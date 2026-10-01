using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace MisFinanzas.Api.Common;

/// <summary>
/// Traduce las excepciones de la aplicacion a ProblemDetails (RFC 7807) con la extension
/// <c>code</c>. El cliente reacciona a ese codigo, nunca al texto del mensaje.
/// </summary>
public sealed class DomainExceptionHandler(ILogger<DomainExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(httpContext);

        if (exception is not AppException appException)
        {
            return false;
        }

        var status = appException switch
        {
            RevisionConflictException => StatusCodes.Status409Conflict,
            DocumentoInvalidoException => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status400BadRequest,
        };

        // Un conflicto de revision es funcionamiento normal con dos dispositivos, no un fallo:
        // se registra como informacion para no llenar los registros de ruido.
        if (appException is RevisionConflictException)
        {
            logger.LogInformation("Conflicto de revision: {Mensaje}", appException.Message);
        }
        else
        {
            logger.LogWarning(appException, "Peticion rechazada: {Codigo}", appException.Code);
        }

        var problema = new ProblemDetails
        {
            Status = status,
            Title = appException.Code,
            Detail = appException.Message,
            Extensions = { ["code"] = appException.Code },
        };

        if (appException is RevisionConflictException conflicto)
        {
            problema.Extensions["rev"] = conflicto.RevActual;
        }

        httpContext.Response.StatusCode = status;
        await httpContext.Response.WriteAsJsonAsync(problema, cancellationToken).ConfigureAwait(false);
        return true;
    }
}
