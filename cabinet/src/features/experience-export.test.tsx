import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { createInitialState } from '../domain/fixtures'
import { ExperiencePage } from './experience'
const mock = vi.hoisted(() => ({ context: {} as Record<string, unknown>, download: vi.fn() }))
vi.mock('../app/context', () => ({ useClub: () => mock.context }))
vi.mock('../services/export', async (original) => ({
  ...await original<typeof import('../services/export')>(), downloadText: mock.download,
}))
vi.mock('./monthly-experience', () => ({ MonthlyExperience: () => null, ManualRankEditor: () => null }))
vi.mock('../components/workspace', () => ({ XPCard: () => null, ChartSlot: () => null }))
afterEach(() => { cleanup(); vi.clearAllMocks() })
function setup(entries = true) {
  const state = createInitialState(), actor = state.users.find(u => u.id === 'u-member')!
  state.ledger = entries ? [
    { id:'mine',userId:actor.id,points:-10,at:'2026-10-10T08:00:00Z',reason:{ru:'Моя корректировка',kk:'Менің түзетуім'},kind:'adjustment' },
    { id:'mine-award',userId:actor.id,points:5,at:'2026-10-10T08:00:00Z',reason:{ru:'Моё начисление',kk:'Менің есептеуім'},kind:'award' },
    { id:'other',userId:'u-other',points:-15,at:'2026-10-10T08:00:00Z',reason:{ru:'Чужая запись',kk:'Басқа жазба'},kind:'adjustment' },
  ] : []
  mock.context = {state,actor,locale:'ru',tx:(ru:string)=>ru,L:(text:{ru:string})=>text.ru}
  render(<MemoryRouter initialEntries={['/ru/app/experience?kind=adjustment']}><ExperiencePage /></MemoryRouter>)
}
describe('XP export visibility boundary', () => {
  it('exports only the current actor and selected history filter', () => {
    setup()
    fireEvent.click(screen.getByRole('button',{name:'Скачать CSV'}))
    const [csv, filename] = mock.download.mock.calls[0]
    expect(csv).toContain('Моя корректировка')
    expect(csv).toContain('-10')
    expect(csv).not.toContain('Моё начисление')
    expect(csv).not.toContain('Чужая запись')
    expect(filename).toBe('allinone-xp-adjustment-ru.csv')
    expect(screen.getByText('Файл подготовлен для скачивания')).toBeTruthy()
  })
  it('disables an empty export and announces preparation failure without success', () => {
    setup(false)
    expect((screen.getByRole('button',{name:'Скачать CSV'}) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    setup()
    mock.download.mockImplementationOnce(() => {throw new Error('storage')})
    fireEvent.click(screen.getByRole('button',{name:'Скачать CSV'}))
    expect(screen.getByText('Не удалось подготовить файл. Попробуй ещё раз.')).toBeTruthy()
    expect(screen.queryByText('Файл подготовлен для скачивания')).toBeNull()
  })
})
