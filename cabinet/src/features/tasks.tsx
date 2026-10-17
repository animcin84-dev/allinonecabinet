import { SavedViews } from './saved-views'
import { useSearchParams } from 'react-router'
import { useClub } from '../app/context'
import { Button, PageHeader, Sheet, StatusBadge, Empty, DemoNote } from '../components/shared'
import { ClubIcon } from '../components/icons'
import { TaskRow } from '../components/workspace'
import type { Status } from '../domain/types'
const statuses: Status[] = ['todo', 'in_progress', 'review', 'done']
export function TasksPage() {
  const { state, actor, tx, L } = useClub()
  const [params, setParams] = useSearchParams()
  if (!state || !actor) return null
  const q = params.get('q') ?? ''
  const status = params.get('status') ?? 'all'
  const project = params.get('project') ?? 'all'
  const view = params.get('view') ?? 'list'
  const mine = params.get('scope') === 'mine'
  const assignee = params.get('assignee') ?? 'all', overdue = params.get('overdue') === 'yes', archived = params.get('archived') === 'yes', sort = params.get('sort') ?? 'due'
  const update = (key: string, value: string) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      value && value !== 'all' ? next.set(key, value) : next.delete(key)
      return next
    })
  const base = state.tasks.filter(
    (t) =>
      (!!(t.archived || state.projects.find(p=>p.id===t.projectId)?.archived) === archived) && (assignee === 'all' || t.assigneeId === assignee) && (!overdue || (t.status !== 'done' && Date.parse(t.dueAt) < Date.now())) &&
      (!mine || t.assigneeId === actor.id) &&
      (project === 'all' || t.projectId === project) &&
      L(t.title).toLowerCase().includes(q.toLowerCase()),
  )
  const tasks = base.filter((t) => status === 'all' || t.status === status).sort((a,b) => sort === 'title' ? L(a.title).localeCompare(L(b.title)) : a.dueAt.localeCompare(b.dueAt))
  return (
    <>
      <PageHeader
        title={tx('ОДНА ЗАДАЧА.\nСЛЕДУЮЩИЙ ШАГ.', 'БІР ТАПСЫРМА.\nКЕЛЕСІ ҚАДАМ.')}
        eyebrow={tx('Команда / задачи', 'Команда / тапсырмалар')}
        description={tx(
          'Выбирай фокус, отправляй результат и следи за проверкой.',
          'Назар аударатын жұмысты таңда, нәтижені жібер және тексеруді бақыла.',
        )}
        action={
          <span className="outline-stamp">
            {tasks.length} {tx('задач', 'тапсырма')}
          </span>
        }
      />
      <div className="filter-bar">
        <label className="search-field">
          <ClubIcon name="search" size={18} />
          <input
            value={q}
            onChange={(e) => update('q', e.target.value)}
            placeholder={tx('Поиск задачи…', 'Тапсырманы іздеу…')}
            aria-label={tx('Поиск задачи', 'Тапсырманы іздеу')}
          />
        </label>
        <select
          value={project}
          aria-label={tx('Проект', 'Жоба')}
          onChange={(e) => update('project', e.target.value)}
        >
          <option value="all">{tx('Все проекты', 'Барлық жобалар')}</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <label className="check-label">
          <input
            type="checkbox"
            checked={mine}
            onChange={(e) => update('scope', e.target.checked ? 'mine' : 'all')}
          />
          {tx('Мои задачи', 'Менің тапсырмаларым')}
        </label>
        <div className="segmented" aria-label={tx('Вид задач', 'Тапсырма көрінісі')}>
          <button aria-pressed={view === 'list'} onClick={() => update('view', 'list')}>
            {tx('Список', 'Тізім')}
          </button>
          <button aria-pressed={view === 'board'} onClick={() => update('view', 'board')}>
            {tx('Доска', 'Тақта')}
          </button>
        </div>
      </div>
      <div className="filter-bar">
        <select aria-label={tx('Исполнитель фильтра','Сүзгі орындаушысы')} value={assignee} onChange={e=>update('assignee',e.target.value)}><option value="all">{tx('Все исполнители','Барлық орындаушылар')}</option>{state.users.filter(u=>u.role!=='applicant').map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select aria-label={tx('Порядок задач','Тапсырмалар реті')} value={sort} onChange={e=>update('sort',e.target.value)}><option value="due">{tx('По дедлайну','Мерзімі бойынша')}</option><option value="title">{tx('По названию','Атауы бойынша')}</option></select>
        <label className="row"><input type="checkbox" checked={overdue} onChange={e=>update('overdue',e.target.checked?'yes':'')}/>{tx('Просроченные','Мерзімі өткен')}</label>
        <label className="row"><input type="checkbox" checked={archived} onChange={e=>update('archived',e.target.checked?'yes':'')}/>{tx('Архив','Мұрағат')}</label>
      </div><SavedViews />
      <div className="status-filters">
        <button
          aria-pressed={status === 'all'}
          className={status === 'all' ? 'active' : ''}
          onClick={() => update('status', 'all')}
        >
          {tx('Все', 'Барлығы')} <span>{base.length}</span>
        </button>
        {statuses.map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            className={status === s ? 'active' : ''}
            onClick={() => update('status', s)}
          >
            <StatusBadge status={s} />
            <span>{base.filter((t) => t.status === s).length}</span>
          </button>
        ))}
      </div>
      {tasks.length ? (
        view === 'board' ? (
          <div className="kanban">
            {statuses
              .filter((s) => status === 'all' || s === status)
              .map((s) => (
                <section className="kanban-column" key={s}>
                  <div className="section-title">
                    <StatusBadge status={s} />
                    <span className="eyebrow">{tasks.filter((t) => t.status === s).length}</span>
                  </div>
                  {tasks
                    .filter((t) => t.status === s)
                    .map((t) => (
                      <div className="kanban-card" key={t.id}>
                        <TaskRow task={t} />
                      </div>
                    ))}
                </section>
              ))}
          </div>
        ) : (
          <Sheet className="task-list">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </Sheet>
        )
      ) : (
        <Empty
          title={tx('Ничего не найдено', 'Ештеңе табылмады')}
          description={tx(
            'Попробуй другой запрос или убери фильтры.',
            'Басқа сұрауды енгіз немесе сүзгілерді алып таста.',
          )}
          action={
            <Button variant="secondary" onClick={() => setParams({})}>
              {tx('Сбросить фильтры', 'Сүзгілерді тазалау')}
            </Button>
          }
        />
      )}
      <DemoNote />
    </>
  )
}
