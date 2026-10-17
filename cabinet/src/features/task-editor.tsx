import { useEffect, useState, type FormEvent } from 'react'
import { almatyInput, toAlmatyInstant } from '../domain/time'
export { almatyInput } from '../domain/time'
import { UnsavedNavigation } from './unsaved-navigation'
import { useClub } from '../app/context'
import { canManageProject, type Task } from '../domain'
import { Button, Field, InlineError, SectionTitle, Sheet } from '../components/shared'
export function TaskEditor({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, actor, act, pending, toast, tx } = useClub()
  const [values, setValues] = useState(() => ({
    title: { ...task.title },
    description: { ...task.description },
    projectId: task.projectId,
    assigneeId: task.assigneeId,
    reviewerId: task.reviewerId,
    dueAt: almatyInput(task.dueAt),
    points: task.points,
    teamId: task.teamId ?? '',
    category: task.category ?? '',
    materialIds: task.materialIds ?? [],
  }))
  const [error, setError] = useState<unknown>()
  const [dirty, setDirty] = useState(false)
  const [discard, setDiscard] = useState(false)
  const [revision, setRevision] = useState(task.revision)
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  if (!state || !actor || !canManageProject(state, actor, task.projectId)) return null
  const update = (key: keyof typeof values, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }))
    setDirty(true)
  }
  const projects = state.projects.filter((p) => canManageProject(state, actor, p.id) && !p.archived)
  const assignees = state.users.filter(
    (u) => u.role !== 'applicant' && u.projectIds.includes(values.projectId),
  )
  const reviewers = state.users.filter(
    (u) => u.id !== values.assigneeId && canManageProject(state, u, values.projectId),
  )
  async function save(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      const result = await act({
        type: 'updateTask',
        taskId: task.id,
        revision,
        payload: { ...values, dueAt: toAlmatyInstant(values.dueAt) },
      })
      setRevision(result.tasks.find((t) => t.id === task.id)?.revision ?? revision + 1)
      setDirty(false)
      toast(tx('Условия задачи сохранены', 'Тапсырма шарттары сақталды'))
      onClose()
    } catch (reason) {
      setError(reason)
    }
  }
  async function archive() {
    setError(undefined)
    try {
      await act({
        type: 'archiveTask',
        taskId: task.id,
        revision,
        payload: { archived: !task.archived },
      })
      toast(tx('Состояние архива обновлено', 'Мұрағат күйі жаңартылды'))
      onClose()
    } catch (reason) {
      setError(reason)
    }
  }
  return (
    <Sheet className="workspace-editor">
      <UnsavedNavigation dirty={dirty} />
      <SectionTitle>
        {tx('РЕДАКЦИЯ ЗАДАЧИ', 'ТАПСЫРМАНЫ ӨҢДЕУ')} <small>R{revision}</small>
      </SectionTitle>
      {task.status === 'done' && (
        <p className="fine-print">
          {tx(
            'Результат подтверждён. Исполнитель, проект и начисленная награда сохраняются. Корректировки XP выполняются отдельно с причиной.',
            'Нәтиже расталды. Орындаушы, жоба және сыйақы сақталады. XP түзету себебі бар бөлек әрекетпен жасалады.',
          )}
        </p>
      )}
      {revision !== task.revision && (
        <p role="alert">
          {tx(
            'Данные изменились. Закрой редактор и открой актуальную версию; ввод пока сохранён.',
            'Деректер өзгерді. Редакторды жауып, ағымдағы нұсқаны аш; енгізілген мәндер сақталды.',
          )}
        </p>
      )}
      {!!error && <InlineError error={error} />}
      <form className="stack" onSubmit={save}>
        <fieldset disabled={pending || !!task.archived}>
          <div className="grid-2">
            {(['ru', 'kk'] as const).map((l) => (
              <div key={l}>
                <Field label={`${tx('Название', 'Атауы')} · ${l.toUpperCase()}`}>
                  <input
                    required
                    maxLength={160}
                    value={values.title[l]}
                    onChange={(e) => update('title', { ...values.title, [l]: e.target.value })}
                  />
                </Field>
                <Field label={`${tx('Описание', 'Сипаттама')} · ${l.toUpperCase()}`}>
                  <textarea
                    required
                    rows={3}
                    value={values.description[l]}
                    onChange={(e) =>
                      update('description', { ...values.description, [l]: e.target.value })
                    }
                  />
                </Field>
              </div>
            ))}
          </div>
          <div className="grid-2">
            <Field label={tx('Проект', 'Жоба')}>
              <select
                disabled={task.status === 'done'}
                value={values.projectId}
                onChange={(e) => {
                  update('projectId', e.target.value)
                  update('assigneeId', '')
                  update('reviewerId', '')
                  update('teamId', '')
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tx('Команда', 'Команда')}>
              <select value={values.teamId} onChange={(e) => update('teamId', e.target.value)}>
                <option value="">{tx('Без команды', 'Командасыз')}</option>
                {state.teams
                  ?.filter((t) => !t.archived && t.projectIds.includes(values.projectId))
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={tx('Исполнитель', 'Орындаушы')}>
              <select
                required
                disabled={task.status === 'done'}
                value={values.assigneeId}
                onChange={(e) => update('assigneeId', e.target.value)}
              >
                <option value="">{tx('Выбери участника', 'Қатысушыны таңда')}</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tx('Проверяющий', 'Тексеруші')}>
              <select
                required
                value={values.reviewerId}
                onChange={(e) => update('reviewerId', e.target.value)}
              >
                <option value="">{tx('Выбери проверяющего', 'Тексерушіні таңда')}</option>
                {reviewers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tx('Дедлайн · Алматы', 'Мерзімі · Алматы')}>
              <input
                required
                type="datetime-local"
                value={values.dueAt}
                onChange={(e) => update('dueAt', e.target.value)}
              />
            </Field>
            <Field label={tx('Награда после Review', 'Review-дан кейінгі сыйақы')}>
              <select
                disabled={task.status === 'done'}
                value={values.points}
                onChange={(e) => update('points', Number(e.target.value))}
              >
                {[5, 10, 15].map((p) => (
                  <option key={p} value={p}>
                    {p} XP
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tx('Категория', 'Санат')}>
              <input
                maxLength={80}
                value={values.category}
                onChange={(e) => update('category', e.target.value)}
              />
            </Field>
          </div>
          <fieldset className="member-picker"><legend>{tx('Материалы задачи','Тапсырма материалдары')}</legend>{state.materials?.filter(m=>m.projectId===values.projectId&&!m.archived).map(m=><label key={m.id}><input type="checkbox" checked={values.materialIds.includes(m.id)} onChange={e=>update('materialIds',e.target.checked?[...values.materialIds,m.id]:values.materialIds.filter(id=>id!==m.id))}/>{m.title}</label>)}{!state.materials?.some(m=>m.projectId===values.projectId&&!m.archived)&&<p className="fine-print">{tx('Сначала добавь материалы в проект.','Алдымен жобаға материал қос.')}</p>}</fieldset>
          <Button type="submit" loading={pending} disabled={!dirty || revision !== task.revision}>
            {tx('Сохранить редакцию', 'Өңдеуді сақтау')}
          </Button>
        </fieldset>
      </form>
      <div className="action-bar">
        <Button variant="secondary" disabled={pending || dirty} onClick={() => void archive()}>
          {task.archived
            ? tx('Восстановить задачу', 'Тапсырманы қалпына келтіру')
            : tx('Архивировать', 'Мұрағаттау')}
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => (dirty ? setDiscard(true) : onClose())}
        >
          {tx('Закрыть', 'Жабу')}
        </Button>
      </div>
      {discard && (
        <div className="discard-confirm" role="alert">
          <p>{tx('Закрыть без сохранения редакции?', 'Өңдеуді сақтамай жабу керек пе?')}</p>
          <Button variant="secondary" onClick={onClose}>
            {tx('Отменить изменения', 'Өзгерістерден бас тарту')}
          </Button>
          <Button variant="ghost" onClick={() => setDiscard(false)}>
            {tx('Продолжить редактирование', 'Өңдеуді жалғастыру')}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
