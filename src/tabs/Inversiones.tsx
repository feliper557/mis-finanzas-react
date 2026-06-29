import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useData } from '../context/DataContext'
import { Card, H3, Btn, SectionTitle } from '../components/ui'
import { Sheet, Field, inputCls } from '../components/Sheet'
import { fmt, invTotalV2, invPendV2, invGanV2, nextInvId, invCatColor, PALETTE, savingTotal, savingPotTotal } from '../lib/calc'
import type { InvCat, InvItemV2, FinanzasData } from '../types'

type SheetState =
  | { k: 'item'; catId: string; itemId: number | null }
  | { k: 'cat'; catId: string | null }
  | null

const tooltipStyle = {
  background: '#161820',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  color: 'rgba(255,255,255,0.8)',
  fontSize: 12,
}

type InvGroup = 'inv' | 'ahorros'

const INV_GROUPS: { id: InvGroup; label: string; color: string }[] = [
  { id: 'inv', label: 'Inversiones', color: 'text-emerald-400' },
  { id: 'ahorros', label: 'Ahorros acumulados', color: 'text-violet-400' },
]

export function Inversiones() {
  const { data } = useData()
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [activeGroup, setActiveGroup] = useState<InvGroup>('inv')

  const invCats = data.invCats ?? []
  const invItems = data.invItems ?? []
  const pots = data.savingPots ?? []

  const totalInv = invTotalV2(data)
  const totalPend = invPendV2(data)
  const totalGan = invGanV2(data)
  const totalAhorrado = savingTotal(data)

  const pie = invCats
    .map((cat, i) => ({
      name: cat.name,
      value: invItems.filter((x) => x.cat === cat.id && !x.pend).reduce((s, x) => s + x.m, 0),
      color: PALETTE[i % PALETTE.length],
    }))
    .filter((x) => x.value > 0)

  return (
    <div>
      {/* Pills de grupo */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-white/[0.04] p-1.5">
        {INV_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(g.id)}
            className={`flex flex-col items-center rounded-xl px-2 py-2 text-[11px] font-semibold transition ${
              activeGroup === g.id ? 'bg-[#1e2130] text-white shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span className={activeGroup === g.id ? g.color : ''}>{g.label}</span>
          </button>
        ))}
      </div>

      {activeGroup === 'ahorros' ? (
        <AhorrosAcumulados pots={pots} totalAhorrado={totalAhorrado} data={data} />
      ) : (
      <div className="mt-3">
      <div className="grid grid-cols-3 gap-2.5">
        <Card><H3>Invertido</H3><div className="text-base font-bold text-emerald-400">{fmt(totalInv)}</div></Card>
        <Card><H3>Pendiente</H3><div className="text-base font-bold text-amber-400">{fmt(totalPend)}</div></Card>
        <Card><H3>Ganancia</H3><div className="text-base font-bold text-emerald-400">+{fmt(totalGan)}</div></Card>
      </div>

      {pie.length > 0 && (
        <Card className="mt-3">
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                {pie.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-white/50">
            {pie.map((e) => (
              <span key={e.name} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded" style={{ background: e.color }} />
                {e.name}: {fmt(e.value)}
              </span>
            ))}
          </div>
        </Card>
      )}

      <SectionTitle action={
        <Btn variant="ghost" className="text-sm" onClick={() => setSheet({ k: 'cat', catId: null })}>
          + categoría
        </Btn>
      }>
        Mis inversiones
      </SectionTitle>

      {invCats.map((cat) => {
        const items = invItems.filter((x) => x.cat === cat.id)
        const catTotal = items.filter((x) => !x.pend).reduce((s, x) => s + x.m, 0)
        const open = openCat === cat.id
        const color = invCatColor(data, cat.id)
        return (
          <Card key={cat.id} className="mb-2.5">
            <div
              className="flex cursor-pointer items-center gap-2.5"
              onClick={() => setOpenCat(open ? null : cat.id)}
            >
              <span className="h-3 w-3 shrink-0 rounded" style={{ background: color }} />
              <div className="min-w-0 flex-1">
                <div className="font-bold">{cat.name}</div>
                <div className="text-xs text-white/40">{items.length} ítem(s)</div>
              </div>
              <div className="text-right text-[13px] font-bold text-emerald-400">{fmt(catTotal)}</div>
            </div>

            {open && (
              <div className="mt-2.5 border-t-2 border-dashed border-violet-500/30 pt-1.5">
                {items.length ? items.map((item) => (
                  <InvRow key={item.id} item={item} onEdit={() => setSheet({ k: 'item', catId: cat.id, itemId: item.id })} />
                )) : <p className="py-2 text-sm text-white/40">Sin inversiones aún.</p>}
                <div className="mt-2.5 flex gap-2.5">
                  <Btn className="flex-1" onClick={() => setSheet({ k: 'item', catId: cat.id, itemId: null })}>+ Inversión</Btn>
                  <Btn variant="ghost" onClick={() => setSheet({ k: 'cat', catId: cat.id })}>Editar</Btn>
                </div>
              </div>
            )}
          </Card>
        )
      })}

      <p className="mt-2 text-[11.5px] leading-relaxed text-white/30">
        El círculo marcado = ya invertido. Vacío = pendiente por invertir.
      </p>

      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet?.k === 'item' && (
          <InvItemForm
            catId={sheet.catId}
            itemId={sheet.itemId}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet?.k === 'cat' && (
          <InvCatForm catId={sheet.catId} onClose={() => setSheet(null)} />
        )}
      </Sheet>
      </div>
      )}
    </div>
  )
}

const SAVING_PALETTE = ['#34d399', '#60a5fa', '#f59e0b', '#a78bfa', '#fb7185', '#22d3ee']

function AhorrosAcumulados({ pots, totalAhorrado, data }: { pots: { id: string; name: string }[]; totalAhorrado: number; data: FinanzasData }) {
  return (
    <div className="mt-3">
      <Card className="border-l-2 border-violet-500">
        <H3>Acumulado total</H3>
        <div className={`text-2xl font-bold ${totalAhorrado >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {fmt(totalAhorrado)}
        </div>
        <p className="mt-1 text-xs text-white/30">{pots.length} bolsillo(s) · histórico de todos los meses</p>
      </Card>

      <SectionTitle>Por bolsillo</SectionTitle>
      {pots.length === 0 ? (
        <p className="py-3 text-sm text-white/40">Aún no has creado bolsillos de ahorro.</p>
      ) : (
        <Card>
          {pots.map((pot, i) => (
            <div key={pot.id} className="flex items-center gap-2.5 border-b border-white/[0.06] py-2.5 last:border-0">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: SAVING_PALETTE[i % SAVING_PALETTE.length] }} />
              <div className="min-w-0 flex-1 font-semibold">{pot.name}</div>
              <div className="font-bold text-emerald-400">{fmt(savingPotTotal(data, pot.id))}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

function InvRow({ item, onEdit }: { item: InvItemV2; onEdit: () => void }) {
  const { mutate } = useData()
  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-0">
      <button
        onClick={() => mutate((d) => {
          const x = (d.invItems ?? []).find((i) => i.id === item.id)
          if (x) x.pend = !x.pend
        })}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-sm transition ${
          item.pend ? 'border-white/20 text-transparent' : 'border-violet-400 bg-violet-500/20 text-violet-400'
        }`}
      >
        ✓
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={onEdit}>
        <div className="truncate font-semibold">{item.c}</div>
        <div className="text-xs text-white/40">
          {item.d}{item.pend ? ' · pendiente' : ''}{item.gan ? ` · gan. ${fmt(item.gan)}` : ''}
        </div>
      </button>
      <div className={`font-bold ${item.m < 0 ? 'text-rose-400' : ''}`}>{fmt(item.m)}</div>
    </div>
  )
}

function InvItemForm({ catId, itemId, onClose }: { catId: string; itemId: number | null; onClose: () => void }) {
  const { data, mutate } = useData()
  const editing = itemId != null
  const cur = editing ? (data.invItems ?? []).find((x) => x.id === itemId) : undefined
  const [d, setD] = useState(cur?.d ?? new Date().toISOString().slice(0, 10))
  const [c, setC] = useState(cur?.c ?? '')
  const [m, setM] = useState(String(cur?.m ?? ''))
  const [pend, setPend] = useState(cur?.pend ?? false)
  const [gan, setGan] = useState(String(cur?.gan ?? 0))

  const guardar = () => {
    const obj: Omit<InvItemV2, 'id'> = { cat: catId, d, c: c.trim() || '(sin nombre)', m: Number(m) || 0, pend, gan: Number(gan) || 0 }
    mutate((data2) => {
      if (!data2.invItems) data2.invItems = []
      if (editing) {
        const idx = data2.invItems.findIndex((x) => x.id === itemId)
        if (idx !== -1) data2.invItems[idx] = { id: itemId!, ...obj }
      } else {
        data2.invItems.push({ id: nextInvId(data2), ...obj })
      }
      data2.invItems.sort((a, b) => (a.d || '').localeCompare(b.d || ''))
    })
    onClose()
  }

  const borrar = () => {
    mutate((data2) => { data2.invItems = (data2.invItems ?? []).filter((x) => x.id !== itemId) })
    onClose()
  }

  return (
    <div>
      <h2 className="text-lg font-bold">{editing ? 'Editar' : 'Nueva'} inversión</h2>
      <Field label="Fecha">
        <input className={inputCls} type="date" value={d} onChange={(e) => setD(e.target.value)} />
      </Field>
      <Field label="Descripción">
        <input className={inputCls} value={c} onChange={(e) => setC(e.target.value)} placeholder="Ej: Acciones Nutresa, CDT…" />
      </Field>
      <div className="flex gap-2.5">
        <Field label="Monto" className="flex-1">
          <input className={inputCls} type="number" value={m} onChange={(e) => setM(e.target.value)} />
        </Field>
        <Field label="Ganancia" className="flex-1">
          <input className={inputCls} type="number" value={gan} onChange={(e) => setGan(e.target.value)} />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={pend} onChange={(e) => setPend(e.target.checked)} />
        Pendiente por invertir
      </label>
      <div className="mt-4 flex gap-2.5">
        <Btn className="flex-1" onClick={guardar}>Guardar</Btn>
        {editing && <Btn variant="ghost" onClick={borrar}>Eliminar</Btn>}
      </div>
    </div>
  )
}

function InvCatForm({ catId, onClose }: { catId: string | null; onClose: () => void }) {
  const { data, mutate } = useData()
  const editing = catId != null
  const cur: InvCat | undefined = editing ? (data.invCats ?? []).find((c) => c.id === catId) : undefined
  const isLast = (data.invCats ?? []).length <= 1
  const [name, setName] = useState(cur?.name ?? '')

  const crear = () => {
    const n = name.trim()
    if (!n) return
    mutate((d) => {
      if (!d.invCats) d.invCats = []
      const id = 'ic' + Date.now()
      d.invCats.push({ id, name: n })
    })
    onClose()
  }

  const guardar = () => {
    mutate((d) => {
      const cc = (d.invCats ?? []).find((c) => c.id === catId)
      if (cc) cc.name = name.trim() || '(sin nombre)'
    })
    onClose()
  }

  const borrar = () => {
    const fallback = (data.invCats ?? []).find((c) => c.id !== catId)?.id ?? ''
    mutate((d) => {
      d.invItems = (d.invItems ?? []).map((x) => x.cat === catId ? { ...x, cat: fallback } : x)
      d.invCats = (d.invCats ?? []).filter((c) => c.id !== catId)
    })
    onClose()
  }

  if (!editing) {
    return (
      <div>
        <h2 className="text-lg font-bold">Nueva categoría</h2>
        <Field label="Nombre">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Finca raíz, Cripto, CDT…" />
        </Field>
        <Btn className="mt-4 w-full" onClick={crear}>Crear categoría</Btn>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-bold">Categoría</h2>
      <Field label="Nombre">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
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
