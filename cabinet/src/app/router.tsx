import { createBrowserRouter, Navigate, useParams } from 'react-router'
import { ClubProvider } from './context'
import { Shell, RouteFailure, NotFound } from './shell'
function Root() {
  const { locale } = useParams()
  if (locale !== 'ru' && locale !== 'kk') return <Navigate to="/ru/app" replace />
  return (
    <ClubProvider>
      <Shell />
    </ClubProvider>
  )
}
type SecondaryPage =
  | 'ProjectsPage'
  | 'ProjectPage'
  | 'TeamPage'
  | 'ClubPage'
  | 'ProfilePage'
  | 'SettingsPage'
  | 'InboxPage'
  | 'AchievementsPage'
const corePages = {
  DashboardPage: () =>
    import('../features/dashboard').then((m) => ({ Component: m.DashboardPage })),
  TasksPage: () => import('../features/tasks').then((m) => ({ Component: m.TasksPage })),
  TaskPage: () => import('../features/task').then((m) => ({ Component: m.TaskPage })),
  ExperiencePage: () =>
    import('../features/experience').then((m) => ({ Component: m.ExperiencePage })),
  RulesPage: () => import('../features/experience').then((m) => ({ Component: m.RulesPage })),
}
type CorePage = keyof typeof corePages
const feature = (name: SecondaryPage) => () =>
  import('../features/secondary').then((mod) => ({ Component: mod[name] }))
const core = (name: CorePage) => corePages[name]
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/ru/app" replace /> },
  {
    path: '/:locale',
    Component: Root,
    ErrorBoundary: RouteFailure,
    HydrateFallback: () => (
      <div className="fatal">
        <h1>ALLINONE</h1>
        <p>Открываем кабинет / Кабинетті ашудамыз</p>
      </div>
    ),
    children: [
      { index: true, element: <Navigate to="app" replace /> },
      { path: 'app', lazy: core('DashboardPage') },
      { path: 'app/tasks', lazy: core('TasksPage') },
      { path: 'app/calendar', lazy: () => import('../features/calendar').then(m => ({ Component: m.CalendarPage })) },
      { path: 'app/tasks/:taskId', lazy: core('TaskPage') },
      { path: 'app/projects', lazy: feature('ProjectsPage') },
      { path: 'app/projects/:projectId', lazy: feature('ProjectPage') },
      { path: 'app/team', lazy: feature('TeamPage') },
      { path: 'app/clubs', lazy: feature('ClubPage') },
      { path: 'app/clubs/young-diplomacy', lazy: feature('ClubPage') },
      { path: 'app/experience', lazy: core('ExperiencePage') },
      { path: 'app/experience/rules', lazy: core('RulesPage') },
      { path: 'app/achievements', lazy: feature('AchievementsPage') },
      { path: 'app/inbox', lazy: feature('InboxPage') },
      { path: 'app/profile', lazy: feature('ProfilePage') },
      { path: 'app/settings', lazy: feature('SettingsPage') },
      {
        path: 'auth/:authMode',
        lazy: () => import('../features/auth').then((mod) => ({ Component: mod.AuthPage })),
      },
      {
        path: 'application',
        lazy: () => import('../features/application').then((mod) => ({ Component: mod.ApplicationPage })),
      },
      {
        path: 'manage/:section?',
        lazy: () =>
          import('../features/management').then((mod) => ({ Component: mod.ManagementPage })),
      },
      { path: '*', Component: NotFound },
    ],
  },
])
