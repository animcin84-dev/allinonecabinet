import { useClub } from '../app/context'
import type { Application } from '../domain'
import { dateLabel } from '../components/shared'
import type { ReactNode } from 'react'
export function ApplicationHistory({ application, renderSnapshot }: { application: Application; renderSnapshot:(snapshot:Application)=>ReactNode }) {
  const { state, tx, locale } = useClub()
  if (!application.history?.length) return null
  return (
    <details className="application-history">
      <summary>
        {tx('История ответов и решений', 'Жауаптар мен шешімдер тарихы')} ·{' '}
        {application.history.length}
      </summary>
      {application.history.map((h) => (
        <article className="comment" key={h.id}>
          <header>
            <strong>{({draft:tx('Черновик','Қаралама'),submitted:tx('Отправлена','Жіберілді'),reviewing:tx('Рассматривается','Қаралуда'),needs_info:tx('Нужны уточнения','Нақтылау қажет'),accepted:tx('Принята','Қабылданды'),rejected:tx('Отклонена','Қабылданбады')})[h.status]}</strong>
            <time>
              {h.at
                ? dateLabel(h.at, locale, true)
                : tx('Дата не записана в старом демо', 'Ескі демода күн жазылмаған')}
            </time>
          </header>
          <p>
            {state?.users.find((u) => u.id === h.by)?.name ??
              tx('Предыдущая версия', 'Алдыңғы нұсқа')}
          </p>
          {h.comment && <p className="user-text">{h.comment}</p>}
          {h.snapshot && (
            <details>
              <summary>{tx('Ответы этой версии', 'Осы нұсқаның жауаптары')}</summary>
              {renderSnapshot({ ...application, ...h.snapshot, status: h.status, history: [] })}
            </details>
          )}
        </article>
      ))}
    </details>
  )
}
