using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using MisFinanzas.Api.Data;
using MisFinanzas.Importer;

// Reconstruye la base relacional a partir del volcado de Firestore.
//
// Usa el mismo FinanzasMapper que la API en produccion: la carga inicial y el funcionamiento
// diario comparten codigo, asi que no pueden divergir. Y al terminar vuelve a leer lo escrito
// y lo compara campo a campo contra el origen; si algo no cuadra, falla.

var opciones = Opciones.Parsear(args);
if (opciones is null)
{
    Console.Error.WriteLine("""
        Uso: dotnet run --project tools/MisFinanzas.Importer -- \
               --file <ruta al firestore-backup.json> \
               --connection "<cadena de conexion de PostgreSQL>" \
               [--user <uid>]   importa solo esa cuenta
               [--truncate]     vacia las tablas de cada cuenta antes de importarla
               [--dry-run]      valida y compara sin confirmar la transaccion
        """);
    return 1;
}

var documentos = VolcadoFirestore.Leer(opciones.Archivo);
if (opciones.Uid is not null)
{
    documentos = [.. documentos.Where(d => d.Uid == opciones.Uid)];
}

if (documentos.Count == 0)
{
    Console.Error.WriteLine("El volcado no contiene ningun documento de usuario que importar.");
    return 1;
}

Console.WriteLine($"Documentos a importar: {documentos.Count}");

var dbOptions = new DbContextOptionsBuilder<FinanzasDbContext>()
    .UseNpgsql(opciones.Conexion)
    .UseSnakeCaseNamingConvention()
    .Options;

await using var db = new FinanzasDbContext(dbOptions);
await db.Database.MigrateAsync();

var fallos = 0;

foreach (var (uid, blob) in documentos)
{
    Console.WriteLine();
    Console.WriteLine($"--- {uid} ---");
    Console.WriteLine(
        $"  origen: {blob.Tx.Count} gastos, {blob.Months.Count} meses, {blob.Cats.Count} categorias, " +
        $"{blob.InvItems.Count} inversiones, {blob.SavingEntries.Count} apuntes, " +
        $"{blob.Prestamo.Count + blob.Deuda.Count} prestamos/deudas");

    await using var tx = await db.Database.BeginTransactionAsync();

    var usuario = await db.Users.FirstOrDefaultAsync(x => x.Id == uid);
    if (usuario is null)
    {
        db.Users.Add(new User { Id = uid, CreatedAt = DateTimeOffset.UtcNow, Rev = 0 });
        await db.SaveChangesAsync();
    }

    if (opciones.Truncate)
    {
        // Vaciar antes de importar hace que el proceso sea repetible: se puede ensayar la
        // migracion completa tantas veces como haga falta contra una base desechable.
        await FinanzasMapper.EscribirAsync(db, uid, new FinanzasBlob());
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
    }

    await FinanzasMapper.EscribirAsync(db, uid, blob);
    await db.SaveChangesAsync();
    db.ChangeTracker.Clear();

    var leido = await FinanzasMapper.LeerAsync(db, uid);
    var diferencias = Comparador.Comparar(blob, leido);

    if (diferencias.Count == 0)
    {
        Console.WriteLine("  verificacion: OK, el documento reconstruido es identico al de origen.");
    }
    else
    {
        fallos++;
        Console.Error.WriteLine($"  VERIFICACION FALLIDA ({diferencias.Count} diferencias):");
        foreach (var d in diferencias.Take(25))
        {
            Console.Error.WriteLine($"    {d}");
        }

        if (diferencias.Count > 25)
        {
            Console.Error.WriteLine($"    ... y {diferencias.Count - 25} mas");
        }
    }

    if (opciones.DryRun || diferencias.Count > 0)
    {
        await tx.RollbackAsync();
        Console.WriteLine(opciones.DryRun ? "  ensayo: cambios descartados." : "  cambios descartados por el fallo.");
    }
    else
    {
        await tx.CommitAsync();
        Console.WriteLine("  confirmado.");
    }

    db.ChangeTracker.Clear();
}

Console.WriteLine();
if (fallos > 0)
{
    Console.Error.WriteLine($"Terminado con {fallos} documento(s) fallido(s). No se importo nada de esos usuarios.");
    return 1;
}

