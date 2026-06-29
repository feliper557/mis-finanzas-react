import type { ReactNode } from 'react'

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-auto rounded-t-3xl border-t border-white/[0.10] bg-[#161820] p-5 pb-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`mt-3 block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-white/50">{label}</span>
      {children}
    </label>
  )
}

export const inputCls =
  'w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-[15px] text-white/90 outline-none placeholder:text-white/30 focus:border-violet-500 focus:bg-white/[0.08] transition'
