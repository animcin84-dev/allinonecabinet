import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useClub } from '../app/context'
import {
  AppLink,
  Button,
  DemoNote,
  Empty,
  Field,
  InlineError,
  PageHeader,
  SectionTitle,
  Sheet,
  StatusBadge,
  dateLabel,
} from '../components/shared'
import { CORES, type Role } from '../domain/types'
import { rankFor, totalXP } from '../domain/policy'
import { AnimatedTabs } from '../components/ui/tabs'
import { CopyLinkButton } from '../components/ui/copy-link'
import { ProjectMaterials, TeamsWorkspace, lifecycleLabels, categoryLabels } from './project-workspace'
import { recordOnboarding } from './onboarding'
import { ProfileAvatarEditor } from './profile-avatar'

const roleName = (role: Role, tx: (ru: string, kk: string) => string) =>
  ({
    applicant: tx('Кандидат', 'Үміткер'),
    member: tx('Участник', 'Қатысушы'),
    manager: tx('Менеджер проекта', 'Жоба менеджері'),
    head: tx('Хед направления', 'Бағыт жетекшісі'),
    admin: tx('Администратор', 'Әкімші'),
  })[role]

export function ProjectMedia({
  src,
  title,
  lazy = true,
}: {
  src: string
  title: string
  lazy?: boolean
}) {
  const { tx } = useClub()
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  if (!src.trim() || failed)
    return (
      <div
        className="project-cover-placeholder"
        role="img"
        aria-label={tx(
          `Типографическая обложка проекта ${title}`,
          `${title} жобасының типографикалық мұқабасы`,
        )}
      >
        <span className="eyebrow">ALLINONE / PROJECT ARCHIVE</span>
        <strong>{title}</strong>
        <span>{tx('ИСТОРИЯ КОМАНДЫ', 'КОМАНДА ТАРИХЫ')}</span>
      </div>
    )
  return (
    <img
      className="project-image"
      src={src}
      alt={title}
      loading={lazy ? 'lazy' : 'eager'}
      width="800"
      height="450"
      onError={() => setFailed(true)}
    />
  )
}

