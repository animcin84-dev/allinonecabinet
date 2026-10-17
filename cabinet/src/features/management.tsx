import { toAlmatyInstant } from '../domain/time'
import { useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useClub } from '../app/context'
import { ProjectEditor, TeamsWorkspace } from './project-workspace'
import { ManualRankEditor } from './monthly-experience'
import { Workload } from './workload'
import { ApplicationHistory } from './application-history'
import { FullApplicationSummary } from './application'
import {
  AppLink,
  Button,
  dateLabel,
  DemoNote,
  Empty,
  Field,
  InlineError,
  PageHeader,
  SectionTitle,
  Sheet,
  StatusBadge,
} from '../components/shared'
import {
  CORES,
  type Action,
  type Application,
  type Project,
  type Role,
  type User,
  type Warning,
} from '../domain/types'

const taskSchema = z
  .object({
    titleRu: z.string().trim().min(4).max(160),
    titleKk: z.string().trim().min(4).max(160),
    descriptionRu: z.string().trim().min(12).max(3000),
    descriptionKk: z.string().trim().min(12).max(3000),
    projectId: z.string().min(1),
    assigneeId: z.string().min(1),
    reviewerId: z.string().min(1),
    dueAt: z.string().min(1),
    points: z.coerce
      .number()
      .int()
      .refine((n) => [5, 10, 15].includes(n)),
  })
  .refine((v) => v.assigneeId !== v.reviewerId, { path: ['reviewerId'], message: 'self-review' })
type TaskFields = z.input<typeof taskSchema>
type ReviewStatus = Exclude<Application['status'], 'draft' | 'submitted'>

