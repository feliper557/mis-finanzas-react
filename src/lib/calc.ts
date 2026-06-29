import type { CatGroup, FinanzasData } from '../types'

export const fmt = (n: number) => '$' + Math.round(n || 0).toLocaleString('es-CO')

const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
export const monthLabel = (k: string) => {
  const [y, m] = k.split('-')
  return `${MES[+m - 1]} ${y}`
}

export const PALETTE = ['#5aa9ff', '#3ddc97', '#ffb454', '#b9a6ff', '#ff6b6b', '#4dd0e1', '#f06292', '#aed581']
export const catName = (d: FinanzasData, id: string) => d.cats.find((c) => c.id === id)?.name ?? id
export const catColor = (d: FinanzasData, id: string) =>
  PALETTE[Math.max(0, d.cats.findIndex((c) => c.id === id)) % PALETTE.length]

export const txOf = (d: FinanzasData, k: string) => d.tx.filter((t) => t.k === k)
export const mTotal = (d: FinanzasData, k: string) => txOf(d, k).reduce((s, t) => s + t.m, 0)
export const mPagado = (d: FinanzasData, k: string) =>
  txOf(d, k).filter((t) => t.pagado).reduce((s, t) => s + t.m, 0)
export const mPendiente = (d: FinanzasData, k: string) =>
  txOf(d, k).filter((t) => !t.pagado).reduce((s, t) => s + t.m, 0)
export const savingTotalMonth = (d: FinanzasData, k: string) =>
  (d.savingEntries ?? []).filter((e) => e.d?.startsWith(k) && e.m > 0).reduce((s, e) => s + e.m, 0)
export const spentCat = (d: FinanzasData, k: string, cat: string) =>
  d.tx.filter((t) => t.k === k && t.cat === cat).reduce((s, t) => s + t.m, 0)
export const budgetTotal = (d: FinanzasData) => d.cats.reduce((s, c) => s + (d.budget[c.id] || 0), 0)

export const invTotal = (d: FinanzasData) =>
  d.nu.filter((x) => !x.pend).reduce((s, x) => s + x.m, 0) +
  d.hapi.filter((x) => !x.pend).reduce((s, x) => s + x.m, 0) +
  d.novilla.filter((x) => !x.pend && !x.vendida).reduce((s, x) => s + x.m, 0)

export const invPend = (d: FinanzasData) =>
  (['nu', 'hapi', 'novilla'] as const).reduce(
    (s, t) => s + d[t].filter((x) => x.pend).reduce((a, x) => a + x.m, 0),
    0,
  )

export const pendiente = (d: FinanzasData, t: 'prestamo' | 'deuda') =>
  d[t].filter((x) => !x.pagado).reduce((s, x) => s + x.m, 0)

export const nextTxId = (d: FinanzasData) => Math.max(0, ...d.tx.map((t) => t.id || 0)) + 1
export const groupCats = (d: FinanzasData, g: CatGroup) => d.cats.filter((c) => c.group === g)
export const mTotalGroup = (d: FinanzasData, k: string, g: CatGroup) => {
  const ids = new Set(groupCats(d, g).map((c) => c.id))
  return d.tx.filter((t) => t.k === k && ids.has(t.cat)).reduce((s, t) => s + t.m, 0)
}

// Investment v2 (dynamic categories)
export const invTotalV2 = (d: FinanzasData) =>
  (d.invItems ?? []).filter((x) => !x.pend).reduce((s, x) => s + x.m, 0)
export const invPendV2 = (d: FinanzasData) =>
  (d.invItems ?? []).filter((x) => x.pend).reduce((s, x) => s + x.m, 0)
export const invGanV2 = (d: FinanzasData) =>
  (d.invItems ?? []).reduce((s, x) => s + (x.gan ?? 0), 0)
export const nextInvId = (d: FinanzasData) =>
  Math.max(0, ...(d.invItems ?? []).map((x) => x.id)) + 1
export const invCatColor = (d: FinanzasData, id: string) =>
  PALETTE[Math.max(0, (d.invCats ?? []).findIndex((c) => c.id === id)) % PALETTE.length]

// Savings
export const savingTotal = (d: FinanzasData) =>
  (d.savingEntries ?? []).reduce((s, e) => s + e.m, 0)
export const savingPotTotal = (d: FinanzasData, potId: string) =>
  (d.savingEntries ?? []).filter((e) => e.potId === potId).reduce((s, e) => s + e.m, 0)
export const nextSavingId = (d: FinanzasData) =>
  Math.max(0, ...(d.savingEntries ?? []).map((e) => e.id)) + 1
