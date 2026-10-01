using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using MisFinanzas.Api.Auth;
using MisFinanzas.Api.Common;
using MisFinanzas.Api.Data;
using MisFinanzas.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

var firebaseProjectId = builder.Configuration["Firebase:ProjectId"]
    ?? throw new InvalidOperationException("Falta la configuracion 'Firebase:ProjectId'.");

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Falta la cadena de conexion 'ConnectionStrings:Default'.");

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];

builder.Services.AddDbContext<FinanzasDbContext>(options => options
    .UseNpgsql(connectionString, npgsql => npgsql
        .EnableRetryOnFailure(maxRetryCount: 5, maxRetryDelay: TimeSpan.FromSeconds(10), null))
    .UseSnakeCaseNamingConvention());

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<FirebaseUserSynchronizer>();
builder.Services.AddScoped<ClaimsPrincipalAccessor>();
builder.Services.AddFirebaseAuthentication(firebaseProjectId);

// En produccion la SPA y la API comparten origen detras de nginx, asi que CORS no interviene.
// Esta politica solo sirve para levantar el frontend aparte con "npm run dev".
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddExceptionHandler<DomainExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // El cliente omite los campos opcionales ausentes (d, ingresos, gan) en vez de mandarlos
    // como null, igual que hacia el documento de Firestore.
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

var app = builder.Build();

if (builder.Configuration.GetValue("Database:AutoMigrate", false))
{
    // Desactivado por defecto a proposito. En Cloud Run el servicio escala a cero y puede
    // levantar varias instancias a la vez, asi que migrar al arrancar las pondria a competir
    // sobre el mismo esquema. Las migraciones las aplica el pipeline antes de desplegar la
    // revision nueva. Esta rama queda para desarrollo local.
    using var scope = app.Services.CreateScope();
    await scope.ServiceProvider.GetRequiredService<FinanzasDbContext>().Database.MigrateAsync();
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Text("Healthy")).AllowAnonymous().ExcludeFromDescription();
app.MapDataEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

await app.RunAsync();

/// <summary>Punto de entrada expuesto para las pruebas de integracion con <c>WebApplicationFactory</c>.</summary>
public partial class Program;
