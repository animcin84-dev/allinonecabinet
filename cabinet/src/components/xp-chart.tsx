import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts'
import { useReducedMotion } from 'motion/react'
import { useClub } from '../app/context'
import type { LedgerEntry } from '../domain/types'
import { chartData } from './chart-data'

const signed = (value: number) => (value > 0 ? `+${value}` : String(value))

function XPTooltip({
  active,
  payload,
  label,
}: TooltipContentProps<TooltipValueType, number | string>) {
  const { tx } = useClub()
  if (!active || !payload?.length) return null
  const earned = Number(payload.find((item) => item.dataKey === 'earned')?.value ?? 0)
  const adjusted = Number(payload.find((item) => item.dataKey === 'adjusted')?.value ?? 0)
  return (
    <div className="chart-tooltip">
      <p>
        {tx('Период с', 'Кезең басталуы')} {label}
      </p>
      <div className="chart-tooltip-row">
        <span>
          <i />
          {tx('Начислено', 'Есептелді')}
        </span>
        <strong>{signed(earned)} XP</strong>
      </div>
      <div className="chart-tooltip-row">
        <span>
          <i className="correction" />
          {tx('Корректировка', 'Түзету')}
        </span>
        <strong>{signed(adjusted)} XP</strong>
      </div>
      <div className="chart-tooltip-row chart-tooltip-total">
        <span>{tx('Изменение XP', 'XP өзгерісі')}</span>
        <strong>{signed(earned + adjusted)} XP</strong>
      </div>
    </div>
  )
}

export function XPChart({ entries, days = 28 }: { entries: LedgerEntry[]; days?: number }) {
  const { locale, tx, settings } = useClub()
  const reduced = useReducedMotion()
  const data = chartData(entries, locale, days)
  const earned = data.reduce((sum, period) => sum + period.earned, 0)
  const adjusted = data.reduce((sum, period) => sum + period.adjusted, 0)
  const animate = !reduced && !settings.reducedMotion
  return (
    <div className="chart-container">
      <div
        className="chart-summary"
        aria-label={tx(`Итоги за ${days} дней`, `${days} күннің қорытындысы`)}
      >
        <div className="chart-summary-item">
          <span>{tx('Начислено', 'Есептелді')}</span>
          <strong>
            {signed(earned)} <small>XP</small>
          </strong>
        </div>
        <div className="chart-summary-item">
          <span>{tx('Корректировка', 'Түзету')}</span>
          <strong>
            {signed(adjusted)} <small>XP</small>
          </strong>
        </div>
        <div className="chart-summary-item">
          <span>{tx('Изменение XP', 'XP өзгерісі')}</span>
          <strong>
            {signed(earned + adjusted)} <small>XP</small>
          </strong>
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i /> {tx('Начислено', 'Есептелді')}
        </span>
        <span>
          <i className="correction" /> {tx('Корректировка', 'Түзету')}
        </span>
      </div>
      <div
        style={{ width: '100%', height: 224, minWidth: 0 }}
        aria-label={tx('XP за четыре периода', 'Төрт кезеңдегі XP')}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            accessibilityLayer
            margin={{ left: -26, right: 0, top: 14, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: '#756a79' }}
            />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#756a79' }} />
            <ReferenceLine y={0} stroke="var(--muted)" strokeOpacity={0.65} />
            <Tooltip
              cursor={{ fill: '#3c0b500b', radius: 4 }}
              content={XPTooltip}
              isAnimationActive={animate}
              animationDuration={160}
            />
            <Bar
              name={tx('Начислено', 'Есептелді')}
              dataKey="earned"
              fill="#3c0b50"
              radius={[3, 3, 0, 0]}
              maxBarSize={32}
              activeBar={{ stroke: '#3c0b50', strokeWidth: 2, fill: '#5a1c6c' }}
              isAnimationActive={animate}
              animationDuration={360}
              animationEasing="ease-out"
            />
            <Bar
              name={tx('Корректировка', 'Түзету')}
              dataKey="adjusted"
              fill="#9b6d4b"
              radius={[0, 0, 3, 3]}
              maxBarSize={16}
              activeBar={{ stroke: '#825337', strokeWidth: 2 }}
              isAnimationActive={animate}
              animationDuration={360}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-details">
        <summary>{tx('Значения графика', 'График мәндері')}</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th>{tx('Период с', 'Кезең басталуы')}</th>
              <th>+ XP</th>
              <th>{tx('Корректировка XP', 'XP түзетуі')}</th>
              <th>{tx('Изменение XP', 'XP өзгерісі')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td>{d.label}</td>
                <td>{signed(d.earned)}</td>
                <td>{signed(d.adjusted)}</td>
                <td>{signed(d.earned + d.adjusted)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
