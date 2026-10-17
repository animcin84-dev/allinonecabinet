import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { createInitialState } from '../domain'
import type { Locale } from '../domain'
import { InboxPage } from './secondary'
import { ProjectMaterials } from './project-workspace'
import { Workload } from './workload'

const mocked = vi.hoisted(() => ({value: {} as Record<string, unknown>}))
vi.mock('../app/context', () => ({useClub: () => mocked.value}))
afterEach(cleanup)
function setup(locale: Locale = 'ru', actorId = 'u-member') {
  const state = createInitialState(), actor = state.users.find(u => u.id === actorId)!
  mocked.value = {state, actor, locale, role: actor.role, pending: false, error: null, act: vi.fn(),
    tx: (ru: string, kk: string) => locale === 'kk' ? kk : ru,
    L: (v: string | {ru: string; kk: string}) => typeof v === 'string' ? v : v[locale]}
  return state
}
describe('mobile workspace usability', () => {
  it('shows newest own notices first without changing the shared state order', () => {
    const state = setup()
    const notice = {userId: 'u-member', read: false, body: {ru: 'Демо', kk: 'Демо'}}
    state.notices = [
      {...notice, id: 'old', title: {ru: 'Старое', kk: 'Ескі'}, at: '2026-10-01T09:00:00Z'},
      {...notice, id: 'private', userId: 'u-other', title: {ru: 'Чужое', kk: 'Басқа'}, at: '2026-10-09T09:00:00Z'},
      {...notice, id: 'new', title: {ru: 'Новое', kk: 'Жаңа'}, at: '2026-10-02T09:00:00Z'},
    ]
    render(<MemoryRouter><InboxPage /></MemoryRouter>)
    expect(screen.getAllByRole('heading', {level: 3}).map(e => e.textContent)).toEqual(['Новое', 'Старое'])
    expect(state.notices.map(n => n.id)).toEqual(['old', 'private', 'new'])
    fireEvent.change(screen.getByLabelText('Тип события'), {target: {value: 'project'}})
    expect(screen.getByRole('heading', {name: 'Нет событий этого типа'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Сбросить фильтры'}))
    expect(screen.getAllByRole('heading', {level: 3})).toHaveLength(2)
  })
  it('does not tell a participant to add materials when they cannot manage them', () => {
    setup('kk')
    render(<MemoryRouter><ProjectMaterials projectId="html" /></MemoryRouter>)
    expect(screen.queryByRole('button', {name: /Материал қосу/})).toBeNull()
    expect(screen.getByText('Жоба жетекшісі қосқан материалдар осында көрсетіледі.')).toBeTruthy()
  })
  it('distinguishes a filtered material list from an empty project and lets the user recover', () => {
    const state = setup()
    state.materials = [{id:'source',projectId:'html',title:'Демо брендбук',category:'Дизайн',url:'https://example.com',by:'u-manager',at:'2026-10-01T09:00:00Z'}]
    render(<MemoryRouter><ProjectMaterials projectId="html" /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText('Поиск по названию и категории'), {target: {value: '  Брендбук  '}})
    expect(screen.getByRole('heading', {name: 'Демо брендбук'})).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Поиск по названию и категории'), {target: {value: 'Не найдено'}})
    expect(screen.getByRole('heading', {name: 'Ничего не найдено'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Сбросить фильтры'}))
    expect(screen.getByRole('heading', {name: 'Демо брендбук'})).toBeTruthy()
  })
  it('keeps member-specific task filters and counts in the mobile workload cards', () => {
    const state = setup('kk', 'u-admin')
    render(<MemoryRouter><Workload /></MemoryRouter>)
    const list = screen.getByRole('list', {name: 'Қатысушылар жүктемесі'})
    const member = within(list).getByRole('link', {name: 'Демо: Алина ↗'}).closest('li')!
    const own = state.tasks.filter(t => t.assigneeId === 'u-member' && !t.archived && t.status !== 'done')
    const review = own.filter(t => t.status === 'review').length
    expect(within(member).getByRole('link', {name: `Тексерілуде · Демо: Алина: ${review} ↗`}).getAttribute('href')).toBe('/kk/app/tasks?assignee=u-member&status=review')
    expect(member.querySelector('dl dd')?.textContent).toBe(String(own.length))
  })
})
