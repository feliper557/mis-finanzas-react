import type { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  )
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-white/40">
      {children}
    </h3>
  )
}

export function Btn({
  children,
  onClick,
  variant = 'solid',
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'solid' | 'ghost'
  className?: string
  type?: 'button' | 'submit'
}) {
  const base = 'rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-95'
  const v =
    variant === 'solid'
      ? 'bg-violet-500 text-white hover:bg-violet-400'
      : 'border border-white/[0.08] bg-white/[0.06] text-white/80 hover:bg-white/[0.10]'
  return (
    <button type={type} onClick={onClick} className={`${base} ${v} ${className}`}>
      {children}
    </button>
  )
}

export function Bar({ pct, color = 'bg-violet-400' }: { pct: number; color?: string }) {
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center gap-2 text-base font-bold text-white/90">
      {children}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  )
}

export function Pill({ children, tone = 'cat' }: { children: ReactNode; tone?: 'cat' | 'pos' | 'neg' }) {
  const t =
    tone === 'pos'
      ? 'bg-emerald-500/15 text-emerald-400'
      : tone === 'neg'
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-white/[0.06] text-white/50'
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t}`}>{children}</span>
}
