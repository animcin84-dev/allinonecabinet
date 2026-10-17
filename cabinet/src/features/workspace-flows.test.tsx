import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createInitialState } from '../domain'
import { TaskEditor } from './task-editor'
import { TaskCollaboration } from './task-collaboration'
import { cleanView } from './saved-views'
import { toAlmatyInstant } from '../domain/time'
import { almatyDay } from './calendar'
const mocked=vi.hoisted(()=>({value:{} as Record<string,unknown>}))
vi.mock('../app/context',()=>({useClub:()=>mocked.value}))
afterEach(cleanup)
function setup(role='admin'){const state=createInitialState(),actor=state.users.find(u=>u.role===role)!;mocked.value={state,actor,role,locale:'ru',tx:(ru:string)=>ru,L:(x:{ru:string})=>x.ru,act:vi.fn().mockRejectedValue(new Error('offline')),pending:false,toast:vi.fn(),retry:vi.fn()};return state}
describe('workspace UI failures and persistence boundaries',()=>{
  it('keeps edited task input after a failed save',async()=>{const state=setup();const task=state.tasks.find(t=>t.status==='todo')!;const router=createMemoryRouter([{path:'/',element:<TaskEditor task={task} onClose={vi.fn()}/>}]);render(<RouterProvider router={router}/>);fireEvent.change(screen.getByLabelText('Название · RU'),{target:{value:'Изменённый демо заголовок'}});fireEvent.click(screen.getByRole('button',{name:'Сохранить редакцию'}));await screen.findByText('offline');expect((screen.getByLabelText('Название · RU') as HTMLInputElement).value).toBe('Изменённый демо заголовок')})
  it('blocks internal navigation while a task editor has unsaved work',async()=>{const state=setup();const task=state.tasks.find(t=>t.status==='todo')!;const router=createMemoryRouter([{path:'/',element:<TaskEditor task={task} onClose={vi.fn()}/>},{path:'/next',element:<h1>Next</h1>}]);render(<RouterProvider router={router}/>);fireEvent.change(screen.getByLabelText('Название · RU'),{target:{value:'Uncommitted'}});await router.navigate('/next');await screen.findByRole('dialog');expect(screen.queryByRole('heading',{name:'Next'})).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Продолжить редактирование'}));await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());expect((screen.getByLabelText('Название · RU') as HTMLInputElement).value).toBe('Uncommitted')})
  it('retains a comment draft on failure and does not interpret HTML',async()=>{const state=setup('member'),task=state.tasks.find(t=>t.assigneeId==='u-member')!;task.comments=[{id:'test',by:'u-member',text:'<img src=x onerror=alert(1)>',at:'2026-10-10T08:00:00Z',edits:[]}];render(<TaskCollaboration task={task}/>);expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();expect(document.querySelector('.comment img')).toBeNull();fireEvent.change(screen.getByLabelText('Комментарий'),{target:{value:'Мой сохранённый черновик'}});fireEvent.click(screen.getByRole('button',{name:/Отправить комментарий/}));await screen.findByText('offline');expect((screen.getByLabelText('Комментарий') as HTMLTextAreaElement).value).toBe('Мой сохранённый черновик')})
  it('does not give an assignee checklist management controls',()=>{const state=setup('member'),task=state.tasks.find(t=>t.assigneeId==='u-member')!;task.checklist=[{id:'first',text:'First',done:false}];render(<TaskCollaboration task={task}/>);expect(screen.getByRole('checkbox',{name:'First'})).toBeTruthy();expect(screen.queryByRole('button',{name:/Удалить пункт/})).toBeNull();expect(screen.queryByRole('textbox',{name:'Новый пункт'})).toBeNull()})
  it('only saves filters instead of query results or role hints',()=>{expect(cleanView('q=demo&role=admin&token=secret&assignee=u-member&sort=due')).toBe('q=demo&assignee=u-member&sort=due')})
  it('uses Almaty midnight consistently in agenda dates',()=>{expect(almatyDay('2026-10-09T20:00:00Z')).toBe('2026-10-10');expect(almatyDay('2026-10-09T18:59:00Z')).toBe('2026-10-09');expect(toAlmatyInstant('2023-10-10T12:00')).toBe('2023-10-10T06:00:00.000Z');expect(toAlmatyInstant('2026-10-10T12:00')).toBe('2026-10-10T07:00:00.000Z')})
})
