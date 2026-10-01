using Microsoft.EntityFrameworkCore;
using MisFinanzas.Api.Auth;
using MisFinanzas.Api.Common;
using MisFinanzas.Api.Data;

namespace MisFinanzas.Api.Endpoints;

/// <summary>
/// Los tres endpoints que sustituyen a Firestore. Deliberadamente hablan en documentos
/// completos en lugar de recursos granulares: el cliente esta construido sobre un unico
/// <c>mutate(fn)</c> que muta todo el documento, y respetar ese contrato es lo que permite
/// migrar la persistencia sin reescribir los cinco tabs de la SPA.
/// </summary>
public static class DataEndpoints
{
    public static void MapDataEndpoints(this IEndpointRouteBuilder app)
    {
        ArgumentNullException.ThrowIfNull(app);

        var grupo = app.MapGroup("/api/data").WithTags("Datos").RequireAuthorization();

        grupo.MapGet("/", ObtenerAsync)
            .WithSummary("Devuelve el documento completo del usuario, sembrandolo si es su primer acceso.");

        grupo.MapPut("/", GuardarAsync)
            .WithSummary("Reemplaza el documento del usuario si la revision enviada sigue vigente.");

        grupo.MapGet("/rev", ObtenerRevisionAsync)
            .WithSummary("Devuelve solo la revision actual, para detectar cambios de otro dispositivo.");
    }

