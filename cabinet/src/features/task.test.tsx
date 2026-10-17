import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { TaskPage } from './task'
import { applyAction, createInitialState, totalXP } from '../domain'
import type { Action, Role, State } from '../domain/types'
import type { useClub } from '../app/context'

const mocked = vi.hoisted(() => ({ value: {} as Partial<ReturnType<typeof useClub>> }))
vi.mock('../app/context', () => ({ useClub: () => mocked.value }))
beforeEach(() => {
  localStorage.clear()
})
afterEach(cleanup)
function setup(
  role: Role,
  taskId = 'task-01',
  state: State = createInitialState(),
  actionImpl?: (action: Action) => Promise<State>,
) {
  const actor = state.users.find((u) => u.role === role)!
  const act = vi.fn<(action: Action) => Promise<State>>(actionImpl ?? (async () => state))
  const toast = vi.fn()
  mocked.value = {
    role,
    actor,
    state,
    locale: 'ru',
    tx: (ru: string) => ru,
    L: (text) => (typeof text === 'string' ? text : text.ru),
    act,
    pending: false,
    toast,
    retry: vi.fn(),
  }
  const tree = () => (
    <MemoryRouter initialEntries={[`/ru/app/tasks/${taskId}`]}>
      <Routes>
        <Route path="/ru/app/tasks/:taskId" element={<TaskPage />} />
      </Routes>
    </MemoryRouter>
  )
  const view = render(tree())
  return { act, toast, state, rerender: () => view.rerender(tree()), user: userEvent.setup() }
}
describe('task result form and review interactions', () => {
  it('submits a valid result with an empty optional URL once through the actual form', async () => {
    const { user, act, toast } = setup('member')
    await user.type(
      screen.getByLabelText('Что сделано?'),
      'Подготовлен двуязычный медиакит, проверены все блоки.',
    )
    await user.click(screen.getByRole('button', { name: /Отправить на проверку/ }))
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1))
    expect(act).toHaveBeenCalledWith({
      type: 'submit',
      taskId: 'task-01',
      revision: 1,
      text: 'Подготовлен двуязычный медиакит, проверены все блоки.',
      url: '',
    })
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1))
    expect(localStorage.getItem('allinone:draft:u-member:task-01')).toBeNull()
  })
  it('rejects a non-HTTP link before any mutation and explains how to fix it', async () => {
    const { user, act } = setup('member')
    await user.type(
      screen.getByLabelText('Что сделано?'),
      'Подготовлен результат задачи и проверен перевод.',
    )
    await user.type(
      screen.getByLabelText('Ссылка на работу (необязательно)'),
      'javascript:alert(1)',
    )
    await user.click(screen.getByRole('button', { name: /Отправить на проверку/ }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Укажи полную HTTP/HTTPS-ссылку.',
    )
    expect(act).not.toHaveBeenCalled()
  })
  it('preserves result fields and the persisted draft when sending fails', async () => {
    const initial = createInitialState()
    const beforeXP = totalXP(initial, 'u-member')
    const { user, act, toast } = setup('member', 'task-01', initial, async () => {
      throw new Error('Демо: сеть недоступна')
    })
    const text = 'Готовы оба языка медиакита, результат можно проверить.'
    await user.type(screen.getByLabelText('Что сделано?'), text)
    await user.type(
      screen.getByLabelText('Ссылка на работу (необязательно)'),
      'https://example.test/result',
    )
    await user.click(screen.getByRole('button', { name: /Отправить на проверку/ }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Демо: сеть недоступна'),
    )
    expect(act).toHaveBeenCalledTimes(1)
    expect((screen.getByLabelText('Что сделано?') as HTMLTextAreaElement).value).toBe(text)
    expect(JSON.parse(localStorage.getItem('allinone:draft:u-member:task-01')!)).toEqual({
      text,
      url: 'https://example.test/result',
    })
    expect(toast).not.toHaveBeenCalled()
    expect(totalXP(initial, 'u-member')).toBe(beforeXP)
  })
  it('requires a return reason and never claims an XP award for a returned result', async () => {
    const state = createInitialState()
    const beforeXP = totalXP(state, 'u-member')
    const { user, act, toast } = setup('manager', 'task-02', state, async (action) =>
      applyAction(state, 'u-manager', { ...action, requestId: 'return-ui' }),
    )
    await user.click(screen.getByRole('button', { name: 'На доработку' }))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Для возврата укажи причину'),
    )
    expect(act).not.toHaveBeenCalled()
    await user.type(
      screen.getByLabelText('Комментарий проверяющего'),
      'Исправить контраст на телефоне.',
    )
    await user.click(screen.getByRole('button', { name: 'На доработку' }))
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1))
    const returned: State = await act.mock.results[0].value
    expect(totalXP(returned, 'u-member')).toBe(beforeXP)
    expect(returned.tasks.find((t) => t.id === 'task-02')?.reviews[0].decision).toBe('returned')
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Вернули на доработку. XP не изменился.'),
    )
  })
  it('hides review actions after confirmation and shows one recorded award', async () => {
    const state = createInitialState()
    const { user, act, rerender, toast } = setup('manager', 'task-02', state, async (action) =>
      applyAction(state, 'u-manager', { ...action, requestId: 'approve-ui' }),
    )
    await user.click(screen.getByRole('button', { name: 'Подтвердить +15 XP' }))
    await waitFor(() => expect(act).toHaveBeenCalledTimes(1))
    const approved: State = await act.mock.results[0].value
    mocked.value.state = approved
    rerender()
    expect(await screen.findByText('✓ ВКЛАД ПОДТВЕРЖДЁН')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Подтвердить/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'На доработку' })).toBeNull()
    expect(approved.ledger.filter((e) => e.taskId === 'task-02')).toHaveLength(1)
    await waitFor(() => expect(toast).toHaveBeenCalledWith('Результат подтверждён. +15 демо-XP.'))
  })
})
