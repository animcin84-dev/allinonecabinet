import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEMO_STORAGE_KEY,
  loadDemoState,
  mutateDemoState,
  readState,
  resetMockState,
} from './store'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  resetMockState()
})
afterEach(() => {
  vi.useRealTimers()
})
describe('shared demo transport', () => {
  it('does not change data on an expired session or a failed request', async () => {
    const before = JSON.stringify(readState())
    const failed = expect(
      mutateDemoState('u-member', { type: 'start', taskId: 'task-03', revision: 1 }, 'error'),
    ).rejects.toMatchObject({ status: 503 })
    const expired = expect(loadDemoState('u-member', 'expired')).rejects.toMatchObject({
      status: 401,
    })
    await vi.runAllTimersAsync()
    await Promise.all([failed, expired])
    expect(JSON.stringify(readState())).toBe(before)
  })
  it('preserves XP and result when a revision conflict occurs, then accepts a fresh retry', async () => {
    const before = readState().ledger
    const staleAction = {
      type: 'submit',
      taskId: 'task-01',
      revision: 1,
      text: 'Готова структура медиакита.',
      url: '',
      requestId: 'demo-retry',
    }
    const conflict = expect(
      mutateDemoState('u-member', staleAction, 'conflict'),
    ).rejects.toMatchObject({ status: 409 })
    await vi.runAllTimersAsync()
    await conflict
    expect(readState().ledger).toEqual(before)
    const task = readState().tasks.find((t) => t.id === 'task-01')!
    expect(task.status).toBe('in_progress')
    const retried = mutateDemoState(
      'u-member',
      { ...staleAction, revision: task.revision },
      'normal',
    )
    await vi.runAllTimersAsync()
    expect((await retried).tasks.find((t) => t.id === 'task-01')?.status).toBe('review')
    expect(
      JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!).tasks.find(
        (t: { id: string }) => t.id === 'task-01',
      ).status,
    ).toBe('review')
  })
  it('returns an empty preview without deleting the stored example', async () => {
    const pending = loadDemoState('u-member', 'empty')
    await vi.runAllTimersAsync()
    expect((await pending).tasks).toEqual([])
    expect(readState().tasks.length).toBeGreaterThan(0)
  })
})