export function ManagementPage() {
  const { section = 'overview' } = useParams()
  const club = useClub()
  const { state, actor, role, tx, L, locale, act, pending, toast } = club
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'oldest' | 'deadline'>('oldest')
  const [localError, setLocalError] = useState<unknown>(null)
  const [creating, setCreating] = useState(false)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const isAdmin = role === 'admin'
  const isHead = role === 'head'
  const projects = useMemo(
    () =>
      (state?.projects ?? []).filter(
        (p) => isAdmin || (isHead ? p.coreId === actor?.coreId : actor?.projectIds.includes(p.id)),
      ),
    [state, isAdmin, isHead, actor],
  )
  const projectIds = new Set(projects.map((p) => p.id))
  const users = (state?.users ?? []).filter(
    (u) =>
      isAdmin ||
      (isHead ? u.coreId === actor?.coreId : u.projectIds.some((id) => projectIds.has(id))),
  )
  const tasks = (state?.tasks ?? []).filter((t) => projectIds.has(t.projectId))
  const queue = tasks
    .filter((t) => t.status === 'review' && !t.archived && !state?.projects.find(p=>p.id===t.projectId)?.archived && t.assigneeId !== actor?.id)
    .sort(
      (a, b) =>
        new Date(sort === 'oldest' ? (a.submission?.at ?? a.dueAt) : a.dueAt).getTime() -
        new Date(sort === 'oldest' ? (b.submission?.at ?? b.dueAt) : b.dueAt).getTime(),
    )
  const applications = (state?.applications ?? []).filter(
    (a) => isAdmin || (isHead && a.coreId === actor?.coreId),
  )
  const warningUsers = users.filter((u) => u.role !== 'applicant')
  const userIds = new Set(warningUsers.map((u) => u.id))
  const warnings = (state?.warnings ?? []).filter((w) => userIds.has(w.userId))
  const names: Record<string, string> = {
    overview: tx('Обзор', 'Шолу'),
    review: tx('Проверка', 'Тексеру'),
    applications: tx('Заявки', 'Өтінімдер'),
    users: tx('Участники', 'Қатысушылар'),
    projects: tx('Проекты', 'Жобалар'),
    teams: tx('Команды', 'Командалар'),
    tasks: tx('Задачи', 'Тапсырмалар'),
    experience: 'XP',
    warnings: tx('Предупреждения', 'Ескертулер'),
  }
  const roles: Record<Role, string> = {
    applicant: tx('Кандидат', 'Үміткер'),
    member: tx('Участник', 'Қатысушы'),
    manager: tx('Менеджер проекта', 'Жоба менеджері'),
    head: tx('Хед кора', 'Бағыт жетекшісі'),
    admin: tx('Администратор', 'Әкімші'),
  }
  const allowedSections = [
    'overview',
    'review',
    ...(isAdmin || isHead ? ['applications'] : []),
    'users',
    'projects',
    'teams',
    'tasks',
    ...(isAdmin ? ['experience'] : []),
    ...(isAdmin || isHead ? ['warnings'] : []),
  ]
  async function run(action: Action, success: string) {
    setLocalError(null)
    try {
      await act(action)
      toast(success)
      return true
    } catch (error) {
      setLocalError(error)
      return false
    }
  }
  function matches(...values: string[]) {
    return values
      .join(' ')
      .toLocaleLowerCase(locale)
      .includes(query.trim().toLocaleLowerCase(locale))
  }
  if (!['manager', 'head', 'admin'].includes(role))
    return (
      <Empty
        title={tx('Нужна роль руководителя', 'Жетекші рөлі қажет')}
        description={tx(
          'Управление доступно менеджеру проекта, хеду кора и администратору в своей области.',
          'Басқару жоба менеджеріне, бағыт жетекшісіне және әкімшіге өз ауқымында қолжетімді.',
        )}
        action={<AppLink to="app">{tx('Вернуться к обзору', 'Шолуға оралу')}</AppLink>}
      />
    )
  if (!state || !actor) return null
  if (!allowedSections.includes(section))
    return (
      <Empty
        title={tx('Раздел недоступен в этой роли', 'Бұл рөлде бөлім қолжетімсіз')}
        action={<AppLink to="manage">{tx('Обзор управления', 'Басқару шолуы')}</AppLink>}
      />
    )
  const scopedDescription = isAdmin
    ? tx(
        'Все демонстрационные проекты и направления.',
        'Барлық демонстрациялық жобалар мен бағыттар.',
      )
    : isHead
      ? tx(
          `Область: ${CORES.find((c) => c.id === actor.coreId)?.title ?? actor.coreId}.`,
          `Ауқым: ${CORES.find((c) => c.id === actor.coreId)?.title ?? actor.coreId}.`,
        )
      : tx(
          `Назначенные проекты: ${projects.map((p) => p.title).join(', ')}.`,
          `Тағайындалған жобалар: ${projects.map((p) => p.title).join(', ')}.`,
        )
  const search = (
    <Field label={tx('Поиск в разделе', 'Бөлімнен іздеу')}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tx('Название, имя или статус…', 'Атау, есім немесе күй…')}
      />
    </Field>
  )
  const applicationStatus = (status: Application['status']) =>
    ({
      draft: tx('Черновик', 'Жоба нұсқа'),
      submitted: tx('Отправлена', 'Жіберілді'),
      reviewing: tx('Рассматривается', 'Қаралуда'),
      needs_info: tx('Нужны уточнения', 'Толықтыру қажет'),
      accepted: tx('Принята', 'Қабылданды'),
      rejected: tx('Отклонена', 'Қабылданбады'),
    })[status]

  return (
    <div className="stack">
      <PageHeader
        eyebrow={tx('ALLINONE / РУКОВОДСТВО', 'ALLINONE / БАСҚАРУ')}
        title={names[section]}
        description={scopedDescription}
        action={
          section === 'tasks' ? (
            <Button onClick={() => setCreating((v) => !v)}>
              {creating
                ? tx('Закрыть форму', 'Пішінді жабу')
                : tx('Создать задачу', 'Тапсырма құру')}
            </Button>
          ) : undefined
        }
      />
      <nav className="tabs" aria-label={tx('Разделы управления', 'Басқару бөлімдері')}>
        {allowedSections.map((s) => (
          <AppLink
            key={s}
            to={`manage${s === 'overview' ? '' : `/${s}`}`}
            className={`tab ${s === section ? 'active' : ''}`}
          >
            {names[s]}
          </AppLink>
        ))}
      </nav>
      {localError != null && <InlineError error={localError} />}
      {section === 'overview' && (
        <>
          <div className="stat-row">
            <Sheet className="stat">
              <span className="eyebrow">{tx('ОЖИДАЮТ ПРОВЕРКИ', 'ТЕКСЕРУДІ КҮТУДЕ')}</span>
              <strong>{queue.length}</strong>
              <AppLink to="manage/review">{tx('Открыть очередь', 'Кезекті ашу')} →</AppLink>
            </Sheet>
            <Sheet className="stat">
              <span className="eyebrow">{tx('ЗАДАЧ В РАБОТЕ', 'ОРЫНДАЛУДАҒЫ ТАПСЫРМАЛАР')}</span>
              <strong>{tasks.filter((t) => t.status === 'in_progress').length}</strong>
              <AppLink to="manage/tasks">{tx('Все задачи', 'Барлық тапсырмалар')} →</AppLink>
            </Sheet>
            <Sheet className="stat">
              <span className="eyebrow">{tx('ПРОЕКТЫ В ОБЛАСТИ', 'АУҚЫМДАҒЫ ЖОБАЛАР')}</span>
              <strong>{projects.length}</strong>
              <AppLink to="manage/projects">
                {tx('Состав и материалы', 'Құрам және материалдар')} →
              </AppLink>
            </Sheet>
          </div>
          <div className="grid-2">
            <Sheet>
              <SectionTitle>
                {tx('Что требует внимания', 'Назар аударуды қажет етеді')}
              </SectionTitle>
              {queue.length ? (
                queue.slice(0, 5).map((t) => (
                  <div className="task-row" key={t.id}>
                    <div>
                      <AppLink to={`app/tasks/${t.id}`}>{L(t.title)}</AppLink>
                      <p className="muted">
                        {state.users.find((u) => u.id === t.assigneeId)?.name} ·{' '}
                        {t.submission && dateLabel(t.submission.at, locale, true)}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                ))
              ) : (
                <Empty
                  title={tx('Очередь свободна', 'Кезек бос')}
                  description={tx(
                    'Новые результаты появятся после отправки участниками.',
                    'Қатысушылар нәтиже жібергеннен кейін осында пайда болады.',
                  )}
                />
              )}
            </Sheet>
            <Sheet>
              <SectionTitle>{tx('Нагрузка по проектам', 'Жобалар бойынша жүктеме')}</SectionTitle>
              {projects.map((p) => {
                const total = tasks.filter((t) => t.projectId === p.id)
                const open = total.filter((t) => t.status !== 'done').length
                return (
                  <div className="task-row" key={p.id}>
                    <div>
                      <AppLink to={`app/projects/${p.id}`}>{p.title}</AppLink>
                      <p className="muted">
                        {tx(
                          `${open} из ${total.length} задач открыты`,
                          `${total.length} тапсырманың ${open} тапсырмасы ашық`,
                        )}
                      </p>
                    </div>
                    <span className="pill mono">{open}</span>
                  </div>
                )
              })}
              <p className="fine-print">
                {tx(
                  'Счетчики рассчитаны из текущих задач доступных проектов.',
                  'Санауыштар қолжетімді жобалардың ағымдағы тапсырмаларынан есептелген.',
                )}
              </p>
            </Sheet>
          </div>
          {(isAdmin || isHead) && (
            <Sheet>
              <SectionTitle
                action={
                  <AppLink to="manage/applications">
                    {tx('Рассмотреть заявки', 'Өтінімдерді қарау')} →
                  </AppLink>
                }
              >
                {tx('Новые участники', 'Жаңа қатысушылар')}
              </SectionTitle>
              <p>
                {tx(
                  `Ожидают решения: ${applications.filter((a) => ['submitted', 'reviewing', 'needs_info'].includes(a.status)).length}.`,
                  `Шешім күтуде: ${applications.filter((a) => ['submitted', 'reviewing', 'needs_info'].includes(a.status)).length}.`,
                )}
              </p>
            </Sheet>
          )}
        </>
      )}
      {section === 'review' && (
        <Sheet>
          <SectionTitle>{tx('Сначала — дольше ожидающие', 'Алдымен ұзақ күткендер')}</SectionTitle>
          <div className="form-grid">
            {search}
            <Field label={tx('Порядок очереди', 'Кезек тәртібі')}>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                <option value="oldest">{tx('По времени отправки', 'Жіберу уақыты бойынша')}</option>
                <option value="deadline">{tx('По сроку задачи', 'Мерзім бойынша')}</option>
              </select>
            </Field>
          </div>
          <div className="stack">
            {queue
              .filter((t) =>
                matches(L(t.title), state.users.find((u) => u.id === t.assigneeId)?.name ?? ''),
              )
              .map((t) => (
                <div className="task-row" key={t.id}>
                  <div>
                    <AppLink to={`app/tasks/${t.id}`}>{L(t.title)}</AppLink>
                    <p className="muted">
                      {state.users.find((u) => u.id === t.assigneeId)?.name} ·{' '}
                      {tx('Результат отправлен', 'Нәтиже жіберілді')}{' '}
                      {t.submission ? dateLabel(t.submission.at, locale, true) : '—'}
                    </p>
                    <p className="metadata">
                      {tx('Срок', 'Мерзім')}: {dateLabel(t.dueAt, locale)} · {t.points} XP
                    </p>
                  </div>
                  <AppLink to={`app/tasks/${t.id}`} className="button secondary">
                    {tx('Проверить', 'Тексеру')} →
                  </AppLink>
                </div>
              ))}
            {!queue.some((t) =>
              matches(L(t.title), state.users.find((u) => u.id === t.assigneeId)?.name ?? ''),
            ) && (
              <Empty
                title={
                  query
                    ? tx('Совпадений нет', 'Сәйкестік табылмады')
                    : tx('Всё проверено', 'Барлығы тексерілді')
                }
              />
            )}
          </div>
        </Sheet>
      )}
      {section === 'applications' && (
        <Sheet>
          <SectionTitle>
            {tx('Заявки в твоей области', 'Сіздің ауқымыңыздағы өтінімдер')}
          </SectionTitle>
          {search}
          <div className="stack">
            {applications
              .filter(
                (a) =>
                  a.status !== 'draft' && matches(a.name, a.school, applicationStatus(a.status)),
              )
              .map((a) => (
                <ApplicationReview
                  key={`${a.id}-${a.status}`}
                  application={a}
                  label={applicationStatus(a.status)}
                  run={run}
                  pending={pending}
                />
              ))}
            {!applications.some(
              (a) => a.status !== 'draft' && matches(a.name, a.school, applicationStatus(a.status)),
            ) && <Empty title={tx('Нет заявок', 'Өтінімдер жоқ')} />}
          </div>
        </Sheet>
      )}
      {section === 'users' && (
        <>
          <Sheet>
            <SectionTitle>{tx('Состав участников', 'Қатысушылар құрамы')}</SectionTitle>
            {search}
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label={tx(
                'Таблица участников — прокрутка по горизонтали',
                'Қатысушылар кестесі — көлденең жылжыту',
              )}
            >
              <table className="data-table">
                <caption className="sr-only">
                  {tx('Участники доступной области', 'Қолжетімді ауқым қатысушылары')}
                </caption>
                <thead>
                  <tr>
                    <th>{tx('Имя', 'Есім')}</th>
                    <th>{tx('Роль', 'Рөл')}</th>
                    <th>{tx('Направление', 'Бағыт')}</th>
                    <th>{tx('Действие', 'Әрекет')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter((u) => matches(u.name, roles[u.role], u.coreId))
                    .map((u) => (
                      <tr key={u.id}>
                        <th scope="row">{u.name}</th>
                        <td>{roles[u.role]}</td>
                        <td>{CORES.find((c) => c.id === u.coreId)?.title ?? '—'}</td>
                        <td>
                          <Button
                            variant="ghost"
                            onClick={() => setSelectedUser(selectedUser === u.id ? null : u.id)}
                          >
                            {tx('Карточка', 'Карточка')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!users.some((u) => matches(u.name, roles[u.role], u.coreId)) && (
              <Empty title={tx('Участник не найден', 'Қатысушы табылмады')} />
            )}
          </Sheet>
          {selectedUser && users.find((u) => u.id === selectedUser) && (
            <UserEditor
              key={selectedUser}
              user={users.find((u) => u.id === selectedUser)!}
              projects={projects}
              editable={isAdmin}
              run={run}
              pending={pending}
            />
          )}
        </>
      )}
      {section === 'projects' && (
        <>
          <Sheet>
            <SectionTitle>
              {tx('Управление составом и описанием', 'Құрам мен сипаттаманы басқару')}
            </SectionTitle>
            <p className="fine-print">
              {tx(
                'Изменения касаются только демо кабинета. Публичные страницы Framer сохраняются отдельно.',
                'Өзгерістер тек демо кабинетке қатысты. Framer қоғамдық беттері бөлек сақталады.',
              )}
            </p>
            {search}
            {projects
              .filter((p) => matches(p.title, L(p.description)))
              .map((p) => (
                <div className="task-row" key={p.id}>
                  <div>
                    <AppLink to={`app/projects/${p.id}`}>{p.title}</AppLink>
                    <p className="muted">
                      {p.teamIds.length} {tx('в команде', 'командада')} ·{' '}
                      {dateLabel(p.date, locale)}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => setSelectedProject(selectedProject === p.id ? null : p.id)}
                  >
                    {tx('Изменить', 'Өзгерту')}
                  </Button>
                </div>
              ))}
            {!projects.some((p) => matches(p.title, L(p.description))) && (
              <Empty title={tx('Проект не найден', 'Жоба табылмады')} />
            )}
          </Sheet>
          {selectedProject && projects.find((p) => p.id === selectedProject) && (
            <ProjectEditor
              key={selectedProject}
              project={projects.find((p) => p.id === selectedProject)!}
              onClose={() => setSelectedProject('')}
            />
          )}
          {selectedProject === 'new' && <ProjectEditor onClose={() => setSelectedProject('')} />}
          {(isAdmin || isHead) && <Button onClick={() => setSelectedProject('new')}>{tx('Создать проект', 'Жоба құру')} +</Button>}
        </>
      )}
      {section === 'teams' && <TeamsWorkspace />}
      {section === 'overview' && <Workload />}
      {section === 'users' && selectedUser && <ManualRankEditor key={selectedUser} userId={selectedUser} />}
      {section === 'teams' && (
        <>
          <div className="grid-2">
            {CORES.filter(
              (c) => isAdmin || c.id === actor.coreId || users.some((u) => u.coreId === c.id),
            ).map((c) => (
              <Sheet key={c.id}>
                <SectionTitle>{c.title}</SectionTitle>
                <p className="muted">{L(c.description)}</p>
                {users
                  .filter((u) => u.coreId === c.id)
                  .map((u) => (
                    <div className="task-row" key={u.id}>
                      <span>{u.name}</span>
                      <span className="badge">{roles[u.role]}</span>
                    </div>
                  ))}
                {!users.some((u) => u.coreId === c.id) && (
                  <p className="muted">
                    {tx(
                      'В доступной области участников нет.',
                      'Қолжетімді ауқымда қатысушылар жоқ.',
                    )}
                  </p>
                )}
              </Sheet>
            ))}
          </div>
          <Sheet>
            <p>
              {tx(
                'Для изменения кора открой карточку участника; назначение доступно администратору. Состав проекта меняется в разделе «Проекты».',
                'Бағытты өзгерту үшін қатысушы карточкасын ашыңыз; тағайындау әкімшіге қолжетімді. Жоба құрамы «Жобалар» бөлімінде өзгертіледі.',
              )}
            </p>
            <div className="action-bar">
              <AppLink to="manage/users">{tx('Участники', 'Қатысушылар')} →</AppLink>
              <AppLink to="manage/projects">{tx('Проекты', 'Жобалар')} →</AppLink>
            </div>
          </Sheet>
        </>
      )}
      {section === 'tasks' && (
        <>
          {creating && (
            <CreateTask
              projects={projects}
              users={users}
              run={run}
              pending={pending}
              onCreated={() => setCreating(false)}
            />
          )}
          <Sheet>
            <SectionTitle>
              {tx('Все задачи доступных проектов', 'Қолжетімді жобалардың барлық тапсырмалары')}
            </SectionTitle>
            {search}
            {tasks
              .filter((t) =>
                matches(L(t.title), projects.find((p) => p.id === t.projectId)?.title ?? ''),
              )
              .map((t) => (
                <div className="task-row" key={t.id}>
                  <div>
                    <AppLink to={`app/tasks/${t.id}`}>{L(t.title)}</AppLink>
                    <p className="muted">
                      {projects.find((p) => p.id === t.projectId)?.title} ·{' '}
                      {state.users.find((u) => u.id === t.assigneeId)?.name} ·{' '}
                      {dateLabel(t.dueAt, locale)}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            {!tasks.some((t) =>
              matches(L(t.title), projects.find((p) => p.id === t.projectId)?.title ?? ''),
            ) && <Empty title={tx('Нет задач', 'Тапсырмалар жоқ')} />}
          </Sheet>
        </>
      )}
      {section === 'experience' && (
        <>
          <AdjustmentForm users={warningUsers} run={run} pending={pending} />
          <Sheet>
            <SectionTitle>{tx('История корректировок', 'Түзету тарихы')}</SectionTitle>
            {state.ledger
              .filter((e) => e.kind === 'adjustment')
              .map((e) => (
                <div className="task-row" key={e.id}>
                  <div>
                    <strong>{state.users.find((u) => u.id === e.userId)?.name}</strong>
                    <p>{L(e.reason)}</p>
                    <span className="metadata">{dateLabel(e.at, locale, true)}</span>
                  </div>
                  <strong className="mono">
                    {e.points > 0 ? '+' : ''}
                    {e.points} XP
                  </strong>
                </div>
              ))}
            {!state.ledger.some((e) => e.kind === 'adjustment') && (
              <Empty title={tx('Корректировок пока нет', 'Әзірге түзету жоқ')} />
            )}
          </Sheet>
        </>
      )}
      {section === 'warnings' && (
        <>
          <WarningForm users={warningUsers} run={run} pending={pending} />
          <Sheet>
            <SectionTitle>
              {tx('Приватный журнал предупреждений', 'Ескертулердің жеке журналы')}
            </SectionTitle>
            <p className="fine-print">
              {tx(
                'Предупреждение не меняет XP автоматически: формула удержаний не утверждена.',
                'Ескерту XP-ді автоматты өзгертпейді: шегерім формуласы бекітілмеген.',
              )}
            </p>
            {warnings.map((w) => (
              <WarningRow
                key={`${w.id}-${w.resolved}`}
                warning={w}
                name={state.users.find((u) => u.id === w.userId)?.name ?? w.userId}
                run={run}
                pending={pending}
              />
            ))}
            {!warnings.length && <Empty title={tx('Предупреждений нет', 'Ескертулер жоқ')} />}
          </Sheet>
        </>
      )}
      <DemoNote />
    </div>
  )
}

type Runner = (action: Action, success: string) => Promise<boolean>
function ApplicationReview({
  application: a,
  label,
  run,
  pending,
}: {
  application: Application
  label: string
  run: Runner
  pending: boolean
}) {
  const { tx } = useClub()
  const [status, setStatus] = useState<ReviewStatus>(
    ['reviewing', 'needs_info', 'accepted', 'rejected'].includes(a.status)
      ? (a.status as ReviewStatus)
      : 'reviewing',
  )
  const [comment, setComment] = useState(a.comment)
  const [assignedCore, setAssignedCore] = useState(a.coreId)
  async function submit(e: FormEvent) {
    e.preventDefault()
    await run(
      { type: 'reviewApplication', payload: { id: a.id, status, comment, coreId: assignedCore } },
      tx('Решение сохранено', 'Шешім сақталды'),
    )
  }
  if (a.status === 'accepted' || a.status === 'rejected')
    return (
      <article className="sheet">
        <div className="row">
          <h3>{a.name}</h3>
          <span className="badge">{label}</span>
        </div>
        <p>{a.motivation}</p>
        {a.formVersion === 2 && <FullApplicationSummary application={a} />}
        <ApplicationHistory application={a} renderSnapshot={snapshot => <FullApplicationSummary application={snapshot} />} />
        <p className="metadata">
          {a.school} · {CORES.find((c) => c.id === a.coreId)?.title}
        </p>
        {a.comment && (
          <p>
            {tx('Решение', 'Шешім')}: {a.comment}
          </p>
        )}
        <p className="fine-print">
          {tx(
            'Решение закрыто. Дальнейшие назначения доступны в карточке участника.',
            'Шешім аяқталды. Кейінгі тағайындаулар қатысушы карточкасында қолжетімді.',
          )}
        </p>
      </article>
    )
  return (
    <article className="sheet">
      <div className="row">
        <h3>{a.name}</h3>
        <span className="badge">{label}</span>
      </div>
      <p className="metadata">
        {a.school} · {CORES.find((c) => c.id === a.coreId)?.title}
      </p>
      <p>{a.motivation}</p>
      <p className="muted">
        {tx('Навыки', 'Дағдылар')}: {a.skills}
      </p>
      {a.formVersion === 2 && <FullApplicationSummary application={a} />}
        <ApplicationHistory application={a} renderSnapshot={snapshot => <FullApplicationSummary application={snapshot} />} />
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label={tx('Решение', 'Шешім')}>
            <select value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus)}>
              <option value="reviewing">{tx('На рассмотрении', 'Қаралуда')}</option>
              <option value="needs_info">{tx('Запросить уточнения', 'Толықтыру сұрау')}</option>
              <option value="accepted">{tx('Принять', 'Қабылдау')}</option>
              <option value="rejected">{tx('Отклонить', 'Қабылдамау')}</option>
            </select>
          </Field>
          <Field label={tx('Комментарий / основание', 'Пікір / негіздеме')}>
            <textarea
              maxLength={2000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required={status === 'needs_info' || status === 'rejected'}
              placeholder={tx('Объясни решение кандидату', 'Үміткерге шешімді түсіндіріңіз')}
            />
          </Field>
        </div>
        {status === 'accepted' && (
          <Field label={tx('Назначить кор при приёме', 'Қабылдағанда бағыт тағайындау')}>
            <select value={assignedCore} onChange={(e) => setAssignedCore(e.target.value)} required>
              <option value="">{tx('Выбери направление', 'Бағытты таңда')}</option>
              {CORES.map((core) => <option key={core.id} value={core.id}>{core.title}</option>)}
            </select>
          </Field>
        )}
        <Button
          disabled={
            pending || ((status === 'needs_info' || status === 'rejected') && !comment.trim()) ||
            (status === 'accepted' && !assignedCore)
          }
          type="submit"
        >
          {pending ? tx('Сохраняем…', 'Сақталуда…') : tx('Сохранить решение', 'Шешімді сақтау')}
        </Button>
      </form>
    </article>
  )
}

function CreateTask({
  projects,
  users,
  run,
  pending,
  onCreated,
}: {
  projects: Project[]
  users: User[]
  run: Runner
  pending: boolean
  onCreated: () => void
}) {
  const { tx } = useClub()
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFields, unknown, z.output<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      projectId: projects[0]?.id ?? '',
      titleRu: '',
      titleKk: '',
      descriptionRu: '',
      descriptionKk: '',
      assigneeId: '',
      reviewerId: '',
      points: 5,
      dueAt: '',
    },
  })
  const projectId = watch('projectId')
  const assigneeId = watch('assigneeId')
  const project = projects.find((p) => p.id === projectId)
  const projectUsers = users.filter(
    (u) =>
      u.role !== 'applicant' &&
      (u.projectIds.includes(projectId) || project?.teamIds.includes(u.id)),
  )
  const reviewers = users.filter(
    (u) =>
      ['manager', 'head', 'admin'].includes(u.role) &&
      u.id !== assigneeId &&
      (u.role === 'admin' ||
        u.projectIds.includes(projectId) ||
        (u.role === 'head' && u.coreId === project?.coreId)),
  )
  async function submit(values: z.output<typeof taskSchema>) {
    if (
      await run(
        {
          type: 'createTask',
          payload: {
            title: { ru: values.titleRu, kk: values.titleKk },
            description: { ru: values.descriptionRu, kk: values.descriptionKk },
            projectId: values.projectId,
            assigneeId: values.assigneeId,
            reviewerId: values.reviewerId,
            dueAt: toAlmatyInstant(values.dueAt),
            points: values.points,
          },
        },
        tx('Задача создана', 'Тапсырма құрылды'),
      )
    )
      onCreated()
  }
  const invalid = tx(
    'Проверь поле: название от 4 символов, описание от 12; все назначения обязательны.',
    'Өрісті тексеріңіз: атауы кемінде 4 таңба, сипаттамасы 12 таңба; барлық тағайындаулар міндетті.',
  )
  return (
    <Sheet>
      <SectionTitle>{tx('Новая задача', 'Жаңа тапсырма')}</SectionTitle>
      <form className="stack" onSubmit={handleSubmit(submit)}>
        <div className="form-grid">
          <Field label={tx('Название · RU', 'Атауы · RU')} error={errors.titleRu && invalid}>
            <input maxLength={160} {...register('titleRu')} />
          </Field>
          <Field label={tx('Название · ҚАЗ', 'Атауы · ҚАЗ')} error={errors.titleKk && invalid}>
            <input maxLength={160} {...register('titleKk')} />
          </Field>
          <Field
            label={tx('Результат и критерии · RU', 'Нәтиже және өлшемдер · RU')}
            error={errors.descriptionRu && invalid}
          >
            <textarea maxLength={3000} {...register('descriptionRu')} />
          </Field>
          <Field
            label={tx('Результат и критерии · ҚАЗ', 'Нәтиже және өлшемдер · ҚАЗ')}
            error={errors.descriptionKk && invalid}
          >
            <textarea maxLength={3000} {...register('descriptionKk')} />
          </Field>
          <Field label={tx('Проект', 'Жоба')}>
            <select
              {...register('projectId', {
                onChange: () => {
                  setValue('assigneeId', '')
                  setValue('reviewerId', '')
                },
              })}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tx('XP после подтверждения', 'Расталғаннан кейінгі XP')}>
            <select {...register('points')}>
              <option value="5">{tx('Стандартная · 5 XP', 'Қалыпты · 5 XP')}</option>
              <option value="10">{tx('Сложная · 10 XP', 'Күрделі · 10 XP')}</option>
              <option value="15">{tx('Срочная · 15 XP', 'Шұғыл · 15 XP')}</option>
            </select>
          </Field>
          <Field label={tx('Исполнитель', 'Орындаушы')} error={errors.assigneeId && invalid}>
            <select {...register('assigneeId', { onChange: () => setValue('reviewerId', '') })}>
              <option value="">{tx('Выбери участника', 'Қатысушыны таңдаңыз')}</option>
              {projectUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={tx('Проверяющий', 'Тексеруші')}
            error={
              errors.reviewerId &&
              tx(
                'Нужен другой участник с правом проверки.',
                'Тексеру құқығы бар басқа қатысушы қажет.',
              )
            }
          >
            <select {...register('reviewerId')}>
              <option value="">{tx('Выбери руководителя', 'Жетекшіні таңдаңыз')}</option>
              {reviewers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={tx('Срок · Алматы (UTC+5)', 'Мерзім · Алматы (UTC+5)')}
            error={errors.dueAt && invalid}
          >
            <input type="datetime-local" {...register('dueAt')} />
          </Field>
        </div>
        <p className="fine-print">
          {tx(
            'XP — черновая политика. Награда начисляется однократно после проверки; самопроверка запрещена.',
            'XP — саясат жобасы. Сыйақы тек тексеруден кейін бір рет беріледі; өзін-өзі тексеруге тыйым салынған.',
          )}
        </p>
        <Button disabled={pending || !projects.length} type="submit">
          {pending
            ? tx('Создаем…', 'Құрылуда…')
            : tx('Создать и назначить', 'Құру және тағайындау')}
        </Button>
      </form>
    </Sheet>
  )
}

function UserEditor({
  user,
  projects,
  editable,
  run,
  pending,
}: {
  user: User
  projects: Project[]
  editable: boolean
  run: Runner
  pending: boolean
}) {
  const { tx } = useClub()
  const [role, setRole] = useState(user.role)
  const [coreId, setCoreId] = useState(user.coreId)
  const [projectIds, setProjectIds] = useState(user.projectIds)
  const [reason, setReason] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (
      await run(
        { type: 'updateUser', reason, payload: { id: user.id, role, coreId, projectIds } },
        tx('Назначение сохранено', 'Тағайындау сақталды'),
      )
    )
      setReason('')
  }
  return (
    <Sheet>
      <SectionTitle>{user.name}</SectionTitle>
      <p>{user.bio}</p>
      <p className="metadata">{user.skills.join(' · ')}</p>
      {editable ? (
        <form className="stack" onSubmit={submit}>
          <div className="form-grid">
            <Field label={tx('Системная роль', 'Жүйелік рөл')}>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="member">{tx('Участник', 'Қатысушы')}</option>
                <option value="manager">{tx('Менеджер проекта', 'Жоба менеджері')}</option>
                <option value="head">{tx('Хед кора', 'Бағыт жетекшісі')}</option>
                <option value="admin">{tx('Администратор', 'Әкімші')}</option>
                <option value="applicant">{tx('Кандидат', 'Үміткер')}</option>
              </select>
            </Field>
            <Field label={tx('Кор / направление', 'Бағыт')}>
              <select value={coreId} onChange={(e) => setCoreId(e.target.value)}>
                {CORES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset className="stack">
            <legend>{tx('Назначенные проекты', 'Тағайындалған жобалар')}</legend>
            {projects.map((p) => (
              <label className="row" key={p.id}>
                <input
                  type="checkbox"
                  checked={projectIds.includes(p.id)}
                  onChange={(e) =>
                    setProjectIds((ids) =>
                      e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                    )
                  }
                />
                <span>{p.title}</span>
              </label>
            ))}
          </fieldset>
          <Field label={tx('Основание изменения', 'Өзгерту негіздемесі')}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={2000}
              required
            />
          </Field>
          <Button type="submit" disabled={pending || reason.trim().length < 3}>
            {tx('Сохранить назначение', 'Тағайындауды сақтау')}
          </Button>
        </form>
      ) : (
        <p className="fine-print">
          {tx(
            'Системные назначения меняет администратор. XP не дает дополнительных разрешений.',
            'Жүйелік тағайындауларды әкімші өзгертеді. XP қосымша рұқсат бермейді.',
          )}
        </p>
      )}
    </Sheet>
  )
}

function AdjustmentForm({ users, run, pending }: { users: User[]; run: Runner; pending: boolean }) {
  const { tx } = useClub()
  const [userId, setUserId] = useState(users[0]?.id ?? '')
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (
      await run(
        { type: 'adjustXP', userId, points: Number(points), reason },
        tx('Корректировка добавлена в журнал', 'Түзету журналға қосылды'),
      )
    ) {
      setPoints('')
      setReason('')
    }
  }
  return (
    <Sheet>
      <SectionTitle>
        {tx('Корректировать подтвержденный XP', 'Расталған XP-ді түзету')}
      </SectionTitle>
      <p>
        {tx(
          'Создается новая запись с основанием. Предыдущие начисления сохраняются в истории.',
          'Негіздемесі бар жаңа жазба жасалады. Бұрынғы есептеулер тарихта сақталады.',
        )}
      </p>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label={tx('Участник', 'Қатысушы')}>
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tx('Изменение XP (например, −5)', 'XP өзгерісі (мысалы, −5)')}>
            <input
              type="number"
              min={-1000}
              max={1000}
              step="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label={tx('Основание корректировки', 'Түзету негіздемесі')}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={3}
            maxLength={2000}
            required
          />
        </Field>
        <Button
          type="submit"
          disabled={pending || !points || Number(points) === 0 || reason.trim().length < 3}
        >
          {tx('Добавить запись в XP', 'XP жазбасын қосу')}
        </Button>
      </form>
    </Sheet>
  )
}

