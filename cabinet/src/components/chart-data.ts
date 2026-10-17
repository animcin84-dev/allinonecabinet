import type { LedgerEntry, Locale } from '../domain/types'
import { dateLabel } from './shared'
export function chartData(entries: LedgerEntry[], locale: Locale, days = 28, clock = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(clock)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const calendar = `${part('year')}-${part('month')}-${part('day')}`
  const endOfDay = new Date(`${calendar}T23:59:59.999+05:00`).getTime()
  const period = days / 4
  return Array.from({ length: 4 }, (_, i) => {
    const end = endOfDay - (3 - i) * period * 86400000
    const start = end - period * 86400000
    const rows = entries.filter((e) => Date.parse(e.at) > start && Date.parse(e.at) <= end)
    return {
      label: dateLabel(new Date(start + 1).toISOString(), locale),
      earned: rows.filter((e) => e.kind === 'award').reduce((s, e) => s + e.points, 0),
      adjusted: rows.filter((e) => e.kind === 'adjustment').reduce((s, e) => s + e.points, 0),
    }
  })
}
