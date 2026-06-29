import { useState } from 'react'
import { useData } from '../context/DataContext'
import { Card, H3, Btn, SectionTitle, Pill } from '../components/ui'
import { Sheet, Field, inputCls } from '../components/Sheet'
import { fmt, pendiente } from '../lib/calc'
import type { LoanItem, LoanKind } from '../types'

export function Prestamos() {
  const { data } = useData()
  const [sheet, setSheet] = useState<{ kind: LoanKind; index: number | null } | null>(null)

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5">
        <Card>
          <H3>Me deben (pend.)</H3>
          <div className="text-base font-bold text-amber-400">{fmt(pendiente(data, 'prestamo'))}</div>
        </Card>
        <Card>
          <H3>Yo debo (pend.)</H3>
          <div className="text-base font-bold text-rose-400">{fmt(pendiente(data, 'deuda'))}</div>
        </Card>
      </div>

      <LoanSection
        title="Préstamos que hice"
        kind="prestamo"
        onAdd={() => setSheet({ kind: 'prestamo', index: null })}
        onEdit={(i) => setSheet({ kind: 'prestamo', index: i })}
      />
      <LoanSection
        title="Deudas mías"
        kind="deuda"
        onAdd={() => setSheet({ kind: 'deuda', index: null })}
        onEdit={(i) => setSheet({ kind: 'deuda', index: i })}
      />

      <p className="mt-2 text-[11.5px] leading-relaxed text-white/30">
        Marca el círculo cuando te paguen (préstamos) o cuando pagues (deudas).
      </p>

      <Sheet open={!!sheet} onClose={() => setSheet(null)}>
        {sheet && <LoanForm kind={sheet.kind} index={sheet.index} onClose={() => setSheet(null)} />}
      </Sheet>
    </div>
  )
}

function LoanSection({
  title, kind, onAdd, onEdit,
}: {
  title: string; kind: LoanKind; onAdd: () => void; onEdit: (i: number) => void
}) {
  const { data, mutate } = useData()
  const list = data[kind]
  return (
    <>
      <SectionTitle action={<Btn variant="ghost" className="!px-3 text-sm" onClick={onAdd}>+</Btn>}>
        {title}
      </SectionTitle>
      <Card>
        {list.length ? list.map((x, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-0">
            <button
              onClick={() => mutate((d) => { d[kind][i].pagado = !d[kind][i].pagado })}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-sm transition ${
                x.pagado
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                  : 'border-white/20 text-transparent'
              }`}
            >
              ✓
            </button>
            <button className="min-w-0 flex-1 text-left" onClick={() => onEdit(i)}>
              <div className="flex items-center gap-2 truncate font-semibold">
                {x.q}
                <Pill tone={x.pagado ? 'pos' : 'neg'}>{x.pagado ? 'pagado' : 'pendiente'}</Pill>
              </div>
              <div className="text-xs text-white/40">{x.c} · {x.d}</div>
            </button>
            <div className="font-bold">{fmt(x.m)}</div>
          </div>
        )) : <p className="text-sm text-white/40">Sin registros</p>}
      </Card>
    </>
  )
}

function LoanForm({ kind, index, onClose }: { kind: LoanKind; index: number | null; onClose: () => void }) {
  const { data, mutate } = useData()
  const editing = index != null
  const cur: LoanItem | undefined = editing ? data[kind][index] : undefined
  const [q, setQ] = useState(cur?.q ?? '')
  const [c, setC] = useState(cur?.c ?? '')
  const [m, setM] = useState(String(cur?.m ?? ''))
  const [d, setD] = useState(cur?.d ?? new Date().toISOString().slice(0, 10))
  const [pagado, setPagado] = useState(cur?.pagado ?? false)

  const guardar = () => {
    const obj: LoanItem = { q: q.trim() || '(sin nombre)', c, m: Number(m) || 0, d, pagado }
    mutate((data2) => { if (editing) data2[kind][index] = obj; else data2[kind].push(obj) })
    onClose()
  }
  const borrar = () => { mutate((data2) => { data2[kind].splice(index!, 1) }); onClose() }

  return (
    <div>
      <h2 className="text-lg font-bold">
        {editing ? 'Editar' : 'Nuevo'} · {kind === 'prestamo' ? 'Préstamo que hice' : 'Deuda mía'}
      </h2>
      <Field label="Persona">
        <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} />
      </Field>
      <Field label="Concepto">
        <input className={inputCls} value={c} onChange={(e) => setC(e.target.value)} />
      </Field>
      <div className="flex gap-2.5">
        <Field label="Monto">
          <input className={inputCls} type="number" value={m} onChange={(e) => setM(e.target.value)} />
        </Field>
        <Field label="Fecha">
          <input className={inputCls} type="date" value={d} onChange={(e) => setD(e.target.value)} />
        </Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} />
        {kind === 'prestamo' ? 'Ya me pagaron' : 'Ya la pagué'}
      </label>
      <div className="mt-4 flex gap-2.5">
        <Btn className="flex-1" onClick={guardar}>Guardar</Btn>
        {editing && <Btn variant="ghost" onClick={borrar}>Eliminar</Btn>}
      </div>
    </div>
  )
}
