import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from '../domain'
import { clearDemoStateCache, DEMO_BACKUP_KEY, DEMO_STORAGE_KEY, getDemoStorageNotice, persist, readState, resetMockState } from './store'
beforeEach(()=>{localStorage.clear();clearDemoStateCache()})
afterEach(()=>{vi.restoreAllMocks();clearDemoStateCache()})
describe('storage upgrade and recovery',()=>{
  it('backs up the exact previous storage before migrating and preserves XP',()=>{
    const legacy = createInitialState(); delete legacy.schemaVersion
    const original = JSON.stringify(legacy);localStorage.setItem(DEMO_STORAGE_KEY,original)
    expect(readState().ledger).toEqual(legacy.ledger)
    expect(localStorage.getItem(DEMO_BACKUP_KEY)).toBe(original)
    expect(JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!).schemaVersion).toBe(2)
    expect(getDemoStorageNotice()).toMatchObject({kind:'recovered',code:'migrated'})
  })
  it('preserves corrupt raw storage and prevents automatic destructive overwrites until explicit reset',()=>{
    localStorage.setItem(DEMO_STORAGE_KEY,'{broken')
    const state = readState();persist(state)
    expect(state.tasks.length).toBeGreaterThan(0)
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe('{broken')
    expect(localStorage.getItem(DEMO_BACKUP_KEY)).toBe('{broken')
    expect(getDemoStorageNotice()).toMatchObject({kind:'not-persisted',code:'invalid'})
    resetMockState()
    expect(JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY)!).schemaVersion).toBe(2)
  })
  it('does not overwrite future schemas or originals when backing up fails',()=>{
    const legacy=createInitialState();delete legacy.schemaVersion
    const original=JSON.stringify(legacy);localStorage.setItem(DEMO_STORAGE_KEY,original)
    vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Quota','QuotaExceededError')})
    expect(readState().ledger).toEqual(legacy.ledger);persist(readState())
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(original)
    expect(getDemoStorageNotice()?.code).toBe('unavailable')
    vi.restoreAllMocks();clearDemoStateCache()
    const future=JSON.stringify({...legacy,schemaVersion:999});localStorage.setItem(DEMO_STORAGE_KEY,future)
    persist(readState());expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(future)
    expect(getDemoStorageNotice()?.code).toBe('future')
  })
})
