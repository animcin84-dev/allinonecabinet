import { useId, useRef, useState } from 'react'
import * as m from 'motion/react-m'
import { useReducedMotion } from 'motion/react'
import { useClub } from '../app/context'
import type { LedgerEntry } from '../domain/types'
import { chartData } from './chart-data'
export function MiniXPChart({ entries }: { entries: LedgerEntry[] }) {
  const { locale, tx, settings } = useClub()
  const reduced = useReducedMotion()
  const [selected, setSelected] = useState(3)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const summaryId = useId()
  const data = chartData(entries, locale)
  const maxPositive = Math.max(0, ...data.flatMap((d) => [d.earned, Math.max(0, d.adjusted)]))
  const maxNegative = Math.max(0, ...data.map((d) => Math.max(0, -d.adjusted)))
  // Both sides of zero use the same scale, including negative-only periods.
  const scale = 112 / Math.max(1, maxPositive + maxNegative)
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value))
  const current = data[selected]
  const animate = !reduced && !settings.reducedMotion
  return (
    <div className="mini-chart">
      <div className="chart-legend">
        <span>
          <i />
          {tx('Начислено', 'Есептелді')}
        </span>
        <span>
          <i className="correction" />
          {tx('Корректировка', 'Түзету')}
        </span>
      </div>
      <div
        className="mini-bars"
        role="group"
        aria-label={tx('Выбери период графика XP', 'XP графигінің кезеңін таңда')}
      >
        {data.map((d, i) => (
          <button
            type="button"
            className="mini-period"
            key={d.label}
            ref={(node) => {
              buttons.current[i] = node
            }}
            aria-pressed={selected === i}
            aria-describedby={selected === i ? summaryId : undefined}
            aria-label={`${tx('Период с', 'Кезең басталуы')} ${d.label}: ${tx('начислено', 'есептелді')} ${signed(d.earned)} XP, ${tx('корректировка', 'түзету')} ${signed(d.adjusted)} XP`}
            onClick={() => setSelected(i)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (i + 1) % 4
                  : event.key === 'ArrowLeft'
                    ? (i + 3) % 4
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? 3
                        : null
              if (next === null) return
              event.preventDefault()
              setSelected(next)
              buttons.current[next]?.focus()
            }}
          >
            <div
              className="mini-bar-space"
              style={{ height: maxPositive * scale + 24 }}
              aria-hidden="true"
            >
              <span className="mini-value">
                {signed(d.earned)}
                {d.adjusted > 0 && (
                  <span className="mini-positive-correction-value"> / {signed(d.adjusted)}</span>
                )}
              </span>
              <div className="mini-positive-bars" style={{ height: maxPositive * scale }}>
                <m.div
                  className={`mini-bar ${selected === i ? 'last' : ''}`}
                  style={{ height: d.earned * scale, minHeight: 0, transformOrigin: 'bottom' }}
                  initial={animate ? { scaleY: 0 } : false}
                  animate={{ scaleY: 1 }}
                  transition={{
                    duration: animate ? 0.36 : 0,
                    delay: animate ? i * 0.04 : 0,
                    ease: 'easeOut',
                  }}
                />
                {d.adjusted > 0 && (
                  <m.i
                    className="mini-correction-positive"
                    style={{ height: d.adjusted * scale, transformOrigin: 'bottom' }}
                    initial={animate ? { scaleY: 0 } : false}
                    animate={{ scaleY: 1 }}
                    transition={{
                      duration: animate ? 0.36 : 0,
                      delay: animate ? i * 0.04 : 0,
                      ease: 'easeOut',
                    }}
                  />
                )}
              </div>
            </div>
            <div
              className="mini-correction"
              style={{ height: Math.max(16, maxNegative * scale) }}
              aria-hidden="true"
            >
              {d.adjusted < 0 && (
                <m.i
                  style={{ height: -d.adjusted * scale, transformOrigin: 'top' }}
                  initial={animate ? { scaleY: 0 } : false}
                  animate={{ scaleY: 1 }}
                  transition={{
                    duration: animate ? 0.36 : 0,
                    delay: animate ? i * 0.04 : 0,
                    ease: 'easeOut',
                  }}
                />
              )}
              {d.adjusted < 0 && <span>{signed(d.adjusted)}</span>}
            </div>
            <small aria-hidden="true">{d.label}</small>
          </button>
        ))}
      </div>
      <div
        className="chart-selection"
        id={summaryId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>
          {tx('Период с', 'Кезең басталуы')} {current.label}
        </span>
        <strong>{signed(current.earned + current.adjusted)} XP</strong>
        <small>
          {tx('Начислено', 'Есептелді')} {signed(current.earned)} · {tx('корректировка', 'түзету')}{' '}
          {signed(current.adjusted)}
        </small>
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
