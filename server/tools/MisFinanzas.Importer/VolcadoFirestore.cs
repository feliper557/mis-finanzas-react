using System.Globalization;
using System.Text.Json.Nodes;
using MisFinanzas.Api.Data;

namespace MisFinanzas.Importer;

/// <summary>
/// Lee el volcado que produce <c>bk/dump.js</c> y lo convierte al documento que entiende la API.
///
/// El JSON de Firestore no encaja directamente con <see cref="FinanzasBlob"/> por dos motivos:
/// los identificadores de <c>tx</c>, <c>invItems</c> y <c>savingEntries</c> son numeros enteros
/// (el viejo <c>Math.max(...) + 1</c>) y no cadenas, y los documentos antiguos pueden traer los
/// arrays heredados <c>nu</c> / <c>hapi</c> / <c>novilla</c> en lugar de <c>invCats</c>.
///
/// Aqui se reproduce exactamente la funcion <c>normalize()</c> que hoy vive en
/// <c>src/context/DataContext.tsx</c>. Es la ultima vez que se ejecuta esa logica: despues de
/// la importacion se borra del cliente, porque el servidor ya garantiza la forma del documento.
/// </summary>
public static class VolcadoFirestore
{
    /// <summary>Un documento del volcado, con el uid al que pertenece.</summary>
    public sealed record Documento(string Uid, FinanzasBlob Blob);

    public static List<Documento> Leer(string ruta)
    {
        var raiz = JsonNode.Parse(File.ReadAllText(ruta))
            ?? throw new InvalidOperationException($"El volcado '{ruta}' esta vacio.");

        var documentos = raiz.AsArray();
        var resultado = new List<Documento>();

        foreach (var nodo in documentos)
        {
            if (nodo is not JsonObject doc)
            {
                continue;
            }

            var path = Texto(doc["_path"]) ?? string.Empty;

            // El volcado recorre todas las colecciones; solo interesan los documentos de usuario.
            if (!path.StartsWith("users/", StringComparison.Ordinal))
            {
                continue;
            }

            var uid = Texto(doc["_id"])
                ?? throw new InvalidOperationException($"Documento sin '_id' en '{path}'.");

            resultado.Add(new Documento(uid, Normalizar(doc)));
        }

        return resultado;
    }

    private static FinanzasBlob Normalizar(JsonObject doc)
    {
        var cats = Lista(doc["cats"]).Select(c => new CategoryBlob
        {
            Id = Obligatorio(c["id"], "cats.id"),
            Name = Texto(c["name"]) ?? string.Empty,

            // Migracion de categorias anteriores al campo de grupo.
            Group = Texto(c["group"]) is { Length: > 0 } g ? g : "fijos",
        }).ToList();

        var meses = Lista(doc["months"]).Select(m => new MonthBlob
        {
            K = Obligatorio(m["k"], "months.k"),
            Ing = Numero(m["ing"]) ?? 0,
            Proj = Booleano(m["proj"]) ?? false,

            // Se distingue "sin desglose" de "desglose vacio": hay meses reales sin el campo.
            Ingresos = m["ingresos"] is JsonArray ingresos
                ? [.. ingresos.Select(i => new IncomeSourceBlob
                {
                    Fuente = Texto(i?["fuente"]) ?? string.Empty,
                    M = Numero(i?["m"]) ?? 0,
                })]
                : null,
        }).ToList();

        var (invCats, invItems) = MigrarInversiones(doc);

        var alcancias = Lista(doc["savingPots"]).Select(p => new SavingPotBlob
        {
            Id = Obligatorio(p["id"], "savingPots.id"),
            Name = Texto(p["name"]) ?? string.Empty,
        }).ToList();

        if (alcancias.Count == 0)
        {
            alcancias.Add(new SavingPotBlob { Id = "sp_default", Name = "Mi alcancía" });
        }

        return new FinanzasBlob
        {
            V = 3,
            Rev = 0,
            Months = meses,
            Cats = cats,
            Budget = doc["budget"] is JsonObject presupuesto
                ? presupuesto.ToDictionary(kv => kv.Key, kv => Numero(kv.Value) ?? 0, StringComparer.Ordinal)
                : [],
            Tx = [.. Lista(doc["tx"]).Select(t => new TxBlob
            {
                Id = Obligatorio(t["id"], "tx.id"),
                K = Obligatorio(t["k"], "tx.k"),
                Cat = Obligatorio(t["cat"], "tx.cat"),
                C = Texto(t["c"]) ?? string.Empty,
                M = Numero(t["m"]) ?? 0,
                Pagado = Booleano(t["pagado"]) ?? false,
                D = Fecha(t["d"]),
            })],
            InvCats = invCats,
            InvItems = invItems,
            SavingPots = alcancias,
            SavingEntries = [.. Lista(doc["savingEntries"]).Select(e => new SavingEntryBlob
            {
                Id = Obligatorio(e["id"], "savingEntries.id"),
                PotId = Obligatorio(e["potId"], "savingEntries.potId"),
                Nota = Texto(e["nota"]) ?? string.Empty,

                // Un importe negativo es un retiro. Se conserva tal cual.
                M = Numero(e["m"]) ?? 0,
                D = Fecha(e["d"]),
            })],
            Prestamo = [.. Lista(doc["prestamo"]).Select(ALoan)],
            Deuda = [.. Lista(doc["deuda"]).Select(ALoan)],
        };
    }

