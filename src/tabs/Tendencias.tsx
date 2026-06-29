import { useState } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar as RBar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, Legend, ReferenceLine,
} from 'recharts'
import { useData } from '../context/DataContext'
import { Card, H3, SectionTitle } from '../components/ui'
import { fmt, monthLabel, mTotal, spentCat, catColor } from '../lib/calc'

type View = 'historico' | 'anual' | 'mes'

const axis = { stroke: 'rgba(255,255,255,0.35)', fontSize: 10 }
const fmtM = (v: number) => {
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M'
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'k'
  return '$' + v
}
const tooltipStyle = {
  background: '#161820',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  color: 'rgba(255,255,255,0.8)',
  fontSize: 12,
}

export function Tendencias() {
  const { curMes, setCurMes } = useData()
  const [view, setView] = useState<View>('historico')

  return (
    <div>
      {/* View switcher */}
      <div className="flex gap-1 rounded-2xl bg-white/[0.04] p-1.5 mb-4">
        {(['historico', 'anual', 'mes'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
              view === v ? 'bg-[#1e2130] text-white shadow-sm' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {v === 'historico' ? 'Histórico' : v === 'anual' ? 'Informe Anual' : 'Por mes'}
          </button>
        ))}
      </div>

      {view === 'historico' && <HistoricoView />}
      {view === 'anual' && <AnualView />}
      {view === 'mes' && <MesView curMes={curMes} setCurMes={setCurMes} />}
    </div>
  )
}

