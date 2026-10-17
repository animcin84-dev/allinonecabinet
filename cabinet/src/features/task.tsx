import { lazy, Suspense, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import * as m from 'motion/react-m'
import { TaskEditor } from './task-editor'
import { TaskMaterials } from './task-materials'
import { TaskCollaboration } from './task-collaboration'
import { recordOnboarding } from './onboarding'
import { canManageProject } from '../domain/workspace'
import { CopyLinkButton } from '../components/ui/copy-link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useClub } from '../app/context'
import {
  Button,
  PageHeader,
  Sheet,
  SectionTitle,
  StatusBadge,
  Empty,
  Field,
  InlineError,
  AppLink,
  DemoNote,
  dateLabel,
} from '../components/shared'
import { ClubIcon } from '../components/icons'
import { rankFor, totalXP, canReview, XP_POLICY } from '../domain'
import { CORES, type Task, type Status } from '../domain/types'
const statuses: Status[] = ['todo', 'in_progress', 'review', 'done']
const resultSchema = z.object({
  text: z.string().trim().min(12),
  url: z.union([z.literal(''), z.url()]).refine((v) => !v || /^https?:\/\//i.test(v)),
})
export function TaskPage() {
  const { taskId } = useParams()
  const { state, actor, tx } = useClub()
  if (!state || !actor) return null
  const task = state.tasks.find((t) => t.id === taskId)
  if (!task)
    return (
      <Empty
        title={tx('Задача недоступна', 'Тапсырма қолжетімсіз')}
        description={tx(
          'Она не найдена или находится вне твоей области доступа.',
          'Ол табылмады немесе сенің рұқсат аймағыңнан тыс.',
        )}
        action={<AppLink to="app/tasks">{tx('К задачам', 'Тапсырмаларға')} →</AppLink>}
      />
    )
  return <TaskDetail key={`${task.id}-${actor.id}`} task={task} />
}
function TaskDetail({ task }: { task: Task }) {
  const { state, actor, tx, L, locale, act, pending, toast } = useClub()
  const [error, setError] = useState<unknown>(null)
  const [reason, setReason] = useState('')
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (actor?.id && task.assigneeId === actor.id) recordOnboarding(actor.id, 'task') }, [actor?.id, task.id, task.assigneeId])
  const key = `allinone:draft:${actor?.id}:${task.id}`
  const [draft] = useState(() => {
    try {
      return (
        JSON.parse(localStorage.getItem(key) ?? 'null') ?? {
          text: task.submission?.text ?? '',
          url: task.submission?.url ?? '',
        }
      )
    } catch {
      return { text: '', url: '' }
    }
  })
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof resultSchema>>({
    resolver: zodResolver(resultSchema),
    defaultValues: draft,
  })
  const values = watch()
  useEffect(() => {
    if (task.assigneeId === actor?.id && task.status === 'in_progress')
      try { localStorage.setItem(key, JSON.stringify(values)) } catch { /* Input remains available this session. */ }
  }, [values.text, values.url, key, actor?.id, task.assigneeId, task.status])
  if (!state || !actor) return null
  const own = task.assigneeId === actor.id
  const reviewer = canReview(state, actor.id, task)
  const project = state.projects.find((p) => p.id === task.projectId)
  const name = (id: string) =>
    state.users.find((u) => u.id === id)?.name ?? tx('Участник команды', 'Команда қатысушысы')
  const history = [
    ...(task.history ?? []).map(h => ({ id: h.id, at: h.at, title: tx('Условия задачи изменены', 'Тапсырма шарттары өзгерді'), by: h.by, body: L(h.detail), url: '' })),
    ...(task.submissions ?? (task.submission ? [task.submission] : [])).map((r, i) => ({
      id: 'submission-' + i,
      at: r.at,
      title: tx('Результат отправлен', 'Нәтиже жіберілді'),
      by: task.assigneeId,
      body: r.text,
      url: r.url,
    })),
    ...task.reviews.map((r) => ({
      id: r.id,
      at: r.at,
      title:
        r.decision === 'approved'
          ? tx('Подтверждено', 'Расталды')
          : tx('Возвращено на доработку', 'Толықтыруға қайтарылды'),
      by: r.by,
      body: r.reason,
      url: '',
    })),
  ].sort((a, b) => a.at.localeCompare(b.at))
  const mutate = async (type: string, extra: Record<string, unknown> = {}) => {
    setError(null)
    try {
      await act({ type, taskId: task.id, revision: task.revision, ...extra })
      if (type === 'submit') localStorage.removeItem(key)
      toast(
        type === 'review' && extra.decision === 'approved'
          ? tx(
              `Результат подтверждён. +${task.points} демо-XP.`,
              `Нәтиже расталды. +${task.points} демо XP.`,
            )
          : type === 'review'
            ? tx(
                'Вернули на доработку. XP не изменился.',
                'Толықтыруға қайтарылды. XP өзгерген жоқ.',
              )
            : tx('Изменения сохранены в демо.', 'Өзгерістер демода сақталды.'),
      )
    } catch (e) {
      setError(e)
    }
  }
  return (
    <>
      <div className="breadcrumb">
        <AppLink to="app/tasks">← {tx('Все задачи', 'Барлық тапсырмалар')}</AppLink>
        <span>
          {project?.title} / {task.id.toUpperCase()}
        </span>
      </div>
      <PageHeader
        eyebrow={tx('Задача / демо-поручение', 'Тапсырма / демо жұмыс')}
        title={L(task.title)}
        description={L(task.description)}
        action={
          <div className="header-actions">
            <StatusBadge status={task.status} />
            <CopyLinkButton />
            {canManageProject(state, actor, task.projectId) && <Button variant="secondary" onClick={() => setEditing(!editing)}>{tx("Редактировать", "Өңдеу")}</Button>}
          </div>
        }
      />
      {editing && <TaskEditor key={task.id} task={task} onClose={() => setEditing(false)} />}
      {(task.archived || project?.archived) && <p className="storage-notice">{tx("Архив · история сохранена, действия ограничены.", "Мұрағат · тарих сақталды, әрекеттер шектелген.")}</p>}
      <div className="dashboard-grid task-detail-grid">
        <div className="stack">
          <Sheet>
            <div className="task-steps" aria-label={tx('Этапы задачи', 'Тапсырма кезеңдері')}>
              {statuses.map((s, i) => (
                <span
                  key={s}
                  className={`task-step ${s === task.status ? 'current' : ''} ${i < statuses.indexOf(task.status) ? 'completed' : ''}`}
                  aria-current={s === task.status ? 'step' : undefined}
                >
                  <small aria-hidden="true">
                    {i < statuses.indexOf(task.status) ? '✓' : `0${i + 1}`}
                  </small>
                  <StatusBadge status={s} />
                </span>
              ))}
            </div>
            <div className="metadata">
              <div>
                <span>{tx('Проект', 'Жоба')}</span>
                <AppLink to={`app/projects/${task.projectId}`}>{project?.title} ↗</AppLink>
              </div>
              <div>
                <span>{tx('Дедлайн · Алматы', 'Мерзімі · Алматы')}</span>
                <strong>{dateLabel(task.dueAt, locale, true)}</strong>
              </div>
              <div>
                <span>{tx('Исполнитель', 'Орындаушы')}</span>
                <strong>{name(task.assigneeId)}</strong>
              </div>
              <div>
                <span>{tx('Проверяющий', 'Тексеруші')}</span>
                <strong>{name(task.reviewerId)}</strong>
              </div>
            </div>
            {task.status === 'todo' && own && !task.archived && !project?.archived && (
              <div className="start-callout">
                <h2>{tx('Начнём с первого шага.', 'Алғашқы қадамнан бастайық.')}</h2>
                <p>
                  {tx(
                    'Срок и ожидаемая награда уже согласованы в демо.',
                    'Демода мерзім мен күтілетін XP көрсетілген.',
                  )}
                </p>
                <Button loading={pending} onClick={() => void mutate('start')}>
                  {tx('Начать задачу', 'Тапсырманы бастау')} ↗
                </Button>
              </div>
            )}
            {task.status === 'in_progress' && own && !task.archived && !project?.archived && (
              <form onSubmit={handleSubmit((data) => mutate('submit', data))} noValidate>
                <SectionTitle>{tx('Твой результат', 'Сенің нәтижең')}</SectionTitle>
                <Field
                  label={tx('Что сделано?', 'Не істелді?')}
                  error={
                    errors.text
                      ? tx(
                          'Опиши результат: минимум 12 символов.',
                          'Нәтижені сипатта: кемінде 12 таңба.',
                        )
                      : undefined
                  }
                >
                  <textarea
                    {...register('text')}
                    rows={5}
                    placeholder={tx(
                      'Что подготовлено, где посмотреть, что проверить…',
                      'Не дайындалды, қайдан қарау керек, нені тексеру керек…',
                    )}
                  />
                </Field>
                <Field
                  label={tx('Ссылка на работу (необязательно)', 'Жұмысқа сілтеме (міндетті емес)')}
                  error={
                    errors.url
                      ? tx('Укажи полную HTTP/HTTPS-ссылку.', 'Толық HTTP/HTTPS сілтемесін енгіз.')
                      : undefined
                  }
                >
                  <input {...register('url')} inputMode="url" placeholder="https://…" />
                </Field>
                <div className="action-bar">
                  <Button type="submit" loading={pending}>
                    {pending
                      ? tx('Отправляем…', 'Жіберілуде…')
                      : tx('Отправить на проверку', 'Тексеруге жіберу')}{' '}
                    ↗
                  </Button>
                  <span className="muted">
                    {tx('Черновик сохраняется в браузере', 'Жоба браузерде сақталады')}
                  </span>
                </div>
              </form>
            )}
            {task.submission && task.status !== 'in_progress' && (
              <section className="submitted-result">
                <span className="eyebrow">{tx('Отправленный результат', 'Жіберілген нәтиже')}</span>
                <p className="pre-line">{task.submission.text}</p>
                {task.submission.url && (
                  <a
                    className="text-link"
                    href={task.submission.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {tx('Открыть материал', 'Материалды ашу')} ↗
                  </a>
                )}
                <small>{dateLabel(task.submission.at, locale, true)}</small>
              </section>
            )}
            {task.status === 'review' && reviewer && !task.archived && !project?.archived && (
              <section className="review-panel">
                <h2>{tx('Подтверди вклад.', 'Үлесті раста.')}</h2>
                <p className="muted">
                  {tx(
                    'Проверь материал. Подтверждение создаст одну запись XP; для возврата нужна причина.',
                    'Материалды тексер. Растау бір XP жазбасын жасайды; қайтару үшін себеп қажет.',
                  )}
                </p>
                <Field label={tx('Комментарий проверяющего', 'Тексеруші пікірі')}>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={tx(
                      'Что улучшить или почему работа принята…',
                      'Нені жақсарту керек немесе жұмыс неге қабылданды…',
                    )}
                  />
                </Field>
                <div className="action-bar">
                  <Button
                    loading={pending}
                    onClick={() => void mutate('review', { decision: 'approved', reason })}
                  >
                    {tx('Подтвердить', 'Растау')} +{task.points} XP
                  </Button>
                  <Button
                    variant="secondary"
                    loading={pending}
                    onClick={() => {
                      if (reason.trim().length < 5) {
                        setError(
                          new Error(
                            tx(
                              'Для возврата укажи причину: минимум 5 символов.',
                              'Қайтару себебін жаз: кемінде 5 таңба.',
                            ),
                          ),
                        )
                        return
                      }
                      void mutate('review', { decision: 'returned', reason })
                    }}
                  >
                    {tx('На доработку', 'Толықтыруға')}
                  </Button>
                </div>
              </section>
            )}
            {task.status === 'review' && !reviewer && (
              <p className="status-note">
                {tx(
                  'Результат на проверке. XP появится после подтверждения.',
                  'Нәтиже тексерілуде. XP расталғаннан кейін беріледі.',
                )}
              </p>
            )}
            {task.status === 'done' && (
              <m.div
                className="approval"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
              >
                <span className="approved-stamp">✓ {tx('ВКЛАД ПОДТВЕРЖДЁН', 'ҮЛЕС РАСТАЛДЫ')}</span>
                <p>
                  {tx(
                    'Результат принят. Начисление сохранено в истории участника.',
                    'Нәтиже қабылданды. Есептеу қатысушының тарихында сақталды.',
                  )}
                </p>
                <AppLink to="app/experience">
                  {tx('История моего XP', 'Менің XP тарихым')} →
                </AppLink>
              </m.div>
            )}
            {error !== null && <InlineError error={error} />}
          </Sheet>
        </div>
        <div className="stack">
          <Sheet className="reward-card">
            <span className="eyebrow">{tx('Ожидаемый вклад', 'Күтілетін үлес')}</span>
            <div className="reward-number">
              +{task.points}
              <small> XP</small>
            </div>
            <p>
              {tx(
                'Начисляется один раз после принятия работы.',
                'Жұмыс қабылданғаннан кейін бір рет есептеледі.',
              )}
            </p>
            <AppLink to="app/experience/rules">{tx('Правила XP', 'XP ережелері')} ↗</AppLink>
          </Sheet>
          <Sheet>
            <SectionTitle>{tx('История задачи', 'Тапсырма тарихы')}</SectionTitle>
            <ol className="timeline">
              <li>
                <strong>{tx('Задача назначена', 'Тапсырма берілді')}</strong>
                <span>
                  {name(task.assigneeId)} · {tx('демо', 'демо')}
                </span>
              </li>
              {history.map((r) => (
                <li key={r.id}>
                  <strong>{r.title}</strong>
                  <span>
                    {name(r.by)} · {dateLabel(r.at, locale, true)}
                  </span>
                  {r.body && <p>{r.body}</p>}
                  {r.url && (
                    <a className="text-link" href={r.url} target="_blank" rel="noopener noreferrer">
                      {tx('Материал результата', 'Нәтиже материалы')} ↗
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </Sheet>
          <p className="tiny-note">
            {tx(
              'XP, должность и права доступа — отдельные вещи.',
              'XP, лауазым және рұқсат құқықтары — бөлек ұғымдар.',
            )}
          </p>
        </div>
      </div>
      <TaskMaterials task={task} />
      <TaskCollaboration task={project?.archived ? { ...task, archived: true } : task} />
      <DemoNote />
    </>
  )
}
