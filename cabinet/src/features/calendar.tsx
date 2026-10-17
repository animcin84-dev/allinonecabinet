import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { useClub } from '../app/context'
import { canManageProject, monthOf, type Meeting } from '../domain'
import {
  AppLink,
  Button,
  Empty,
  Field,
  InlineError,
  PageHeader,
  SectionTitle,
  Sheet,
  dateLabel,
} from '../components/shared'
import { almatyInput, toAlmatyInstant } from '../domain/time'
import { ExportButton } from '../components/export-button'
import { calendarFile, downloadText } from '../services/export'
export function almatyDay(at: string) {
  return almatyInput(at).slice(0, 10)
}
export function CalendarPage() {
  const { state, actor, tx, L, locale } = useClub()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string>()
  if (!actor || !state) return null
  const raw = params.get('month') ?? monthOf(new Date().toISOString()),
    month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : monthOf(new Date().toISOString()),
    project = params.get('project') ?? 'all',
    club = params.get('club') ?? 'all',
    mine = params.get('scope') === 'mine',
    day = params.get('day') ?? '',
    view = params.get('view') ?? 'month'
  const update = (key: string, value: string) =>
    setParams((old) => {
      const next = new URLSearchParams(old)
      value && value !== 'all' ? next.set(key, value) : next.delete(key)
      return next
    })
  const matches = (id: string) => {
    const p = state.projects.find((p) => p.id === id)
    return (
      !p?.archived &&
      (project === 'all' || id === project) &&
      (club === 'all' || (p?.clubId ?? 'allinone') === club) &&
      (!mine || actor.projectIds.includes(id))
    )
  }
  const tasks = state.tasks
    .filter((t) => !t.archived && matches(t.projectId) && (!mine || t.assigneeId === actor.id))
    .map((t) => ({
      id: t.id,
      title: L(t.title),
      start: t.dueAt,
      end: t.dueAt,
      projectId: t.projectId,
      task: true,
      cancelled: false,
      overdue: t.status !== 'done' && Date.parse(t.dueAt) < Date.now(),
    }))
  const meetings = (state.meetings ?? [])
    .filter((m) => matches(m.projectId))
    .map((m) => ({
      id: m.id,
      title: L(m.title),
      start: m.startAt,
      end: m.endAt,
      projectId: m.projectId,
      task: false,
      cancelled: m.status === 'cancelled',
      overdue: false,
    }))
  const events = [...tasks, ...meetings]
    .filter((e) => monthOf(e.start) === month)
    .sort((a, b) => a.start.localeCompare(b.start))
  const rows = events.filter((e) => !day || almatyDay(e.start) === day)
  const [year, number] = month.split('-').map(Number)
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate(),
    offset = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7
  const move = (n: number) => {
    const d = new Date(Date.UTC(year, number - 1 + n, 1))
    setParams((old) => {
      const next = new URLSearchParams(old)
      next.set('month', d.toISOString().slice(0, 7))
      next.delete('day')
      return next
    })
  }
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / TIME & FOCUS"
        title={tx('СВОЙ РИТМ.\nОБЩИЙ ПЛАН.', 'ӨЗ ЫРҒАҒЫҢ.\nОРТАҚ ЖОСПАР.')}
        description={tx(
          'Дедлайны задач и демо-встречи · часовой пояс Алматы.',
          'Тапсырма мерзімдері мен демо кездесулер · Алматы уақыты.',
        )}
        action={
          state.projects.some((p) => !p.archived && canManageProject(state, actor, p.id)) && (
            <Button onClick={() => setSelected('new')}>
              {tx('Демо-встреча', 'Демо кездесу')} +
            </Button>
          )
        }
      />
      <Sheet>
        <div className="calendar-toolbar">
          <div className="row">
            <Button
              variant="ghost"
              aria-label={tx('Предыдущий месяц', 'Алдыңғы ай')}
              onClick={() => move(-1)}
            >
              ←
            </Button>
            <Field label={tx('Месяц', 'Ай')}>
              <input
                type="month"
                value={month}
                onChange={(e) => {
                  update('month', e.target.value)
                  if (day) update('day', '')
                }}
              />
            </Field>
            <Button
              variant="ghost"
              aria-label={tx('Следующий месяц', 'Келесі ай')}
              onClick={() => move(1)}
            >
              →
            </Button>
          </div>
          <div className="segmented">
            <button aria-pressed={view === 'month'} onClick={() => update('view', 'month')}>
              {tx('Месяц', 'Ай')}
            </button>
            <button aria-pressed={view === 'list'} onClick={() => update('view', 'list')}>
              {tx('Список', 'Тізім')}
            </button>
          </div>
        </div>
        <div className="filter-bar">
          <select
            aria-label={tx('Проект календаря', 'Күнтізбе жобасы')}
            value={project}
            onChange={(e) => update('project', e.target.value)}
          >
            <option value="all">{tx('Все проекты', 'Барлық жобалар')}</option>
            {state.projects
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
          </select>
          <select
            aria-label={tx('Клуб календаря', 'Күнтізбе клубы')}
            value={club}
            onChange={(e) => update('club', e.target.value)}
          >
            <option value="all">{tx('Все клубы', 'Барлық клубтар')}</option>
            <option value="allinone">Allinone</option>
            <option value="young-diplomacy">Young Diplomacy</option>
          </select>
          <label className="row">
            <input
              type="checkbox"
              checked={mine}
              onChange={(e) => update('scope', e.target.checked ? 'mine' : '')}
            />
            {tx('Мои задачи и проекты', 'Менің тапсырмаларым мен жобаларым')}
          </label>
        </div>
        {view === 'month' && (
          <div className="calendar-month" role="group" aria-label={tx('Дни месяца', 'Ай күндері')}>
            <div className="calendar-week">
              {(locale === 'ru'
                ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
                : ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс']
              ).map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-days">
              {Array.from({ length: offset }, (_, i) => (
                <span key={`empty-${i}`} aria-hidden="true" />
              ))}
              {Array.from({ length: count }, (_, i) => {
                const date = `${month}-${String(i + 1).padStart(2, '0')}`,
                  items = events.filter((e) => almatyDay(e.start) === date)
                return (
                  <button
                    key={date}
                    className={day === date ? 'selected-day' : ''}
                    aria-pressed={day === date}
                    aria-label={`${date}: ${items.length} ${tx('событий', 'оқиға')}`}
                    onClick={() => update('day', day === date ? '' : date)}
                  >
                    <strong>{i + 1}</strong>
                    <span>
                      {items.slice(0, 2).map((e) => (
                        <small
                          key={e.id}
                          className={e.cancelled ? 'cancelled' : e.overdue ? 'overdue' : ''}
                        >
                          {e.title}
                        </small>
                      ))}
                      {items.length > 2 && <small>+{items.length - 2}</small>}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <SectionTitle
          action={
            day && (
              <Button variant="ghost" onClick={() => update('day', '')}>
                {tx('Все дни', 'Барлық күндер')}
              </Button>
            )
          }
        >
          {day || tx('ПОВЕСТКА МЕСЯЦА', 'АЙДЫҢ КҮН ТӘРТІБІ')} <small>{rows.length}</small>
        </SectionTitle>
        <div className="calendar-agenda">
          {rows.map((e) => (
            <article className={`agenda-event ${e.cancelled ? 'cancelled' : ''}`} key={e.id}>
              <time dateTime={e.start}>
                <strong>{almatyDay(e.start).slice(8)}</strong>
                {dateLabel(e.start, locale, true)}
              </time>
              <div>
                <span className="eyebrow">
                  {e.task
                    ? tx('Дедлайн задачи', 'Тапсырма мерзімі')
                    : tx('Демо-встреча', 'Демо кездесу')}
                  {e.cancelled
                    ? ` · ${tx('Отменена', 'Бас тартылды')}`
                    : e.overdue
                      ? ` · ${tx('Просрочено', 'Мерзімі өтті')}`
                      : ''}
                </span>
                {e.task ? (
                  <AppLink to={`app/tasks/${e.id}`}>{e.title} ↗</AppLink>
                ) : (
                  <Button variant="ghost" onClick={() => setSelected(e.id)}>
                    {e.title} ↗
                  </Button>
                )}
                <p className="muted">{state.projects.find((p) => p.id === e.projectId)?.title}</p>
                <ExportButton label={tx('В календарь · ICS', 'Күнтізбеге · ICS')} onExport={() => {
                  const projectTitle = state.projects.find((p) => p.id === e.projectId)?.title ?? ''
                  const meeting = e.task ? undefined : state.meetings?.find((m) => m.id === e.id)
                  downloadText(calendarFile({
                    id: `${e.task ? 'task' : 'meeting'}-${e.id}`,
                    title: `${tx('Демо', 'Демо')} · ${e.task ? tx('Дедлайн: ', 'Мерзімі: ') : ''}${e.title}`,
                    start: e.start, end: e.end, cancelled: e.cancelled,
                    location: meeting?.place,
                    description: `${projectTitle}\n${tx('Демонстрационные данные Allinone. Время события отображается в часовом поясе твоего календаря.', 'Allinone демо деректері. Оқиға уақыты күнтізбеңіздің уақыт белдеуінде көрсетіледі.')}`,
                  }), `allinone-${e.task ? 'task' : 'meeting'}-${encodeURIComponent(e.id)}.ics`, 'text/calendar;charset=utf-8')
                }} />
              </div>
            </article>
          ))}
        </div>
        {!rows.length && (
          <Empty
            title={tx('Этот период свободен', 'Бұл кезең бос')}
            description={tx(
              'Попробуй другой месяц или сбрось фильтры. Реальные встречи не добавляются без подтверждения клуба.',
              'Басқа айды таңда немесе сүзгілерді тазарт. Клубтың растауынсыз нақты кездесулер қосылмайды.',
            )}
          />
        )}
      </Sheet>
      {selected && (
        <MeetingEditor
          key={selected}
          meeting={state.meetings?.find((m) => m.id === selected)}
          onClose={() => setSelected(undefined)}
        />
      )}
    </>
  )
}
function MeetingEditor({ meeting, onClose }: { meeting?: Meeting; onClose: () => void }) {
  const { state, actor, tx, act, pending, L } = useClub()
  const now = almatyInput(new Date().toISOString())
  const [v, set] = useState({
    title: meeting?.title ?? { ru: '', kk: '' },
    projectId:
      meeting?.projectId ??
      state?.projects.find((p) => actor && canManageProject(state, actor, p.id) && !p.archived)
        ?.id ??
      '',
    startAt: meeting ? almatyInput(meeting.startAt) : now,
    endAt: meeting
      ? almatyInput(meeting.endAt)
      : almatyInput(new Date(Date.now() + 3600000).toISOString()),
    place: meeting?.place ?? '',
    format: meeting?.format ?? 'offline',
    status: meeting?.status ?? 'scheduled',
  })
  const [error, setError] = useState<unknown>()
  if (!state || !actor) return null
  const manage =
    canManageProject(state, actor, v.projectId) &&
    (!meeting || canManageProject(state, actor, meeting.projectId))
  const update = (key: keyof typeof v, x: unknown) => set((old) => ({ ...old, [key]: x }))
  async function save(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      await act({
        type: meeting ? 'updateMeeting' : 'createMeeting',
        payload: {
          ...v,
          id: meeting?.id,
          startAt: toAlmatyInstant(v.startAt),
          endAt: toAlmatyInstant(v.endAt),
        },
      })
      onClose()
    } catch (e) {
      setError(e)
    }
  }
  return (
    <Sheet className="workspace-editor">
      <SectionTitle>
        {meeting ? L(meeting.title) : tx('НОВАЯ ДЕМО-ВСТРЕЧА', 'ЖАҢА ДЕМО КЕЗДЕСУ')}
      </SectionTitle>
      <p className="fine-print">
        {tx(
          'Это локальная демонстрация. Приглашения и уведомления по email не отправляются.',
          'Бұл жергілікті демонстрация. Email шақырулары мен хабарламалар жіберілмейді.',
        )}
      </p>
      {!!error && <InlineError error={error} />}
      <form onSubmit={save} className="stack">
        <fieldset disabled={!manage || pending}>
          <div className="grid-2">
            {(['ru', 'kk'] as const).map((l) => (
              <Field key={l} label={`${tx('Название встречи', 'Кездесу атауы')} · ${l}`}>
                <input
                  required
                  value={v.title[l]}
                  onChange={(e) => update('title', { ...v.title, [l]: e.target.value })}
                />
              </Field>
            ))}
            <Field label={tx('Начало · Алматы', 'Басталуы · Алматы')}>
              <input
                required
                type="datetime-local"
                value={v.startAt}
                onChange={(e) => update('startAt', e.target.value)}
              />
            </Field>
            <Field label={tx('Окончание · Алматы', 'Аяқталуы · Алматы')}>
              <input
                required
                type="datetime-local"
                value={v.endAt}
                min={v.startAt}
                onChange={(e) => update('endAt', e.target.value)}
              />
            </Field>
          </div>
          <Field label={tx('Проект встречи', 'Кездесу жобасы')}>
            <select
              required
              value={v.projectId}
              onChange={(e) => update('projectId', e.target.value)}
            >
              {state.projects
                .filter((p) => p.id === meeting?.projectId || canManageProject(state, actor, p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field label={tx('Формат', 'Пішімі')}>
            <select value={v.format} onChange={(e) => update('format', e.target.value)}>
              <option value="offline">{tx('Офлайн', 'Офлайн')}</option>
              <option value="online">{tx('Онлайн', 'Онлайн')}</option>
            </select>
          </Field>
          <Field label={v.format === 'online' ? 'HTTP/HTTPS' : tx('Место', 'Орын')}>
            <input
              required
              value={v.place}
              onChange={(e) => update('place', e.target.value)}
              type={v.format === 'online' ? 'url' : 'text'}
            />
          </Field>
          <Field label={tx('Статус встречи', 'Кездесу күйі')}>
            <select value={v.status} onChange={(e) => update('status', e.target.value)}>
              <option value="scheduled">{tx('Запланирована', 'Жоспарланған')}</option>
              <option value="cancelled">{tx('Отменена', 'Бас тартылған')}</option>
            </select>
          </Field>
          {manage && (
            <Button type="submit" loading={pending}>
              {tx('Сохранить встречу', 'Кездесуді сақтау')}
            </Button>
          )}
        </fieldset>
      </form>
      <Button variant="ghost" disabled={pending} onClick={onClose}>
        {tx('Закрыть', 'Жабу')}
      </Button>
    </Sheet>
  )
}
