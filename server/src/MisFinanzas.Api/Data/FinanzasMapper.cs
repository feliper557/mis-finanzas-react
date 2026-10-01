using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace MisFinanzas.Api.Data;

/// <summary>
/// Traduce entre el almacenamiento relacional y el documento que espera el cliente.
///
/// Es la pieza que permite guardar en tablas de verdad sin reescribir los cinco tabs de la SPA:
/// por dentro hay claves foraneas e indices; por fuera la API sigue entregando y aceptando el
/// mismo documento que devolvia Firestore.
///
/// El mismo codigo lo usa el importador, de modo que la carga inicial y el funcionamiento
/// diario no pueden divergir.
/// </summary>
public static class FinanzasMapper
{
    private const string FormatoFecha = "yyyy-MM-dd";

    /// <summary>Carga todo lo del usuario y lo ensambla en el documento que espera el cliente.</summary>
    public static async Task<FinanzasBlob> LeerAsync(
        FinanzasDbContext db,
        string userId,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(db);

        var usuario = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == userId, cancellationToken)
            .ConfigureAwait(false);

        var meses = await db.Months.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.K)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var ingresos = await db.IncomeSources.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var categorias = await db.Categories.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var presupuestos = await db.Budgets.AsNoTracking()
            .Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var gastos = await db.Transactions.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var invCats = await db.InvCategories.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var invItems = await db.InvItems.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var alcancias = await db.SavingPots.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var apuntes = await db.SavingEntries.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var prestamos = await db.Loans.AsNoTracking()
            .Where(x => x.UserId == userId).OrderBy(x => x.Orden)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        var ingresosPorMes = ingresos.GroupBy(x => x.MonthK)
            .ToDictionary(g => g.Key, g => g.OrderBy(x => x.Orden).ToList());

        return new FinanzasBlob
        {
            V = 3,
            Rev = usuario?.Rev ?? 0,
            Months = [.. meses.Select(m => new MonthBlob
            {
                K = m.K,
                Ing = m.Ing,
                Proj = m.Proj,
                Ingresos = m.TieneIngresos
                    ? [.. (ingresosPorMes.TryGetValue(m.K, out var lista) ? lista : [])
                        .Select(i => new IncomeSourceBlob { Fuente = i.Fuente, M = i.M })]
                    : null,
            })],
            Cats = [.. categorias.Select(c => new CategoryBlob { Id = c.Id, Name = c.Name, Group = c.Grp })],
            Budget = presupuestos.ToDictionary(b => b.CategoryId, b => b.Amount),
            Tx = [.. gastos.Select(t => new TxBlob
            {
                Id = t.Id,
                K = t.MonthK,
                Cat = t.CategoryId,
                C = t.Concepto,
                M = t.Monto,
                Pagado = t.Pagado,
                D = Formatear(t.Fecha),
            })],
            InvCats = [.. invCats.Select(c => new InvCatBlob { Id = c.Id, Name = c.Name })],
            InvItems = [.. invItems.Select(i => new InvItemBlob
            {
                Id = i.Id,
                Cat = i.InvCategoryId,
                C = i.Concepto,
                M = i.Monto,
                Pend = i.Pend,
                Gan = i.Gan,
                D = Formatear(i.Fecha),
            })],
            SavingPots = [.. alcancias.Select(p => new SavingPotBlob { Id = p.Id, Name = p.Name })],
            SavingEntries = [.. apuntes.Select(e => new SavingEntryBlob
            {
                Id = e.Id,
                PotId = e.PotId,
                Nota = e.Nota,
                M = e.Monto,
                D = Formatear(e.Fecha),
            })],
            Prestamo = [.. prestamos.Where(l => l.Kind == "prestamo").Select(ADto)],
            Deuda = [.. prestamos.Where(l => l.Kind == "deuda").Select(ADto)],
        };
    }

    /// <summary>
    /// Vuelca el documento sobre las tablas del usuario dentro de la transaccion del llamante.
    ///
    /// Sincroniza por diferencias en vez de borrar y reinsertar: lo que ya existe se actualiza,
    /// lo que sobra se elimina. Asi las claves foraneas nunca quedan colgando a mitad de la
    /// operacion y el historial de filas se mantiene estable.
    ///
    /// El orden de las operaciones es deliberado: primero se dan de alta los catalogos
    /// (meses, categorias, alcancias) y al final se borran, para no dejar huerfanos en medio.
    /// </summary>
    public static async Task EscribirAsync(
        FinanzasDbContext db,
        string userId,
        FinanzasBlob blob,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(blob);

        // --- Catalogos: primero altas y modificaciones ------------------------------------
        var meses = await db.Months.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.K, cancellationToken).ConfigureAwait(false);
        foreach (var m in blob.Months)
        {
            if (!meses.TryGetValue(m.K, out var fila))
            {
                fila = new Month { UserId = userId, K = m.K };
                db.Months.Add(fila);
                meses[m.K] = fila;
            }

            fila.Ing = m.Ing;
            fila.Proj = m.Proj;
            fila.TieneIngresos = m.Ingresos is not null;
        }

        var categorias = await db.Categories.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        Sincronizar(
            blob.Cats,
            categorias,
            c => c.Id,
            c => new Category { UserId = userId, Id = c.Id, Name = c.Name, Grp = c.Group },
            (c, fila) => { fila.Name = c.Name; fila.Grp = c.Group; },
            db.Categories);

        var invCats = await db.InvCategories.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        Sincronizar(
            blob.InvCats,
            invCats,
            c => c.Id,
            c => new InvCategory { UserId = userId, Id = c.Id, Name = c.Name },
            (c, fila) => fila.Name = c.Name,
            db.InvCategories);

        var alcancias = await db.SavingPots.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        Sincronizar(
            blob.SavingPots,
            alcancias,
            p => p.Id,
            p => new SavingPot { UserId = userId, Id = p.Id, Name = p.Name },
            (p, fila) => fila.Name = p.Name,
            db.SavingPots);

        // --- Hojas -------------------------------------------------------------------------
        var gastos = await db.Transactions.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        Sincronizar(
            blob.Tx,
            gastos,
            t => t.Id,
            t => new Transaction
            {
                UserId = userId,
                Id = t.Id,
                MonthK = t.K,
                CategoryId = t.Cat,
                Concepto = t.C,
                Monto = t.M,
                Pagado = t.Pagado,
                Fecha = Parsear(t.D),
            },
            (t, fila) =>
            {
                fila.MonthK = t.K;
                fila.CategoryId = t.Cat;
                fila.Concepto = t.C;
                fila.Monto = t.M;
                fila.Pagado = t.Pagado;
                fila.Fecha = Parsear(t.D);
            },
            db.Transactions);

        var invItems = await db.InvItems.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        Sincronizar(
            blob.InvItems,
            invItems,
            i => i.Id,
            i => new InvItem
            {
                UserId = userId,
                Id = i.Id,
                InvCategoryId = i.Cat,
                Concepto = i.C,
                Monto = i.M,
                Pend = i.Pend,
                Gan = i.Gan,
                Fecha = Parsear(i.D),
            },
            (i, fila) =>
            {
                fila.InvCategoryId = i.Cat;
                fila.Concepto = i.C;
                fila.Monto = i.M;
                fila.Pend = i.Pend;
                fila.Gan = i.Gan;
                fila.Fecha = Parsear(i.D);
            },
            db.InvItems);

        var apuntes = await db.SavingEntries.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        Sincronizar(
            blob.SavingEntries,
            apuntes,
            e => e.Id,
            e => new SavingEntry
            {
                UserId = userId,
                Id = e.Id,
                PotId = e.PotId,
                Nota = e.Nota,
                Monto = e.M,
                Fecha = Parsear(e.D),
            },
            (e, fila) =>
            {
                fila.PotId = e.PotId;
                fila.Nota = e.Nota;
                fila.Monto = e.M;
                fila.Fecha = Parsear(e.D);
            },
            db.SavingEntries);

        // Prestamos y deudas comparten tabla; se concatenan conservando el orden de cada lista.
        var creditos = blob.Prestamo.Select(l => (Kind: "prestamo", Loan: l))
            .Concat(blob.Deuda.Select(l => (Kind: "deuda", Loan: l)))
            .ToList();
        var creditosFila = await db.Loans.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.Id, cancellationToken).ConfigureAwait(false);
        Sincronizar(
            creditos,
            creditosFila,
            x => x.Loan.Id,
            x => new Loan
            {
                UserId = userId,
                Id = x.Loan.Id,
                Kind = x.Kind,
                Quien = x.Loan.Q,
                Concepto = x.Loan.C,
                Monto = x.Loan.M,
                Pagado = x.Loan.Pagado,
                Fecha = Parsear(x.Loan.D),
            },
            (x, fila) =>
            {
                fila.Kind = x.Kind;
                fila.Quien = x.Loan.Q;
                fila.Concepto = x.Loan.C;
                fila.Monto = x.Loan.M;
                fila.Pagado = x.Loan.Pagado;
                fila.Fecha = Parsear(x.Loan.D);
            },
            db.Loans);

        // Los presupuestos son un diccionario, no un array: no llevan orden.
        var presupuestos = await db.Budgets.Where(x => x.UserId == userId)
            .ToDictionaryAsync(x => x.CategoryId, cancellationToken).ConfigureAwait(false);
        foreach (var (catId, importe) in blob.Budget)
        {
            if (presupuestos.TryGetValue(catId, out var fila))
            {
                fila.Amount = importe;
            }
            else
            {
                db.Budgets.Add(new Budget { UserId = userId, CategoryId = catId, Amount = importe });
            }
        }

        db.Budgets.RemoveRange(presupuestos
            .Where(kv => !blob.Budget.ContainsKey(kv.Key))
            .Select(kv => kv.Value));

        // Las fuentes de ingreso no tienen identificador propio en el cliente, asi que se
        // reemplazan en bloque por mes. Son un punado de filas: no compensa diferenciarlas.
        var ingresosViejos = await db.IncomeSources.Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken).ConfigureAwait(false);
        db.IncomeSources.RemoveRange(ingresosViejos);
        foreach (var m in blob.Months.Where(m => m.Ingresos is not null))
        {
            var orden = 0;
            foreach (var i in m.Ingresos!)
            {
                db.IncomeSources.Add(new IncomeSource
                {
                    UserId = userId,
                    MonthK = m.K,
                    Orden = orden++,
                    Fuente = i.Fuente,
                    M = i.M,
                });
            }
        }

        // --- Catalogos: las bajas van al final, ya sin nadie apuntando a ellos -------------
        var mesesVivos = blob.Months.Select(m => m.K).ToHashSet(StringComparer.Ordinal);
        db.Months.RemoveRange(meses.Where(kv => !mesesVivos.Contains(kv.Key)).Select(kv => kv.Value));
    }

    /// <summary>
    /// Alta, modificacion y baja de una coleccion, asignando <c>Orden</c> segun la posicion en
    /// el array recibido. El orden se reescribe siempre porque no se puede deducir del
    /// identificador: en los datos reales los <c>invItems</c> llegan como 11, 9, 1, 2...
    /// </summary>
    private static void Sincronizar<TDto, TEntidad>(
        IReadOnlyList<TDto> entrada,
        Dictionary<string, TEntidad> existentes,
        Func<TDto, string> clave,
        Func<TDto, TEntidad> crear,
        Action<TDto, TEntidad> actualizar,
        DbSet<TEntidad> conjunto)
        where TEntidad : class
    {
        var vivos = new HashSet<string>(StringComparer.Ordinal);

        for (var i = 0; i < entrada.Count; i++)
        {
            var dto = entrada[i];
            var id = clave(dto);
            vivos.Add(id);

            if (existentes.TryGetValue(id, out var fila))
            {
                actualizar(dto, fila);
            }
            else
            {
                fila = crear(dto);
                conjunto.Add(fila);
                existentes[id] = fila;
            }

            EstablecerOrden(fila, i);
        }

        conjunto.RemoveRange(existentes.Where(kv => !vivos.Contains(kv.Key)).Select(kv => kv.Value));
    }

    private static void EstablecerOrden(object fila, int orden)
    {
        switch (fila)
        {
            case Category x: x.Orden = orden; break;
            case Transaction x: x.Orden = orden; break;
            case InvCategory x: x.Orden = orden; break;
            case InvItem x: x.Orden = orden; break;
            case SavingPot x: x.Orden = orden; break;
            case SavingEntry x: x.Orden = orden; break;
            case Loan x: x.Orden = orden; break;
            default: throw new InvalidOperationException($"Tipo sin orden: {fila.GetType().Name}");
        }
    }

    private static LoanBlob ADto(Loan l) => new()
    {
        Id = l.Id,
        Q = l.Quien,
        C = l.Concepto,
        M = l.Monto,
        Pagado = l.Pagado,
        D = Formatear(l.Fecha),
    };

    private static string? Formatear(DateOnly? fecha) =>
        fecha?.ToString(FormatoFecha, CultureInfo.InvariantCulture);

    private static DateOnly? Parsear(string? fecha) =>
        string.IsNullOrWhiteSpace(fecha)
            ? null
            : DateOnly.TryParseExact(fecha, FormatoFecha, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                ? d
                : null;
}
