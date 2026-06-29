export interface Tx { id: number; k: string; cat: string; c: string; m: number; pagado: boolean; d?: string }
export interface IncomeSource { fuente: string; m: number }
export interface Month { k: string; ing: number; ingresos?: IncomeSource[]; proj?: boolean }
export type CatGroup = 'fijos' | 'variables' | 'ahorros'
export interface Category { id: string; name: string; group: CatGroup }
export interface InvItem { d: string; c: string; m: number; pend: boolean; vendida?: boolean; gan?: number }
export interface InvCat { id: string; name: string }
export interface InvItemV2 { id: number; cat: string; d: string; c: string; m: number; pend: boolean; gan?: number }
export interface LoanItem { d: string; q: string; c: string; m: number; pagado: boolean }
export interface SavingPot { id: string; name: string }
export interface SavingEntry { id: number; potId: string; nota: string; m: number; d?: string }

export type InvKind = 'nu' | 'hapi' | 'novilla'
export type LoanKind = 'prestamo' | 'deuda'

export interface FinanzasData {
  v: number
  months: Month[]
  cats: Category[]
  budget: Record<string, number>
  tx: Tx[]
  nu: InvItem[]
  hapi: InvItem[]
  novilla: InvItem[]
  invCats?: InvCat[]
  invItems?: InvItemV2[]
  savingPots?: SavingPot[]
  savingEntries?: SavingEntry[]
  prestamo: LoanItem[]
  deuda: LoanItem[]
}
