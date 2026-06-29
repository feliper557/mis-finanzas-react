import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Nav } from './Nav'
import type { TabId } from './Nav'
import { Resumen } from '../tabs/Resumen'
import { Presupuestos } from '../tabs/Presupuestos'
import { Inversiones } from '../tabs/Inversiones'
import { Prestamos } from '../tabs/Prestamos'
import { Tendencias } from '../tabs/Tendencias'

export function Layout() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState<TabId>('resumen')

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-[#0F1117]/80 px-4 py-3 backdrop-blur-md">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold leading-tight">Mis Finanzas</h1>
          <p className="truncate text-[10px] text-white/35">{user?.email}</p>
        </div>
        <button
          onClick={() => logout()}
          className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 transition hover:bg-white/[0.08] active:scale-95"
        >
          Salir
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-3.5 py-4">
        {tab === 'resumen' && <Resumen />}
        {tab === 'gastos'  && <Presupuestos />}
        {tab === 'inv'     && <Inversiones />}
        {tab === 'pres'    && <Prestamos />}
        {tab === 'tend'    && <Tendencias />}
      </main>

      <Nav current={tab} onChange={setTab} />
    </div>
  )
}
