export type TabId = 'resumen' | 'gastos' | 'inv' | 'pres' | 'tend'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'resumen', label: 'Resumen',     icon: '⊞' },
  { id: 'gastos',  label: 'Presupuesto', icon: '▤' },
  { id: 'inv',     label: 'Inversión',   icon: '◎' },
  { id: 'pres',    label: 'Préstamos',   icon: '⇄' },
  { id: 'tend',    label: 'Tendencias',  icon: '↗' },
]

export function Nav({ current, onChange }: { current: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="fixed inset-x-3 bottom-4 z-30 flex items-center rounded-2xl border border-white/[0.08] bg-[#161820]/90 px-1 py-1 backdrop-blur-md">
      {TABS.map((t) => {
        const active = current === t.id
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[9px] font-semibold transition ${
              active
                ? 'bg-violet-500/20 text-violet-400'
                : 'text-white/35 hover:text-white/60'
            }`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