    /// <summary>
    /// Fusiona los arrays heredados <c>nu</c> / <c>hapi</c> / <c>novilla</c> en el modelo actual
    /// de categorias dinamicas, igual que hacia <c>normalize()</c>. En el volcado del 29-09-2026
    /// los tres estan vacios en los tres usuarios, asi que esta rama es una red de seguridad
    /// para volcados mas antiguos, no el camino habitual.
    /// </summary>
    private static (List<InvCatBlob> Cats, List<InvItemBlob> Items) MigrarInversiones(JsonObject doc)
    {
        var items = Lista(doc["invItems"]).Select(i => new InvItemBlob
        {
            Id = Obligatorio(i["id"], "invItems.id"),
            Cat = Obligatorio(i["cat"], "invItems.cat"),
            C = Texto(i["c"]) ?? string.Empty,
            M = Numero(i["m"]) ?? 0,
            Pend = Booleano(i["pend"]) ?? false,
            Gan = Numero(i["gan"]),
            D = Fecha(i["d"]),
        }).ToList();

        var cats = Lista(doc["invCats"]).Select(c => new InvCatBlob
        {
            Id = Obligatorio(c["id"], "invCats.id"),
            Name = Texto(c["name"]) ?? string.Empty,
        }).ToList();

        if (doc["invCats"] is null)
        {
            cats = [new InvCatBlob { Id = "inv", Name = "Inversión" }];

            var siguienteId = 1;
            foreach (var (campo, catId, nombre) in new[]
                     {
                         ("nu", "nu_legacy", "NU / Ganado"),
                         ("hapi", "hapi_legacy", "ETFs (Hapi)"),
                         ("novilla", "novilla_legacy", "Novillas"),
                     })
            {
                var heredados = Lista(doc[campo]);
                if (heredados.Count == 0)
                {
                    continue;
                }

                cats.Add(new InvCatBlob { Id = catId, Name = nombre });
                items.AddRange(heredados.Select(x => new InvItemBlob
                {
                    Id = (siguienteId++).ToString(CultureInfo.InvariantCulture),
                    Cat = catId,
                    C = Texto(x["c"]) ?? string.Empty,
                    M = Numero(x["m"]) ?? 0,
                    Pend = Booleano(x["pend"]) ?? false,
                    Gan = Numero(x["gan"]) ?? 0,
                    D = Fecha(x["d"]),
                }));
            }
        }

        if (cats.Count == 0)
        {
            cats = [new InvCatBlob { Id = "inv", Name = "Inversión" }];
        }

        return (cats, items);
    }

    private static LoanBlob ALoan(JsonNode? l) => new()
    {
        Id = Obligatorio(l?["id"], "prestamo/deuda.id"),
        Q = Texto(l?["q"]) ?? string.Empty,
        C = Texto(l?["c"]) ?? string.Empty,
        M = Numero(l?["m"]) ?? 0,
        Pagado = Booleano(l?["pagado"]) ?? false,
        D = Fecha(l?["d"]),
    };

    private static List<JsonNode> Lista(JsonNode? nodo) =>
        nodo is JsonArray array ? [.. array.Where(x => x is not null).Select(x => x!)] : [];

    /// <summary>
    /// Convierte a cadena tanto los identificadores numericos heredados como los que ya eran
    /// texto. A partir de aqui el identificador es opaco: el cliente nuevo genera UUID.
    /// </summary>
    private static string? Texto(JsonNode? nodo) => nodo?.GetValueKind() switch
    {
        System.Text.Json.JsonValueKind.String => nodo.GetValue<string>(),
        System.Text.Json.JsonValueKind.Number => nodo.GetValue<decimal>().ToString(CultureInfo.InvariantCulture),
        System.Text.Json.JsonValueKind.True => "true",
        System.Text.Json.JsonValueKind.False => "false",
        _ => null,
    };

    private static string Obligatorio(JsonNode? nodo, string campo) =>
        Texto(nodo) ?? throw new InvalidOperationException($"Falta el campo obligatorio '{campo}'.");

    private static decimal? Numero(JsonNode? nodo) =>
        nodo?.GetValueKind() == System.Text.Json.JsonValueKind.Number ? nodo.GetValue<decimal>() : null;

    private static bool? Booleano(JsonNode? nodo) => nodo?.GetValueKind() switch
    {
        System.Text.Json.JsonValueKind.True => true,
        System.Text.Json.JsonValueKind.False => false,
        _ => null,
    };

    /// <summary>Normaliza la fecha a <c>YYYY-MM-DD</c>, o la descarta si no es interpretable.</summary>
    private static string? Fecha(JsonNode? nodo)
    {
        var texto = nodo?.GetValueKind() == System.Text.Json.JsonValueKind.String
            ? nodo.GetValue<string>()
            : null;

        if (string.IsNullOrWhiteSpace(texto))
        {
            return null;
        }

        return DateOnly.TryParseExact(texto, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
            ? d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
            : null;
    }
}
