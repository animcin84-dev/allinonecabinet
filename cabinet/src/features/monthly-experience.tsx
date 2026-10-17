import { useState } from 'react'
import { useClub } from '../app/context'
import { monthOf, previewMonthlyXP, rankFor, totalXP, canManageUser } from '../domain'
import { Button, Field, InlineError, SectionTitle, Sheet, dateLabel } from '../components/shared'
export function MonthlyExperience() {
  const { state, actor, tx, L, act, pending, locale } = useClub()
  const [month, setMonth] = useState(() => monthOf(new Date().toISOString())),
    [userId, setUserId] = useState(actor?.id ?? ''),
    [w1, setW1] = useState(false),
    [w2, setW2] = useState(false),
    [confirm, setConfirm] = useState(false),
    [reason, setReason] = useState(''),
    [error, setError] = useState<unknown>()
  if (!state || !actor) return null
  const user = state.users.find((u) => u.id === userId) ?? actor
  const entries = state.ledger.filter((e) => e.userId === user.id),
    prior = entries.filter((e) => monthOf(e.at) < month).reduce((n, e) => n + e.points, 0),
    awards = entries
      .filter((e) => monthOf(e.at) === month && e.kind === 'award')
      .reduce((n, e) => n + e.points, 0),
    adjustments = entries
      .filter((e) => monthOf(e.at) === month && e.kind === 'adjustment')
      .reduce((n, e) => n + e.points, 0),
    monthly = awards + adjustments,
    preview = previewMonthlyXP(prior, monthly, w1, w2),
    closure = state.closures?.find((c) => c.month === month && c.userId === user.id)
  return (
    <Sheet className="monthly-sheet">
      <SectionTitle>{tx('КАЛЕНДАРНЫЙ МЕСЯЦ · XP', 'КҮНТІЗБЕЛІК АЙ · XP')}</SectionTitle>
      <div className="action-bar">
        <Field label={tx('Месяц расчёта', 'Есептеу айы')}>
          <input
            type="month"
            value={month}
            onChange={(e) => {
              if (e.target.value) setMonth(e.target.value)
              setConfirm(false)
            }}
          />
        </Field>
        {actor.role === 'admin' && (
          <Field label={tx('Профиль расчёта', 'Есептеу профилі')}>
            <select
              value={user.id}
              onChange={(e) => {
                setUserId(e.target.value)
                setConfirm(false)
              }}
            >
              {state.users
                .filter((u) => u.role !== 'applicant')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </div>
      <dl className="month-metrics">
        <div>
          <dt>{tx('До месяца', 'Айға дейін')}</dt>
          <dd>{prior.toFixed(1)}</dd>
        </div>
        <div>
          <dt>{tx('Заработано', 'Табылған')}</dt>
          <dd>+{awards.toFixed(1)}</dd>
        </div>
        <div>
          <dt>{tx('Корректировки', 'Түзетулер')}</dt>
          <dd>{adjustments.toFixed(1)}</dd>
        </div>
        <div>
          <dt>{tx('Итог без удержаний', 'Шегерімсіз қорытынды')}</dt>
          <dd>
            {(prior + monthly).toFixed(1)} <small>XP</small>
          </dd>
        </div>
      </dl>
      <div className="month-preview">
        <div>
          <span className="eyebrow">
            {tx('Черновая формула · предварительный расчёт', 'Жоба формуласы · алдын ала есептеу')}
          </span>
          <h3>{preview.toFixed(1)} XP</h3>
          <p>
            {tx(
              'Прошлый баланс + (месяц − min(30% месяца, 100) при W1) × 0.5 при W2.',
              'Алдыңғы баланс + (ай − W1 болса min(айдың 30%, 100)) × W2 болса 0.5.',
            )}
          </p>
        </div>
        <div className="stack">
          <label className="row">
            <input
              type="checkbox"
              checked={w1}
              onChange={(e) => {
                setW1(e.target.checked)
                setConfirm(false)
              }}
            />
            W1 · {tx('Предпросмотр удержания', 'Шегерімді алдын ала қарау')}
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={w2}
              onChange={(e) => {
                setW2(e.target.checked)
                setConfirm(false)
              }}
            />
            W2 · {tx('Предпросмотр коэффициента', 'Коэффициентті алдын ала қарау')}
          </label>
        </div>
      </div>
      <p className="fine-print">
        {tx(
          'Предпросмотр не меняет баланс. W3, суммирование предупреждений и официальное закрытие требуют решения клуба.',
          'Алдын ала қарау балансты өзгертпейді. W3, ескертулерді жинақтау және ресми жабу клуб шешімін қажет етеді.',
        )}
      </p>
      {closure ? (
        <p className="badge">
          {tx('Демо-месяц уже закрыт', 'Демо ай жабылған')} · {dateLabel(closure.at, locale)} ·{' '}
          {closure.result.toFixed(1)} XP · {closure.reason}
        </p>
      ) : (
        actor.role === 'admin' &&
        month < monthOf(new Date().toISOString()) &&
        monthly >= 0 && (
          <div className="stack">
            <Field label={tx('Основание демо-закрытия', 'Демо жабу негізі')}>
              <input value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} />
            </Field>
            <label className="row">
              <input
                type="checkbox"
                checked={confirm}
                onChange={(e) => setConfirm(e.target.checked)}
              />
              {tx(
                'Применить выбранный черновой расчёт только в демо. Это не утверждённая политика клуба.',
                'Таңдалған жоба есебін тек демода қолдану. Бұл клубтың бекітілген саясаты емес.',
              )}
            </label>
            <Button
              variant="secondary"
              disabled={!confirm || reason.trim().length < 5}
              loading={pending}
              onClick={async () => {
                setError(undefined)
                try {
                  await act({
                    type: 'closeMonth',
                    payload: {
                      userId: user.id,
                      month,
                      w1,
                      w2,
                      reason,
                      confirmed: true,
                      demo: true,
                    },
                  })
                  setConfirm(false)
                } catch (e) {
                  setError(e)
                }
              }}
            >
              {tx('Провести демо-закрытие', 'Демо жабуды өткізу')}
            </Button>
          </div>
        )
      )}
      {!!error && <InlineError error={error} />}
      <details className="private-warnings"><summary>{tx('Приватные предупреждения','Жеке ескертулер')} · {state.warnings.filter(w=>w.userId===user.id).length}</summary>{state.warnings.filter(w=>w.userId===user.id).map(w=><article className="comment" key={w.id}><strong>{w.resolved?tx('Закрыто','Жабылған'):tx('Открыто','Ашық')}</strong><p>{w.reason}</p><small>{state.users.find(u=>u.id===w.by)?.name??tx('Руководитель','Жетекші')} · {dateLabel(w.at,locale,true)}</small>{w.resolved&&<p>{w.resolvedReason} · {w.resolvedAt?dateLabel(w.resolvedAt,locale,true):''}</p>}</article>)}</details>
      <details>
        <summary>{tx('Записи выбранного месяца', 'Таңдалған ай жазбалары')}</summary>
        {entries
          .filter((e) => monthOf(e.at) === month)
          .map((e) => (
            <div className="task-row" key={e.id}>
              <span>{L(e.reason)}</span>
              <strong>{e.points} XP</strong>
            </div>
          ))}
      </details>
    </Sheet>
  )
}
export function ManualRankEditor({ userId }: { userId: string }) {
  const { actor, state, tx, act, pending, locale } = useClub()
  const user = state?.users.find((u) => u.id === userId)
  const [title, setTitle] = useState(user?.manualRank?.title ?? ''),
    [reason, setReason] = useState(''),
    [error, setError] = useState<unknown>()
  if (!actor || !state || !user) return null
  const can = canManageUser(actor, user)
  return (
    <Sheet>
      <SectionTitle>{tx('РАНГ · ОТДЕЛЬНО ОТ ДОЛЖНОСТИ', 'ДӘРЕЖЕ · ЛАУАЗЫМНАН БӨЛЕК')}</SectionTitle>
      <p>
        {tx('Расчётный ранг', 'Есептік дәреже')}:{' '}
        <strong>{rankFor(totalXP(state, user.id)).name}</strong>
      </p>
      {user.manualRank && (
        <div className="rank-assignment">
          <strong>{user.manualRank.title}</strong>
          <p>{user.manualRank.reason}</p>
          <small>
            {state.users.find((u) => u.id === user.manualRank?.by)?.name} ·{' '}
            {dateLabel(user.manualRank.at, locale)}
          </small>
        </div>
      )}
      <p className="fine-print">
        {tx(
          'Ручной ранг не меняет роль, доступ к проектам и баланс XP.',
          'Қолмен берілген дәреже рөлді, жоба рұқсатын және XP балансын өзгертпейді.',
        )}
      </p>
      {!!error && <InlineError error={error} />}{' '}
      {can && (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault()
            try {
              await act({ type: 'manualRank', payload: { userId, title, reason } })
              setReason('')
            } catch (e) {
              setError(e)
            }
          }}
        >
          <Field label={tx('Ручной ранг', 'Қолмен берілген дәреже')}>
            <input
              required
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <Field label={tx('Причина назначения', 'Тағайындау себебі')}>
            <textarea
              required
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </Field>
          <Button type="submit" loading={pending}>
            {tx('Назначить с основанием', 'Негізбен тағайындау')}
          </Button>
        </form>
      )}
    </Sheet>
  )
}