export function ProjectsPage() {
  const { state, actor, L, tx } = useClub()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const own = params.get('scope') === 'mine'
  const lifecycle = params.get('lifecycle') ?? 'all', category = params.get('category') ?? 'all', club = params.get('club') ?? 'all', archived = params.get('archived') === 'yes'
  const updateFilter = (key:string,value:string) => setParams(old => { const next = new URLSearchParams(old); value !== 'all' && value ? next.set(key,value) : next.delete(key); return next })
  const projects = (state?.projects ?? []).filter(
    (p) =>
      (!!p.archived === archived) && (lifecycle === 'all' || (p.lifecycle ?? 'unknown') === lifecycle) && (category === 'all' || p.category === category) && (club === 'all' || (p.clubId ?? 'allinone') === club) &&
      (!own || actor?.projectIds.includes(p.id)) &&
      `${p.title} ${L(p.description)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / PROJECTS"
        title={tx('ПРОЕКТЫ КОМАНДЫ', 'КОМАНДА ЖОБАЛАРЫ')}
        description={tx(
          'Прошедшие события, текущая работа и люди за каждым результатом.',
          'Өткен іс-шаралар, ағымдағы жұмыс және әр нәтиженің артындағы адамдар.',
        )}
      />
      <Sheet>
        <div className="action-bar">
          <Field label={tx('Найти проект', 'Жобаны табу')}>
            <input
              type="search"
              value={query}
              placeholder={tx('Название или направление', 'Атауы немесе бағыты')}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                next.set('q', e.target.value)
                setParams(next, { replace: true })
              }}
            />
          </Field>
          <label className="row">
            <input
              type="checkbox"
              checked={own}
              onChange={(e) => {
                const next = new URLSearchParams(params)
                if (e.target.checked) next.set('scope', 'mine')
                else next.delete('scope')
                setParams(next)
              }}
            />
            {tx('Только мои проекты', 'Тек менің жобаларым')}
          </label>
          <select aria-label={tx('Статус проекта','Жоба күйі')} value={lifecycle} onChange={e=>updateFilter('lifecycle',e.target.value)}><option value="all">{tx('Все статусы','Барлық күйлер')}</option><option value="unknown">{tx('Статус не указан','Күйі көрсетілмеген')}</option>{Object.entries(lifecycleLabels).map(([id,t])=><option key={id} value={id}>{tx(t[0],t[1])}</option>)}</select>
          <select aria-label={tx('Категория проекта','Жоба санаты')} value={category} onChange={e=>updateFilter('category',e.target.value)}><option value="all">{tx('Все категории','Барлық санаттар')}</option>{Object.entries(categoryLabels).map(([id,t])=><option key={id} value={id}>{tx(t[0],t[1])}</option>)}</select>
          <select aria-label={tx('Клуб проекта','Жоба клубы')} value={club} onChange={e=>updateFilter('club',e.target.value)}><option value="all">{tx('Все клубы','Барлық клубтар')}</option><option value="allinone">Allinone</option><option value="young-diplomacy">Young Diplomacy</option></select>
          <label className="row"><input type="checkbox" checked={archived} onChange={e=>updateFilter('archived',e.target.checked?'yes':'')}/>{tx('Архив','Мұрағат')}</label>
        </div>
      </Sheet>
      <div className="grid-2">
        {projects.map((p) => (
          <Sheet className="project-card" key={p.id}>
            <AppLink to={`app/projects/${p.id}`} className="project-cover-link">
              <ProjectMedia src={p.image} title={p.title} />
            </AppLink>
            <div className="metadata">
              <span className="eyebrow">{CORES.find((c) => c.id === p.coreId)?.title}</span>
              <span className="badge">
                {p.lifecycle ? tx(lifecycleLabels[p.lifecycle][0],lifecycleLabels[p.lifecycle][1]) : tx('Статус не указан', 'Күйі көрсетілмеген')} · {p.date}{p.id.startsWith('project-') ? ' · DEMO' : ''}
              </span>
            </div>
            <h2>{p.title}</h2>
            <p>{L(p.description)}</p>
            <div className="row">
              <span className="muted">
                {(state?.tasks ?? []).filter((t) => t.projectId === p.id).length}{' '}
                {tx('демо-задач', 'демо тапсырма')}
              </span>
              <AppLink to={`app/projects/${p.id}`}>{tx('Открыть проект', 'Жобаны ашу')} ↗</AppLink>
            </div>
          </Sheet>
        ))}
      </div>
      {!projects.length && (
        <Sheet>
          <Empty
            title={tx('Проекты не найдены', 'Жобалар табылмады')}
            description={tx(
              'Попробуй другое название или отключи фильтр личных проектов.',
              'Басқа атауды енгіз немесе жеке жобалар сүзгісін өшір.',
            )}
            action={
              <Button variant="secondary" onClick={() => setParams({})}>
                {tx('Сбросить фильтры', 'Сүзгілерді тазарту')}
              </Button>
            }
          />
        </Sheet>
      )}
      <DemoNote />
    </>
  )
}

export function ProjectPage() {
  const { projectId } = useParams()
  const { state, actor, L, tx, locale } = useClub()
  const [params, setParams] = useSearchParams()
  const project = state?.projects.find((p) => p.id === projectId)
  const requested = params.get('tab') ?? 'overview'
  const tab = ['overview', 'tasks', 'team', 'materials'].includes(requested)
    ? requested
    : 'overview'
  if (!project)
    return (
      <Sheet>
        <Empty
          title={tx('Проект не найден', 'Жоба табылмады')}
          action={<AppLink to="app/projects">{tx('Все проекты', 'Барлық жобалар')}</AppLink>}
        />
      </Sheet>
    )
  const tasks = state?.tasks.filter((t) => t.projectId === project.id) ?? []
  const users = state?.users.filter((u) => project.teamIds.includes(u.id)) ?? []
  const tabs = [
    ['overview', tx('О проекте', 'Жоба туралы')],
    ['tasks', tx('Задачи', 'Тапсырмалар')],
    ['team', tx('Команда', 'Команда')],
    ['materials', tx('Материалы', 'Материалдар')],
  ]
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / PROJECT FILE"
        title={project.title}
        description={L(project.description)}
        action={
          <div className="header-actions">
            <AppLink to="app/projects">← {tx('Проекты', 'Жобалар')}</AppLink>
            <CopyLinkButton />
          </div>
        }
      />
      <AnimatedTabs
        value={tab}
        onValueChange={(id) => setParams({ tab: id })}
        label={tx('Разделы проекта', 'Жоба бөлімдері')}
        tabs={tabs}
      >
        {tab === 'tasks' ? (
          <Sheet>
            <SectionTitle>{tx('Работа по проекту', 'Жоба жұмысы')}</SectionTitle>
            <p className="fine-print">
              {tx(
                'Это демонстрационные задачи кабинета, а не отчет о работе прошедшего события.',
                'Бұл өткен іс-шараның есебі емес, кабинеттің демо тапсырмалары.',
              )}
            </p>
            {tasks.map((t) => (
              <div className="task-row" key={t.id}>
                <div>
                  <AppLink to={`app/tasks/${t.id}`}>{L(t.title)}</AppLink>
                  <p className="muted">
                    {state?.users.find((u) => u.id === t.assigneeId)?.name} · {tx('Срок', 'Мерзім')}
                    : {dateLabel(t.dueAt, locale)}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </div>
            ))}
            {!tasks.length && <Empty title={tx('Задач пока нет', 'Әзірге тапсырма жоқ')} />}
          </Sheet>
        ) : tab === 'team' ? (
          <Sheet>
            <SectionTitle>{tx('Команда проекта', 'Жоба командасы')}</SectionTitle>
            {users.map((u) => (
              <div className="task-row" key={u.id}>
                <div>
                  <strong>{u.name}</strong>
                  <p className="muted">{CORES.find((c) => c.id === u.coreId)?.title}</p>
                </div>
                <span className="badge">{roleName(u.role, tx)}</span>
              </div>
            ))}
            {!users.length && (
              <Empty title={tx('Состав еще не добавлен', 'Құрамы әлі қосылмаған')} />
            )}
            <DemoNote />
          </Sheet>
        ) : tab === 'materials' ? (
          <Sheet>
            <ProjectMaterials projectId={project.id} />
            <SectionTitle>{tx('Публичные источники','Жария дереккөздер')}</SectionTitle>
            <div className="task-row">
              <div>
                <strong>{tx('Публичная страница Allinone', 'Allinone жария парақшасы')}</strong>
                <p className="muted">
                  {tx(
                    'История проектов, реальные события и контакты.',
                    'Жобалар тарихы, нақты іс-шаралар және байланыстар.',
                  )}
                </p>
              </div>
              <a
                className="text-link"
                href="https://allinoneclub.framer.website/projects"
                target="_blank"
                rel="noreferrer"
              >
                {tx('Открыть сайт', 'Сайтты ашу')} ↗
              </a>
            </div>
            <div className="task-row">
              <div>
                <strong>Instagram · Allinone</strong>
                <p className="muted">@allinone_almaty</p>
              </div>
              <a
                className="text-link"
                href="https://www.instagram.com/allinone_almaty/"
                target="_blank"
                rel="noreferrer"
              >
                {tx('Открыть', 'Ашу')} ↗
              </a>
            </div>
            <p className="fine-print">
              {tx(
                'Внутренние документы не добавлены: здесь нет вымышленных файлов или недоступных ссылок.',
                'Ішкі құжаттар қосылмаған: бұл жерде ойдан шығарылған файлдар жоқ.',
              )}
            </p>
          </Sheet>
        ) : (
          <div className="split">
            <Sheet>
              <ProjectMedia src={project.image} title={project.title} lazy={false} />
              <SectionTitle>{tx('Что было сделано', 'Не істелді')}</SectionTitle>
              <div className="facts">
                {project.facts.map((fact, i) => (
                  <p key={i}>{L(fact)}</p>
                ))}
              </div>
            </Sheet>
            <div className="stack">
              {!!project.history?.length && <Sheet><details><summary>{tx('История проекта','Жоба тарихы')}</summary>{project.history.map(h=><div className="comment" key={h.id}><p>{L(h.detail)}</p><small>{dateLabel(h.at,locale,true)} · {state?.users.find(u=>u.id===h.by)?.name}</small></div>)}</details></Sheet>}
              <Sheet>
                <SectionTitle>{tx('Паспорт проекта', 'Жоба паспорты')}</SectionTitle>
                <dl className="list">
                  <dt>{tx('Период события', 'Іс-шара кезеңі')}</dt>
                  <dd>{project.date}</dd>
                  <dt>{tx('Направление', 'Бағыт')}</dt>
                  <dd>{CORES.find((c) => c.id === project.coreId)?.title}</dd>
                  <dt>{tx('Мое участие', 'Менің қатысуым')}</dt>
                  <dd>
                    {actor?.projectIds.includes(project.id)
                      ? tx('В демо-команде проекта', 'Жобаның демо командасында')
                      : tx('Просмотр проекта', 'Жобаны қарау')}
                  </dd>
                </dl>
                {project.clubId && (
                  <AppLink to="app/clubs/young-diplomacy">Young Diplomacy ↗</AppLink>
                )}
              </Sheet>
              <Sheet>
                <strong>{tx('За результатом — команда', 'Нәтиженің артында — команда')}</strong>
                <p>
                  {tx(
                    'Открой вкладку задач, чтобы увидеть текущую демо-работу и ответственных.',
                    'Ағымдағы демо жұмысты және жауапты адамдарды көру үшін тапсырмалар бөлімін аш.',
                  )}
                </p>
                <Button variant="secondary" onClick={() => setParams({ tab: 'tasks' })}>
                  {tx('К задачам проекта', 'Жоба тапсырмаларына')}
                </Button>
              </Sheet>
            </div>
          </div>
        )}
      </AnimatedTabs>
      <DemoNote />
    </>
  )
}

export function TeamPage() {
  const { state, actor, L, tx } = useClub()
  useEffect(() => { if(actor?.id) recordOnboarding(actor.id,'team') },[actor?.id])
  const core = CORES.find((c) => c.id === actor?.coreId)
  const colleagues = state?.users.filter((u) => u.coreId === actor?.coreId) ?? []
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / PEOPLE"
        title={tx('ОДНА КОМАНДА', 'БІР КОМАНДА')}
        description={tx(
          'Твое направление и люди, с которыми идеи становятся проектами.',
          'Сенің бағытың және идеяларды жобаға айналдыратын адамдар.',
        )}
      />
      <div className="split">
        <Sheet className="hero-panel">
          <div className="eyebrow">{tx('МОЙ КОР', 'МЕНІҢ БАҒЫТЫМ')}</div>
          <h2>{core?.title ?? tx('Не назначен', 'Тағайындалмаған')}</h2>
          <p>
            {core
              ? L(core.description)
              : tx(
                  'Кор будет назначен после рассмотрения заявки.',
                  'Бағыт өтінім қаралғаннан кейін тағайындалады.',
                )}
          </p>
          <p className="fine-print">
            {tx(
              'Назначение направления меняется руководителем, а не через редактирование профиля.',
              'Бағытты профильде емес, жетекші өзгертеді.',
            )}
          </p>
        </Sheet>
        <Sheet>
          <SectionTitle>{tx('Как мы работаем', 'Қалай жұмыс істейміз')}</SectionTitle>
          <p>
            {tx(
              'Идея → команда → план → организация → событие.',
              'Идея → команда → жоспар → ұйымдастыру → іс-шара.',
            )}
          </p>
          <p>
            {tx(
              'Ответственность. Инициатива. Поддержка. Каждый вклад имеет автора.',
              'Жауапкершілік. Бастама. Қолдау. Әр үлестің авторы бар.',
            )}
          </p>
        </Sheet>
      </div>
      <Sheet>
        <SectionTitle>{tx('В моем направлении', 'Менің бағытымда')}</SectionTitle>
        {colleagues.map((u) => (
          <div className="task-row" key={u.id}>
            <div>
              <strong>
                {u.name}
                {u.id === actor?.id ? ` · ${tx('это ты', 'бұл сен')}` : ''}
              </strong>
              <p className="muted">
                {u.skills.join(' · ') || tx('Навыки еще не указаны', 'Дағдылар әлі көрсетілмеген')}
              </p>
            </div>
            <span className="badge">{roleName(u.role, tx)}</span>
          </div>
        ))}
        {!colleagues.length && (
          <Empty title={tx('Команда пока не назначена', 'Команда әлі тағайындалмаған')} />
        )}
      </Sheet>
      <SectionTitle>{tx('Пять направлений Allinone', 'Allinone ұйымының бес бағыты')}</SectionTitle>
      <div className="grid-3">
        {CORES.map((c) => (
          <Sheet key={c.id}>
            <div className="eyebrow">
              {c.id === actor?.coreId ? tx('МОЕ НАПРАВЛЕНИЕ', 'МЕНІҢ БАҒЫТЫМ') : 'ALLINONE'}
            </div>
            <h3>{c.title}</h3>
            <p>{L(c.description)}</p>
          </Sheet>
        ))}
      </div>
      <DemoNote />
    </>
  )
}

export function ClubPage() {
  const { state, L, tx } = useClub()
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / CLUB"
        title="YOUNG DIPLOMACY"
        description={tx(
          'Самостоятельный клуб внутри Allinone. Диалог, международные отношения и Model United Nations.',
          'Allinone ішіндегі дербес клуб. Диалог, халықаралық қатынастар және Model United Nations.',
        )}
      />
      <div className="split">
        <Sheet className="hero-panel">
          <div className="eyebrow">{tx('КЛУБ, КОТОРЫЙ ОБЪЕДИНЯЕТ', 'БІРІКТІРЕТІН КЛУБ')}</div>
          <h2>{tx('ДИАЛОГ НАЧИНАЕТСЯ С ТЕБЯ', 'ДИАЛОГ СЕНЕН БАСТАЛАДЫ')}</h2>
          <p>
            {tx(
              'Young Diplomacy развивает культуру аргументированного обсуждения и командной организации MUN. Aspan MUN — отдельный проект клуба.',
              'Young Diplomacy дәлелді пікірталас пен MUN іс-шараларын бірге ұйымдастыру мәдениетін дамытады. Aspan MUN — клубтың жеке жобасы.',
            )}
          </p>
          <a
            className="button primary"
            href="https://www.instagram.com/young_diplomacy_club/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram ↗
          </a>
        </Sheet>
        <Sheet>
          <SectionTitle>{tx('Руководство клуба', 'Клуб басшылығы')}</SectionTitle>
          <div className="task-row">
            <div>
              <h3>Тарап Айша</h3>
              <p>{tx('Фаундер и генеральный секретарь', 'Негізін қалаушы және бас хатшы')}</p>
            </div>
          </div>
          <div className="task-row">
            <div>
              <h3>Кайназарова Жасмин</h3>
              <p>{tx('Заместитель генерального секретаря', 'Бас хатшының орынбасары')}</p>
            </div>
          </div>
          <p className="fine-print">
            {tx(
              'Имена и должности предоставлены командой Allinone. Членство в клубе не дает прав администратора кабинета.',
              'Аты-жөні мен лауазымдарын Allinone командасы ұсынды. Клуб мүшелігі кабинет әкімшісінің құқықтарын бермейді.',
            )}
          </p>
        </Sheet>
      </div>
      <SectionTitle>{tx('Связанные проекты', 'Байланысты жобалар')}</SectionTitle>
      <div className="grid-2">
        {state?.projects
          .filter((p) => p.clubId)
          .map((p) => (
            <Sheet className="project-card" key={p.id}>
              <ProjectMedia src={p.image} title={p.title} />
              <div className="eyebrow">
                {tx('ПРОШЕДШЕЕ СОБЫТИЕ', 'ӨТКЕН ІС-ШАРА')} · {p.date}
              </div>
              <h2>{p.title}</h2>
              <p>{L(p.description)}</p>
              <AppLink to={`app/projects/${p.id}`}>
                {tx('Материалы проекта', 'Жоба материалдары')} ↗
              </AppLink>
            </Sheet>
          ))}
      </div>
      <Sheet>
        <SectionTitle>{tx('Объявления и участие', 'Хабарландырулар және қатысу')}</SectionTitle>
        <p>
          {tx(
            'Новый набор и ближайшие события пока не подтверждены. Следи за официальными объявлениями клуба.',
            'Жаңа қабылдау және алдағы іс-шаралар әзірге расталмаған. Клубтың ресми хабарландыруларын қадағала.',
          )}
        </p>
        <a
          className="text-link"
          href="https://www.instagram.com/young_diplomacy_club/"
          target="_blank"
          rel="noreferrer"
        >
          @young_diplomacy_club ↗
        </a>
      </Sheet>
    </>
  )
}

type ProfileValues = { name: string; bio: string; skills: string }
export function ProfilePage() {
  const { state, actor, role, act, pending, error, toast, tx } = useClub()
  const [saved, setSaved] = useState(false)
  const profileKey = `allinone:profile-draft:${actor?.id ?? 'unknown'}`
  const form = useForm<ProfileValues>({
    defaultValues: {
      name: actor?.name ?? '',
      bio: actor?.bio ?? '',
      skills: actor?.skills.join(', ') ?? '',
    },
  })
  useEffect(() => {
    if (!actor) return
    try {
      const draft = sessionStorage.getItem(profileKey)
      if (draft) {
        form.reset(JSON.parse(draft), { keepDefaultValues: true })
        return
      }
    } catch {
      /* Ignore a malformed draft. */
    }
    form.reset({ name: actor.name, bio: actor.bio, skills: actor.skills.join(', ') })
    setSaved(false)
  }, [actor?.id, profileKey, form])
  useEffect(() => {
    const subscription = form.watch((values) =>
      (() => { try { sessionStorage.setItem(profileKey, JSON.stringify(values)) } catch { /* Draft stays in current form. */ } })(),
    )
    return () => subscription.unsubscribe()
  }, [form, profileKey])
  const save = form.handleSubmit(async (values) => {
    const parsed = z
      .object({
        name: z
          .string()
          .trim()
          .min(2, tx('Минимум 2 символа', 'Кемінде 2 таңба'))
          .max(80, tx('До 80 символов', '80 таңбаға дейін')),
        bio: z.string().max(500, tx('До 500 символов', '500 таңбаға дейін')),
        skills: z.string().max(240, tx('До 240 символов', '240 таңбаға дейін')),
      })
      .safeParse(values)
    if (!parsed.success) {
      for (const issue of parsed.error.issues)
        form.setError(issue.path[0] as keyof ProfileValues, { message: issue.message })
      return
    }
    try {
      await act({
        type: 'profile',
        payload: {
          ...parsed.data,
          skills: parsed.data.skills
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      })
      if(actor?.id) recordOnboarding(actor.id,'profile')
      form.reset(parsed.data)
      sessionStorage.removeItem(profileKey)
      setSaved(true)
      toast(tx('Профиль сохранен в демо-кабинете', 'Профиль демо кабинетте сақталды'))
    } catch {
      /* Preserve draft. */
    }
  })
  const points = state && actor ? totalXP(state, actor.id) : 0
  const warnings = state?.warnings.filter((w) => w.userId === actor?.id) ?? []
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / YOUR PROFILE"
        title={tx('ТВОЯ ИСТОРИЯ', 'СЕНІҢ ТАРИХЫҢ')}
        description={tx(
          'Навыки, направление и подтвержденный вклад.',
          'Дағдылар, бағыт және расталған үлес.',
        )}
        action={<AppLink to="app/settings">{tx('Настройки', 'Баптаулар')} ↗</AppLink>}
      />
      <div className="split">
        <Sheet>
          <div className="profile-banner">
            <div className="eyebrow">ALLINONE MEMBER FILE</div>
            <h2>{actor?.name}</h2>
            <span className="badge">{roleName(actor?.role ?? role, tx)}</span>
          </div>
          <ProfileAvatarEditor />
          <form className="stack" onSubmit={save}>
            <Field label={tx('Имя', 'Аты')} error={form.formState.errors.name?.message}>
              <input {...form.register('name')} autoComplete="off" maxLength={80} />
            </Field>
            <Field label={tx('О себе', 'Өзің туралы')} error={form.formState.errors.bio?.message}>
              <textarea {...form.register('bio')} rows={4} maxLength={500} />
            </Field>
            <Field
              label={tx('Навыки через запятую', 'Дағдыларды үтірмен бөл')}
              error={form.formState.errors.skills?.message}
            >
              <input
                {...form.register('skills')}
                placeholder={tx(
                  'Дизайн, организация, коммуникация',
                  'Дизайн, ұйымдастыру, коммуникация',
                )}
                maxLength={240}
              />
            </Field>
            {error && <InlineError error={error} />}
            <div className="row">
              <Button type="submit" disabled={pending || !form.formState.isDirty}>
                {pending
                  ? tx('Сохраняем…', 'Сақталуда…')
                  : tx('Сохранить профиль', 'Профильді сақтау')}
              </Button>
              <span className="fine-print" role="status">
                {form.formState.isDirty
                  ? tx('Есть несохраненные изменения', 'Сақталмаған өзгерістер бар')
                  : saved
                    ? tx('Все изменения сохранены', 'Барлық өзгерістер сақталды')
                    : ''}
              </span>
            </div>
          </form>
        </Sheet>
        <div className="stack">
          <Sheet>
            <SectionTitle>{tx('Назначения', 'Тағайындаулар')}</SectionTitle>
            <dl className="list">
              <dt>{tx('Должность', 'Лауазым')}</dt>
              <dd>{roleName(actor?.role ?? role, tx)}</dd>
              <dt>{tx('Кор', 'Бағыт')}</dt>
              <dd>
                {CORES.find((c) => c.id === actor?.coreId)?.title ??
                  tx('Не назначен', 'Тағайындалмаған')}
              </dd>
              <dt>{tx('Демо-почта', 'Демо пошта')}</dt>
              <dd>{actor?.email}</dd>
              <dt>{tx('Расчетный уровень', 'Есептік деңгей')}</dt>
              <dd>
                {rankFor(points).name} · {points} XP
              </dd>
            </dl>
            <p className="fine-print">
              {tx(
                'Системные назначения доступны только для чтения. Расчетный уровень XP не изменяет должность.',
                'Жүйелік тағайындаулар тек оқуға қолжетімді. XP есептік деңгейі лауазымды өзгертпейді.',
              )}
            </p>
            <AppLink to="app/experience">{tx('История вклада', 'Үлес тарихы')} ↗</AppLink>
          </Sheet>
          <Sheet>
            <SectionTitle>{tx('Личные замечания', 'Жеке ескертулер')}</SectionTitle>
            {warnings.length ? (
              warnings.map((w) => (
                <div className="task-row" key={w.id}>
                  <div>
                    <strong>{w.reason}</strong>
                    <p className="muted">
                      {w.resolved ? tx('Закрыто', 'Жабылды') : tx('Открыто', 'Ашық')}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p>{tx('Активных замечаний нет.', 'Белсенді ескертулер жоқ.')}</p>
            )}
            <p className="fine-print">
              {tx(
                'Видны тебе и уполномоченному руководству. Формула санкций находится на согласовании.',
                'Саған және уәкілетті басшылыққа көрінеді. Шаралар формуласы келісілуде.',
              )}
            </p>
          </Sheet>
        </div>
      </div>
      <DemoNote />
    </>
  )
}

export function SettingsPage() {
  const [confirmReset, setConfirmReset] = useState(false)
  const { locale, settings, setSettings, scenario, setScenario, act, pending, tx, toast, error } =
    useClub()
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / PREFERENCES"
        title={tx('ПО ТВОИМ ПРАВИЛАМ', 'СЕНІҢ ЕРЕЖЕЛЕРІҢ')}
        description={tx(
          'Удобный ритм работы и прозрачные настройки демо.',
          'Ыңғайлы жұмыс ырғағы және демоның түсінікті баптаулары.',
        )}
      />
      <div className="grid-2">
        <Sheet>
          <SectionTitle>{tx('Язык интерфейса', 'Интерфейс тілі')}</SectionTitle>
          <p>
            {tx(
              'Смена языка сохраняет данные и работу в кабинете.',
              'Тілді өзгерту кабинеттегі деректер мен жұмысты сақтайды.',
            )}
          </p>
          <div className="row">
            <Link
              className={`button ${locale === 'ru' ? 'primary' : 'secondary'}`}
              to="/ru/app/settings"
              lang="ru"
            >
              Русский
            </Link>
            <Link
              className={`button ${locale === 'kk' ? 'primary' : 'secondary'}`}
              to="/kk/app/settings"
              lang="kk"
            >
              Қазақша
            </Link>
          </div>
        </Sheet>
        <Sheet>
          <SectionTitle>{tx('Движение и уведомления', 'Қозғалыс және хабарламалар')}</SectionTitle>
          <label className="task-row">
            <span>
              <strong>{tx('Уменьшить анимации', 'Анимацияларды азайту')}</strong>
              <span className="fine-print">
                {tx(
                  'Без перемещений и анимации графиков.',
                  'Қозғалыстар мен график анимацияларын өшіру.',
                )}
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => setSettings({ ...settings, reducedMotion: e.target.checked })}
            />
          </label>
          <label className="task-row">
            <span>
              <strong>{tx('Уведомления внутри кабинета', 'Кабинет ішіндегі хабарламалар')}</strong>
              <span className="fine-print">
                {tx(
                  'Значок новых событий; почта не отправляется.',
                  'Жаңа оқиғалар белгісі; пошта жіберілмейді.',
                )}
              </span>
            </span>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
            />
          </label>
        </Sheet>
        <Sheet>
          <SectionTitle>{tx('Проверка состояний демо', 'Демо күйлерін тексеру')}</SectionTitle>
          <Field label={tx('Сценарий запросов', 'Сұраныс сценарийі')}>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as typeof scenario)}
            >
              <option value="normal">{tx('Обычная работа', 'Қалыпты жұмыс')}</option>
              <option value="slow">{tx('Медленная загрузка', 'Баяу жүктеу')}</option>
              <option value="expired">{tx('Демо-сеанс истёк', 'Демо сеанс аяқталды')}</option>
              <option value="error">{tx('Ошибка сети', 'Желі қатесі')}</option>
              <option value="empty">{tx('Пустые данные', 'Бос деректер')}</option>
              <option value="conflict">{tx('Конфликт изменения', 'Өзгеріс қайшылығы')}</option>
            </select>
          </Field>
          <p className="fine-print">
            {tx(
              'Сценарий влияет только на локальную демонстрацию. Для продолжения выбери обычную работу.',
              'Сценарий тек жергілікті демонстрацияға әсер етеді. Жалғастыру үшін қалыпты жұмысты таңда.',
            )}
          </p>
        </Sheet>
        <Sheet>
          <SectionTitle>{tx('Локальные демо-данные', 'Жергілікті демо деректер')}</SectionTitle>
          <p>
            {tx(
              'Профиль, задачи и опыт сохраняются только в этом браузере. Сброс удалит демо-изменения и восстановит исходный пример.',
              'Профиль, тапсырмалар және тәжірибе тек осы браузерде сақталады. Қалпына келтіру демо өзгерістерді жояды.',
            )}
          </p>
          <Button variant="danger" disabled={pending} onClick={() => setConfirmReset(true)}>
            {tx('Сбросить демо', 'Демоны қалпына келтіру')}
          </Button>
          {confirmReset && (
            <div
              className="notice"
              role="group"
              aria-label={tx('Сброс демо', 'Демоны қалпына келтіру')}
            >
              <strong>
                {tx('Вернуть исходный пример?', 'Бастапқы мысалды қайтару керек пе?')}
              </strong>
              <p>
                {tx(
                  'Будут сброшены только локальные демо-изменения.',
                  'Тек жергілікті демо өзгерістер қалпына келтіріледі.',
                )}
              </p>
              <div className="action-bar">
                <Button
                  disabled={pending}
                  onClick={async () => {
                    try {
                      await act({ type: 'reset' })
                      try { await (await import('../services/local-files')).clearLocalFiles() } catch { toast(tx('Демо сброшено, но локальные файлы не удалось очистить.', 'Демо қалпына келтірілді, бірақ жергілікті файлдар тазаланбады.')); setConfirmReset(false); return }
                      for (const storage of [localStorage, sessionStorage])
                        for (const key of Object.keys(storage))
                          if (
                            key.startsWith('allinone:draft:') ||
                            key.startsWith('allinone:profile-draft:') ||
                            key.startsWith('allinone:application-draft:') || key.startsWith('allinone:onboarding:') || key.startsWith('allinone:views:')
                          )
                            storage.removeItem(key)
                      setConfirmReset(false)
                      toast(
                        tx(
                          'Исходные демо-данные восстановлены',
                          'Бастапқы демо деректер қалпына келтірілді',
                        ),
                      )
                    } catch {
                      /* Context error remains visible. */
                    }
                  }}
                >
                  {tx('Восстановить пример', 'Мысалды қалпына келтіру')}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmReset(false)}>
                  {tx('Отмена', 'Болдырмау')}
                </Button>
              </div>
            </div>
          )}
          {error && <InlineError error={error} />}
        </Sheet>
      </div>
      <DemoNote />
    </>
  )
}

export function InboxPage() {
  const { state, actor, L, tx, locale, act, pending, error } = useClub()
  const [unread, setUnread] = useState(false)
  const [kind, setKind] = useState('all')
  const notices = (state?.notices.filter((n) => n.userId === actor?.id && (!unread || !n.read) && (kind === 'all' || (n.kind ?? (n.taskId ? 'task' : 'system')) === kind)) ?? []).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / INBOX"
        title={tx('ВАЖНОЕ ДЛЯ ТЕБЯ', 'САҒАН МАҢЫЗДЫ')}
        description={tx(
          'Назначения, результаты проверок и изменения заявки.',
          'Тағайындаулар, тексеру нәтижелері және өтінім өзгерістері.',
        )}
      />
      <Sheet>
        <div className="row">
          <SectionTitle>{tx('Входящие', 'Кіріс хабарламалар')}</SectionTitle>
          <label className="row">
            <input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} />
            {tx('Только непрочитанные', 'Тек оқылмаған')}
          </label>
        </div>
        <Field label={tx('Тип события','Оқиға түрі')}><select value={kind} onChange={e=>setKind(e.target.value)}><option value="all">{tx('Все события','Барлық оқиғалар')}</option><option value="task">{tx('Задачи и обсуждения','Тапсырмалар және талқылаулар')}</option><option value="application">{tx('Заявка','Өтінім')}</option><option value="project">{tx('Проекты','Жобалар')}</option><option value="system">{tx('Другие изменения','Басқа өзгерістер')}</option></select></Field>
        {notices.map((n) => (
          <article className="task-row" key={n.id}>
            <div>
              <span className="eyebrow">
                {dateLabel(n.at, locale, true)} ·{' '}
                {n.read ? tx('Прочитано', 'Оқылды') : tx('НОВОЕ', 'ЖАҢА')}
              </span>
              <h3>{L(n.title)}</h3>
              <p>{L(n.body)}</p>
              {n.kind === 'application' && <AppLink to="application">{tx('Открыть свою заявку','Өз өтініміңді ашу')} ↗</AppLink>}
              {n.projectId && <AppLink to={`app/projects/${n.projectId}`}>{tx('Открыть проект','Жобаны ашу')} ↗</AppLink>}
              {n.taskId && (
                <AppLink to={`app/tasks/${n.taskId}`}>
                  {tx('Открыть задачу', 'Тапсырманы ашу')} ↗
                </AppLink>
              )}
            </div>
            {!n.read && (
              <Button
                variant="secondary"
                disabled={pending}
                onClick={async () => {
                  try {
                    await act({ type: 'readNotice', payload: { id: n.id } })
                  } catch {
                    /* Retain unread state on failure. */
                  }
                }}
              >
                {tx('Прочитано', 'Оқылды')}
              </Button>
            )}
          </article>
        ))}
        {!notices.length && (
          <Empty
            title={kind !== 'all' ? tx('Нет событий этого типа', 'Бұл түрдегі оқиғалар жоқ') : unread ? tx('Все прочитано', 'Барлығы оқылды') : tx('Пока тихо', 'Әзірге тыныш')}
            description={kind !== 'all' ? tx('Попробуй другой тип события или сбрось фильтры.', 'Басқа оқиға түрін таңда немесе сүзгілерді тазарт.') : tx(
              'Важные события появятся здесь после действий по задачам и заявке.',
              'Маңызды оқиғалар тапсырмалар мен өтінім бойынша әрекеттерден кейін осында пайда болады.',
            )}
            action={(kind !== 'all' || unread) && <Button variant="secondary" onClick={() => {setKind('all'); setUnread(false)}}>{tx('Сбросить фильтры', 'Сүзгілерді тазарту')}</Button>}
          />
        )}{' '}
        {error && <InlineError error={error} />}
      </Sheet>
    </>
  )
}

export function AchievementsPage() {
  const { state, actor, tx } = useClub()
  const awards = state?.ledger.filter((e) => e.userId === actor?.id && e.kind === 'award') ?? []
  const confirmed =
    state?.tasks.filter((t) => t.assigneeId === actor?.id && t.status === 'done') ?? []
  const projects = new Set(confirmed.map((t) => t.projectId)).size
  const badges = [
    {
      id: '01',
      name: tx('Первый вклад', 'Алғашқы үлес'),
      condition: tx('Одна подтвержденная задача', 'Бір расталған тапсырма'),
      unlocked: confirmed.length >= 1,
      count: confirmed.length,
      target: 1,
    },
    {
      id: '02',
      name: tx('Надежное плечо', 'Сенімді қолдау'),
      condition: tx('Пять подтвержденных задач', 'Бес расталған тапсырма'),
      unlocked: confirmed.length >= 5,
      count: confirmed.length,
      target: 5,
    },
    {
      id: '03',
      name: tx('За пределами одного проекта', 'Бір жобадан тыс'),
      condition: tx('Подтвержденные задачи в двух проектах', 'Екі жобада расталған тапсырмалар'),
      unlocked: projects >= 2,
      count: projects,
      target: 2,
    },
  ]
  return (
    <>
      <PageHeader
        eyebrow="ALLINONE / MILESTONES"
        title={tx('ВКЛАД ОСТАЕТСЯ', 'ҮЛЕС САҚТАЛАДЫ')}
        description={tx(
          'Небольшие вехи большой командной истории.',
          'Үлкен команда тарихының шағын белестері.',
        )}
      />
      <Sheet className="hero-panel">
        <div className="eyebrow">
          {tx('ПРЕДЛОЖЕННЫЕ УСЛОВИЯ · ДЕМО', 'ҰСЫНЫЛҒАН ШАРТТАР · ДЕМО')}
        </div>
        <h2>{tx('ПОДТВЕРЖДЕНО ДЕЙСТВИЕМ', 'ӘРЕКЕТПЕН РАСТАЛҒАН')}</h2>
        <p>
          {tx(
            'Достижения ниже рассчитаны по демо-задачам. Условия предложены для прототипа; официальные награды клуба еще не утверждены.',
            'Төмендегі жетістіктер демо тапсырмалардан есептеледі. Шарттар прототипке ұсынылған; клубтың ресми марапаттары әлі бекітілмеген.',
          )}
        </p>
      </Sheet>
      <div className="grid-3">
        {badges.map((b) => (
          <Sheet key={b.id}>
            <div className="row">
              <span className="eyebrow">{b.id} / MILESTONE</span>
              <span className="badge">
                {b.unlocked ? tx('Демо: достигнуто', 'Демо: жетті') : tx('Впереди', 'Алда')}
              </span>
            </div>
            <h2>{b.name}</h2>
            <p>{b.condition}</p>
            <progress value={Math.min(b.count, b.target)} max={b.target} aria-label={b.name} />
            <p className="fine-print">
              {Math.min(b.count, b.target)} / {b.target}
            </p>
          </Sheet>
        ))}
      </div>
      <Sheet>
        <SectionTitle>{tx('Факты твоего вклада', 'Сенің үлесің туралы деректер')}</SectionTitle>
        <div className="stat-row">
          <div className="stat">
            <strong>{confirmed.length}</strong>
            <span>{tx('Подтвержденных задач', 'Расталған тапсырма')}</span>
          </div>
          <div className="stat">
            <strong>{projects}</strong>
            <span>{tx('Проектов с вкладом', 'Үлес қосылған жоба')}</span>
          </div>
          <div className="stat">
            <strong>{awards.length}</strong>
            <span>{tx('Записей о начислении', 'Есептеу жазбасы')}</span>
          </div>
        </div>
        <AppLink to="app/experience">{tx('Посмотреть журнал XP', 'XP журналын қарау')} ↗</AppLink>
      </Sheet>
    </>
  )
}
