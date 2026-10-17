import { describe, expect, it } from 'vitest'
import { chartData } from './chart-data'
import { dateLabel } from './shared'
import type { LedgerEntry } from '../domain/types'

const entry = (id: string, at: string, points: number): LedgerEntry => ({
  id,
  at,
  points,
  userId: 'u-member',
  kind: points < 0 ? 'adjustment' : 'award',
  reason: { ru: 'Пример', kk: 'Мысал' },
})

describe('localized contribution chart', () => {
  it('keeps positive corrections separate from earned awards', () => {
    const data = chartData(
      [
        entry('award', '2026-10-09T12:00:00Z', 20),
        { ...entry('positive-correction', '2026-10-09T12:00:00Z', 6), kind: 'adjustment' },
        entry('negative-correction', '2026-10-09T12:00:00Z', -3),
      ],
      'ru',
      28,
      new Date('2026-10-09T12:00:00Z'),
    )
    expect(data[3].earned).toBe(20)
    expect(data[3].adjusted).toBe(3)
  })
  it('uses the Almaty calendar day, including an award after midnight local time', () => {
    const data = chartData(
      [
        entry('outside', '2026-09-11T18:59:59.999Z', 100),
        entry('first', '2026-09-11T19:00:00.000Z', 10),
        entry('correction', '2026-10-08T19:00:00.000Z', -3),
        entry('today', '2026-10-09T18:59:59.999Z', 5),
        entry('tomorrow', '2026-10-09T19:00:00.000Z', 100),
      ],
      'kk',
      28,
      new Date('2026-10-08T20:00:00Z'),
    )
    expect(data.map((d) => d.label)).toEqual(['12 қыр.', '19 қыр.', '26 қыр.', '3 қаз.'])
    expect(data.reduce((sum, d) => sum + d.earned, 0)).toBe(15)
    expect(data.reduce((sum, d) => sum + d.adjusted, 0)).toBe(-3)
  })
  it('counts each boundary entry once and extends the range for 56 days', () => {
    const entries = [
      entry('older', '2026-08-20T12:00:00Z', 20),
      entry('boundary', '2026-09-18T19:00:00Z', 10),
    ]
    const clock = new Date('2026-10-09T12:00:00Z')
    expect(chartData(entries, 'ru', 28, clock).reduce((sum, d) => sum + d.earned, 0)).toBe(10)
    expect(chartData(entries, 'ru', 56, clock).reduce((sum, d) => sum + d.earned, 0)).toBe(30)
  })
  it('renders a Kazakh month and local time without requiring kk ICU support', () => {
    expect(dateLabel('2026-10-08T20:05:00Z', 'kk', true)).toBe('9 қаз., 01:05')
  })
})
