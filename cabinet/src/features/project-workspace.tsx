import { useEffect, useState, type FormEvent } from 'react'
import { UnsavedNavigation } from './unsaved-navigation'
import { useClub } from '../app/context'
import {
  CORES,
  canManageProject,
  type LocalAttachment,
  type Material,
  type Project,
  type Team,
} from '../domain'
import {
  AppLink,
  Button,
  Empty,
  Field,
  InlineError,
  SectionTitle,
  Sheet,
  dateLabel,
} from '../components/shared'
import { LocalFilePicker } from '../components/ui/local-files'
import { almatyInput } from '../domain/time'
export const lifecycleLabels = {
  in_progress: ['В процессе', 'Жүріп жатыр'],
  completed: ['Завершён', 'Аяқталды'],
  frozen: ['Заморожен', 'Тоқтатылды'],
  soon: ['Скоро', 'Жақында'],
} as const
export const categoryLabels = {
  research: ['Исследования', 'Зерттеулер'],
  diplomacy: ['Дипломатия', 'Дипломатия'],
  digital: ['Технологии', 'Технологиялар'],
  community: ['Сообщество', 'Қауымдастық'],
} as const
function useDirtyClose(onClose?: () => void) {
  const [dirty, setDirty] = useState(false),
    [confirm, setConfirm] = useState(false)
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
  return {
    dirty,
    setDirty,
    confirm,
    setConfirm,
    close: () => (dirty ? setConfirm(true) : onClose?.()),
  }
}
export function ProjectEditor({ project, onClose }: { project?: Project; onClose?: () => void }) {
  const { state, actor, act, pending, tx, toast } = useClub()
  const [v, set] = useState(() => ({
    title: project?.title ?? '',
    description: project?.description ?? { ru: '', kk: '' },
    date: project?.date ?? almatyInput(new Date().toISOString()).slice(0, 10),
    coreId: project?.coreId ?? actor?.coreId ?? 'main',
    lifecycle: project?.lifecycle ?? '',
    category: project?.category ?? '',
    clubId: project?.clubId ?? '',
    ownerId: project?.ownerId ?? '',
    image: project?.image ?? '',
    memberIds: project?.memberIds ?? project?.teamIds ?? [],
  }))
  const [error, setError] = useState<unknown>(),
    dirty = useDirtyClose(onClose)
  if (
    !actor ||
    !state ||
    (!project && !['head', 'admin'].includes(actor.role)) ||
    (project && !canManageProject(state, actor, project.id))
  )
    return null
  function update(key: keyof typeof v, value: unknown) {
    set((prev) => ({ ...prev, [key]: value }))
    dirty.setDirty(true)
  }
  async function save(e: FormEvent) {
    e.preventDefault()
    setError(undefined)
    try {
      const payload: Record<string, unknown> = { ...v, id: project?.id }
      if (!v.lifecycle) delete payload.lifecycle
      if (!v.category) delete payload.category
      if (project && v.image === project.image) delete payload.image
      await act({ type: project ? 'updateProject' : 'createProject', payload })
      dirty.setDirty(false)
      toast(tx('Проект сохранён в демо', 'Жоба демода сақталды'))
      onClose?.()
    } catch (e) {
      setError(e)
    }
  }
  return (
    <Sheet className="workspace-editor">
      <UnsavedNavigation dirty={dirty.dirty} />
      <SectionTitle>
        {project
          ? tx('ПАСПОРТ ПРОЕКТА · РЕДАКЦИЯ', 'ЖОБА ПАСПОРТЫ · ӨҢДЕУ')
          : tx('НОВАЯ ИДЕЯ → ПРОЕКТ', 'ЖАҢА ИДЕЯ → ЖОБА')}
      </SectionTitle>
      <p className="fine-print">
        {tx(
          'Изменения остаются в демо-кабинете. Новые проекты не публикуются на сайте клуба.',
          'Өзгерістер демо кабинетте қалады. Жаңа жобалар клуб сайтында жарияланбайды.',
        )}
      </p>
      {!!error && <InlineError error={error} />}
      <form className="stack" onSubmit={save}>
        <fieldset disabled={pending || !!project?.archived}>
          <Field label={tx('Название', 'Атауы')}>
            <input
              required
              maxLength={160}
              value={v.title}
              onChange={(e) => update('title', e.target.value)}
            />
          </Field>
          <div className="grid-2">
            {(['ru', 'kk'] as const).map((l) => (
              <Field key={l} label={`${tx('Описание', 'Сипаттама')} · ${l.toUpperCase()}`}>
                <textarea
                  required
                  rows={4}
                  value={v.description[l]}
                  onChange={(e) => update('description', { ...v.description, [l]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <div className="grid-2">
            <Field label={tx('Статус', 'Күйі')}>
              <select value={v.lifecycle} onChange={(e) => update('lifecycle', e.target.value)}>
                <option value="">{tx('Не указан', 'Көрсетілмеген')}</option>
                {Object.entries(lifecycleLabels).map(([id, title]) => (
                  <option key={id} value={id}>
                    {tx(title[0], title[1])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tx('Категория', 'Санат')}>
              <select value={v.category} onChange={(e) => update('category', e.target.value)}>
                <option value="">{tx('Не указана', 'Көрсетілмеген')}</option>
                {Object.entries(categoryLabels).map(([id, title]) => (
                  <option key={id} value={id}>
                    {tx(title[0], title[1])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tx('Дата события', 'Іс-шара күні')}>
              <input
                type="date"
                required
                value={v.date}
                onChange={(e) => update('date', e.target.value)}
              />
            </Field>
            <Field label={tx('Кор', 'Бағыт')}>
              <select
                disabled={actor.role !== 'admin'}
                value={v.coreId}
                onChange={(e) => update('coreId', e.target.value)}
              >
                {CORES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tx('Клуб', 'Клуб')}>
              <select value={v.clubId} onChange={(e) => update('clubId', e.target.value)}>
                <option value="">Allinone</option>
                <option value="young-diplomacy">Young Diplomacy</option>
              </select>
            </Field>
            <Field label={tx('Ответственный', 'Жауапты адам')}>
              <select value={v.ownerId} onChange={(e) => update('ownerId', e.target.value)}>
                <option value="">{tx('Не назначен', 'Тағайындалмаған')}</option>
                {state.users
                  .filter((u) => u.role !== 'applicant')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <Field
            label={tx(
              'Обложка · HTTP/HTTPS или текущий файл',
              'Мұқаба · HTTP/HTTPS немесе ағымдағы файл',
            )}
          >
            <input value={v.image} onChange={(e) => update('image', e.target.value)} />
          </Field>
          <fieldset className="member-picker">
            <legend>{tx('Участники проекта', 'Жоба қатысушылары')}</legend>
            {state.users
              .filter((u) => u.role !== 'applicant')
              .map((u) => (
                <label key={u.id}>
                  <input
                    type="checkbox"
                    checked={v.memberIds.includes(u.id)}
                    onChange={(e) =>
                      update(
                        'memberIds',
                        e.target.checked
                          ? [...v.memberIds, u.id]
                          : v.memberIds.filter((id) => id !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
          </fieldset>
          <p className="fine-print">
            {tx(
              'Участника с активной задачей сначала нужно переназначить в редакторе задачи.',
              'Белсенді тапсырмасы бар қатысушыны алдымен тапсырма редакторында қайта тағайындау керек.',
            )}
          </p>
          <Button type="submit" loading={pending}>
            {tx('Сохранить проект', 'Жобаны сақтау')}
          </Button>
        </fieldset>
      </form>
      <div className="action-bar">
        {project && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              setError(undefined)
              try {
                await act({
                  type: 'archiveProject',
                  payload: { id: project.id, archived: !project.archived },
                })
                onClose?.()
              } catch (e) {
                setError(e)
              }
            }}
          >
            {project.archived
              ? tx('Восстановить', 'Қалпына келтіру')
              : tx('Архивировать проект', 'Жобаны мұрағаттау')}
          </Button>
        )}
        {onClose && (
          <Button variant="ghost" disabled={pending} onClick={dirty.close}>
            {tx('Закрыть', 'Жабу')}
          </Button>
        )}
      </div>
      {dirty.confirm && (
        <div role="alert" className="discard-confirm">
          <p>{tx('Закрыть без сохранения?', 'Сақтамай жабу керек пе?')}</p>
          <Button variant="secondary" onClick={onClose}>
            {tx('Отменить изменения', 'Өзгерістерден бас тарту')}
          </Button>
          <Button variant="ghost" onClick={() => dirty.setConfirm(false)}>
            {tx('Продолжить', 'Жалғастыру')}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
export function TeamsWorkspace() {
  const { state, actor, tx, L } = useClub()
  const [selected, setSelected] = useState<string>(),
    [archive, setArchive] = useState(false)
  if (!state || !actor) return null
  const canCreate = ['head', 'admin'].includes(actor.role)
  return (
    <div className="stack">
      <SectionTitle
        action={
          canCreate && (
            <Button onClick={() => setSelected('new')}>
              {tx('Создать команду', 'Команда құру')} +
            </Button>
          )
        }
      >
        {tx('САМОСТОЯТЕЛЬНЫЕ КОМАНДЫ', 'ДЕРБЕС КОМАНДАЛАР')}
      </SectionTitle>
      <p className="fine-print">
        {tx(
          'Состав команды, кор и доступ к проекту — отдельные назначения. Команда не меняет роль участника.',
          'Команда құрамы, бағыт және жобаға рұқсат — бөлек тағайындаулар. Команда қатысушы рөлін өзгертпейді.',
        )}
      </p>
      <label className="row">
        <input type="checkbox" checked={archive} onChange={(e) => setArchive(e.target.checked)} />
        {tx('Показать архив', 'Мұрағатты көрсету')}
      </label>
      <div className="grid-2">
        {state.teams
          ?.filter((t) => (archive ? !!t.archived : !t.archived))
          .map((t) => (
            <Sheet key={t.id}>
              <span className="eyebrow">{CORES.find((c) => c.id === t.coreId)?.title}</span>
              <h2>{t.title}</h2>
              <p>
                {t.description
                  ? L(t.description)
                  : tx('Описание пока не добавлено', 'Сипаттама әлі қосылмаған')}
              </p>
              <p>
                {tx('Руководитель', 'Жетекші')}:{' '}
                {state.users.find((u) => u.id === t.leaderId)?.name ??
                  tx('Не назначен', 'Тағайындалмаған')}
              </p>
              <div className="team-roster">
                {t.memberIds.map((id) => (
                  <span className="badge" key={id}>
                    {state.users.find((u) => u.id === id)?.name ??
                      tx('Недоступный участник', 'Қолжетімсіз қатысушы')}
                  </span>
                ))}
              </div>
              <div className="row">
                {t.projectIds.map((id) => (
                  <AppLink key={id} to={`app/projects/${id}`}>
                    {state.projects.find((p) => p.id === id)?.title} ↗
                  </AppLink>
                ))}
              </div>
              {(actor.role === 'admin' ||
                (actor.role === 'head' && actor.coreId === t.coreId) ||
                (actor.role === 'manager' && t.leaderId === actor.id)) && (
                <Button variant="secondary" onClick={() => setSelected(t.id)}>
                  {tx('Изменить команду', 'Команданы өзгерту')}
                </Button>
              )}
            </Sheet>
          ))}
      </div>
      {!state.teams?.some((t) => (archive ? !!t.archived : !t.archived)) && (
        <Empty
          title={tx('Здесь пока нет команд', 'Мұнда әлі команда жоқ')}
          description={tx(
            'Создай отдельную команду для работы над проектом.',
            'Жобамен жұмыс істеу үшін бөлек команда құр.',
          )}
        />
      )}{' '}
      {selected && (
        <TeamEditor
          key={selected}
          team={state.teams?.find((t) => t.id === selected)}
          onClose={() => setSelected(undefined)}
        />
      )}
    </div>
  )
}
function TeamEditor({ team, onClose }: { team?: Team; onClose: () => void }) {
  const { state, actor, act, pending, tx } = useClub()
  const [v, set] = useState({
    title: team?.title ?? '',
    description: team?.description ?? { ru: '', kk: '' },
    coreId: team?.coreId ?? actor?.coreId ?? 'main',
    leaderId: team?.leaderId ?? '',
    memberIds: team?.memberIds ?? [],
    projectIds: team?.projectIds ?? [],
  })
  const [error, setError] = useState<unknown>()
  if (!state || !actor) return null
  const update = (key: keyof typeof v, x: unknown) => set((old) => ({ ...old, [key]: x }))
  return (
    <Sheet className="workspace-editor">
      <SectionTitle>{tx('КОМАНДА · СОСТАВ', 'КОМАНДА · ҚҰРАМЫ')}</SectionTitle>
      {!!error && <InlineError error={error} />}
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await act({ type: team ? 'updateTeam' : 'createTeam', payload: { ...v, id: team?.id } })
            onClose()
          } catch (e) {
            setError(e)
          }
        }}
      >
        <fieldset disabled={pending || !!team?.archived}>
          <Field label={tx('Название команды', 'Команда атауы')}>
            <input required value={v.title} onChange={(e) => update('title', e.target.value)} />
          </Field>
          <div className="grid-2">
            {(['ru', 'kk'] as const).map((l) => (
              <Field key={l} label={`${tx('Описание', 'Сипаттама')} · ${l}`}>
                <textarea
                  required
                  rows={3}
                  value={v.description[l]}
                  onChange={(e) => update('description', { ...v.description, [l]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          <Field label={tx('Кор команды', 'Команда бағыты')}>
            <select
              disabled={actor.role !== 'admin' || !!team}
              value={v.coreId}
              onChange={(e) => update('coreId', e.target.value)}
            >
              {CORES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="member-picker">
            <legend>{tx('Участники', 'Қатысушылар')}</legend>
            {state.users
              .filter((u) => u.role !== 'applicant')
              .map((u) => (
                <label key={u.id}>
                  <input
                    type="checkbox"
                    checked={v.memberIds.includes(u.id)}
                    onChange={(e) =>
                      update(
                        'memberIds',
                        e.target.checked
                          ? [...v.memberIds, u.id]
                          : v.memberIds.filter((id) => id !== u.id),
                      )
                    }
                  />
                  {u.name}
                </label>
              ))}
          </fieldset>
          <Field label={tx('Руководитель из состава', 'Құрамдағы жетекші')}>
            <select
              required
              value={v.leaderId}
              onChange={(e) => update('leaderId', e.target.value)}
            >
              <option value="">{tx('Выбери участника', 'Қатысушыны таңда')}</option>
              {state.users
                .filter((u) => v.memberIds.includes(u.id))
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </Field>
          <fieldset className="member-picker">
            <legend>{tx('Связанные проекты', 'Байланысты жобалар')}</legend>
            {state.projects
              .filter((p) => canManageProject(state, actor, p.id))
              .map((p) => (
                <label key={p.id}>
                  <input
                    type="checkbox"
                    checked={v.projectIds.includes(p.id)}
                    onChange={(e) =>
                      update(
                        'projectIds',
                        e.target.checked
                          ? [...v.projectIds, p.id]
                          : v.projectIds.filter((id) => id !== p.id),
                      )
                    }
                  />
                  {p.title}
                </label>
              ))}
          </fieldset>
          <Button type="submit" loading={pending}>
            {tx('Сохранить команду', 'Команданы сақтау')}
          </Button>
        </fieldset>
      </form>
      <div className="row">
        {team && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={async () => {
              try {
                await act({
                  type: 'archiveTeam',
                  payload: { id: team.id, archived: !team.archived },
                })
                onClose()
              } catch (e) {
                setError(e)
              }
            }}
          >
            {team.archived
              ? tx('Восстановить', 'Қалпына келтіру')
              : tx('Архивировать', 'Мұрағаттау')}
          </Button>
        )}
        <Button variant="ghost" disabled={pending} onClick={onClose}>
          {tx('Закрыть', 'Жабу')}
        </Button>
      </div>
    </Sheet>
  )
}
export function ProjectMaterials({ projectId }: { projectId: string }) {
  const { state, actor, tx, locale, act, pending } = useClub()
  const [q, setQ] = useState(''),
    [archive, setArchive] = useState(false),
    [edit, setEdit] = useState<string>(),
    [error, setError] = useState<unknown>()
  if (!state || !actor) return null
  const manage = canManageProject(state, actor, projectId)
  const rows = (state.materials ?? []).filter(
    (m) =>
      m.projectId === projectId &&
      (archive ? m.archived : !m.archived) &&
      `${m.title} ${m.category}`.toLowerCase().includes(q.trim().toLowerCase()),
  )
  return (
    <Sheet>
      <SectionTitle
        action={
          manage && (
            <Button onClick={() => setEdit('new')}>
              {tx('Добавить материал', 'Материал қосу')} +
            </Button>
          )
        }
      >
        {tx('МАТЕРИАЛЫ ПРОЕКТА', 'ЖОБА МАТЕРИАЛДАРЫ')}
      </SectionTitle>
      <div className="action-bar">
        <Field label={tx('Поиск по названию и категории', 'Атау және санат бойынша іздеу')}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
        <label className="row">
          <input type="checkbox" checked={archive} onChange={(e) => setArchive(e.target.checked)} />
          {tx('Архив', 'Мұрағат')}
        </label>
      </div>
      {!!error && <InlineError error={error} />}{' '}
      {rows.map((m) => (
        <article className="material-card" key={m.id}>
          <span className="eyebrow">
            {m.category} · {m.file ? tx('Локальный файл', 'Жергілікті файл') : 'HTTP/HTTPS'}
          </span>
          <h3>{m.title}</h3>
          <p className="fine-print">
            {state.users.find((u) => u.id === m.by)?.name} · {dateLabel(m.at, locale)}
          </p>
          {m.url && (
            <a className="text-link" href={m.url} rel="noreferrer" target="_blank">
              {tx('Открыть источник', 'Дереккөзді ашу')} ↗
            </a>
          )}
          {m.file && (
            <LocalFilePicker value={[m.file]} kind="material" disabled onChange={() => {}} />
          )}
          {manage && (
            <div className="row">
              <Button variant="ghost" onClick={() => setEdit(m.id)}>
                {tx('Изменить', 'Өзгерту')}
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={async () => {
                  try {
                    await act({
                      type: 'archiveMaterial',
                      payload: { id: m.id, archived: !m.archived },
                    })
                  } catch (e) {
                    setError(e)
                  }
                }}
              >
                {m.archived ? tx('Восстановить', 'Қалпына келтіру') : tx('В архив', 'Мұрағатқа')}
              </Button>
            </div>
          )}
        </article>
      ))}
      {!rows.length && (
        <Empty
          title={q.trim() ? tx('Ничего не найдено', 'Ештеңе табылмады') : archive ? tx('Архив материалов пуст', 'Материалдар мұрағаты бос') : tx('Материалов пока нет', 'Әзірге материал жоқ')}
          description={q.trim() || archive ? tx('Измени запрос или сбрось фильтры, чтобы увидеть доступные материалы.', 'Қолжетімді материалдарды көру үшін сұрауды өзгерт немесе сүзгілерді тазарт.') : manage ? tx(
            'Добавь файл в этот браузер или ссылку на внешний источник.',
            'Осы браузерге файл немесе сыртқы дереккөзге сілтеме қос.',
          ) : tx('Материалы появятся здесь, когда руководитель проекта их добавит.', 'Жоба жетекшісі қосқан материалдар осында көрсетіледі.')}
          action={(q.trim() || archive) && <Button variant="secondary" onClick={() => {setQ(''); setArchive(false)}}>{tx('Сбросить фильтры', 'Сүзгілерді тазарту')}</Button>}
        />
      )}{' '}
      {edit && (
        <MaterialEditor
          key={edit}
          projectId={projectId}
          material={state.materials?.find((m) => m.id === edit)}
          onClose={() => setEdit(undefined)}
        />
      )}
    </Sheet>
  )
}
function MaterialEditor({
  projectId,
  material,
  onClose,
}: {
  projectId: string
  material?: Material
  onClose: () => void
}) {
  const { act, pending, tx } = useClub()
  const [title, setTitle] = useState(material?.title ?? ''),
    [category, setCategory] = useState(material?.category ?? ''),
    [link, setLink] = useState(material?.url ?? ''),
    [files, setFiles] = useState<LocalAttachment[]>(material?.file ? [material.file] : []),
    [kind, setKind] = useState(material?.file ? 'file' : 'link'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>()
  return (
    <form
      className="workspace-editor stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (busy) return
        try {
          await act({
            type: material ? 'updateMaterial' : 'createMaterial',
            payload: {
              id: material?.id,
              projectId,
              title,
              category,
              url: kind === 'link' ? link : undefined,
              file: kind === 'file' ? files[0] : undefined,
            },
          })
          onClose()
        } catch (e) {
          setError(e)
        }
      }}
    >
      <Field label={tx('Название материала', 'Материал атауы')}>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={tx('Категория материала', 'Материал санаты')}>
        <input required value={category} onChange={(e) => setCategory(e.target.value)} />
      </Field>
      <Field label={tx('Тип источника', 'Дереккөз түрі')}>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="link">{tx('Внешняя ссылка', 'Сыртқы сілтеме')}</option>
          <option value="file">{tx('Локальный файл', 'Жергілікті файл')}</option>
        </select>
      </Field>
      {kind === 'file' ? (
        <LocalFilePicker
          value={files}
          onChange={setFiles}
          kind="material"
          multiple={false}
          disabled={pending}
          onBusyChange={setBusy}
        />
      ) : (
        <Field label="HTTP/HTTPS">
          <input required type="url" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
      )}
      {!!error && <InlineError error={error} />}
      <div className="row">
        <Button type="submit" loading={pending} disabled={busy || !!material?.archived}>
          {tx('Сохранить материал', 'Материалды сақтау')}
        </Button>
        <Button variant="ghost" disabled={pending || busy} onClick={onClose}>
          {tx('Отменить', 'Бас тарту')}
        </Button>
      </div>
    </form>
  )
}