function HistoricoView() {
  const { data } = useData()
  const rows = data.months.map((m) => {
    const gas = mTotal(data, m.k)
    return { name: monthLabel(m.k).replace(' 20', '-'), Ingresos: m.ing, Gastos: gas, Balance: m.ing - gas }
  })
  const n = rows.length || 1
  const avgIng = rows.reduce((s, r) => s + r.Ingresos, 0) / n
  const avgGas = rows.reduce((s, r) => s + r.Gastos, 0) / n
  const avgAhorro = avgIng - avgGas

  return (
    <>
      <SectionTitle>Ingresos vs Gastos</SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rows} margin={{ left: -10, right: 8, top: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={axis} angle={-60} textAnchor="end" height={50} />
            <YAxis tick={axis} tickFormatter={fmtM} />
            <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
            <Line type="monotone" dataKey="Ingresos" stroke="#34d399" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Gastos" stroke="#fb7185" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <SectionTitle>Balance mensual</SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ left: -10, right: 8, top: 6 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={axis} angle={-60} textAnchor="end" height={50} />
            <YAxis tick={axis} tickFormatter={fmtM} />
            <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={tooltipStyle} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
            <RBar dataKey="Balance" radius={[4, 4, 0, 0]}>
              {rows.map((r, i) => <Cell key={i} fill={r.Balance >= 0 ? '#34d399' : '#fb7185'} />)}
            </RBar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <SectionTitle>Promedios históricos</SectionTitle>
      <div className="grid grid-cols-3 gap-2.5">
        <Card><H3>Ingreso prom.</H3><div className="text-base font-bold text-emerald-400">{fmt(avgIng)}</div></Card>
        <Card><H3>Gasto prom.</H3><div className="text-base font-bold text-rose-400">{fmt(avgGas)}</div></Card>
        <Card>
          <H3>Ahorro prom.</H3>
          <div className={`text-base font-bold ${avgAhorro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmt(avgAhorro)}
          </div>
        </Card>
      </div>
    </>
  )
}

function AnualView() {
  const { data } = useData()

  // Detectar año actual (el del mes más reciente con datos o el año en curso)
  const currentYear = new Date().getFullYear()
  const yearsAvailable = [...new Set(data.months.map((m) => m.k.slice(0, 4)))].sort()
  const [year, setYear] = useState(
    yearsAvailable.includes(String(currentYear)) ? String(currentYear) : yearsAvailable[yearsAvailable.length - 1] ?? String(currentYear)
  )

  const months = data.months.filter((m) => m.k.startsWith(year))
  const rows = months.map((m) => {
    const gas = mTotal(data, m.k)
    const sav = m.ing - gas
    return {
      name: monthLabel(m.k).replace(` ${year}`, ''),
      Ingresos: m.ing,
      Gastos: gas,
      Ahorro: sav,
    }
  })

  const totalIng = months.reduce((s, m) => s + m.ing, 0)
  const totalGas = months.reduce((s, m) => s + mTotal(data, m.k), 0)
  const totalSav = totalIng - totalGas
  const bestMonth = [...months].sort((a, b) => (b.ing - mTotal(data, b.k)) - (a.ing - mTotal(data, a.k)))[0]

  return (
    <>
      {yearsAvailable.length > 1 && (
        <div className="mb-3 flex gap-2">
          {yearsAvailable.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
                y === year ? 'bg-violet-500 text-white' : 'bg-white/[0.05] text-white/50 hover:text-white/80'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 mb-3">
        <Card><H3>Ingresos {year}</H3><div className="text-sm font-bold text-emerald-400">{fmt(totalIng)}</div></Card>
        <Card><H3>Gastos {year}</H3><div className="text-sm font-bold text-rose-400">{fmt(totalGas)}</div></Card>
        <Card>
          <H3>Ahorro {year}</H3>
          <div className={`text-sm font-bold ${totalSav >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(totalSav)}</div>
        </Card>
      </div>

      {bestMonth && (
        <Card className="mb-3 border-l-2 border-violet-500">
          <H3>Mejor mes</H3>
          <div className="font-bold text-violet-300">{monthLabel(bestMonth.k)}</div>
          <div className="text-xs text-white/40">
            Ahorro: {fmt(bestMonth.ing - mTotal(data, bestMonth.k))}
          </div>
        </Card>
      )}

      <SectionTitle>Ingresos y Gastos por mes</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-sm text-white/40">Sin datos para {year}.</p>
      ) : (
        <Card>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ left: -10, right: 8, top: 6 }} barCategoryGap="25%">
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} tickFormatter={fmtM} />
              <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
              <RBar dataKey="Ingresos" fill="#34d399" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <RBar dataKey="Gastos" fill="#fb7185" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <SectionTitle>Ahorro mensual</SectionTitle>
      {rows.length === 0 ? null : (
        <Card>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={rows} margin={{ left: -10, right: 8, top: 6 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={axis} />
              <YAxis tick={axis} tickFormatter={fmtM} />
              <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={tooltipStyle} />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="4" />
              <Line type="monotone" dataKey="Ahorro" stroke="#a78bfa" strokeWidth={2.5} dot={{ r: 3, fill: '#a78bfa' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Tabla resumen */}
      {rows.length > 0 && (
        <>
          <SectionTitle>Detalle por mes</SectionTitle>
          <Card>
            <div className="grid grid-cols-4 gap-2 mb-2 text-[10px] font-bold text-white/30 uppercase tracking-wide">
              <span>Mes</span><span className="text-right">Ingresos</span><span className="text-right">Gastos</span><span className="text-right">Ahorro</span>
            </div>
            {rows.map((r) => (
              <div key={r.name} className="grid grid-cols-4 gap-2 border-t border-white/[0.06] py-2 text-sm">
                <span className="font-semibold">{r.name}</span>
                <span className="text-right text-emerald-400">{fmt(r.Ingresos)}</span>
                <span className="text-right text-rose-400">{fmt(r.Gastos)}</span>
                <span className={`text-right font-bold ${r.Ahorro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(r.Ahorro)}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}

function MesView({ curMes, setCurMes }: { curMes: string; setCurMes: (k: string) => void }) {
  const { data } = useData()
  const [openCat, setOpenCat] = useState<string | null>(null)

  const m = data.months.find((x) => x.k === curMes) ?? data.months[data.months.length - 1]
  const idx = data.months.findIndex((x) => x.k === m.k)
  const prevM = idx > 0 ? data.months[idx - 1] : null

  const catRows = data.cats
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      Este: spentCat(data, m.k, cat.id),
      Anterior: prevM ? spentCat(data, prevM.k, cat.id) : 0,
      color: catColor(data, cat.id),
      txItems: data.tx.filter((t) => t.k === m.k && t.cat === cat.id),
    }))
    .filter((r) => r.Este > 0 || r.Anterior > 0)
    .sort((a, b) => b.Este - a.Este)

  const tot = mTotal(data, m.k)
  const prevTot = prevM ? mTotal(data, prevM.k) : 0
  const diff = tot - prevTot

  const last6 = data.months.slice(-6).map((mm) => {
    const gas = mTotal(data, mm.k)
    return { name: monthLabel(mm.k).replace(' 20', '-'), Ingresos: mm.ing, Gastos: gas }
  })

  return (
    <>
      <div className="mb-3">
        <select
          className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-white/90 outline-none focus:border-violet-500 transition"
          value={m.k}
          onChange={(e) => { setCurMes(e.target.value); setOpenCat(null) }}
        >
          {data.months.map((mm) => (
            <option key={mm.k} value={mm.k} className="bg-[#161820]">{monthLabel(mm.k)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mb-3">
        <Card><H3>Ingresos</H3><div className="text-sm font-bold text-emerald-400">{fmt(m.ing)}</div></Card>
        <Card><H3>Gastado</H3><div className="text-sm font-bold text-rose-400">{fmt(tot)}</div></Card>
        <Card>
          <H3>vs anterior</H3>
          <div className={`text-sm font-bold ${diff <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {diff > 0 ? '+' : ''}{fmt(diff)}
          </div>
        </Card>
      </div>

      {last6.length > 1 && (
        <>
          <SectionTitle>Últimos {last6.length} meses</SectionTitle>
          <Card>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={last6} margin={{ left: -10, right: 8, top: 6 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={axis} />
                <YAxis tick={axis} tickFormatter={fmtM} />
                <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />
                <Line type="monotone" dataKey="Ingresos" stroke="#34d399" strokeWidth={2} dot={{ r: 3, fill: '#34d399' }} />
                <Line type="monotone" dataKey="Gastos" stroke="#fb7185" strokeWidth={2} dot={{ r: 3, fill: '#fb7185' }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {catRows.length > 0 ? (
        <>
          <SectionTitle>
            Gasto por categoría{prevM ? ` · vs ${monthLabel(prevM.k)}` : ''}
          </SectionTitle>
          <Card>
            <ResponsiveContainer width="100%" height={Math.max(180, catRows.length * 38 + 40)}>
              <BarChart data={catRows} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" tick={axis} tickFormatter={fmtM} />
                <YAxis type="category" dataKey="name" tick={{ ...axis, fontSize: 11 }} width={80} />
                <Tooltip formatter={(v) => typeof v === 'number' ? fmt(v) : v} contentStyle={tooltipStyle} />
                {prevM && <Legend wrapperStyle={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }} />}
                <RBar dataKey="Este" name={monthLabel(m.k)} fill="#a78bfa" radius={[0, 4, 4, 0]} maxBarSize={14} />
                {prevM && <RBar dataKey="Anterior" name={monthLabel(prevM.k)} fill="rgba(167,139,250,0.3)" radius={[0, 4, 4, 0]} maxBarSize={14} />}
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Lista con desglose por categoría */}
          <div className="mt-2.5 space-y-1">
            {catRows.map((r) => {
              const varPct = prevM && r.Anterior ? ((r.Este - r.Anterior) / r.Anterior) * 100 : null
              const open = openCat === r.id
              return (
                <div
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04]"
                >
                  {/* Fila de categoría — clickeable para desglose */}
                  <button
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                    onClick={() => setOpenCat(open ? null : r.id)}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded" style={{ background: r.color }} />
                    <span className="flex-1 text-sm font-semibold">{r.name}</span>
                    <div className="text-right">
                      <div className="text-sm font-bold">{fmt(r.Este)}</div>
                      {varPct !== null && (
                        <div className={`text-[10px] ${varPct > 10 ? 'text-rose-400' : varPct < -10 ? 'text-emerald-400' : 'text-white/40'}`}>
                          {varPct > 0 ? '+' : ''}{varPct.toFixed(0)}% vs ant.
                        </div>
                      )}
                    </div>
                    <span className={`ml-1 text-xs text-white/30 transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
                  </button>

                  {/* Desglose de movimientos */}
                  {open && (
                    <div className="border-t border-white/[0.06] bg-white/[0.02] px-3.5 pb-2 pt-1">
                      {r.txItems.length === 0 ? (
                        <p className="py-2 text-xs text-white/30">Sin movimientos registrados.</p>
                      ) : (
                        r.txItems.map((t) => (
                          <div key={t.id} className="flex items-center gap-2.5 border-b border-white/[0.04] py-2 last:border-0">
                            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                              t.pagado ? 'border-violet-400/60 text-violet-400' : 'border-white/20 text-white/20'
                            }`}>✓</span>
                            <span className={`flex-1 text-xs ${t.pagado ? 'text-white/40 line-through' : 'text-white/80'}`}>{t.c}</span>
                            <span className="text-xs font-bold text-white/70">{fmt(t.m)}</span>
                          </div>
                        ))
                      )}
                      <div className="mt-1.5 flex justify-between text-[10px] text-white/30">
                        <span>{r.txItems.length} movimiento(s)</span>
                        <span>Total: {fmt(r.Este)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-white/40">Sin gastos registrados en {monthLabel(m.k)}.</p>
      )}
    </>
  )
}
