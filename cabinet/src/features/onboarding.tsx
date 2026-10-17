import { useState } from 'react'
import { useClub } from '../app/context'
import { AppLink, Button, Sheet, SectionTitle } from '../components/shared'
export function recordOnboarding(userId: string, step: string) {
  try {
    localStorage.setItem(`allinone:onboarding:${userId}:${step}`, 'yes')
  } catch {
    /* no claim of persistence */
  }
}
export function Onboarding() {
  const { actor, state, tx } = useClub()
  const [, refresh] = useState(0)
  const [error, setError] = useState(false)
  if (!actor || !state) return null
  const read = (step: string) => {
    try {
      return localStorage.getItem(`allinone:onboarding:${actor.id}:${step}`) === 'yes'
    } catch {
      return false
    }
  }
  const skipped = read('hidden')
  const candidate = actor.role === 'applicant'
  const task = state.tasks.find(
    (t) => t.assigneeId === actor.id && !t.archived && t.status !== 'done',
  )
  const steps = candidate
    ? [
        {
          title: tx('Заполнить профиль', 'Профильді толтыру'),
          to: 'app/profile',
          done: read('profile'),
        },
        {
          title: tx('Отправить заявку', 'Өтінімді жіберу'),
          to: 'application',
          done: state.applications.some(
            (a) => a.userId === actor.id && !['draft', 'needs_info'].includes(a.status),
          ),
        },
      ]
    : [
        {
          title: tx('Проверить профиль', 'Профильді тексеру'),
          to: 'app/profile',
          done: read('profile'),
        },
        {
          title: tx('Познакомиться с командой', 'Командамен танысу'),
          to: 'app/team',
          done: read('team'),
        },
        {
          title: task
            ? tx('Открыть первую задачу', 'Алғашқы тапсырманы ашу')
            : tx('Ожидаем назначения задачи', 'Тапсырма тағайындауды күтеміз'),
          to: task ? `app/tasks/${task.id}` : 'app/tasks',
          done: read('task'),
        },
      ]
  const hide = (value: boolean) => {
    try {
      localStorage.setItem(`allinone:onboarding:${actor.id}:hidden`, value ? 'yes' : 'no')
      refresh((n) => n + 1)
    } catch {
      setError(true)
    }
  }
  if (skipped)
    return (
      <Button variant="ghost" onClick={() => hide(false)}>
        {tx('Открыть первые шаги', 'Алғашқы қадамдарды ашу')} ↗
      </Button>
    )
  return (
    <Sheet className="onboarding-card">
      <SectionTitle
        action={
          <Button variant="ghost" onClick={() => hide(true)}>
            {steps.every((s) => s.done) ? tx('Завершить', 'Аяқтау') : tx('Позже', 'Кейін')}
          </Button>
        }
      >
        {tx('ТВОЙ СТАРТ В ALLINONE', 'ALLINONE-ДАҒЫ БАСТАУЫҢ')}
      </SectionTitle>
      <ol className="onboarding-steps">
        {steps.map((s, i) => (
          <li key={s.to}>
            <span className={s.done ? 'step-done' : ''}>{s.done ? '✓' : `0${i + 1}`}</span>
            <AppLink to={s.to}>{s.title} ↗</AppLink>
          </li>
        ))}
      </ol>
      {error && (
        <p role="alert">{tx('Браузер не сохранил настройку.', 'Браузер баптауды сақтамады.')}</p>
      )}
    </Sheet>
  )
}
