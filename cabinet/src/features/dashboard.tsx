import { Onboarding } from './onboarding'
import { Link } from 'react-router'
import { useClub } from '../app/context'
import { PageHeader, Sheet, SectionTitle, AppLink, Empty, DemoNote } from '../components/shared'
import { TaskRow, XPCard } from '../components/workspace'
import { MiniXPChart } from '../components/mini-xp-chart'
import { canReview } from '../domain/access'
import { AnimatedNumber } from '../components/ui/motion'
export function DashboardPage() {
  const { state, actor, tx, L, role, locale } = useClub()
  if (!state || !actor) return null
  const own = state.tasks.filter((t) => t.assigneeId === actor.id && !t.archived && !state.projects.find(p => p.id === t.projectId)?.archived)
  const review = state.tasks.filter((t) => canReview(state, actor.id, t))
  const next =
    ['manager', 'head', 'admin'].includes(role) && review.length
      ? review[0]
      : (own.find((t) => t.status === 'in_progress') ??
        own.find((t) => t.status === 'todo') ??
        own.find((t) => t.status === 'review'))
  const ownActive = own.filter((t) => t.status === 'in_progress')
  return (
    <>
      <PageHeader
        eyebrow={tx('Обзор / твой рабочий день', 'Шолу / сенің жұмыс күнің')}
        title={tx('ТВОЙ ВКЛАД.\nОБЩИЙ РЕЗУЛЬТАТ.', 'СЕНІҢ ҮЛЕСІҢ.\nОРТАҚ НӘТИЖЕ.')}
        description={tx(
          'Одна задача, один следующий шаг. Так идеи становятся настоящими проектами.',
          'Бір тапсырма, бір келесі қадам. Идеялар осылай нақты жобаларға айналады.',
        )}
        action={<span className="outline-stamp">IDEA → TEAM → RESULT</span>}
      />
      <Onboarding />
      <div className="dashboard-grid">
        <div className="stack">
          <section className="focus-panel">
            <div className="focus-motif" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="focus-top">
              <span className="eyebrow">{tx('01 / Следующий шаг', '01 / Келесі қадам')}</span>
            </div>
            {next ? (
              <>
                <h2>{L(next.title)}</h2>
                <p>{L(next.description)}</p>
                <div className="focus-tags">
                  <span>{state.projects.find((p) => p.id === next.projectId)?.title}</span>
                  <span>
                    +{next.points} XP {tx('после проверки', 'тексеруден кейін')}
                  </span>
                </div>
                <Link className="button primary" to={`/${locale}/app/tasks/${next.id}`}>
                  {review.includes(next)
                    ? tx('Проверить результат', 'Нәтижені тексеру')
                    : tx('Продолжить задачу', 'Тапсырманы жалғастыру')}
                  <span>↗</span>
                </Link>
              </>
            ) : (
              <>
                <h2>{tx('Сейчас всё спокойно.', 'Қазір бәрі тыныш.')}</h2>
                <p>
                  {tx(
                    'Новых задач нет. Посмотри проекты команды или историю своего вклада.',
                    'Жаңа тапсырмалар жоқ. Команда жобаларын немесе өз үлесіңнің тарихын қара.',
                  )}
                </p>
                <AppLink className="button primary" to="app/projects">
                  {tx('Открыть проекты', 'Жобаларды ашу')} ↗
                </AppLink>
              </>
            )}
          </section>
          <div className="stat-row">
            <AppLink to="app/tasks?status=in_progress&scope=mine" className="stat">
              <span className="eyebrow">{tx('В работе', 'Орындалуда')}</span>
              <strong>
                <AnimatedNumber value={ownActive.length} />
              </strong>
              <small>{tx('личных задач', 'жеке тапсырма')}</small>
            </AppLink>
            <AppLink to="app/tasks?status=review&scope=mine" className="stat">
              <span className="eyebrow">{tx('На проверке', 'Тексерілуде')}</span>
              <strong>
                <AnimatedNumber value={own.filter((t) => t.status === 'review').length} />
              </strong>
              <small>{tx('ждут подтверждения', 'растауды күтуде')}</small>
            </AppLink>
            <AppLink to="app/experience" className="stat">
              <span className="eyebrow">{tx('Подтверждено', 'Расталды')}</span>
              <strong>
                <AnimatedNumber value={own.filter((t) => t.status === 'done').length} />
              </strong>
              <small>{tx('завершённых задач', 'аяқталған тапсырма')}</small>
            </AppLink>
          </div>
          <Sheet>
            <SectionTitle
              action={<AppLink to="app/tasks">{tx('Все задачи', 'Барлық тапсырмалар')} ↗</AppLink>}
            >
              {tx('В фокусе команды', 'Команда назарында')}
            </SectionTitle>
            {(role === 'member' ? own : state.tasks)
              .filter((t) => t.status !== 'done')
              .slice(0, 4)
              .map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            {state.tasks.length === 0 && (
              <Empty title={tx('Пока нет задач', 'Әзірге тапсырмалар жоқ')} />
            )}
          </Sheet>
          <Sheet>
            <SectionTitle
              action={<AppLink to="app/projects">{tx('Все проекты', 'Барлық жобалар')} ↗</AppLink>}
            >
              {tx('Работаем вместе', 'Бірге жұмыс істейміз')}
            </SectionTitle>
            <div className="compact-projects">
              {state.projects
                .filter((p) => actor.projectIds.includes(p.id))
                .slice(0, 2)
                .map((p, i) => (
                  <AppLink key={p.id} to={`app/projects/${p.id}`} className="compact-project">
                    <span className="project-index">0{i + 1}</span>
                    <h3>{p.id === 'yrt' ? 'YRT' : p.title}</h3>
                    <p>{tx('Архив проекта / демо-задачи', 'Жоба мұрағаты / демо тапсырмалар')}</p>
                    <span className="text-link">
                      {tx('Открыть пространство', 'Жоба кеңістігін ашу')} ↗
                    </span>
                  </AppLink>
                ))}
            </div>
          </Sheet>
        </div>
        <div className="stack">
          <XPCard />
          <Sheet>
            <SectionTitle>{tx('Вклад по неделям', 'Апталар бойынша үлес')}</SectionTitle>
            <p className="muted chart-period">
              {tx('Последние 28 дней · подтверждённый XP', 'Соңғы 28 күн · расталған XP')}
            </p>
            <MiniXPChart entries={state.ledger.filter((e) => e.userId === actor.id)} />
          </Sheet>
          <section className="club-note">
            <span className="eyebrow">
              {tx('Клуб внутри Allinone', 'Allinone құрамындағы клуб')}
            </span>
            <h2>
              YOUNG
              <br />
              DIPLOMACY.
            </h2>
            <p>
              {tx('Исследовать. Выступать. Договариваться.', 'Зерттеу. Сөйлеу. Келісімге келу.')}
            </p>
            <AppLink to="app/clubs/young-diplomacy">{tx('Открыть клуб', 'Клубты ашу')} ↗</AppLink>
          </section>
          <p className="tiny-note">
            {tx('Одна команда — разные направления.', 'Бір команда — әртүрлі бағыттар.')}
            <br />
            All for one, and one for all.
          </p>
        </div>
      </div>
      <DemoNote />
    </>
  )
}
