import { auth } from '../firebase'

/**
 * Cliente HTTP de la API.
 *
 * En producción la SPA y la API comparten origen detrás de nginx (`/api/` se redirige al
 * contenedor de la API), así que CORS no interviene. En desarrollo `VITE_API_URL` apunta al
 * backend levantado aparte.
 */
const BASE = import.meta.env.VITE_API_URL ?? ''

/** Error de la API que conserva el código estable del ProblemDetails. */
export class ApiError extends Error {
  readonly status: number
  /** Código estable (`revision_conflict`, `documento_invalido`…). Nunca leer el mensaje. */
  readonly code: string
  /** Revisión vigente en el servidor, presente en los conflictos. */
  readonly rev?: number

  constructor(status: number, code: string, message: string, rev?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.rev = rev
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new ApiError(401, 'sin_sesion', 'No hay sesión iniciada.')

  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${await user.getIdToken()}`,
      ...init?.headers,
    },
  })

  if (!res.ok) {
    // La API devuelve ProblemDetails; si algo se cae antes (nginx, red) el cuerpo no es JSON.
    const problema = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      problema?.code ?? 'error_desconocido',
      problema?.detail ?? `La petición falló con estado ${res.status}.`,
      problema?.rev,
    )
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
}
