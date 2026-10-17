import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { createInitialState, scopedState } from '../domain'
import { Shell } from './shell'

const mocked = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('./context', () => ({ useClub: () => mocked.value }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => (key === 'settings' ? 'Настройки' : key) }),
}))
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
function TestShell({path}: {path:string}) {
  return <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/ru" element={<Shell />}>
          <Route path="application" element={<h1>Моя заявка</h1>} />
          <Route path="app/profile" element={<h1>Личный профиль</h1>} />
          <Route path="app/settings" element={<h1>Личные настройки</h1>} />
          <Route path="app/tasks" element={<h1>Рабочие задачи</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>
}
function candidate(path: string, overrides: Record<string,unknown> = {}) {
  const state = scopedState(createInitialState(), 'u-applicant')
  mocked.value = {
    state,
    actor: state.users.find((u) => u.id === 'u-applicant'),
    role: 'applicant',
    demoRole: 'applicant',
    locale: 'ru',
    loading: false,
    error: null,
    settings: { reducedMotion: true, notifications: true },
    tx: (ru: string) => ru,
    L: (value: string | { ru: string }) => (typeof value === 'string' ? value : value.ru),
    message: '',
    setRole: vi.fn(),
    ...overrides,
  }
  return render(<TestShell path={path} />)
}
describe('candidate navigation before membership', () => {
  it('retains an accepted candidate deep link while their current role is loading', async () => {
    const view = candidate('/ru/app/tasks', {state:undefined,actor:undefined,loading:true})
    expect(screen.getByRole('heading',{name:'Открываем рабочую тетрадь'})).toBeTruthy()
    expect(screen.queryByRole('heading',{name:'Моя заявка'})).toBeNull()
    const state = createInitialState()
    const actor = state.users.find(u=>u.id==='u-applicant')!
    actor.role = 'member'
    mocked.value = {...mocked.value,state,actor,role:'member',loading:false}
    view.rerender(<TestShell path="/ru/app/tasks" />)
    expect(await screen.findByRole('heading',{name:'Рабочие задачи'})).toBeTruthy()
    expect(screen.queryByRole('heading',{name:'Моя заявка'})).toBeNull()
  })
  it('redirects a workspace deep link and does not offer unavailable task/project navigation', async () => {
    candidate('/ru/app/tasks')
    expect(await screen.findByRole('heading', { name: 'Моя заявка' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Рабочие задачи' })).toBeNull()
    const navigation = within(screen.getByRole('navigation', { name: 'Мобильная навигация' }))
    expect(navigation.queryByRole('link', { name: /Задачи|Проекты/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Поиск по кабинету' })).toBeNull()
  })
  it('allows a candidate to reach personal settings from their own profile', async () => {
    candidate('/ru/app/profile')
    expect(screen.getByRole('heading', { name: 'Личный профиль' })).toBeTruthy()
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Мобильная навигация' })).getByRole('link', {
        name: 'Настройки',
      }),
    )
    expect(await screen.findByRole('heading', { name: 'Личные настройки' })).toBeTruthy()
  })
})
