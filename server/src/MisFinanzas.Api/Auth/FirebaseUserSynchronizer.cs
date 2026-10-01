using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using MisFinanzas.Api.Data;

namespace MisFinanzas.Api.Auth;

/// <summary>
/// Da de alta la cuenta en la base local la primera vez que se presenta un token valido.
/// Firestore no necesitaba esto porque el documento se creaba solo al escribir; aqui la fila
/// de <c>users</c> es el ancla de todas las claves foraneas, asi que tiene que existir antes
/// de cualquier escritura.
/// </summary>
public sealed class FirebaseUserSynchronizer(FinanzasDbContext db)
{
    /// <summary>Crea la cuenta si es su primer acceso y mantiene el correo al dia.</summary>
    public async Task SincronizarAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var uid = FirebaseAuthentication.LeerUid(principal);
        var email = principal.FindFirstValue(ClaimTypes.Email) ?? principal.FindFirstValue("email");

        var usuario = await db.Users
            .FirstOrDefaultAsync(x => x.Id == uid, cancellationToken)
            .ConfigureAwait(false);

        if (usuario is null)
        {
            db.Users.Add(new User { Id = uid, Email = email, CreatedAt = DateTimeOffset.UtcNow, Rev = 0 });
        }
        else if (email is not null && usuario.Email != email)
        {
            usuario.Email = email;
        }
        else
        {
            return;
        }

        await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }
}
