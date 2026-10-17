import { useClub } from '../app/context'
import { AppLink, SectionTitle, Sheet, dateLabel } from '../components/shared'
import { canManageProject } from '../domain'
export function Workload() {
  const { state, actor, tx, locale } = useClub()
  if (!actor || !state || !['manager', 'head', 'admin'].includes(actor.role)) return null
  const tasks = state.tasks.filter(
      (t) =>
        !t.archived &&
        canManageProject(state, actor, t.projectId) &&
        !state.projects.find((p) => p.id === t.projectId)?.archived,
    ),
    users = state.users.filter(
      (u) => u.role !== 'applicant' && tasks.some((t) => t.assigneeId === u.id),
    )
  const maximum = Math.max(
    1,
    ...users.map((u) => tasks.filter((t) => t.assigneeId === u.id && t.status !== 'done').length),
  )
  const now = Date.now()
  const rows = users.map((user) => {
    const own = tasks.filter((t) => t.assigneeId === user.id && t.status !== 'done')
    return {
      user,
      active: own.length,
      overdue: own.filter((t) => Date.parse(t.dueAt) < now).length,
      review: own.filter((t) => t.status === 'review').length,
      nearest: [...own].sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0],
    }
  })
  return (
    <Sheet className="workload-sheet">
      <SectionTitle>{tx('ФОКУС КОМАНДЫ · НАГРУЗКА', 'КОМАНДА ФОКУСЫ · ЖҮКТЕМЕ')}</SectionTitle>
      <p className="fine-print">
        {tx(
          'Количество задач, а не оценка продуктивности или часов занятости.',
          'Тапсырмалар саны, өнімділік не жұмыс сағатының бағасы емес.',
        )}
      </p>
      <div className="table-wrap workload-desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th>{tx('Участник', 'Қатысушы')}</th>
              <th>{tx('Активных', 'Белсенді')}</th>
              <th>{tx('Просрочено', 'Мерзімі өткен')}</th>
              <th>{tx('На проверке', 'Тексерілуде')}</th>
              <th>{tx('Ближайший срок', 'Жақын мерзім')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({user: u, active, overdue, review, nearest}) => {
              return (
                <tr key={u.id}>
                  <td>
                    <AppLink to={`app/tasks?assignee=${u.id}`}>{u.name} ↗</AppLink>
                    <div className="workload-bar" aria-hidden="true">
                      <span style={{ width: `${(active / maximum) * 100}%` }} />
                    </div>
                  </td>
                  <td>{active}</td>
                  <td>
                    <AppLink to={`app/tasks?assignee=${u.id}&overdue=yes`}>
                      {overdue}
                    </AppLink>
                  </td>
                  <td>
                    <AppLink to={`app/tasks?assignee=${u.id}&status=review`}>
                      {review}
                    </AppLink>
                  </td>
                  <td>{nearest ? dateLabel(nearest.dueAt, locale, true) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <ul className="workload-mobile" aria-label={tx('Нагрузка участников', 'Қатысушылар жүктемесі')}>
        {rows.map(({user, active, overdue, review, nearest}) => (
          <li className="workload-member" key={user.id}>
            <AppLink to={`app/tasks?assignee=${user.id}`} className="workload-member-name">{user.name} ↗</AppLink>
            <div className="workload-bar" aria-hidden="true"><span style={{width: `${(active / maximum) * 100}%`}} /></div>
            <dl className="workload-metrics">
              <div><dt>{tx('Активных', 'Белсенді')}</dt><dd>{active}</dd></div>
              <div><dt>{tx('Просрочено', 'Мерзімі өткен')}</dt><dd><AppLink to={`app/tasks?assignee=${user.id}&overdue=yes`}><span className="sr-only">{tx('Просрочено', 'Мерзімі өткен')} · {user.name}: </span>{overdue} ↗</AppLink></dd></div>
              <div><dt>{tx('На проверке', 'Тексерілуде')}</dt><dd><AppLink to={`app/tasks?assignee=${user.id}&status=review`}><span className="sr-only">{tx('На проверке', 'Тексерілуде')} · {user.name}: </span>{review} ↗</AppLink></dd></div>
            </dl>
            <p className="fine-print">{tx('Ближайший срок', 'Жақын мерзім')} · {nearest ? dateLabel(nearest.dueAt, locale, true) : '—'}</p>
          </li>
        ))}
      </ul>
      {!users.length && (
        <p>{tx('В области нет активных назначений', 'Ауқымда белсенді тағайындаулар жоқ')}</p>
      )}
    </Sheet>
  )
}
