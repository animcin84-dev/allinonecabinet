import { lazy, Suspense, useEffect, useState } from 'react'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useRouteError,
} from 'react-router'
import { LazyMotion, domAnimation, MotionConfig } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useClub } from './context'
import { MemberAvatar } from '../components/ui/member-avatar'
const StorageNotice = lazy(() => import('../features/storage-notice').then(m => ({ default: m.StorageNotice })))
import { ClubIcon } from '../components/icons'
import { NotificationMark, PageReveal } from '../components/ui/motion'
const Dialog = lazy(() => import('../components/ui/dialog').then((m) => ({ default: m.Dialog })))
import { Button, Empty, InlineError } from '../components/shared'
import type { Role } from '../domain/types'
const nav = [
  ['', 'overview', 'home'],
  ['tasks', 'tasks', 'tasks'],
  ['projects', 'projects', 'projects'],
  ['team', 'team', 'team'],
  ['clubs/young-diplomacy', 'club', 'experience'],
  ['experience', 'experience', 'experience'],
  ['calendar', 'calendar', 'tasks'],
] as const
export function Shell() {
  const c = useClub()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)
  const [term, setTerm] = useState('')
  const [menuReady, setMenuReady] = useState(false)
  const [searchReady, setSearchReady] = useState(false)
  useEffect(() => {
    if (menu) setMenuReady(true)
    if (search) setSearchReady(true)
  }, [menu, search])
  const base = `/${c.locale}/app`
  const isAuth = location.pathname.includes('/auth/')
  const isApplication = location.pathname.endsWith('/application')
  const isPersonalPage = ['profile', 'settings', 'inbox'].some(
    (page) => location.pathname === `${base}/${page}`,
  )
  const management = ['manager', 'head', 'admin'].includes(c.role)
  const roleNames: Record<Role, string> = {
    member: c.tx('Участник', 'Қатысушы'),
    manager: c.tx('Менеджер проекта', 'Жоба менеджері'),
    head: c.tx('Руководитель кора', 'Бағыт жетекшісі'),
    admin: c.tx('Администратор', 'Әкімші'),
    applicant: c.tx('Кандидат', 'Үміткер'),
  }
  const unread = c.state?.notices.filter((n) => !n.read).length ?? 0
  const searchTerm = term.trim().toLowerCase()
  const taskResults =
    c.state?.tasks
      .filter((task) => c.L(task.title).toLowerCase().includes(searchTerm))
      .slice(0, 6) ?? []
  const projectResults =
    c.state?.projects
      .filter((project) => project.title.toLowerCase().includes(searchTerm))
      .slice(0, 3) ?? []
  useEffect(() => {
    setMenu(false)
    setSearch(false)
    setTerm('')
    window.scrollTo(0, 0)
    const timer = setTimeout(
      () => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }),
      80,
    )
    return () => clearTimeout(timer)
  }, [location.pathname])
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (c.role !== 'applicant' && (e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearch((v) => !v)
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [c.role])
  const switchLocale = (locale: string) =>
    navigate(location.pathname.replace(/^\/(ru|kk)/, `/${locale}`) + location.search, {
      replace: true,
    })
  const navigation = (
    <>
      <div className="brand">
        ALLINONE<span>ONE TEAM. ONE WORKSPACE.</span>
      </div>
      <div className="eyebrow sidebar-label">
        {c.tx('Рабочая тетрадь', 'Команданың жұмыс дәптері')}
      </div>
      <nav className="sidebar-nav" aria-label={c.tx('Основная навигация', 'Негізгі навигация')}>
        {c.role === 'applicant' ? (
          <NavLink to={`/${c.locale}/application`}>{c.tx('Моя заявка', 'Менің өтінімім')}</NavLink>
        ) : (
          nav.map(([path, key, icon], i) => (
            <NavLink key={key} end={!path} to={`${base}${path ? `/${path}` : ''}`}>
              <ClubIcon name={icon} />
              <span>{t(key)}</span>
              <small>0{i + 1}</small>
            </NavLink>
          ))
        )}
        {management && (
          <NavLink to={`/${c.locale}/manage`}>
            <ClubIcon name="settings" />
            {t('manage')}
            <small>↗</small>
          </NavLink>
        )}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-message">
          <span className="eyebrow">ALL FOR ONE</span>
          <h3>{c.tx('Идея становится делом.', 'Идея іске айналады.')}</h3>
          <p>
            {c.tx(
              'Твой следующий шаг — вклад в общую историю.',
              'Келесі қадамың — ортақ тарихқа қосқан үлесің.',
            )}
          </p>
        </div>
        <Link className="sidebar-profile" to={`${base}/profile`}>
          <MemberAvatar fileId={c.actor?.avatarId} name={c.actor?.name ?? "Allinone"} />
          <strong>{c.actor?.name ?? c.tx('Демо-профиль', 'Демо профиль')}</strong>
          <span>
            {roleNames[c.role]} · {c.tx('демо', 'демо')}
          </span>
        </Link>
        <Link className="sidebar-settings" to={`${base}/settings`}>
          <ClubIcon name="settings" size={16} />
          {t('settings')}
        </Link>
      </div>
    </>
  )
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion={c.settings.reducedMotion ? 'always' : 'user'}>
        <a className="skip-link" href="#main">
          {c.tx('К содержимому', 'Мазмұнға өту')}
        </a>
        <div className="demo-banner">
          <span>
            <b>DEMO / FRONTEND</b>{' '}
            <span className="demo-text">
              {c.tx(
                'Тестовые данные · действия сохраняются в этом браузере',
                'Сынақ деректері · әрекеттер осы браузерде сақталады',
              )}
            </span>
          </span>
          <a href="https://allinoneclub.framer.website/" target="_blank" rel="noopener">
            {c.tx('Публичный сайт', 'Қоғамдық сайт')} ↗
          </a>
        </div>
        <div className="app-shell">
          <aside className="sidebar">{navigation}</aside>
          <div className="workspace">
            <header className="topbar">
              <button
                className="icon-button menu-toggle"
                onClick={() => setMenu(true)}
                aria-label={c.tx('Открыть меню', 'Мәзірді ашу')}
              >
                <ClubIcon name="menu" />
              </button>
              <span className="topbar-label eyebrow">
                {c.tx('КАБИНЕТ / ALLINONE', 'ЖЕКЕ КАБИНЕТ / ALLINONE')}
              </span>
              <div className="topbar-tools">
                {c.role !== 'applicant' && (
                  <button
                    className="search-trigger"
                    onClick={() => setSearch(true)}
                    aria-label={c.tx('Поиск по кабинету', 'Кабинеттен іздеу')}
                  >
                    <ClubIcon name="search" size={18} />
                    <span>{c.tx('Найти задачу', 'Тапсырманы іздеу')}</span>
                    <kbd>⌘ K</kbd>
                  </button>
                )}
                <div className="language" aria-label={c.tx('Язык', 'Тіл')}>
                  <button aria-pressed={c.locale === 'ru'} onClick={() => switchLocale('ru')}>
                    RU
                  </button>
                  <button aria-pressed={c.locale === 'kk'} onClick={() => switchLocale('kk')}>
                    ҚАЗ
                  </button>
                </div>
                <Link
                  className="icon-button notification-button"
                  to={`${base}/inbox`}
                  aria-label={`${t('inbox')} ${unread}`}
                >
                  <NotificationMark count={unread} enabled={c.settings.notifications} />
                </Link>
                <label className="role-control">
                  <span className="sr-only">
                    {c.tx('Демонстрационная роль', 'Демонстрациялық рөл')}
                  </span>
                  <select
                    value={c.demoRole}
                    onChange={(e) => {
                      const r = e.target.value as Role
                      c.setRole(r)
                      if (r === 'applicant') navigate(`/${c.locale}/application`)
                      else if (
                        isApplication ||
                        isAuth ||
                        (!['manager', 'head', 'admin'].includes(r) &&
                          location.pathname.includes('/manage'))
                      )
                        navigate(base)
                    }}
                  >
                    {Object.entries(roleNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        Демо: {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </header>
            <main id="main" className="content">
              {c.state && <Suspense fallback={null}><StorageNotice /></Suspense>}
              {c.loading ? (
                <div className="loading-state" role="status">
                  <span className="eyebrow">ALLINONE / WORKSPACE</span>
                  <h1>{c.tx('Открываем рабочую тетрадь', 'Жұмыс дәптерін ашудамыз')}</h1>
                  <div className="skeleton" />
                  <div className="skeleton short" />
                </div>
              ) : c.error && !c.state ? (
                <InlineError error={c.error} />
              ) : c.role === 'applicant' && !isApplication && !isAuth && !isPersonalPage ? (
                <Navigate to={`/${c.locale}/application`} replace />
              ) : (
                <PageReveal key={location.pathname}><Outlet /></PageReveal>
              )}
              <footer className="workspace-footer">
                <span>ALLINONE © 2026</span>
                <span>
                  {c.tx(
                    'Одна команда. Безграничные возможности.',
                    'Бір команда. Шексіз мүмкіндіктер.',
                  )}
                </span>
                <Link to={`${base}/settings`}>{c.tx('Настройки демо', 'Демо баптаулары')} ↗</Link>
              </footer>
            </main>
          </div>
        </div>
        <nav
          className="mobile-bottom"
          aria-label={c.tx('Мобильная навигация', 'Мобильді навигация')}
        >
          {c.role === 'applicant' ? (
            <>
              <NavLink to={`/${c.locale}/application`}>
                <ClubIcon name="home" />
                <span>{c.tx('Моя заявка', 'Менің өтінімім')}</span>
              </NavLink>
              <NavLink to={`${base}/profile`}>
                <ClubIcon name="team" />
                <span>{c.tx('Профиль', 'Профиль')}</span>
              </NavLink>
              <NavLink to={`${base}/settings`}>
                <ClubIcon name="settings" />
                <span>{t('settings')}</span>
              </NavLink>
            </>
          ) : (
            nav.slice(0, 3).map(([path, key, icon]) => (
              <NavLink key={key} to={`${base}${path ? `/${path}` : ''}`} end={!path}>
                <ClubIcon name={icon} />
                <span>{t(key)}</span>
              </NavLink>
            ))
          )}
          <button onClick={() => setMenu(true)}>
            <ClubIcon name="menu" />
            <span>{c.tx('Ещё', 'Тағы')}</span>
          </button>
        </nav>
        <Suspense fallback={null}>
          {(menu || menuReady) && (
            <Dialog
              open={menu}
              closeLabel={c.tx('Закрыть', 'Жабу')}
              onOpenChange={setMenu}
              title={c.tx('Навигация', 'Мәзір')}
              className="nav-sheet"
            >
              {navigation}
            </Dialog>
          )}
          {(search || searchReady) && (
            <Dialog
              open={search}
              closeLabel={c.tx('Закрыть', 'Жабу')}
              onOpenChange={setSearch}
              title={c.tx('Найти следующий шаг', 'Келесі қадамды табу')}
              description={c.tx(
                'Поиск в доступных задачах и проектах',
                'Қолжетімді тапсырмалар мен жобалардан іздеу',
              )}
            >
              <input
                className="command-input"
                autoFocus
                aria-label={c.tx('Поиск', 'Іздеу')}
                placeholder={c.tx('Название задачи или проекта…', 'Тапсырма немесе жоба атауы…')}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
              <div className="command-results">
                {taskResults.map((x) => (
                  <Link key={x.id} onClick={() => setSearch(false)} to={`${base}/tasks/${x.id}`}>
                    <ClubIcon name="tasks" />
                    <span>{c.L(x.title)}</span>
                    <small>+{x.points} XP</small>
                  </Link>
                ))}
                {projectResults.map((x) => (
                  <Link key={x.id} onClick={() => setSearch(false)} to={`${base}/projects/${x.id}`}>
                    <ClubIcon name="projects" />
                    {x.title}
                    <small>↗</small>
                  </Link>
                ))}
                {c.state && taskResults.length === 0 && projectResults.length === 0 && (
                  <p className="notice" role="status">
                    {c.tx(
                      'Ничего не найдено. Попробуй другое название задачи или проекта.',
                      'Ештеңе табылмады. Тапсырма не жоба атауын басқаша енгізіп көр.',
                    )}
                  </p>
                )}
              </div>
            </Dialog>
          )}
        </Suspense>
        <div role="status" aria-live="polite" className={`toast ${c.message ? 'visible' : ''}`}>
          {c.message && <span className="toast-mark" aria-hidden="true">✓</span>}
          {c.message}
        </div>
      </MotionConfig>
    </LazyMotion>
  )
}
export function RouteFailure() {
  const error = useRouteError()
  return (
    <div className="fatal">
      <h1>ALLINONE</h1>
      <p>Не удалось открыть страницу / Бетті ашу мүмкін болмады.</p>
      <pre>{error instanceof Error ? error.message : ''}</pre>
      <Button variant="secondary" onClick={() => window.location.reload()}>Обновить страницу / Бетті жаңарту</Button>
      <a className="button primary" href="/ru/app">
        Вернуться в кабинет / Кабинетке оралу
      </a>
    </div>
  )
}
export function NotFound() {
  const { tx } = useClub()
  return (
    <Empty
      title={tx('Этой страницы нет', 'Бұл бет жоқ')}
      description={tx(
        'Проверь адрес или вернись к обзору.',
        'Мекенжайды тексер немесе шолуға қайт.',
      )}
      action={
        <Link className="button primary" to="../app">
          {tx('К обзору', 'Шолуға')}
        </Link>
      }
    />
  )
}
