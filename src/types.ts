// Los identificadores son cadenas opacas generadas con crypto.randomUUID(). Antes eran enteros
// calculados con Math.max(...) + 1, lo que hacía que dos dispositivos crearan el mismo id.
export interface Tx { id: string; k: string; cat: string; c: string; m: number; pagado: boolean; d?: string }
export interface IncomeSource { fuente: string; m: number }
export interface Month { k: string; ing: number; ingresos?: IncomeSource[]; proj?: boolean }
export type CatGroup = 'fijos' | 'variables' | 'ahorros'
export interface Category { id: string; name: string; group: CatGroup }
export interface InvCat { id: string; name: string }
export interface InvItemV2 { id: string; cat: string; d: string; c: string; m: number; pend: boolean; gan?: number }
export interface LoanItem { id: string; d: string; q: string; c: string; m: number; pagado: boolean }
export interface SavingPot { id: string; name: string }
export interface SavingEntry { id: string; potId: string; nota: string; m: number; d?: string }

export type LoanKind = 'prestamo' | 'deuda'

export interface FinanzasData {
  v: number
  /** Revisión del servidor. Se devuelve tal cual al guardar; si no coincide, la API responde 409. */
  rev: number
  months: Month[]
  cats: Category[]
  budget: Record<string, number>
  tx: Tx[]
  invCats: InvCat[]
  invItems: InvItemV2[]
  savingPots: SavingPot[]
  savingEntries: SavingEntry[]
  prestamo: LoanItem[]
  deuda: LoanItem[]
}
