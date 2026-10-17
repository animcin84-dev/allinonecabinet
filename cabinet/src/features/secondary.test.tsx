import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { createInitialState } from '../domain/fixtures'
import type { Action, Locale } from '../domain/types'
import { ProfilePage, ProjectMedia } from './secondary'
import { ApplicationPage } from './auth'

const mocked = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../app/context', () => ({ useClub: () => mocked.value }))
beforeEach(() => sessionStorage.clear())
afterEach(cleanup)
function context(locale: Locale = 'ru', actorId = 'u-member') {
  const state = createInitialState()
  const actor = state.users.find((u) => u.id === actorId)!
  const act = vi.fn(async (_action: Action) => state)
  const setRole = vi.fn()
  mocked.value = {
    state,
    actor,
    role: actor.role,
    locale,
    act,
    setRole,
    pending: false,
    error: null,
    toast: vi.fn(),
    retry: vi.fn(),
    tx: (ru: string, kk: string) => (locale === 'kk' ? kk : ru),
    L: (text: string | { ru: string; kk: string }) =>
      typeof text === 'string' ? text : text[locale],
  }
  return { state, actor, act, setRole }
}
function Profile() {
  return (
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  )
}

describe('secondary screens preserve user work', () => {
  it('restores an unsaved profile in the other language without assigning the draft to another actor', async () => {
    const user = userEvent.setup()
    const original = context()
    const rendered = render(<Profile />)
    const name = screen.getByLabelText('Имя')
    await user.clear(name)
    await user.type(name, 'Демо черновик')
    expect(
      JSON.parse(sessionStorage.getItem(`allinone:profile-draft:${original.actor.id}`)!).name,
    ).toBe('Демо черновик')
    rendered.unmount()
    context('kk')
    const translated = render(<Profile />)
    expect((screen.getByLabelText('Аты') as HTMLInputElement).value).toBe('Демо черновик')
    translated.unmount()
    const other = context('ru', 'u-admin')
    render(<Profile />)
    expect((screen.getByLabelText('Имя') as HTMLInputElement).value).toBe(other.actor.name)
    expect((screen.getByLabelText('Имя') as HTMLInputElement).value).not.toBe('Демо черновик')
  })
  it('retains profile draft after a failed save, and removes it after a successful retry', async () => {
    const user = userEvent.setup()
    const { actor, act, state } = context()
    act.mockRejectedValueOnce(new Error('demo network failure'))
    render(<Profile />)
    const name = screen.getByLabelText('Имя')
    await user.clear(name)
    await user.type(name, 'Демо новая версия')
    await user.click(screen.getByRole('button', { name: 'Сохранить профиль' }))
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1))
    expect((name as HTMLInputElement).value).toBe('Демо новая версия')
    expect(JSON.parse(sessionStorage.getItem(`allinone:profile-draft:${actor.id}`)!).name).toBe(
      'Демо новая версия',
    )
    act.mockResolvedValueOnce(state)
    await user.click(screen.getByRole('button', { name: 'Сохранить профиль' }))
    await waitFor(() =>
      expect(sessionStorage.getItem(`allinone:profile-draft:${actor.id}`)).toBeNull(),
    )
    expect(act.mock.calls[1]?.[0]).toMatchObject({
      type: 'profile',
      payload: { name: 'Демо новая версия' },
    })
  })
  it('opens the accepted candidate’s workspace without switching to another demo identity', async () => {
    const user = userEvent.setup()
    const { state, actor, setRole } = context('ru', 'u-applicant')
    actor.role = 'member'
    state.applications[0] = { ...state.applications[0], userId: actor.id, status: 'accepted' }
    render(
      <MemoryRouter initialEntries={['/ru/application']}>
        <Routes>
          <Route path="/ru/application" element={<ApplicationPage />} />
          <Route path="/ru/app" element={<h1>Рабочий кабинет</h1>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Отправить демо-заявку' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Открыть кабинет' }))
    expect(screen.getByRole('heading', { name: 'Рабочий кабинет' })).toBeTruthy()
    expect(setRole).not.toHaveBeenCalled()
  })
})
describe('project photography fallback', () => {
  it('uses an actual project title when photography is unavailable and recovers for a new source', () => {
    context()
    const view = render(<ProjectMedia src="" title="YRT" />)
    expect(screen.getByRole('img', { name: 'Типографическая обложка проекта YRT' }).tagName).toBe(
      'DIV',
    )
    expect(view.container.querySelector('img')).toBeNull()
    view.rerender(<ProjectMedia src="https://example.com/demo-photo.webp" title="AMUSE MUN" />)
    const image = screen.getByRole('img', { name: 'AMUSE MUN' })
    fireEvent.error(image)
    expect(
      screen.getByRole('img', { name: 'Типографическая обложка проекта AMUSE MUN' }),
    ).toBeTruthy()
    view.rerender(<ProjectMedia src="https://example.com/new-demo-photo.webp" title="AMUSE MUN" />)
    expect(screen.getByRole('img', { name: 'AMUSE MUN' }).tagName).toBe('IMG')
  })
})
