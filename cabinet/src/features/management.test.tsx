import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { createInitialState } from '../domain/fixtures'
import type { Role, State } from '../domain/types'
import { ManagementPage } from './management'

const mocked = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../app/context', () => ({ useClub: () => mocked.value }))
afterEach(cleanup)
function setup(role: Role, path: string, state: State = createInitialState()) {
  const actor = state.users.find((u) => u.role === role)!
  mocked.value = {
    role,
    actor,
    state,
    locale: 'ru',
    tx: (ru: string) => ru,
    L: (text: { ru: string } | string) => (typeof text === 'string' ? text : text.ru),
    act: vi.fn(async () => state),
    pending: false,
    toast: vi.fn(),
    retry: vi.fn(),
  }
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ru/manage" element={<ManagementPage />} />
        <Route path="/ru/manage/:section" element={<ManagementPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
describe('management scope and closed decisions', () => {
  it('blocks a direct warning route for a project manager', () => {
    setup('manager', '/ru/manage/warnings')
    expect(screen.getByRole('heading', { name: 'Раздел недоступен в этой роли' })).toBeTruthy()
    expect(screen.queryByText('Демо: уточнить договоренности с организаторами.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Добавить предупреждение' })).toBeNull()
  })
  it('only exposes projects in a head’s core, even if unscoped data is supplied', () => {
    setup('head', '/ru/manage/projects')
    expect(screen.getByRole('link', { name: 'HTML Challenge 2026' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Aspan MUN' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'AMUSE MUN' })).toBeNull()
  })
  it('does not offer a manager their own submission as a review action', () => {
    setup('manager', '/ru/manage/review')
    expect(screen.getByRole('link', { name: 'Проверить мобильные макеты' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Согласовать план команды' })).toBeNull()
  })
  it('shows a completed application without a second decision form', () => {
    const state = createInitialState()
    state.applications[0] = {
      ...state.applications[0],
      status: 'accepted',
      motivation: 'Готов помогать команде с дизайном.',
      comment: 'Демо: заявка принята',
    }
    setup('admin', '/ru/manage/applications', state)
    expect(screen.getByText('Принята')).toBeTruthy()
    expect(screen.getByText('Решение: Демо: заявка принята')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Сохранить решение' })).toBeNull()
  })
})
