import { useData } from '../context/DataContext'

/**
 * Estado del guardado en la cabecera.
 *
 * Con Firestore no hacía falta: el SDK reintentaba solo y el conflicto entre dispositivos ni
 * siquiera se detectaba (ganaba el último en escribir y el otro perdía sus datos en silencio).
 * Ahora que la API rechaza las escrituras desfasadas con un 409, hay que contarlo.
 */
export function SaveIndicator() {
  const { saveStatus } = useData()

  if (saveStatus === 'idle') return null

  const estilos: Record<Exclude<typeof saveStatus, 'idle'>, { texto: string; clase: string }> = {
    saving: { texto: 'Guardando…', clase: 'text-white/35' },
    saved: { texto: 'Guardado', clase: 'text-emerald-400/70' },
    error: { texto: 'Sin guardar', clase: 'text-red-400' },
    conflict: { texto: 'Actualizado desde otro dispositivo', clase: 'text-amber-400' },
  }

  const { texto, clase } = estilos[saveStatus]

  return (
    <span className={`shrink-0 text-[10px] font-semibold ${clase}`} role="status" aria-live="polite">
      {texto}
    </span>
  )
}
