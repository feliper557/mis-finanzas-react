namespace MisFinanzas.Api.Auth;

/// <summary>Expone la identidad autenticada a los endpoints sin que estos toquen los claims.</summary>
public sealed class ClaimsPrincipalAccessor(IHttpContextAccessor httpContextAccessor)
{
    /// <summary>Identificador de Firebase de quien realiza la peticion.</summary>
    public string FirebaseUid
    {
        get
        {
            var principal = httpContextAccessor.HttpContext?.User
                ?? throw new InvalidOperationException("No hay una peticion autenticada en curso.");

            return FirebaseAuthentication.LeerUid(principal);
        }
    }
}
