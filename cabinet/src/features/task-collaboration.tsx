import { useState, type FormEvent } from 'react'
import { useClub } from '../app/context'
import { canManageProject, type Task } from '../domain'
import { Button, Field, InlineError, SectionTitle, Sheet, dateLabel } from '../components/shared'
export function TaskCollaboration({ task }: { task: Task }) {
  const { actor, state, tx, act, pending, locale } = useClub()
  const [text, setText] = useState(''),
    [reply, setReply] = useState(''),
    [edit, setEdit] = useState(''),
    [error, setError] = useState<unknown>(),
    [item, setItem] = useState('')
  const comments = task.comments ?? [],
    items = task.checklist ?? []
  if (!actor || !state) return null
  const manager = canManageProject(state, actor, task.projectId),
    toggle = manager || actor.id === task.assigneeId
  async function run(type: string, payload: Record<string, unknown>) {
    setError(undefined)
    try {
      await act({ type, taskId: task.id, revision: task.revision, payload })
      return true
    } catch (e) {
      setError(e)
      return false
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault()
    if (
      await run(
        edit ? 'editComment' : 'commentTask',
        edit ? { id: edit, text } : { text, replyTo: reply },
      )
    ) {
      setText('')
      setReply('')
      setEdit('')
    }
  }
  return (
    <div className="stack">
      <Sheet className="checklist-sheet">
        <SectionTitle
          action={
            <span className="badge">
              {items.filter((i) => i.done).length}/{items.length}
            </span>
          }
        >
          {tx('ПО ШАГАМ', 'ҚАДАМДАР')}
        </SectionTitle>
        {items.length > 0 && (
          <progress
            value={items.filter((i) => i.done).length}
            max={items.length}
            aria-label={tx('Прогресс чеклиста', 'Қадамдар барысы')}
          />
        )}
        {items.map((i, index) => (
          <div className="checklist-item" key={i.id}>
            <label>
              <input
                type="checkbox"
                disabled={pending || !toggle || !!task.archived}
                checked={i.done}
                onChange={(e) => void run('checklistTask', { id: i.id, done: e.target.checked })}
              />
              <span className={i.done ? 'checked-text' : ''}>{i.text}</span>
            </label>
            {manager && !task.archived && (
              <div className="row">
                <Button
                  variant="ghost"
                  disabled={pending || index === 0}
                  aria-label={tx(`Поднять пункт ${i.text}`, `${i.text} тармағын көтеру`)}
                  onClick={() => {
                    const next = [...items]
                    ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                    void run('checklistTask', { items: next })
                  }}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending}
                  aria-label={tx(`Удалить пункт ${i.text}`, `${i.text} тармағын жою`)}
                  onClick={() =>
                    void run('checklistTask', { items: items.filter((x) => x.id !== i.id) })
                  }
                >
                  ×
                </Button>
              </div>
            )}
          </div>
        ))}
        {manager && !task.archived && (
          <form
            className="action-bar"
            onSubmit={async (e) => {
              e.preventDefault()
              if (
                await run('checklistTask', {
                  items: [...items, { id: crypto.randomUUID(), text: item, done: false }],
                })
              )
                setItem('')
            }}
          >
            <Field label={tx('Новый пункт', 'Жаңа тармақ')}>
              <input
                required
                maxLength={300}
                value={item}
                onChange={(e) => setItem(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={pending}>
              {tx('Добавить', 'Қосу')} +
            </Button>
          </form>
        )}
        <p className="fine-print">
          {tx(
            'Чеклист помогает работе. XP начисляется только после проверки результата.',
            'Қадамдар жұмысқа көмектеседі. XP тек нәтиже тексерілгеннен кейін есептеледі.',
          )}
        </p>
      </Sheet>
      <Sheet className="discussion-sheet">
        <SectionTitle>
          {tx('ОБСУДИМ РЕЗУЛЬТАТ', 'НӘТИЖЕНІ ТАЛҚЫЛАЙЫҚ')} <small>{comments.length}</small>
        </SectionTitle>
        {!comments.length && (
          <p className="muted">
            {tx(
              'Здесь можно уточнить задачу или оставить обратную связь.',
              'Мұнда тапсырманы нақтылауға немесе пікір қалдыруға болады.',
            )}
          </p>
        )}
        {comments.map((c) => (
          <article className="comment" key={c.id}>
            <header>
              <strong>
                {state.users.find((u) => u.id === c.by)?.name ?? tx('Участник', 'Қатысушы')}
              </strong>
              <time dateTime={c.at}>{dateLabel(c.at, locale, true)}</time>
            </header>
            {c.replyTo && (
              <blockquote>
                {comments.find((x) => x.id === c.replyTo)?.text.slice(0, 160)}
              </blockquote>
            )}
            <p className="user-text">{c.text}</p>
            {c.edits.length > 0 && (
              <details>
                <summary>{tx('Изменён · история', 'Өңделген · тарих')}</summary>
                {c.edits.map((x, i) => (
                  <p className="user-text" key={i}>
                    {x.text} · {dateLabel(x.at, locale, true)}
                  </p>
                ))}
              </details>
            )}
            {!task.archived && (
              <div className="row">
                <Button
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setReply(c.id)
                    setEdit('')
                  }}
                >
                  {tx('Ответить', 'Жауап беру')}
                </Button>
                {c.by === actor.id && (
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setEdit(c.id)
                      setText(c.text)
                      setReply('')
                    }}
                  >
                    {tx('Изменить', 'Өзгерту')}
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
        {!!error && <InlineError error={error} />}
        {!task.archived && (
          <form onSubmit={send} className="stack">
            {(edit || reply) && (
              <div className="reply-context">
                {edit
                  ? tx('Редактирование своего комментария', 'Өз пікіріңді өңдеу')
                  : comments.find((x) => x.id === reply)?.text.slice(0, 160)}
                <Button
                  variant="ghost"
                  onClick={() => {
                    setReply('')
                    setEdit('')
                    setText('')
                  }}
                >
                  {tx('Отменить', 'Бас тарту')}
                </Button>
              </div>
            )}
            <Field label={tx('Комментарий', 'Пікір')}>
              <textarea
                required
                maxLength={4000}
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </Field>
            <Button type="submit" loading={pending}>
              {edit
                ? tx('Сохранить комментарий', 'Пікірді сақтау')
                : tx('Отправить комментарий', 'Пікірді жіберу')}{' '}
              ↗
            </Button>
          </form>
        )}
      </Sheet>
    </div>
  )
}
