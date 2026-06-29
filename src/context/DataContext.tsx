import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'
import { buildStarter } from '../lib/starter'
import type { FinanzasData, InvItem } from '../types'

interface DataCtx {
  data: FinanzasData
  curMes: string
  setCurMes: (k: string) => void
  mutate: (fn: (d: FinanzasData) => void) => void
}

const Ctx = createContext<DataCtx | null>(null)

function normalize(d: FinanzasData): FinanzasData {
  const base = buildStarter()
  if (d.cats == null) d.cats = base.cats
  if (d.budget == null) d.budget = base.budget
  ;(['months', 'tx', 'nu', 'hapi', 'novilla', 'prestamo', 'deuda'] as const).forEach((k) => {
    const rec = d as unknown as Record<string, unknown>
    if (!Array.isArray(rec[k])) rec[k] = []
  })
  if (!d.months.length) d.months = base.months

  // Migrate cats without group field
  d.cats.forEach((c) => { if (!c.group) c.group = 'fijos' })

  // Migrate legacy investment arrays to dynamic invCats + invItems
  if (!d.invCats) {
    d.invCats = [{ id: 'inv', name: 'Inversión' }]
    let nextId = 1
    const migrateOld = (arr: InvItem[], cat: string) =>
      arr.map((x) => ({ id: nextId++, cat, d: x.d, c: x.c, m: x.m, pend: x.pend, gan: x.gan ?? 0 }))
    d.invItems = [
      ...migrateOld(d.nu ?? [], 'nu_legacy'),
      ...migrateOld(d.hapi ?? [], 'hapi_legacy'),
      ...migrateOld(d.novilla ?? [], 'novilla_legacy'),
    ]
    if ((d.nu ?? []).length) d.invCats.push({ id: 'nu_legacy', name: 'NU / Ganado' })
    if ((d.hapi ?? []).length) d.invCats.push({ id: 'hapi_legacy', name: 'ETFs (Hapi)' })
    if ((d.novilla ?? []).length) d.invCats.push({ id: 'novilla_legacy', name: 'Novillas' })
    d.nu = []; d.hapi = []; d.novilla = []
  }
  if (!Array.isArray(d.invItems)) d.invItems = []
  if (!d.invCats.length) d.invCats = [{ id: 'inv', name: 'Inversión' }]

  if (!d.savingPots) d.savingPots = [{ id: 'sp_default', name: 'Mi alcancía' }]
  if (!Array.isArray(d.savingEntries)) d.savingEntries = []

  return d
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<FinanzasData | null>(null)
  const [curMes, setCurMes] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) { setData(null); return }
    let alive = true
    ;(async () => {
      const ref = doc(db, 'users', user.uid)
      const snap = await getDoc(ref)
      let d: FinanzasData
      if (snap.exists()) d = normalize(snap.data() as FinanzasData)
      else { d = buildStarter(); await setDoc(ref, d) }
      if (!alive) return
      setData(d)
      setCurMes(d.months[d.months.length - 1].k)
    })()
    return () => { alive = false }
  }, [user])

  const persist = useCallback(
    (next: FinanzasData) => {
      if (!user) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        setDoc(doc(db, 'users', user.uid), next).catch(console.error)
      }, 500)
    },
    [user],
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

  if (!data)
    return (
      <div className="grid min-h-screen place-items-center text-white/40 text-sm">
        Cargando tus datos…
      </div>
    )

  return (
    <Ctx.Provider
      value={{ data, curMes: curMes || data.months[data.months.length - 1].k, setCurMes, mutate }}
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
