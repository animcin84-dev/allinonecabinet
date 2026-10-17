import type { Action, State } from '../domain/types'
export type Scenario = 'normal' | 'error' | 'empty' | 'conflict' | 'slow' | 'expired'
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'serverError',
  ) {
    super(message)
  }
}
const headers = (actor: string, scenario: Scenario) => ({
  'Content-Type': 'application/json',
  'x-demo-actor': actor,
  'x-demo-scenario': scenario,
})
async function response<T>(r: Response): Promise<T> {
  const data = await r.json()
  if (!r.ok) throw new ApiError(r.status, data.message ?? data.error ?? 'Request failed', data.code)
  return data as T
}
export const httpApi = {
  state: (actor: string, scenario: Scenario): Promise<State> =>
    fetch('/api/state', { headers: headers(actor, scenario) }).then(response<State>),
  action: (actor: string, action: Action, scenario: Scenario): Promise<State> =>
    fetch('/api/action', {
      method: 'POST',
      headers: headers(actor, scenario),
      body: JSON.stringify(action),
    }).then(response<State>),
}

async function demoResponse<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (error instanceof Error && 'status' in error && 'code' in error)
      throw new ApiError(Number(error.status), error.message, String(error.code))
    throw error
  }
}
// Shared demo store in static previews; MSW wraps the same store in development.
// Replace this selection with httpApi after connecting a real authenticated API.
const demoApi = {
  state: (actor: string, scenario: Scenario) =>
    demoResponse(async () => (await import('../mocks/store')).loadDemoState(actor, scenario)),
  action: (actor: string, action: Action, scenario: Scenario) =>
    demoResponse(async () =>
      (await import('../mocks/store')).mutateDemoState(actor, action, scenario),
    ),
}
export const api = import.meta.env.DEV ? httpApi : demoApi
