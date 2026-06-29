import { useData } from '../context/DataContext'
import { Card, H3, Bar, SectionTitle } from '../components/ui'
import {
  fmt, monthLabel, mTotal, txOf, catName, catColor, invTotalV2, pendiente,
} from '../lib/calc'

export function Resumen() {
  const { data, curMes, setCurMes } = useData()
  const m = data.months.find((x) => x.k === curMes) ?? data.months[data.months.length - 1]
  const tot = mTotal(data, m.k)
  const bal = m.ing - tot

  const cats: Record<string, number> = {}
  txOf(data, m.k).forEach((t) => { cats[t.cat] = (cats[t.cat] || 0) + t.m })
  const entries = Object.entries(cats).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...Object.values(cats))

  return (
    <div>
      <label className="block">
        <span className="mb-1 block text-xs text-white/40">Mes</span>
        <select
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-white/90 outline-none focus:border-violet-500 transition"
          value={m.k}
          onChange={(e) => setCurMes(e.target.value)}
        >
          {data.months.map((mm) => (
            <option key={mm.k} value={mm.k} className="bg-[#161820]">
              {monthLabel(mm.k)}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Card className="shadow-[0_0_24px_-4px_rgba(52,211,153,0.12)]">
          <H3>Ingresos</H3>
          <div className="text-xl font-bold text-emerald-400">{fmt(m.ing)}</div>
        </Card>
        <Card className="shadow-[0_0_24px_-4px_rgba(251,113,133,0.12)]">
          <H3>Gastos</H3>
          <div className="text-xl font-bold text-rose-400">{fmt(tot)}</div>
        </Card>
      </div>

      <Card className="mt-2.5 border-l-2 border-violet-500">
        <H3>Balance del mes</H3>
        <div className={`text-xl font-bold ${bal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {bal >= 0 ? '+' : ''}{fmt(bal)}
        </div>
        <p className="mt-0.5 text-xs text-white/40">
          {bal >= 0 ? 'Te sobra este mes' : 'Gastas más de lo que entra'}
        </p>
      </Card>

      <Card className="mt-2.5">
        <H3>Resumen del mes</H3>
        <div className="flex justify-between py-1.5 text-sm">
          <span className="text-white/70">Ingresos</span><b className="text-emerald-400">{fmt(m.ing)}</b>
        </div>
        <div className="flex justify-between py-1.5 text-sm">
          <span className="text-white/70">Gastado</span><b className="text-rose-400">{fmt(tot)}</b>
        </div>
        <div className="flex justify-between py-1.5 text-sm">
          <span className="text-white/70">Disponible</span>
          <b className={bal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmt(bal)}</b>
        </div>
        <Bar pct={m.ing ? (tot / m.ing) * 100 : 0} color={bal >= 0 ? 'bg-violet-400' : 'bg-rose-400'} />
      </Card>

      <SectionTitle>Gasto por categoría</SectionTitle>
      <Card>
        {entries.length ? entries.map(([c, v]) => (
          <div key={c} className="border-b border-white/[0.06] py-2 last:border-0">
            <div className="flex justify-between text-sm">
              <span>{catName(data, c)}</span>
              <span>
                {fmt(v)}{' '}
                <span className="text-xs text-white/40">{tot ? Math.round((v / tot) * 100) : 0}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: catColor(data, c) }} />
            </div>
          </div>
        )) : <p className="text-sm text-white/40">Sin gastos este mes.</p>}
      </Card>

      <SectionTitle>Patrimonio</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        <Card>
          <H3>Inversiones</H3>
          <div className="text-base font-bold text-emerald-400">{fmt(invTotalV2(data))}</div>
        </Card>
        <Card>
          <H3>Me deben</H3>
          <div className="text-base font-bold text-amber-400">{fmt(pendiente(data, 'prestamo'))}</div>
        </Card>
        <Card>
          <H3>Yo debo</H3>
          <div className="text-base font-bold text-rose-400">{fmt(pendiente(data, 'deuda'))}</div>
        </Card>
      </div>
    </div>
  )
}
