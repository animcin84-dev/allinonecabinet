import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useClub } from '../app/context'
import { Button, Field } from '../components/shared'
type View = { id: string; name: string; query: string }
const allowed = new Set([
  'q',
  'project',
  'status',
  'view',
  'scope',
  'assignee',
  'overdue',
  'archived',
  'sort',
])
export function cleanView(query: string) {
  const next = new URLSearchParams(query)
  for (const key of [...next.keys()]) if (!allowed.has(key)) next.delete(key)
  return next.toString()
}
export function SavedViews() {
  const { actor, tx } = useClub()
  const [params, setParams] = useSearchParams()
  const [views, setViews] = useState<View[]>([]),
    [name, setName] = useState(''),
    [error, setError] = useState(false)
  const key = `allinone:views:${actor?.id}:tasks`
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? '[]')
      setViews(
        Array.isArray(v)
          ? v
              .filter(
                (x) =>
                  typeof x?.id === 'string' &&
                  typeof x?.name === 'string' &&
                  typeof x?.query === 'string',
              )
              .slice(0, 8)
          : [],
      )
    } catch {
      setViews([])
    }
    setName('')
    setError(false)
  }, [key])
  if (!actor) return null
  const save = (next: View[]) => {
    try {
      localStorage.setItem(key, JSON.stringify(next))
      setViews(next)
      setError(false)
      return true
    } catch {
      setError(true)
      return false
    }
  }
  return (
    <details className="saved-views">
      <summary>
        {tx('Мои сохранённые фильтры', 'Менің сақталған сүзгілерім')}{' '}
        <small>{views.length}/8</small>
      </summary>
      <div className="saved-view-list">
        {views.map((v) => (
          <div className="row" key={v.id}>
            <Button
              variant="secondary"
              onClick={() => setParams(new URLSearchParams(cleanView(v.query)))}
            >
              {v.name} ↗
            </Button>
            <Button
              variant="ghost"
              aria-label={tx(`Удалить фильтр ${v.name}`, `${v.name} сүзгісін жою`)}
              onClick={() => save(views.filter((x) => x.id !== v.id))}
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <form
        className="action-bar"
        onSubmit={(e) => {
          e.preventDefault()
          if (
            name.trim() &&
            views.length < 8 &&
            save([
              ...views,
              { id: crypto.randomUUID(), name: name.trim(), query: cleanView(params.toString()) },
            ])
          )
            setName('')
        }}
      >
        <Field label={tx('Название набора фильтров', 'Сүзгілер жинағының атауы')}>
          <input required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Button type="submit" disabled={views.length >= 8}>
          {tx('Сохранить текущие фильтры', 'Ағымдағы сүзгілерді сақтау')}
        </Button>
      </form>
      {error && (
        <p role="alert">
          {tx(
            'Браузер не сохранил фильтр. Попробуй снова.',
            'Браузер сүзгіні сақтамады. Қайта көр.',
          )}
        </p>
      )}
    </details>
  )
}
