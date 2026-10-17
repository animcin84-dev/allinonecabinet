import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { LazyMotion, domAnimation } from 'motion/react'
import '@testing-library/jest-dom/vitest'
import type { LedgerEntry } from '../domain/types'
import { MiniXPChart } from './mini-xp-chart'

vi.mock('../app/context', () => ({
  useClub: () => ({
    locale: 'ru',
    tx: (ru: string) => ru,
    settings: { reducedMotion: true },
  }),
}))
afterEach(cleanup)

function entry(id: string, daysAgo: number, points: number): LedgerEntry {
  return {
    id,
    at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    points,
    userId: 'u-member',
    kind: points < 0 ? 'adjustment' : 'award',
    reason: { ru: 'Демо-проверка', kk: 'Демо-тексеру' },
  }
}
function show(entries: LedgerEntry[]) {
  render(
    <LazyMotion features={domAnimation} strict>
      <MiniXPChart entries={entries} />
    </LazyMotion>,
  )
  return within(screen.getByRole('group', { name: 'Выбери период графика XP' })).getAllByRole(
    'button',
  )
}

describe('XP chart period selection', () => {
  it('keeps signed corrections and the actual net value when selecting a period by touch/click', () => {
    const periods = show([
      entry('earned', 22, 12),
      entry('correction', 22, -3),
      entry('recent', 1, 5),
    ])
    expect(periods[3]).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(periods[0])
    expect(periods[0]).toHaveAttribute('aria-pressed', 'true')
    expect(periods[3]).toHaveAttribute('aria-pressed', 'false')
    expect(periods[0]).toHaveAccessibleName(/начислено \+12 XP, корректировка -3 XP/)
    expect(screen.getByRole('status')).toHaveTextContent('+9 XP')
    expect(screen.getByRole('status')).toHaveTextContent('Начислено +12 · корректировка -3')
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('+12-3+9')
  })

  it('moves selection and focus with arrows and Home/End without requiring a pointer', () => {
    const periods = show([])
    periods[3].focus()
    fireEvent.keyDown(periods[3], { key: 'ArrowRight' })
    expect(periods[0]).toHaveFocus()
    expect(periods[0]).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(periods[0], { key: 'End' })
    expect(periods[3]).toHaveFocus()
    fireEvent.keyDown(periods[3], { key: 'Home' })
    expect(periods[0]).toHaveFocus()
    fireEvent.keyDown(periods[0], { key: 'ArrowLeft' })
    expect(periods[3]).toHaveFocus()
    expect(screen.getByRole('status')).toHaveTextContent('0 XP')
  })

  it('uses the same geometric scale above and below zero, without displaying a positive bar for zero', () => {
    const periods = show([
      entry('earned', 22, 12),
      entry('correction', 22, -3),
      entry('negative-only', 1, -6),
    ])
    const positive = periods[0].querySelector<HTMLElement>('.mini-bar')!
    const negative = periods[0].querySelector<HTMLElement>('.mini-correction i')!
    expect(
      Number.parseFloat(positive.style.height) / Number.parseFloat(negative.style.height),
    ).toBe(4)
    expect(periods[3].querySelector<HTMLElement>('.mini-bar')!.style.height).toBe('0px')
    expect(screen.getByRole('status')).toHaveTextContent('-6 XP')
  })

  it('places a positive correction above zero as a distinct series, without a negative correction bar', () => {
    const correction = { ...entry('positive-correction', 1, 6), kind: 'adjustment' as const }
    const periods = show([entry('earned', 1, 12), correction])
    expect(periods[3]).toHaveAccessibleName(/начислено \+12 XP, корректировка \+6 XP/)
    const positive = periods[3].querySelector<HTMLElement>('.mini-bar')!
    const adjusted = periods[3].querySelector<HTMLElement>('.mini-correction-positive')!
    expect(adjusted.closest('.mini-positive-bars')).not.toBeNull()
    expect(
      Number.parseFloat(positive.style.height) / Number.parseFloat(adjusted.style.height),
    ).toBe(2)
    expect(periods[3].querySelector('.mini-correction i')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('+18 XP')
    expect(screen.getByRole('status')).toHaveTextContent('Начислено +12 · корректировка +6')
  })
})
