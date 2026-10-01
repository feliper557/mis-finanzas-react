using System.Globalization;

namespace MisFinanzas.Api.Data;

/// <summary>
/// Documento con el que arranca una cuenta nueva. Es la version de servidor de
/// <c>src/lib/starter.ts</c>: antes lo sembraba el cliente al no encontrar el documento en
/// Firestore, pero con una base relacional el alta tiene que ocurrir donde estan las claves
/// foraneas, no en el navegador.
/// </summary>
public static class DocumentoInicial
{
    public static FinanzasBlob Construir(DateOnly hoy) => new()
    {
        V = 3,
        Rev = 0,
        Months = [new MonthBlob { K = hoy.ToString("yyyy-MM", CultureInfo.InvariantCulture), Ing = 0, Proj = false }],
        Cats = [new CategoryBlob { Id = "fijos", Name = "Gastos Fijos", Group = "fijos" }],
        Budget = new Dictionary<string, decimal> { ["fijos"] = 0 },
        InvCats = [new InvCatBlob { Id = "inv", Name = "Inversión" }],
        SavingPots = [new SavingPotBlob { Id = "sp_default", Name = "Mi alcancía" }],
    };
}
