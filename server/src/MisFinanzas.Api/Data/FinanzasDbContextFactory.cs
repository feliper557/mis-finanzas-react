using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace MisFinanzas.Api.Data;

/// <summary>
/// Solo la usa <c>dotnet-ef</c> al generar migraciones. La cadena de conexion no se lee de la
/// configuracion a proposito: crear una migracion no debe requerir una base en marcha ni las
/// credenciales de produccion.
/// </summary>
public sealed class FinanzasDbContextFactory : IDesignTimeDbContextFactory<FinanzasDbContext>
{
    public FinanzasDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<FinanzasDbContext>()
            .UseNpgsql("Host=localhost;Database=misfinanzas;Username=postgres;Password=postgres")
            .UseSnakeCaseNamingConvention()
            .Options;

        return new FinanzasDbContext(options);
    }
}
