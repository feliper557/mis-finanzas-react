import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import { useAuth } from './AuthContext'
import type { FinanzasData } from '../types'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

interface DataCtx {
  data: FinanzasData
  curMes: string
  setCurMes: (k: string) => void
  mutate: (fn: (d: FinanzasData) => void) => void
  saveStatus: SaveStatus
}

const Ctx = createContext<DataCtx | null>(null)

/** Cada cuánto se comprueba si otro dispositivo escribió. Sustituye al onSnapshot de Firestore. */
const INTERVALO_SONDEO_MS = 30_000

/** Ventana de agrupación de escrituras, igual que la que tenía la versión con Firestore. */
const DEBOUNCE_MS = 500

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<FinanzasData | null>(null)
  const [curMes, setCurMes] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // La revisión vive en una ref además de en el estado: persist() la lee desde dentro de un
  // temporizador, donde el valor capturado por el closure ya estaría obsoleto.
  const revRef = useRef(0)
  const pendiente = useRef<FinanzasData | null>(null)

  const cargar = useCallback(async () => {
    const d = await api.get<FinanzasData>('/data')
    revRef.current = d.rev
    setData(d)
    setCurMes((actual) => actual || d.months[d.months.length - 1]?.k || '')
    return d
  }, [])

  useEffect(() => {
    if (!user) {
      setData(null)
      setCurMes('')
      return
    }

    let vivo = true
    cargar().catch((e: unknown) => {
      if (!vivo) return
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos.')
    })

    return () => { vivo = false }
  }, [user, cargar])

  const persist = useCallback(
    (next: FinanzasData) => {
      pendiente.current = next
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setSaveStatus('saving')

      saveTimer.current = setTimeout(async () => {
        saveTimer.current = null
        const cuerpo = pendiente.current
        pendiente.current = null
        if (!cuerpo) return

        try {
          const { rev } = await api.put<{ rev: number }>('/data', { ...cuerpo, rev: revRef.current })
          revRef.current = rev
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2000)
        } catch (e) {
          // Un 409 significa que otro dispositivo guardó primero. Antes, con Firestore, esta
          // misma situación sobreescribía el documento entero y se perdían datos en silencio.
          // Ahora se recarga el estado del servidor y se avisa en vez de pisar nada.
          if (e instanceof ApiError && e.code === 'revision_conflict') {
            setSaveStatus('conflict')
            await cargar().catch(() => undefined)
            return
          }
          setSaveStatus('error')
        }
      }, DEBOUNCE_MS)
    },
    [cargar],
  )

  const mutate = useCallback(
    (fn: (d: FinanzasData) => void) => {
      setData((prev) => {
        if (!prev) return prev
        const next = structuredClone(prev)
        fn(next)
        persist(next)
        return next
      })
    },
    [persist],
  )

  // Sondeo de la revisión: barato (devuelve un entero) y suficiente para una app personal.
  // Se comprueba al volver a la pestaña, que es cuando de verdad importa, y cada 30 s.
  useEffect(() => {
    if (!user || !data) return

    const comprobar = async () => {
      // Con una escritura en vuelo el servidor va por detrás: recargar pisaría lo que el
      // usuario acaba de escribir.
      if (saveTimer.current || document.hidden) return

      try {
        const { rev } = await api.get<{ rev: number }>('/data/rev')
        if (rev !== revRef.current) await cargar()
      } catch {
        // Un sondeo fallido no es motivo para molestar: el siguiente lo reintenta.
      }
    }

    const id = setInterval(comprobar, INTERVALO_SONDEO_MS)
    window.addEventListener('focus', comprobar)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', comprobar)
    }
  }, [user, data, cargar])

  if (error && !data)
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center text-sm text-white/40">
        <div>
          <p className="mb-2 text-white/70">No se pudieron cargar tus datos.</p>
          <p className="text-xs">{error}</p>
        </div>
      </div>
    )

  if (!data)
    return (
      <div className="grid min-h-screen place-items-center text-white/40 text-sm">
        Cargando tus datos…
      </div>
    )

  return (
    <Ctx.Provider
      value={{ data, curMes: curMes || data.months[data.months.length - 1]?.k || '', setCurMes, mutate, saveStatus }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useData() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useData debe usarse dentro de <DataProvider>')
  return c
}
