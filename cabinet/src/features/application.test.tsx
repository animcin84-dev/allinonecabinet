import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { LazyMotion, domAnimation } from 'motion/react'
import { createInitialState } from '../domain/fixtures'
import { emptyApplicationAnswers } from '../domain/application'
import type { Action, Locale } from '../domain/types'
import { ApplicationPage, restoreApplicationDraft, stepApplicationErrors } from './application'
const mocked = vi.hoisted(() => ({ value: {} as Record<string, unknown> }))
vi.mock('../app/context', () => ({ useClub: () => mocked.value }))
vi.mock('../components/ui/local-files', () => ({
  LocalFilePicker: () => <span>Локальное портфолио</span>,
}))
beforeEach(() => sessionStorage.clear())
afterEach(cleanup)
function context(locale: Locale = 'ru', actorId = 'u-applicant') {
  const state = createInitialState()
  const actor = state.users.find((u) => u.id === actorId)!
  const act = vi.fn(async (_action: Action) => state)
  mocked.value = {
    state,
    actor,
    locale,
    act,
    pending: false,
    error: null,
    toast: vi.fn(),
    setRole: vi.fn(),
    settings: { reducedMotion: true },
    tx: (ru: string, kk: string) => (locale === 'kk' ? kk : ru),
    L: (text: string | { ru: string; kk: string }) =>
      typeof text === 'string' ? text : text[locale],
  }
  return { actor, state, act }
}
function Page() {
  return (
    <MemoryRouter>
      <LazyMotion features={domAnimation}>
        <ApplicationPage />
      </LazyMotion>
    </MemoryRouter>
  )
}
function validDraft() {
  return {
    name: 'Демо Кандидат',
    email: 'demo@example.test',
    school: 'Демо школа',
    motivation: 'Демо: хочу создавать полезные проекты с командой.',
    skills: 'Лидерство',
    answers: {
      ...emptyApplicationAnswers(),
      birthDate: '2007-01-01',
      phone: '+77000000000',
      grade: '11',
      languages: 'Русский, қазақша',
      hasComputer: 'yes',
      telegram: '@demo_candidate',
      instagram: '@demo_candidate',
      gender: 'female',
      location: 'Демо город',
      departmentIds: ['media'],
      priority1: 'media',
      tools: ['figma'],
      skillIds: ['leadership'],
      experience: 'Демо проект',
      availability: '3to5',
      additional: 'Нет',
      portfolio: [
        {
          id: 'file-demo',
          name: 'demo.pdf',
          type: 'application/pdf',
          size: 12,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    },
  }
}
describe('full application workflow', () => {
  it('validates the current step and focuses its first invalid control', async () => {
    context()
    render(<Page />)
    await userEvent.click(screen.getByRole('button', { name: 'Далее: На связи →' }))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('02 · Дата рождения')),
    )
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('06 · Языки')).toBeNull()
  })
  it('keeps drafts across refresh, languages and failed saves without leaking to another actor', async () => {
    const original = context()
    const user = userEvent.setup()
    const page = render(<Page />)
    const name = screen.getByLabelText('01 · ФИО')
    await user.clear(name)
    await user.type(name, 'Демо новый черновик')
    mocked.value = {
      ...mocked.value,
      state: { ...original.state, applications: [...original.state.applications] },
    }
    page.rerender(<Page />)
    expect((screen.getByLabelText('01 · ФИО') as HTMLInputElement).value).toBe(
      'Демо новый черновик',
    )
    original.act.mockRejectedValueOnce(new Error('demo save failure'))
    await user.click(screen.getByRole('button', { name: 'Сохранить черновик' }))
    await waitFor(() => expect(screen.getByText('demo save failure')).toBeTruthy())
    expect(
      JSON.parse(sessionStorage.getItem(`allinone:application-draft:${original.actor.id}`)!).name,
    ).toBe('Демо новый черновик')
    page.unmount()
    context('kk')
    const translated = render(<Page />)
    expect((screen.getByLabelText('01 · Аты-жөні') as HTMLInputElement).value).toBe(
      'Демо новый черновик',
    )
    translated.unmount()
    context('ru', 'u-admin')
    render(<Page />)
    expect((screen.getByLabelText('01 · ФИО') as HTMLInputElement).value).toBe('')
  })
  it('limits departments to two and clears a removed priority', async () => {
    context()
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole('button', { name: /03 Твой вклад/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Media & Design' }))
    await user.click(screen.getByRole('checkbox', { name: 'PR' }))
    expect((screen.getByRole('checkbox', { name: 'Finance' }) as HTMLInputElement).disabled).toBe(
      true,
    )
    await user.selectOptions(screen.getByLabelText('14 · Первый приоритет'), 'media')
    await user.selectOptions(screen.getByLabelText('15 · Второй приоритет'), 'pr')
    await user.click(screen.getByRole('checkbox', { name: 'PR' }))
    expect((screen.getByLabelText('15 · Второй приоритет') as HTMLSelectElement).value).toBe('')
    expect((screen.getByLabelText('15 · Второй приоритет') as HTMLSelectElement).disabled).toBe(
      true,
    )
  })
  it('retains all answers on failed submission and submits the reviewed snapshot on retry', async () => {
    const { act, actor, state } = context()
    const draft = validDraft()
    sessionStorage.setItem(`allinone:application-draft:${actor.id}`, JSON.stringify(draft))
    const user = userEvent.setup()
    render(<Page />)
    await user.click(screen.getByRole('button', { name: /04 Твоя история/ }))
    await user.click(screen.getByRole('button', { name: 'Проверить ответы' }))
    expect(screen.getByRole('heading', { name: 'Всё на своих местах?' })).toBeTruthy()
    act.mockRejectedValueOnce(new Error('demo submit failure'))
    await user.click(screen.getByRole('button', { name: 'Отправить демо-заявку' }))
    await waitFor(() => expect(screen.getByText('demo submit failure')).toBeTruthy())
    expect(
      JSON.parse(sessionStorage.getItem(`allinone:application-draft:${actor.id}`)!).answers,
    ).toEqual(draft.answers)
    act.mockResolvedValueOnce(state)
    await user.click(screen.getByRole('button', { name: 'Отправить демо-заявку' }))
    await waitFor(() =>
      expect(sessionStorage.getItem(`allinone:application-draft:${actor.id}`)).toBeNull(),
    )
    expect(act.mock.calls[1]?.[0]).toMatchObject({
      type: 'application',
      payload: { formVersion: 2, coreId: '', answers: draft.answers, status: 'submitted' },
    })
    expect(screen.queryByRole('button', { name: 'Отправить демо-заявку' })).toBeNull()
  })
  it('restores legacy basics safely and scopes validation to the active step', () => {
    const fallback = {
      name: '',
      email: '',
      school: '',
      motivation: '',
      skills: '',
      answers: emptyApplicationAnswers(),
    }
    expect(restoreApplicationDraft('{bad-json', fallback)).toBe(fallback)
    expect(
      restoreApplicationDraft(
        JSON.stringify({
          name: 'Демо legacy',
          answers: { tools: ['figma', 7], portfolio: ['wrong'] },
        }),
        fallback,
      ),
    ).toMatchObject({ name: 'Демо legacy', answers: { tools: ['figma'], portfolio: [] } })
    expect(
      stepApplicationErrors(
        {
          name: 'required',
          'answers.grade': 'required',
          email: 'invalidEmail',
          'answers.portfolio': 'required',
        },
        0,
      ),
    ).toEqual({ name: 'required', 'answers.grade': 'required' })
  })
})
