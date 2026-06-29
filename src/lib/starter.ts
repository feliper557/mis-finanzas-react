import type { FinanzasData } from '../types'

export function buildStarter(): FinanzasData {
  const k = new Date().toISOString().slice(0, 7)
  return {
    v: 3,
    months: [{ k, ing: 0, proj: false }],
    cats: [
      { id: 'fijos', name: 'Gastos Fijos', group: 'fijos' as const },
    ],
    budget: { fijos: 0 },
    tx: [],
    nu: [], hapi: [], novilla: [],
    invCats: [{ id: 'inv', name: 'Inversión' }],
    invItems: [],
    savingPots: [{ id: 'sp_default', name: 'Mi alcancía' }],
    savingEntries: [],
    prestamo: [], deuda: [],
  }
}

export const DEFAULT_CAT_IDS: string[] = []
