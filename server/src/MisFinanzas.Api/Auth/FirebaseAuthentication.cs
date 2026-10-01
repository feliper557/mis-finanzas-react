using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

namespace MisFinanzas.Api.Auth;

/// <summary>Configura la validacion de los tokens que emite Firebase Authentication.</summary>
public static class FirebaseAuthentication
{
    /// <summary>Reclamacion en la que Firebase publica el identificador de la cuenta.</summary>
    public const string UserIdClaim = "user_id";

    /// <summary>
    /// Registra el esquema JWT apuntando al emisor de Firebase. No se usa el SDK de administracion
    /// para validar: basta con verificar la firma contra las claves publicas de Google, lo que evita
    /// una dependencia pesada y una llamada de red en cada peticion.
    ///
    /// Es el mismo planteamiento que usa Lactumama en el mismo servidor. Cada API apunta a su
    /// propio proyecto de Firebase, asi que los dos emisores conviven sin interferir.
    /// </summary>
    public static IServiceCollection AddFirebaseAuthentication(
        this IServiceCollection services,
        string projectId)
    {
        ArgumentNullException.ThrowIfNull(services);
        ArgumentException.ThrowIfNullOrWhiteSpace(projectId);

        var issuer = $"https://securetoken.google.com/{projectId}";

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = issuer;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = true,
                    ValidAudience = projectId,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromMinutes(2),
                    NameClaimType = UserIdClaim,
                };

                // El alta de la cuenta ocurre en cuanto la firma se da por buena: asi el primer
                // acceso de un usuario nuevo ya encuentra su fila y el documento inicial sembrado.
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = async context =>
                    {
                        if (context.Principal is null)
                        {
                            return;
                        }

                        var sincronizador = context.HttpContext.RequestServices
                            .GetRequiredService<FirebaseUserSynchronizer>();

                        await sincronizador.SincronizarAsync(
                            context.Principal, context.HttpContext.RequestAborted);
                    },
                };
            });

        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(null);

        return services;
    }

    /// <summary>Lee el uid de Firebase del token ya validado.</summary>
    public static string LeerUid(ClaimsPrincipal principal)
    {
        ArgumentNullException.ThrowIfNull(principal);

        return principal.FindFirstValue(UserIdClaim)
            ?? principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("El token no publica el identificador de la cuenta.");
    }
}
