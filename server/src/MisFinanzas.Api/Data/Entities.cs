namespace MisFinanzas.Api.Data;

// Todas las entidades comparten la misma forma de clave: (UserId, Id), donde Id es la cadena
// opaca que genera el cliente. Conservarla en lugar de asignar un UUID propio del servidor
// hace que el viaje de ida y vuelta blob -> tablas -> blob sea exacto, y permite que el
// importador compare campo a campo contra el volcado original sin tablas de equivalencia.
//
// El identificador ya no colisiona entre dispositivos porque el cliente lo genera con
// crypto.randomUUID() en vez del antiguo Math.max(...) + 1.

/// <summary>Cuenta de Firebase. El identificador es el uid del token, no un autonumerico.</summary>
public class User
{
    public required string Id { get; set; }

    public string? Email { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Contador de revision para la deteccion de escrituras concurrentes.</summary>
    public int Rev { get; set; }
}

/// <summary>Mes presupuestado. La clave natural es el <c>k</c> con formato <c>YYYY-MM</c>.</summary>
public class Month
{
    public required string UserId { get; set; }

    public required string K { get; set; }

    public decimal Ing { get; set; }

    public bool Proj { get; set; }

    /// <summary>
    /// Distingue "el mes no trae desglose" de "el desglose esta vacio": en los datos reales hay
    /// meses sin el array <c>ingresos</c>, y al reconstruir el blob hay que devolverlos sin el campo.
    /// </summary>
    public bool TieneIngresos { get; set; }

    public List<IncomeSource> Ingresos { get; } = [];
}

/// <summary>Una fuente de ingreso dentro de un mes. No tiene identificador en el cliente.</summary>
public class IncomeSource
{
    public int Id { get; set; }

    public required string UserId { get; set; }

    public required string MonthK { get; set; }

    /// <summary>Posicion en el array original: el cliente los muestra en orden de captura.</summary>
    public int Orden { get; set; }

    public required string Fuente { get; set; }

    public decimal M { get; set; }
}

/// <summary>Categoria de gasto. El <c>Id</c> es el que usan <c>tx.cat</c> y las claves de <c>budget</c>.</summary>
public class Category
{
    public required string UserId { get; set; }

    public required string Id { get; set; }

    /// <summary>Posicion en el array del cliente. Ver la nota en <see cref="Transaction.Orden"/>.</summary>
    public int Orden { get; set; }

    public required string Name { get; set; }

    /// <summary>Uno de <c>fijos</c>, <c>variables</c> o <c>ahorros</c>.</summary>
    public required string Grp { get; set; }

    public Budget? Budget { get; set; }
}

/// <summary>Sobre asignado a una categoria. Relacion uno a uno con <see cref="Category"/>.</summary>
public class Budget
{
    public required string UserId { get; set; }

    public required string CategoryId { get; set; }

    public decimal Amount { get; set; }
}

/// <summary>Gasto de un mes concreto.</summary>
public class Transaction
{
    public required string UserId { get; set; }

    public required string Id { get; set; }

    /// <summary>
    /// Posicion en el array del cliente. Se conserva de forma explicita porque el orden real no
    /// es deducible del identificador: en los datos reales los <c>invItems</c> vienen como
    /// 11, 9, 1, 2... El cliente los pinta en ese orden y hay que devolverselo igual.
    /// </summary>
    public int Orden { get; set; }

    public required string MonthK { get; set; }

    public required string CategoryId { get; set; }

    public required string Concepto { get; set; }

    public decimal Monto { get; set; }

    public bool Pagado { get; set; }

    /// <summary>Opcional: 33 de las 229 transacciones reales no tienen fecha.</summary>
    public DateOnly? Fecha { get; set; }
}

/// <summary>Categoria de inversion.</summary>
public class InvCategory
{
    public required string UserId { get; set; }

    public required string Id { get; set; }

    /// <summary>Posicion en el array del cliente. Ver la nota en <see cref="Transaction.Orden"/>.</summary>
    public int Orden { get; set; }

    public required string Name { get; set; }
}

/// <summary>Posicion de inversion.</summary>
public class InvItem
{
    public required string UserId { get; set; }

    public required string Id { get; set; }

    /// <summary>Posicion en el array del cliente. Ver la nota en <see cref="Transaction.Orden"/>.</summary>
    public int Orden { get; set; }

    public required string InvCategoryId { get; set; }

    public required string Concepto { get; set; }

    public decimal Monto { get; set; }

    public bool Pend { get; set; }

    public decimal? Gan { get; set; }

    public DateOnly? Fecha { get; set; }
}

/// <summary>Alcancia de ahorro.</summary>
public class SavingPot
{
    public required string UserId { get; set; }

    public required string Id { get; set; }

    /// <summary>Posicion en el array del cliente. Ver la nota en <see cref="Transaction.Orden"/>.</summary>
    public int Orden { get; set; }

    public required string Name { get; set; }
}

/// <summary>
/// Movimiento de una alcancia. Un <see cref="Monto"/> <b>negativo</b> es un retiro: asi lo
/// registra <c>RetiroForm</c> en el cliente, y hay tres en los datos reales. No poner una
/// restriccion de positividad sobre esta columna.
/// </summary>
public class SavingEntry
{
    public required string UserId { get; set; }

    public required string Id { get; set; }

    /// <summary>Posicion en el array del cliente. Ver la nota en <see cref="Transaction.Orden"/>.</summary>
    public int Orden { get; set; }

    public required string PotId { get; set; }

    public required string Nota { get; set; }

    public decimal Monto { get; set; }

    public DateOnly? Fecha { get; set; }
}

/// <summary>Prestamo concedido (<c>prestamo</c>) o deuda contraida (<c>deuda</c>).</summary>
public class Loan
{
    public required string UserId { get; set; }

    public required string Id { get; set; }

    /// <summary>Posicion en el array del cliente. Ver la nota en <see cref="Transaction.Orden"/>.</summary>
    public int Orden { get; set; }

    /// <summary><c>prestamo</c> o <c>deuda</c>.</summary>
    public required string Kind { get; set; }

    public required string Quien { get; set; }

    public required string Concepto { get; set; }

    public decimal Monto { get; set; }

    public bool Pagado { get; set; }

    public DateOnly? Fecha { get; set; }
}
