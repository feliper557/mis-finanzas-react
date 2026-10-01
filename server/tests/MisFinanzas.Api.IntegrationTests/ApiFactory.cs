using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using MisFinanzas.Api.Auth;
using MisFinanzas.Api.Data;
using Testcontainers.PostgreSql;
using Xunit;

namespace MisFinanzas.Api.IntegrationTests;

/// <summary>
/// Levanta la API contra un PostgreSQL real en contenedor. Igual que en Lactumama, no se usa
/// proveedor en memoria: la mitad de lo que hay que comprobar aqui (claves foraneas
/// compuestas, restricciones CHECK, <c>FOR UPDATE</c>) simplemente no existe fuera de Postgres.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _db = new PostgreSqlBuilder("postgres:17-alpine").Build();

    async Task IAsyncLifetime.InitializeAsync()
    {
        await _db.StartAsync();

        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<FinanzasDbContext>().Database.MigrateAsync();
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _db.DisposeAsync();
    }

    /// <summary>
    /// Cliente autenticado como el uid indicado. La identidad viaja en una cabecera por
    /// peticion, no en estado compartido, para que las pruebas no se interfieran entre si.
    /// </summary>
    public HttpClient ClienteDe(string uid)
    {
        var cliente = CreateClient();
        cliente.DefaultRequestHeaders.Add(EsquemaDePrueba.CabeceraUid, uid);
        return cliente;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        ArgumentNullException.ThrowIfNull(builder);

        builder.UseSetting("ConnectionStrings:Default", _db.GetConnectionString());
        builder.UseSetting("Firebase:ProjectId", "proyecto-de-prueba");
        builder.UseSetting("Database:AutoMigrate", "false");

        // Las excepciones del servidor se recogen aqui: sin esto, un fallo interno solo se ve
        // como un 500 opaco desde la prueba.
        builder.ConfigureLogging(l => l.AddProvider(new CapturaDeErrores()));

        builder.ConfigureTestServices(services =>
        {
            // Se sustituye la validacion del token de Firebase, no la autorizacion: los
            // endpoints siguen exigiendo una identidad y siguen filtrando por ella.
            services.AddAuthentication(EsquemaDePrueba.Nombre)
                .AddScheme<AuthenticationSchemeOptions, EsquemaDePrueba>(EsquemaDePrueba.Nombre, _ => { });

            services.Configure<AuthenticationOptions>(o =>
            {
                o.DefaultAuthenticateScheme = EsquemaDePrueba.Nombre;
                o.DefaultChallengeScheme = EsquemaDePrueba.Nombre;
            });
        });
    }
}

/// <summary>Autenticacion de prueba: toma el uid de una cabecera en vez de validarlo con Google.</summary>
public sealed class EsquemaDePrueba(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string Nombre = "Prueba";

    public const string CabeceraUid = "X-Test-Uid";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(CabeceraUid, out var valores) || valores.Count == 0)
        {
            return AuthenticateResult.NoResult();
        }

        var uid = valores[0]!;
        var identidad = new ClaimsIdentity(
            [new Claim(FirebaseAuthentication.UserIdClaim, uid), new Claim(ClaimTypes.Email, $"{uid}@prueba.test")],
            Nombre,
            FirebaseAuthentication.UserIdClaim,
            ClaimTypes.Role);

        var principal = new ClaimsPrincipal(identidad);

        // El alta de la cuenta la hace normalmente el evento OnTokenValidated del esquema real;
        // aqui se invoca a mano para que la prueba recorra el mismo camino.
        var sincronizador = Context.RequestServices.GetRequiredService<FirebaseUserSynchronizer>();
        await sincronizador.SincronizarAsync(principal, Context.RequestAborted);

        return AuthenticateResult.Success(new AuthenticationTicket(principal, Nombre));
    }
}


/// <summary>Registrador minimo que guarda las excepciones del servidor para las pruebas.</summary>
public sealed class CapturaDeErrores : ILoggerProvider
{
    public static readonly List<string> Errores = [];

    public ILogger CreateLogger(string categoryName) => new Registrador();

    public void Dispose() => GC.SuppressFinalize(this);

    private sealed class Registrador : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= LogLevel.Error;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (logLevel >= LogLevel.Error)
            {
                Errores.Add($"{formatter(state, exception)} :: {exception}");
            }
        }
    }
}
