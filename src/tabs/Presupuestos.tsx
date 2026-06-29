import { useState } from 'react'
import { useData } from '../context/DataContext'
import { Card, H3, Bar, Btn, SectionTitle } from '../components/ui'
import { Sheet, Field, inputCls } from '../components/Sheet'
import { fmt, monthLabel, mTotal, mPagado, mPendiente, mTotalGroup, spentCat, catColor, nextTxId, groupCats, savingPotTotal, savingTotalMonth, nextSavingId } from '../lib/calc'
import type { CatGroup, Tx } from '../types'

const GROUPS: { id: CatGroup; label: string; color: string }[] = [
  { id: 'fijos', label: 'Gastos Fijos', color: 'text-blue-400' },
  { id: 'variables', label: 'Gastos Variables', color: 'text-amber-400' },
  { id: 'ahorros', label: 'Ahorros', color: 'text-emerald-400' },
]

type SheetState =
  | { k: 'tx'; tx?: Tx; cat?: string }
  | { k: 'budget'; catId: string }
  | { k: 'newcat'; group: CatGroup }
  | { k: 'ingreso' }
  | { k: 'mes' }
  | null

export function Presupuestos() {
  const { data, curMes, setCurMes } = useData()
  const [openEnv, setOpenEnv] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<CatGroup>('fijos')
  const [sheet, setSheet] = useState<SheetState>(null)

  const tot = mTotal(data, curMes)
  const pagado = mPagado(data, curMes)
  const pendiente = mPendiente(data, curMes)
  const ahorroMes = savingTotalMonth(data, curMes)
  const m = data.months.find((x) => x.k === curMes)!
  const disponible = m.ing - tot - ahorroMes

  const cats = groupCats(data, activeGroup)

  return (
    <div>
      {/* Selector de mes */}
      <div className="flex items-end gap-2.5">
        <label className="flex-1">
          <span className="mb-1 block text-xs text-white/40">Mes</span>
          <select
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-white/90 outline-none focus:border-violet-500 transition"
            value={curMes}
            onChange={(e) => setCurMes(e.target.value)}
          >
            {data.months.map((mm) => (
              <option key={mm.k} value={mm.k} className="bg-[#161820]">
                {monthLabel(mm.k)}
              </option>
            ))}
          </select>
        </label>
        <Btn variant="ghost" className="text-sm" onClick={() => setSheet({ k: 'mes' })}>+ Mes</Btn>
      </div>

      {/* Cards resumen global */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Card>
          <div className="flex items-start justify-between">
            <H3>Ingresos</H3>
            <button
              onClick={() => setSheet({ k: 'ingreso' })}
              className="text-violet-400 hover:text-violet-300 transition text-base leading-none"
              title="Editar ingresos"
            >
              ✏️
            </button>
          </div>
          <div className="text-xl font-bold text-emerald-400">{fmt(m.ing)}</div>
        </Card>
        <Card className={disponible >= 0 ? 'border-l-2 border-emerald-500' : 'border-l-2 border-rose-500'}>
          <H3>Disponible</H3>
          <div className={`text-xl font-bold ${disponible >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmt(disponible)}
          </div>
          {ahorroMes > 0 && (
            <p className="mt-0.5 text-[10px] text-white/30">incl. {fmt(ahorroMes)} ahorrado</p>
          )}
        </Card>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Card className="py-2.5">
          <H3>Total gastos</H3>
          <div className="text-sm font-bold text-rose-400">{fmt(tot)}</div>
        </Card>
        <Card className="py-2.5">
          <H3>Pagado</H3>
          <div className="text-sm font-bold text-emerald-400">{fmt(pagado)}</div>
        </Card>
        <Card className="py-2.5">
          <H3>Por pagar</H3>
          <div className="text-sm font-bold text-amber-400">{fmt(pendiente)}</div>
        </Card>
      </div>

      {/* Pills de grupo */}
      <div className="mt-4 grid grid-cols-3 gap-1.5 rounded-2xl bg-white/[0.04] p-1.5">
        {GROUPS.map((g) => {
          const gTotal = g.id === 'ahorros' ? savingTotalMonth(data, curMes) : mTotalGroup(data, curMes, g.id)
          return (
            <button
              key={g.id}
              onClick={() => { setActiveGroup(g.id); setOpenEnv(null) }}
              className={`flex flex-col items-center rounded-xl px-2 py-2 text-[11px] font-semibold transition ${
                activeGroup === g.id
                  ? 'bg-[#1e2130] text-white shadow-sm'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <span className={activeGroup === g.id ? g.color : ''}>{g.label}</span>
              <span className={`text-[10px] font-normal mt-0.5 ${activeGroup === g.id ? 'text-white/50' : 'text-white/25'}`}>
                {fmt(gTotal)}
              </span>
            </button>
          )
        })}
      </div>

      {activeGroup === 'ahorros' ? (
        <AhorrosPanel />
      ) : (
        <>
          <SectionTitle action={
            <Btn variant="ghost" className="text-sm" onClick={() => setSheet({ k: 'newcat', group: activeGroup })}>
              + categoría
            </Btn>
          }>
            {GROUPS.find((g) => g.id === activeGroup)?.label}
          </SectionTitle>

          {cats.length === 0 && (
            <p className="py-3 text-sm text-white/40">
              No hay categorías en este grupo.{' '}
              <button
                className="text-violet-400 underline"
                onClick={() => setSheet({ k: 'newcat', group: activeGroup })}
              >
                Agregar una
              </button>
            </p>
          )}

          {cats.map((cat) => {
            const b = data.budget[cat.id] || 0
            const g = spentCat(data, curMes, cat.id)
            const r = b - g
            const pct = b ? Math.min(100, (g / b) * 100) : 0
            const over = b > 0 && g > b
            const barColor = over ? 'bg-rose-400' : b > 0 && g / b > 0.85 ? 'bg-amber-400' : 'bg-violet-400'
            const open = openEnv === cat.id
            const items = data.tx.filter((t) => t.k === curMes && t.cat === cat.id)
            return (
              <Card key={cat.id} className="mb-2.5">
                <div
                  className="flex cursor-pointer items-center gap-2.5"
                  onClick={() => setOpenEnv(open ? null : cat.id)}
                >
                  <span className="h-3 w-3 shrink-0 rounded" style={{ background: catColor(data, cat.id) }} />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{cat.name}</div>
                    <div className="text-xs text-white/40">
                      {b ? `${fmt(g)} de ${fmt(b)}` : `${fmt(g)} gastado · sin tope`}
                    </div>
                  </div>
                  <div className="text-right text-[13px] font-bold">
                    {b
                      ? r >= 0
                        ? <span className="text-emerald-400">Quedan {fmt(r)}</span>
                        : <span className="text-rose-400">Excedido {fmt(-r)}</span>
                      : <span className="text-xs text-white/30">sin tope</span>}
                  </div>
                </div>
                {b > 0 && <Bar pct={pct} color={barColor} />}
                {open && (
                  <div className="mt-2.5 border-t-2 border-dashed border-violet-500/30 pt-1.5">
                    {items.length
                      ? items.map((t) => (
                        <ExpenseRow key={t.id} tx={t} onEdit={() => setSheet({ k: 'tx', tx: t })} />
                      ))
                      : <p className="py-2 text-sm text-white/40">Sin gastos aún. Toca &ldquo;+ Gasto&rdquo;.</p>}
                    <div className="mt-2.5 flex gap-2.5">
                      <Btn className="flex-1" onClick={() => setSheet({ k: 'tx', cat: cat.id })}>+ Gasto</Btn>
                      <Btn variant="ghost" onClick={() => setSheet({ k: 'budget', catId: cat.id })}>Editar</Btn>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          <p className="mt-2 text-[11.5px] leading-relaxed text-white/30">
            Toca una categoría para ver o agregar sus gastos.
          </p>

          <button
            onClick={() => setSheet({ k: 'tx' })}
            className="fixed bottom-[88px] right-4 z-20 grid h-14 w-14 place-items-center rounded-full bg-violet-500 text-3xl font-light text-white shadow-[0_8px_24px_-4px_rgba(139,92,246,0.6)] active:scale-95 transition"
          >
            +
          </button>
        </>
      )}

      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet?.k === 'tx' && <TxForm key={sheet.tx?.id ?? 'new'} tx={sheet.tx} cat={sheet.cat} onClose={() => setSheet(null)} />}
        {sheet?.k === 'budget' && <BudgetForm key={sheet.catId} catId={sheet.catId} onClose={() => setSheet(null)} />}
        {sheet?.k === 'newcat' && <NewCatForm group={sheet.group} onClose={() => setSheet(null)} />}
        {sheet?.k === 'ingreso' && <IngresoForm onClose={() => setSheet(null)} />}
        {sheet?.k === 'mes' && <MesForm onClose={() => setSheet(null)} />}
      </Sheet>
    </div>
  )
}

function ExpenseRow({ tx, onEdit }: { tx: Tx; onEdit: () => void }) {
  const { mutate } = useData()
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-0">
      <button
        onClick={() => mutate((d) => { const x = d.tx.find((z) => z.id === tx.id); if (x) x.pagado = !x.pagado })}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-sm transition ${
          tx.pagado
            ? 'border-violet-400 bg-violet-500/20 text-violet-400'
            : 'border-white/20 text-transparent'
        }`}
      >
        ✓
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <div className={`truncate font-semibold ${tx.pagado ? 'text-white/30 line-through' : ''}`}>{tx.c}</div>
        <div className="text-xs text-white/40">
          {tx.d ? tx.d.slice(5).replace('-', '/') + ' · ' : ''}{tx.pagado ? 'pagado' : 'pendiente'}
        </div>
      </button>
      <div className="font-bold">{fmt(tx.m)}</div>
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

function TxForm({ tx, cat, onClose }: { tx?: Tx; cat?: string; onClose: () => void }) {
  const { data, curMes, mutate } = useData()
  const editing = !!tx
  const [d, setD] = useState(tx?.d ?? today())
  const [c, setC] = useState(tx?.c ?? '')
  const [m, setM] = useState(String(tx?.m ?? ''))
  const [cId, setCId] = useState(tx?.cat ?? cat ?? data.cats[0]?.id ?? '')
  const [pag, setPag] = useState(tx?.pagado ?? false)

  const guardar = () => {
    const obj = { d, c: c.trim() || '(sin nombre)', m: Number(m) || 0, cat: cId, pagado: pag }
    mutate((data2) => {
      if (editing) { const t = data2.tx.find((x) => x.id === tx!.id); if (t) Object.assign(t, obj) }
      else data2.tx.push({ id: nextTxId(data2), k: curMes, ...obj })
    })
    onClose()
  }
  const borrar = () => { mutate((data2) => { data2.tx = data2.tx.filter((x) => x.id !== tx!.id) }); onClose() }

  return (
    <div>
      <h2 className="text-lg font-bold">{editing ? 'Editar gasto' : 'Nuevo gasto'}</h2>
      <Field label="Fecha">
        <input className={inputCls} type="date" value={d} onChange={(e) => setD(e.target.value)} />
      </Field>
      <Field label="Descripción">
        <input className={inputCls} value={c} onChange={(e) => setC(e.target.value)} placeholder="Ej: Mercado, Gasolina, Netflix" />
      </Field>
      <div className="flex gap-2.5">
        <Field label="Monto">
          <input className={inputCls} type="number" value={m} onChange={(e) => setM(e.target.value)} />
        </Field>
        <Field label="Categoría">
          <select className={inputCls} value={cId} onChange={(e) => setCId(e.target.value)}>
            {GROUPS.map((g) => {
              const gCats = data.cats.filter((x) => x.group === g.id)
              if (!gCats.length) return null
              return (
                <optgroup key={g.id} label={g.label}>
                  {gCats.map((x) => <option key={x.id} value={x.id} className="bg-[#161820]">{x.name}</option>)}
                </optgroup>
              )
            })}
          </select>
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={pag} onChange={(e) => setPag(e.target.checked)} />
        Ya está pagado
      </label>
      <div className="mt-4 flex gap-2.5">
        <Btn className="flex-1" onClick={guardar}>Guardar</Btn>
        {editing && <Btn variant="ghost" onClick={borrar}>Eliminar</Btn>}
      </div>
    </div>
  )
}

function BudgetForm({ catId, onClose }: { catId: string; onClose: () => void }) {
  const { data, mutate } = useData()
  const cat = data.cats.find((c) => c.id === catId)!
  const isLast = data.cats.length <= 1
  const [name, setName] = useState(cat.name)
  const [b, setB] = useState(String(data.budget[catId] ?? 0))

  const guardar = () => {
    mutate((d) => {
      const cc = d.cats.find((x) => x.id === catId)
      if (cc) cc.name = name.trim() || '(sin nombre)'
      d.budget[catId] = Number(b) || 0
    })
    onClose()
  }
  const borrar = () => {
    const fallback = data.cats.find((x) => x.id !== catId)?.id ?? ''
    mutate((d) => {
      d.tx.forEach((t) => { if (t.cat === catId) t.cat = fallback })
      d.cats = d.cats.filter((x) => x.id !== catId)
      delete d.budget[catId]
    })
    onClose()
  }

  return (
    <div>
      <h2 className="text-lg font-bold">Categoría</h2>
      <p className="mb-2 text-xs text-white/40">
        {GROUPS.find((g) => g.id === cat.group)?.label}
      </p>
      <Field label="Nombre">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Tope mensual (opcional)">
        <input className={inputCls} type="number" value={b} onChange={(e) => setB(e.target.value)} />
      </Field>
      <p className="mt-2 text-[11.5px] text-white/30">Deja en 0 si no quieres un tope fijo.</p>
      <div className="mt-4 flex gap-2.5">
        <Btn className="flex-1" onClick={guardar}>Guardar</Btn>
        <Btn
          variant="ghost"
          onClick={borrar}
          className={isLast ? 'opacity-30 pointer-events-none' : ''}
        >
          Eliminar
        </Btn>
      </div>
      {isLast && <p className="mt-2 text-[11px] text-white/30">Debe haber al menos una categoría.</p>}
    </div>
  )
}

function NewCatForm({ group, onClose }: { group: CatGroup; onClose: () => void }) {
  const { mutate } = useData()
  const [name, setName] = useState('')
  const [b, setB] = useState('0')
  const crear = () => {
    const n = name.trim()
    if (!n) return
    mutate((d) => {
      const id = 'c' + Date.now()
      d.cats.push({ id, name: n, group })
      d.budget[id] = Number(b) || 0
    })
    onClose()
  }
  const groupLabel = GROUPS.find((g) => g.id === group)?.label ?? group
  return (
    <div>
      <h2 className="text-lg font-bold">Nuevo presupuesto</h2>
      <p className="mb-2 text-xs text-white/40">Grupo: {groupLabel}</p>
      <Field label="Nombre">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Tarjeta, Arriendo, Gasolina" />
      </Field>
      <Field label="Tope mensual">
        <input className={inputCls} type="number" value={b} onChange={(e) => setB(e.target.value)} />
      </Field>
      <p className="mt-2 text-[11.5px] text-white/30">Luego agregas gastos que se van descontando del tope.</p>
      <Btn className="mt-4 w-full" onClick={crear}>Crear categoría</Btn>
    </div>
  )
}

function IngresoForm({ onClose }: { onClose: () => void }) {
  const { data, curMes, mutate } = useData()
  const m = data.months.find((x) => x.k === curMes)!
  type Source = { fuente: string; m: string }
  const init: Source[] = m.ingresos?.map((s) => ({ fuente: s.fuente, m: String(s.m) })) ??
    (m.ing > 0 ? [{ fuente: '', m: String(m.ing) }] : [])
  const [sources, setSources] = useState<Source[]>(init.length ? init : [{ fuente: '', m: '' }])

  const update = (i: number, field: 'fuente' | 'm', val: string) =>
    setSources((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  const add = () => setSources((prev) => [...prev, { fuente: '', m: '' }])
  const remove = (i: number) => setSources((prev) => prev.filter((_, idx) => idx !== i))

  const guardar = () => {
    const parsed = sources.map((s) => ({ fuente: s.fuente.trim() || 'Ingreso', m: Number(s.m) || 0 }))
    const total = parsed.reduce((s, x) => s + x.m, 0)
    mutate((d) => {
      const mm = d.months.find((x) => x.k === curMes)
      if (mm) { mm.ingresos = parsed; mm.ing = total }
    })
    onClose()
  }

  return (
    <div>
      <h2 className="text-lg font-bold">Ingresos · {monthLabel(curMes)}</h2>
      <p className="mb-3 text-xs text-white/40">Agrega cada fuente de ingreso por separado.</p>
      {sources.map((s, i) => (
        <div key={i} className="mb-2 flex items-end gap-2">
          <Field label="Fuente" className="flex-1">
            <input
              className={inputCls}
              value={s.fuente}
              onChange={(e) => update(i, 'fuente', e.target.value)}
              placeholder="Ej: Sueldo, Ventas…"
            />
          </Field>
          <Field label="Monto" className="w-36">
            <input
              className={inputCls}
              type="number"
              value={s.m}
              onChange={(e) => update(i, 'm', e.target.value)}
            />
          </Field>
          {sources.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="mb-0.5 rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-white/50 hover:text-rose-400 transition"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        onClick={add}
        className="mt-1 w-full rounded-xl border border-dashed border-white/20 py-2 text-sm text-white/40 hover:border-violet-500 hover:text-violet-400 transition"
      >
        + fuente
      </button>
      <div className="mt-3 rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
        <span className="text-white/50">Total: </span>
        <span className="font-bold text-emerald-400">
          {'$' + Math.round(sources.reduce((s, x) => s + (Number(x.m) || 0), 0)).toLocaleString('es-CO')}
        </span>
      </div>
      <Btn className="mt-4 w-full" onClick={guardar}>Guardar</Btn>
    </div>
  )
}

function MesForm({ onClose }: { onClose: () => void }) {
  const { data, setCurMes, mutate } = useData()
  const [k, setK] = useState('')
  const [ing, setIng] = useState('0')
  const crear = () => {
    if (!/^\d{4}-\d{2}$/.test(k)) { alert('Formato inválido (ej: 2026-08)'); return }
    if (data.months.find((x) => x.k === k)) { alert('Ese mes ya existe'); return }
    mutate((d) => {
      d.months.push({ k, ing: Number(ing) || 0, proj: false })
      d.months.sort((a, b) => a.k.localeCompare(b.k))
    })
    setCurMes(k)
    onClose()
  }
  return (
    <div>
      <h2 className="text-lg font-bold">Nuevo mes</h2>
      <Field label="Mes (AAAA-MM)">
        <input className={inputCls} value={k} onChange={(e) => setK(e.target.value)} placeholder="2026-08" />
      </Field>
      <Field label="Ingresos estimados">
        <input className={inputCls} type="number" value={ing} onChange={(e) => setIng(e.target.value)} />
      </Field>
      <Btn className="mt-4 w-full" onClick={crear}>Crear mes</Btn>
    </div>
  )
}

// ─── Panel de Ahorros ──────────────────────────────────────────────────────

type SavingSheet =
  | { k: 'pot'; potId: string | null }
  | { k: 'entry'; potId: string; entryId?: number }
  | null

const SAVING_PALETTE = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#fb7185', '#22d3ee']

function AhorrosPanel() {
  const { data, curMes } = useData()
  const [openPot, setOpenPot] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SavingSheet>(null)

  const pots = data.savingPots ?? []
  const totalMes = savingTotalMonth(data, curMes)

  return (
    <div>
      {/* Resumen del mes */}
      <Card className="mt-3 border-l-2 border-emerald-500">
        <H3>Ahorrado en {monthLabel(curMes)}</H3>
        <div className={`text-2xl font-bold ${totalMes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {fmt(totalMes)}
        </div>
        <p className="mt-1 text-xs text-white/30">
          {pots.length} bolsillo(s) · acumulado total en la pestaña Inversiones
        </p>
      </Card>

      <SectionTitle action={
        <Btn variant="ghost" className="text-sm" onClick={() => setSheet({ k: 'pot', potId: null })}>
          + bolsillo
        </Btn>
      }>
        Mis bolsillos
      </SectionTitle>

      {pots.map((pot, i) => {
        const potTotal = savingPotTotal(data, pot.id)
        const entries = (data.savingEntries ?? []).filter((e) => e.potId === pot.id)
        const open = openPot === pot.id
        const color = SAVING_PALETTE[i % SAVING_PALETTE.length]
        return (
          <Card key={pot.id} className="mb-2.5">
            <div
              className="flex cursor-pointer items-center gap-2.5"
              onClick={() => setOpenPot(open ? null : pot.id)}
            >
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <div className="font-bold">{pot.name}</div>
                <div className="text-xs text-white/40">{entries.length} movimiento(s)</div>
              </div>
              <div className={`text-right text-[15px] font-bold ${potTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {fmt(potTotal)}
              </div>
            </div>

            {open && (
              <div className="mt-2.5 border-t-2 border-dashed border-violet-500/30 pt-1.5">
                {entries.length === 0 ? (
                  <p className="py-2 text-sm text-white/40">Sin movimientos aún.</p>
                ) : (
                  entries.slice().reverse().map((e) => (
                    <div key={e.id} className="flex items-center gap-2.5 border-b border-white/[0.06] py-2.5 last:border-0">
                      <span className={`text-lg font-bold ${e.m >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {e.m >= 0 ? '↑' : '↓'}
                      </span>
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setSheet({ k: 'entry', potId: pot.id, entryId: e.id })}
                      >
                        <div className="truncate text-sm font-semibold">{e.nota || '(sin nota)'}</div>
                        {e.d && <div className="text-xs text-white/30">{e.d.slice(5).replace('-', '/')}</div>}
                      </button>
                      <div className={`font-bold ${e.m >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {e.m >= 0 ? '+' : ''}{fmt(e.m)}
                      </div>
                    </div>
                  ))
                )}
                <div className="mt-2.5 flex gap-2.5">
                  <Btn className="flex-1" onClick={() => setSheet({ k: 'entry', potId: pot.id })}>
                    + Movimiento
                  </Btn>
                  <Btn variant="ghost" onClick={() => setSheet({ k: 'pot', potId: pot.id })}>
                    Editar
                  </Btn>
                </div>
              </div>
            )}
          </Card>
        )
      })}

      {pots.length === 0 && (
        <p className="py-3 text-sm text-white/40">
          Crea tu primer bolsillo para empezar a rastrear tus ahorros.
        </p>
      )}

      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet?.k === 'pot' && <PotForm potId={sheet.potId} onClose={() => setSheet(null)} />}
        {sheet?.k === 'entry' && (
          <SavingEntryForm potId={sheet.potId} entryId={sheet.entryId} onClose={() => setSheet(null)} />
        )}
      </Sheet>
    </div>
  )
}

function PotForm({ potId, onClose }: { potId: string | null; onClose: () => void }) {
  const { data, mutate } = useData()
  const editing = potId != null
  const pot = editing ? (data.savingPots ?? []).find((p) => p.id === potId) : undefined
  const isLast = (data.savingPots ?? []).length <= 1
  const [name, setName] = useState(pot?.name ?? '')

  const crear = () => {
    const n = name.trim()
    if (!n) return
    mutate((d) => {
      if (!d.savingPots) d.savingPots = []
      d.savingPots.push({ id: 'sp' + Date.now(), name: n })
    })
    onClose()
  }

  const guardar = () => {
    mutate((d) => {
      const p = (d.savingPots ?? []).find((x) => x.id === potId)
      if (p) p.name = name.trim() || '(sin nombre)'
    })
    onClose()
  }

  const borrar = () => {
    mutate((d) => {
      d.savingPots = (d.savingPots ?? []).filter((p) => p.id !== potId)
      d.savingEntries = (d.savingEntries ?? []).filter((e) => e.potId !== potId)
    })
    onClose()
  }

  return (
    <div>
      <h2 className="text-lg font-bold">{editing ? 'Editar bolsillo' : 'Nuevo bolsillo'}</h2>
      <p className="mb-2 text-xs text-white/40">
        {editing ? '' : 'Puede ser una cuenta, un sobre, una alcancía…'}
      </p>
      <Field label="Nombre">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Cuenta Bancolombia, Alcancía, Sobre viaje"
        />
      </Field>
      <div className="mt-4 flex gap-2.5">
        <Btn className="flex-1" onClick={editing ? guardar : crear}>
          {editing ? 'Guardar' : 'Crear bolsillo'}
        </Btn>
        {editing && (
          <Btn
            variant="ghost"
            onClick={borrar}
            className={isLast ? 'opacity-30 pointer-events-none' : ''}
          >
            Eliminar
          </Btn>
        )}
      </div>
      {editing && isLast && (
        <p className="mt-2 text-[11px] text-white/30">Debe haber al menos un bolsillo.</p>
      )}
    </div>
  )
}

function SavingEntryForm({ potId, entryId, onClose }: { potId: string; entryId?: number; onClose: () => void }) {
  const { data, mutate } = useData()
  const editing = entryId != null
  const cur = editing ? (data.savingEntries ?? []).find((e) => e.id === entryId) : undefined
  const [d, setD] = useState(cur?.d ?? today())
  const [tipo, setTipo] = useState<'in' | 'out'>(cur ? (cur.m >= 0 ? 'in' : 'out') : 'in')
  const [nota, setNota] = useState(cur?.nota ?? '')
  const [m, setM] = useState(String(cur ? Math.abs(cur.m) : ''))
  const pot = (data.savingPots ?? []).find((p) => p.id === potId)

  const guardar = () => {
    const monto = (Number(m) || 0) * (tipo === 'in' ? 1 : -1)
    mutate((data2) => {
      if (!data2.savingEntries) data2.savingEntries = []
      if (editing) {
        const idx = data2.savingEntries.findIndex((e) => e.id === entryId)
        if (idx !== -1) data2.savingEntries[idx] = { id: entryId!, potId, nota: nota.trim(), m: monto, d }
      } else {
        data2.savingEntries.push({ id: nextSavingId(data2), potId, nota: nota.trim(), m: monto, d })
      }
    })
    onClose()
  }

  const borrar = () => {
    mutate((d) => { d.savingEntries = (d.savingEntries ?? []).filter((e) => e.id !== entryId) })
    onClose()
  }

  return (
    <div>
      <h2 className="text-lg font-bold">{editing ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
      {pot && <p className="mb-2 text-xs text-white/40">{pot.name}</p>}
      <Field label="Fecha">
        <input className={inputCls} type="date" value={d} onChange={(e) => setD(e.target.value)} />
      </Field>

      {/* Toggle ahorro / retiro */}
      <div className="mb-1 flex rounded-xl border border-white/[0.08] overflow-hidden">
        <button
          onClick={() => setTipo('in')}
          className={`flex-1 py-2.5 text-sm font-semibold transition ${
            tipo === 'in' ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30 hover:text-white/60'
          }`}
        >
          ↑ Ahorro
        </button>
        <button
          onClick={() => setTipo('out')}
          className={`flex-1 py-2.5 text-sm font-semibold transition ${
            tipo === 'out' ? 'bg-rose-500/20 text-rose-400' : 'text-white/30 hover:text-white/60'
          }`}
        >
          ↓ Retiro
        </button>
      </div>

      <Field label="Nota (opcional)">
        <input
          className={inputCls}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: Quincena, Para viaje…"
        />
      </Field>
      <Field label="Monto">
        <input className={inputCls} type="number" value={m} onChange={(e) => setM(e.target.value)} />
      </Field>
      <div className="mt-4 flex gap-2.5">
        <Btn className="flex-1" onClick={guardar}>Guardar</Btn>
        {editing && <Btn variant="ghost" onClick={borrar}>Eliminar</Btn>}
      </div>
    </div>
  )
}
