namespace MisFinanzas.Api.Common;

/// <summary>
/// Excepcion con un codigo estable que el cliente puede interpretar. El texto es para las
/// personas; el <see cref="Code"/> es para el codigo, que nunca debe leer mensajes.
/// </summary>
public abstract class AppException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>
/// El documento que llega viene de una revision anterior a la almacenada: otro dispositivo
/// escribio primero. Es la correccion del "ultimo que escribe gana" que tenia Firestore, donde
/// esta misma situacion borraba datos en silencio.
/// </summary>
public sealed class RevisionConflictException(int revEnviada, int revActual)
    : AppException(
        "revision_conflict",
        $"El documento cambio en otro dispositivo (enviada {revEnviada}, actual {revActual}).")
{
    public int RevEnviada { get; } = revEnviada;

    public int RevActual { get; } = revActual;
}

/// <summary>El documento recibido no es coherente consigo mismo.</summary>
public sealed class DocumentoInvalidoException(string detalle)
    : AppException("documento_invalido", detalle);