    private static async Task<IResult> ObtenerAsync(
        FinanzasDbContext db,
        ClaimsPrincipalAccessor accessor,
        TimeProvider reloj,
        CancellationToken cancellationToken)
    {
        var uid = accessor.FirebaseUid;

        var tieneDatos = await db.Months.AnyAsync(x => x.UserId == uid, cancellationToken)
            .ConfigureAwait(false);

        if (!tieneDatos)
        {
            // Primer acceso: se siembra el documento inicial en la misma transaccion, de modo
            // que la respuesta ya es el estado definitivo y no un vacio que el cliente rellena.
            var inicial = DocumentoInicial.Construir(DateOnly.FromDateTime(reloj.GetUtcNow().UtcDateTime));

            // La conexion reintenta ante fallos transitorios (EnableRetryOnFailure), y esa
            // estrategia exige que las transacciones propias se ejecuten como unidad
            // reintentable. Sin esto, abrir una transaccion a mano lanza al instante.
            await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();

                await using var tx = await db.Database.BeginTransactionAsync(cancellationToken)
                    .ConfigureAwait(false);

                await FinanzasMapper.EscribirAsync(db, uid, inicial, cancellationToken).ConfigureAwait(false);
                await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                await tx.CommitAsync(cancellationToken).ConfigureAwait(false);
            }).ConfigureAwait(false);
        }

        var blob = await FinanzasMapper.LeerAsync(db, uid, cancellationToken).ConfigureAwait(false);
        return Results.Ok(blob);
    }

    private static async Task<IResult> GuardarAsync(
        FinanzasBlob blob,
        FinanzasDbContext db,
        ClaimsPrincipalAccessor accessor,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(blob);

        var uid = accessor.FirebaseUid;

        Validar(blob);

        // Igual que en la lectura: con EnableRetryOnFailure activo, una transaccion propia
        // tiene que envolverse en la estrategia de ejecucion para poder reintentarse entera.
        var revNueva = await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();

            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken)
                .ConfigureAwait(false);

            // El bloqueo de la fila del usuario serializa las escrituras concurrentes del mismo
            // usuario: sin el, dos peticiones podrian leer la misma revision y ambas darla por buena.
            var usuario = await db.Users
                .FromSql($"SELECT * FROM users WHERE id = {uid} FOR UPDATE")
                .FirstOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false)
                ?? throw new DocumentoInvalidoException("La cuenta no existe.");

            if (blob.Rev != usuario.Rev)
            {
                throw new RevisionConflictException(blob.Rev, usuario.Rev);
            }

            await FinanzasMapper.EscribirAsync(db, uid, blob, cancellationToken).ConfigureAwait(false);

            usuario.Rev++;
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            await tx.CommitAsync(cancellationToken).ConfigureAwait(false);

            return usuario.Rev;
        }).ConfigureAwait(false);

        return Results.Ok(new { rev = revNueva });
    }

    private static async Task<IResult> ObtenerRevisionAsync(
        FinanzasDbContext db,
        ClaimsPrincipalAccessor accessor,
        CancellationToken cancellationToken)
    {
        var uid = accessor.FirebaseUid;

        var rev = await db.Users.AsNoTracking()
            .Where(x => x.Id == uid)
            .Select(x => (int?)x.Rev)
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return Results.Ok(new { rev = rev ?? 0 });
    }

    /// <summary>
    /// Comprueba la coherencia interna del documento antes de tocar la base.
    ///
    /// Las claves foraneas ya lo impedirian, pero fallarian con un error de PostgreSQL
    /// incomprensible para quien usa la aplicacion. Validar aqui permite decir exactamente
    /// que referencia esta rota, y ademas detecta los identificadores repetidos, que la base
    /// rechazaria con un mensaje igual de opaco.
    /// </summary>
    private static void Validar(FinanzasBlob blob)
    {
        var meses = blob.Months.Select(m => m.K).ToHashSet(StringComparer.Ordinal);
        var cats = blob.Cats.Select(c => c.Id).ToHashSet(StringComparer.Ordinal);
        var invCats = blob.InvCats.Select(c => c.Id).ToHashSet(StringComparer.Ordinal);
        var pots = blob.SavingPots.Select(p => p.Id).ToHashSet(StringComparer.Ordinal);

        ExigirUnicos(blob.Months.Select(m => m.K), "months");
        ExigirUnicos(blob.Cats.Select(c => c.Id), "cats");
        ExigirUnicos(blob.InvCats.Select(c => c.Id), "invCats");
        ExigirUnicos(blob.SavingPots.Select(p => p.Id), "savingPots");
        ExigirUnicos(blob.Tx.Select(t => t.Id), "tx");
        ExigirUnicos(blob.InvItems.Select(i => i.Id), "invItems");
        ExigirUnicos(blob.SavingEntries.Select(e => e.Id), "savingEntries");
        ExigirUnicos(blob.Prestamo.Concat(blob.Deuda).Select(l => l.Id), "prestamo/deuda");

        foreach (var c in blob.Cats.Where(c => c.Group is not ("fijos" or "variables" or "ahorros")))
        {
            throw new DocumentoInvalidoException($"La categoria '{c.Id}' tiene un grupo invalido: '{c.Group}'.");
        }

        ExigirReferencia(blob.Tx.Select(t => (t.Id, t.K)), meses, "tx", "months");
        ExigirReferencia(blob.Tx.Select(t => (t.Id, t.Cat)), cats, "tx", "cats");
        ExigirReferencia(blob.Budget.Select(b => (b.Key, b.Key)), cats, "budget", "cats");
        ExigirReferencia(blob.InvItems.Select(i => (i.Id, i.Cat)), invCats, "invItems", "invCats");
        ExigirReferencia(blob.SavingEntries.Select(e => (e.Id, e.PotId)), pots, "savingEntries", "savingPots");
    }

    private static void ExigirUnicos(IEnumerable<string> ids, string coleccion)
    {
        var vistos = new HashSet<string>(StringComparer.Ordinal);
        var repetido = ids.FirstOrDefault(id => !vistos.Add(id));

        if (repetido is not null)
        {
            throw new DocumentoInvalidoException($"El identificador '{repetido}' esta repetido en '{coleccion}'.");
        }
    }

    private static void ExigirReferencia(
        IEnumerable<(string Id, string Referencia)> elementos,
        HashSet<string> validos,
        string coleccion,
        string destino)
    {
        foreach (var (id, referencia) in elementos)
        {
            if (!validos.Contains(referencia))
            {
                throw new DocumentoInvalidoException(
                    $"'{coleccion}' (id '{id}') apunta a '{referencia}', que no existe en '{destino}'.");
            }
        }
    }
}
