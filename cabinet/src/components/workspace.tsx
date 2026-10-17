import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { useClub } from '../app/context'
import { Sheet, AppLink, dateLabel, StatusBadge } from './shared'
import { ClubIcon } from './icons'
import { rankFor, totalXP } from '../domain/policy'
import type { Task } from '../domain/types'
import { AnimatedNumber } from './ui/motion'
const Chart = lazy(() => import('../components/xp-chart').then((x) => ({ default: x.XPChart })))
export function ChartSlot({ days = 28 }: { days?: number }) {
  const { state, actor } = useClub()
  return (
    <Suspense fallback={<div className="chart-skeleton" />}>
      <Chart days={days} entries={state?.ledger.filter((e) => e.userId === actor?.id) ?? []} />
    </Suspense>
  )
}
export function TaskRow({ task }: { task: Task }) {
  const { state, locale, L, tx } = useClub()
  const project = state?.projects.find((p) => p.id === task.projectId)
  return (
    <Link className="task-row" to={`/${locale}/app/tasks/${task.id}`}>
      <span className={`task-check ${task.status === 'done' ? 'checked' : ''}`} aria-hidden="true">
        {task.status === 'done' ? '✓' : ''}
      </span>
      <div className="task-row-content">
        <strong>{L(task.title)}</strong>
        <span>
          {project?.title} <b>·</b> {dateLabel(task.dueAt, locale)}
          {new Date(task.dueAt) < new Date() && task.status !== 'done' && (
            <em> · {tx('Срок прошёл', 'Мерзімі өтті')}</em>
          )}
        </span>
      </div>
      <div className="task-row-meta">
        <StatusBadge status={task.status} />
        <small>+{task.points} XP</small>
      </div>
      <ClubIcon name="arrow" size={18} />
    </Link>
  )
}
export function XPCard() {
  const { state, actor, tx } = useClub()
  if (!state || !actor) return null
  const xp = totalXP(state, actor.id)
  const rank = rankFor(xp)
  const progress = rank.max
    ? Math.max(0, Math.min(100, ((xp - rank.min) / (rank.max - rank.min)) * 100))
    : 100
  return (
    <Sheet className="xp-card">
      <div className="section-title">
        <span className="eyebrow">{tx('Подтверждённый вклад', 'Расталған үлес')}</span>
        <span className="rank">{rank.name}</span>
      </div>
      <div className="xp-number">
        <AnimatedNumber value={xp} />
        <span className="xp-unit">XP</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label={tx('Прогресс уровня опыта', 'Тәжірибе деңгейінің барысы')}
        aria-valuemin={rank.min}
        aria-valuemax={rank.max ?? xp}
        aria-valuenow={xp}
      >
        <span style={{ transform: `scaleX(${progress / 100})` }} />
      </div>
      <div className="xp-caption">
        <span>
          {rank.min}—{rank.max ?? '∞'} XP
        </span>
        <span>
          {rank.max
            ? `${rank.max - xp} XP ${tx('до следующего', 'келесі деңгейге')}`
            : tx('Верхний расчётный диапазон', 'Ең жоғары есептік аралық')}
        </span>
      </div>
      <AppLink to="app/experience">{tx('История и правила', 'Тарих пен ережелер')} →</AppLink>
      <p className="fine-print">
        {tx(
          'Демо · правила XP — черновик. Уровень не меняет права.',
          'Демо · XP ережелері — жоба. Деңгей құқықтарды өзгертпейді.',
        )}
      </p>
    </Sheet>
  )
}