function WarningForm({ users, run, pending }: { users: User[]; run: Runner; pending: boolean }) {
  const { tx } = useClub()
  const [userId, setUserId] = useState(users[0]?.id ?? '')
  const [reason, setReason] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (
      await run(
        { type: 'warning', userId, reason },
        tx('Предупреждение зарегистрировано', 'Ескерту тіркелді'),
      )
    )
      setReason('')
  }
  return (
    <Sheet>
      <SectionTitle>{tx('Зафиксировать предупреждение', 'Ескертуді тіркеу')}</SectionTitle>
      <form className="stack" onSubmit={submit}>
        <Field label={tx('Участник', 'Қатысушы')}>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tx('Основание и обстоятельства', 'Негіздеме және мән-жайлар')}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={3}
            maxLength={2000}
          />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending || reason.trim().length < 3}>
          {tx('Добавить предупреждение', 'Ескерту қосу')}
        </Button>
      </form>
    </Sheet>
  )
}

function WarningRow({
  warning: w,
  name,
  run,
  pending,
}: {
  warning: Warning
  name: string
  run: Runner
  pending: boolean
}) {
  const { tx, locale } = useClub()
  const [reason, setReason] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    await run(
      { type: 'resolveWarning', payload: { id: w.id }, reason },
      tx('Предупреждение снято, история сохранена', 'Ескерту алынды, тарих сақталды'),
    )
  }
  return (
    <article className="sheet">
      <div className="row">
        <strong>{name}</strong>
        <span className="badge">
          {w.resolved ? tx('Снято', 'Алынды') : tx('Действует', 'Белсенді')}
        </span>
      </div>
      <p>{w.reason}</p>
      <p className="metadata">{dateLabel(w.at, locale, true)}</p>
      {w.resolvedReason && (
        <div className="divider">
          <p>
            {tx('Основание снятия', 'Алу негіздемесі')}: {w.resolvedReason}
          </p>
          {w.resolvedAt && (
            <span className="metadata">{dateLabel(w.resolvedAt, locale, true)}</span>
          )}
        </div>
      )}
      {!w.resolved && (
        <form className="stack" onSubmit={submit}>
          <Field label={tx('Основание для снятия', 'Алу негіздемесі')}>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              minLength={3}
              maxLength={2000}
            />
          </Field>
          <Button type="submit" variant="secondary" disabled={pending || reason.trim().length < 3}>
            {tx('Снять с сохранением истории', 'Тарихты сақтап алу')}
          </Button>
        </form>
      )}
    </article>
  )
}