Console.WriteLine(opciones.DryRun
    ? "Ensayo completado sin diferencias. Repite sin --dry-run para confirmar."
    : "Importacion completada y verificada.");
return 0;

/// <summary>Argumentos de linea de comandos del importador.</summary>
internal sealed record Opciones(string Archivo, string Conexion, string? Uid, bool Truncate, bool DryRun)
{
    public static Opciones? Parsear(string[] args)
    {
        string? archivo = null;
        string? conexion = null;
        string? uid = null;
        var truncate = false;
        var dryRun = false;

        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--file" when i + 1 < args.Length: archivo = args[++i]; break;
                case "--connection" when i + 1 < args.Length: conexion = args[++i]; break;
                case "--user" when i + 1 < args.Length: uid = args[++i]; break;
                case "--truncate": truncate = true; break;
                case "--dry-run": dryRun = true; break;
                default: return null;
            }
        }

        if (archivo is null || conexion is null || !File.Exists(archivo))
        {
            return null;
        }

        return new Opciones(archivo, conexion, uid, truncate, dryRun);
    }
}

/// <summary>
/// Compara el documento de origen con el que devuelve la base despues de escribirlo.
///
/// La comparacion es exhaustiva, no muestral: se serializan ambos a JSON canonico (con las
/// claves del diccionario de presupuestos ordenadas, que es lo unico sin orden natural) y se
/// contrastan propiedad a propiedad. Con ~270 filas en total no hay motivo para conformarse
/// con menos.
/// </summary>
internal static class Comparador
{
    public static List<string> Comparar(FinanzasBlob origen, FinanzasBlob leido)
    {
        // La revision la asigna el servidor, no viene del volcado.
        var a = Canonico(origen with { Rev = 0 });
        var b = Canonico(leido with { Rev = 0 });

        var diferencias = new List<string>();
        Recorrer("$", a, b, diferencias);
        return diferencias;
    }

    private static JsonNode Canonico(FinanzasBlob blob)
    {
        var nodo = JsonSerializer.SerializeToNode(blob, new JsonSerializerOptions
        {
            DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        })!;

        if (nodo["budget"] is JsonObject presupuesto)
        {
            var ordenado = new JsonObject();
            foreach (var clave in presupuesto.Select(kv => kv.Key).OrderBy(k => k, StringComparer.Ordinal))
            {
                ordenado[clave] = presupuesto[clave]?.DeepClone();
            }

            nodo["budget"] = ordenado;
        }

        return nodo;
    }

    private static void Recorrer(string ruta, JsonNode? a, JsonNode? b, List<string> diferencias)
    {
        if (a is JsonObject oa && b is JsonObject ob)
        {
            foreach (var clave in oa.Select(kv => kv.Key).Union(ob.Select(kv => kv.Key), StringComparer.Ordinal))
            {
                Recorrer($"{ruta}.{clave}", oa[clave], ob[clave], diferencias);
            }

            return;
        }

        if (a is JsonArray aa && b is JsonArray ab)
        {
            if (aa.Count != ab.Count)
            {
                diferencias.Add($"{ruta}: origen tiene {aa.Count} elementos, la base {ab.Count}");
                return;
            }

            for (var i = 0; i < aa.Count; i++)
            {
                Recorrer($"{ruta}[{i}]", aa[i], ab[i], diferencias);
            }

            return;
        }

        var ta = Normalizar(a);
        var tb = Normalizar(b);

        if (!string.Equals(ta, tb, StringComparison.Ordinal))
        {
            diferencias.Add($"{ruta}: origen '{ta}' != base '{tb}'");
        }
    }

    /// <summary>
    /// Iguala las representaciones numericas antes de comparar: el volcado trae <c>0</c> donde
    /// la base devuelve <c>0.00</c>, y son el mismo importe.
    /// </summary>
    private static string Normalizar(JsonNode? nodo)
    {
        if (nodo is null)
        {
            return "(ausente)";
        }

        return nodo.GetValueKind() == JsonValueKind.Number
            ? nodo.GetValue<decimal>().ToString("0.##", CultureInfo.InvariantCulture)
            : nodo.ToJsonString();
    }
}
