import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Action, Locale, Localized, Role, State, User } from '../domain/types'
import { api, type Scenario } from '../services/api'
export type Settings = { reducedMotion: boolean; notifications: boolean }
type ClubContext = {
  state: State | undefined
  actor: User | undefined
  role: Role
  demoRole: Role
  setRole: (r: Role) => void
  locale: Locale
  L: (text: Localized | string) => string
  tx: (ru: string, kk: string) => string
  act: (action: Action) => Promise<State>
  pending: boolean
  error: Error | null
  loading: boolean
  retry: () => void
  toast: (message: string) => void
  message: string
  settings: Settings
  setSettings: (s: Settings) => void
  scenario: Scenario
  setScenario: (s: Scenario) => void
}
const Context = createContext<ClubContext | null>(null)
export const roleActor: Record<Role, string> = {
  member: 'u-member',
  manager: 'u-manager',
  head: 'u-head',
  admin: 'u-admin',
  applicant: 'u-applicant',
}
export function ClubProvider({ children }: { children: ReactNode }) {
  const params = useParams()
  const locale: Locale = params.locale === 'kk' ? 'kk' : 'ru'
  const { i18n } = useTranslation()
  const [demoRole, setRoleState] = useState<Role>(() => {
    let s: string | null = null
    try { s = localStorage.getItem('allinone:role') } catch { /* Memory-only demo. */ }
    return ['member', 'manager', 'head', 'admin', 'applicant'].includes(s ?? '')
      ? (s as Role)
      : 'member'
  })
  const [scenario, setScenario] = useState<Scenario>('normal')
  const [message, setMessage] = useState('')
  const [settings, setSettingsState] = useState<Settings>(() => {
    try {
      return {
        ...{ reducedMotion: false, notifications: true },
        ...JSON.parse(localStorage.getItem('allinone:settings') ?? '{}'),
      }
    } catch {
      return { reducedMotion: false, notifications: true }
    }
  })
  const client = useQueryClient()
  const actorId = roleActor[demoRole]
  const query = useQuery({
    queryKey: ['state', actorId, scenario],
    queryFn: () => api.state(actorId, scenario),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: (action: Action) => api.action(actorId, action, scenario),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['state'] })
    },
  })
  useEffect(() => {
    void i18n.changeLanguage(locale)
    document.documentElement.lang = locale
  }, [locale, i18n])
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion)
  }, [settings.reducedMotion])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 5500)
    return () => clearTimeout(timer)
  }, [message])
  const setRole = (r: Role) => {
    try { localStorage.setItem('allinone:role', r) } catch {
      setMessage(locale === 'kk' ? 'Рөл осы сеанс үшін өзгерді. Браузерде сақтау қолжетімсіз.' : 'Роль изменена на этот сеанс. Сохранение в браузере недоступно.')
    }
    setRoleState(r)
    mutation.reset()
    setScenario('normal')
  }
  const setSettings = (s: Settings) => {
    setSettingsState(s)
    try { localStorage.setItem('allinone:settings', JSON.stringify(s)) } catch {
      setMessage(locale === 'kk' ? 'Баптаулар тек осы сеанс үшін қолданылды.' : 'Настройки применены только на этот сеанс.')
    }
  }
  const actor = query.data?.users.find((u) => u.id === actorId)
  const role = actor?.role ?? demoRole
  const value: ClubContext = {
    state: query.data,
    actor,
    role,
    demoRole,
    setRole,
    locale,
    L: (text) => (typeof text === 'string' ? text : text[locale]),
    tx: (ru, kk) => (locale === 'kk' ? kk : ru),
    act: async (action) => {
      mutation.reset()
      return mutation.mutateAsync({ ...action, requestId: action.requestId ?? crypto.randomUUID() })
    },
    pending: mutation.isPending,
    error: query.error ?? mutation.error,
    loading: query.isPending,
    retry: () => {
      mutation.reset()
      setScenario('normal')
      void query.refetch()
    },
    toast: setMessage,
    message,
    settings,
    setSettings,
    scenario,
    setScenario,
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useClub() {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('Missing ClubProvider')
  return ctx
}
