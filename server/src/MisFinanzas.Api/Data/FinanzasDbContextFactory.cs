using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MisFinanzas.Api.Data;

/// <summary>
/// La usa <c>dotnet-ef</c> al generar migraciones y al aplicarlas.
///
/// Toma la cadena de <c>ConnectionStrings__Default</c> si esta definida, y si no cae a una
/// local. Asi crear una migracion no exige tener credenciales delante, pero el flujo de
/// despliegue puede aplicarlas contra la base real exportando esa variable.
/// </summary>
public sealed class FinanzasDbContextFactory : IDesignTimeDbContextFactory<FinanzasDbContext>
{
    private const string CadenaLocal = "Host=localhost;Port=5433;Database=misfinanzas;Username=misfinanzas;Password=misfinanzas";

    public FinanzasDbContext CreateDbContext(string[] args)
    {
        var cadena = Environment.GetEnvironmentVariable("ConnectionStrings__Default") ?? CadenaLocal;

        var options = new DbContextOptionsBuilder<FinanzasDbContext>()
            .UseNpgsql(cadena)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new FinanzasDbContext(options);
    }
}
