import {
  createInitialState,
  DomainError,
  migrateDemoState,
  MigrationError,
  type Action,
  type State,
} from '../domain'
import { scopedState } from '../domain/access'
export const DEMO_STORAGE_KEY = 'allinone-cabinet-demo-v1'
export const DEMO_BACKUP_KEY = `${DEMO_STORAGE_KEY}-backup`
export interface DemoStorageNotice { kind: 'recovered' | 'not-persisted'; code: string }
let memory: State | undefined
let storageNotice: DemoStorageNotice | undefined
let protectStoredOriginal = false
export function getDemoStorageNotice(): DemoStorageNotice | undefined { return storageNotice }
export function clearDemoStorageNotice() { storageNotice = undefined }
export function clearDemoStateCache() { memory = undefined; protectStoredOriginal = false; storageNotice = undefined }
export function readState(): State {
  if (memory) return memory
  let saved: string | null = null
  try {
    saved = typeof localStorage !== 'undefined' ? localStorage.getItem(DEMO_STORAGE_KEY) : null
    if (saved) {
      const result = migrateDemoState(JSON.parse(saved))
      memory = result.state
      if (result.migrated && typeof localStorage !== 'undefined') {
        // Backup must succeed before overwriting the original; this includes quota failures.
        localStorage.setItem(DEMO_BACKUP_KEY, saved)
        localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(memory))
        storageNotice = { kind: 'recovered', code: 'migrated' }
      }
      return memory
    }
  } catch (error) {
    if (memory) {
      storageNotice = { kind: 'not-persisted', code: 'unavailable' }
      protectStoredOriginal = true
      return memory
    }
    if (saved) {
      protectStoredOriginal = true
      try { localStorage.setItem(DEMO_BACKUP_KEY, saved) } catch { /* Preserve main key even if backup fails. */ }
    }
    storageNotice = { kind: 'not-persisted', code: error instanceof MigrationError ? error.code : saved ? 'invalid' : 'unavailable' }
  }
  memory = createInitialState()
  return memory
}
export function persist(state: State) {
  memory = state
  if (protectStoredOriginal) return
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state))
  } catch { storageNotice = { kind: 'not-persisted', code: 'unavailable' } }
}
export function resetMockState() {
  protectStoredOriginal = false
  storageNotice = undefined
  persist(createInitialState())
}

const pause = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration))
export async function loadDemoState(actorId: string, scenario: string): Promise<State> {
  await pause(scenario === 'slow' || scenario === 'loading' ? 1600 : 180)
  if (scenario === 'error') throw new DomainError(503, 'connectionError')
  if (scenario === 'expired') throw new DomainError(401, 'sessionExpired')
  const state = scopedState(readState(), actorId)
  return scenario === 'empty' ? { ...state, tasks: [], ledger: [], notices: [] } : state
}
export async function mutateDemoState(
  actorId: string,
  action: Action,
  scenario: string,
): Promise<State> {
  await pause(scenario === 'slow' ? 1400 : 360)
  if (scenario === 'error') throw new DomainError(503, 'connectionError')
  if (scenario === 'expired') throw new DomainError(401, 'sessionExpired')
  if (scenario === 'conflict' && ['start', 'submit', 'review', 'updateTask', 'archiveTask', 'commentTask', 'editComment', 'checklistTask'].includes(action.type)) {
    const state = structuredClone(readState())
    const task = state.tasks.find((t) => t.id === action.taskId)
    if (task) {
      task.revision++
      persist(state)
    }
    throw new DomainError(409, 'conflict')
  }
  const { applyAction } = await import('../domain/actions')
  const next = applyAction(readState(), actorId, {
    ...action,
    payload: { ...action.payload, at: new Date().toISOString() },
  })
  if(action.type === 'reset') { protectStoredOriginal = false; storageNotice = undefined }
  persist(next)
  return scopedState(next, actorId)
}
