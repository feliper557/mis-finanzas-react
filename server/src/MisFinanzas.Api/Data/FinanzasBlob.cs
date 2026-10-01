using System.Text.Json.Serialization;

namespace MisFinanzas.Api.Data;

// Contrato exacto con el cliente. Los nombres cortos (k, ing, cat, c, m, d...) no son un
// descuido: son los que ya usaba el documento de Firestore y los que leen los cinco tabs de
// la SPA. Cambiarlos obligaria a tocar ~1.800 lineas de formularios sin ganar nada, asi que
// la API habla el mismo dialecto y la forma relacional queda del lado del servidor.
//
// Las fechas viajan como cadena "YYYY-MM-DD" en vez de DateOnly para que el viaje de ida y
// vuelta sea literal: lo que entra es exactamente lo que sale.

/// <summary>Documento completo de finanzas de un usuario, la unidad que intercambia la API.</summary>
public sealed record FinanzasBlob
{
    [JsonPropertyName("v")]
    public int V { get; init; } = 3;

    /// <summary>
    /// Revision del servidor. El cliente la devuelve en cada <c>PUT</c> y un desajuste provoca
    /// un 409: es lo que impide que dos dispositivos se pisen como ocurria con Firestore.
    /// </summary>
    [JsonPropertyName("rev")]
    public int Rev { get; init; }

    [JsonPropertyName("months")]
    public List<MonthBlob> Months { get; init; } = [];

    [JsonPropertyName("cats")]
    public List<CategoryBlob> Cats { get; init; } = [];

    [JsonPropertyName("budget")]
    public Dictionary<string, decimal> Budget { get; init; } = [];

    [JsonPropertyName("tx")]
    public List<TxBlob> Tx { get; init; } = [];

    [JsonPropertyName("invCats")]
    public List<InvCatBlob> InvCats { get; init; } = [];

    [JsonPropertyName("invItems")]
    public List<InvItemBlob> InvItems { get; init; } = [];

    [JsonPropertyName("savingPots")]
    public List<SavingPotBlob> SavingPots { get; init; } = [];

    [JsonPropertyName("savingEntries")]
    public List<SavingEntryBlob> SavingEntries { get; init; } = [];

    [JsonPropertyName("prestamo")]
    public List<LoanBlob> Prestamo { get; init; } = [];

    [JsonPropertyName("deuda")]
    public List<LoanBlob> Deuda { get; init; } = [];
}

public sealed record MonthBlob
{
    [JsonPropertyName("k")]
    public required string K { get; init; }

    [JsonPropertyName("ing")]
    public decimal Ing { get; init; }

    /// <summary>Se omite si el mes no trae desglose; tres meses reales estan en ese caso.</summary>
    [JsonPropertyName("ingresos")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public List<IncomeSourceBlob>? Ingresos { get; init; }

    [JsonPropertyName("proj")]
    public bool Proj { get; init; }
}

public sealed record IncomeSourceBlob
{
    [JsonPropertyName("fuente")]
    public required string Fuente { get; init; }

    [JsonPropertyName("m")]
    public decimal M { get; init; }
}

public sealed record CategoryBlob
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }

    [JsonPropertyName("group")]
    public required string Group { get; init; }
}

public sealed record TxBlob
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("k")]
    public required string K { get; init; }

    [JsonPropertyName("cat")]
    public required string Cat { get; init; }

    [JsonPropertyName("c")]
    public required string C { get; init; }

    [JsonPropertyName("m")]
    public decimal M { get; init; }

    [JsonPropertyName("pagado")]
    public bool Pagado { get; init; }

    [JsonPropertyName("d")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? D { get; init; }
}

public sealed record InvCatBlob
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }
}

public sealed record InvItemBlob
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("cat")]
    public required string Cat { get; init; }

    [JsonPropertyName("c")]
    public required string C { get; init; }

    [JsonPropertyName("m")]
    public decimal M { get; init; }

    [JsonPropertyName("pend")]
    public bool Pend { get; init; }

    [JsonPropertyName("gan")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public decimal? Gan { get; init; }

    [JsonPropertyName("d")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? D { get; init; }
}

public sealed record SavingPotBlob
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("name")]
    public required string Name { get; init; }
}

public sealed record SavingEntryBlob
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("potId")]
    public required string PotId { get; init; }

    [JsonPropertyName("nota")]
    public required string Nota { get; init; }

    /// <summary>Negativo = retiro.</summary>
    [JsonPropertyName("m")]
    public decimal M { get; init; }

    [JsonPropertyName("d")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? D { get; init; }
}

public sealed record LoanBlob
{
    [JsonPropertyName("id")]
    public required string Id { get; init; }

    [JsonPropertyName("q")]
    public required string Q { get; init; }

    [JsonPropertyName("c")]
    public required string C { get; init; }

    [JsonPropertyName("m")]
    public decimal M { get; init; }

    [JsonPropertyName("pagado")]
    public bool Pagado { get; init; }

    [JsonPropertyName("d")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? D { get; init; }
}
