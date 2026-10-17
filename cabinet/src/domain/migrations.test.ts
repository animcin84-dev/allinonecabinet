import { describe, expect, it } from 'vitest'
import { applyAction, createInitialState, migrateDemoState } from './index'
describe('non-destructive demo migrations', () => {
  it('preserves old XP, task decisions and legacy application content and is idempotent', () => {
    const legacy = createInitialState()
    delete legacy.schemaVersion; delete legacy.teams
    legacy.tasks[1].reviews.push({ id:'past-review',decision:'returned',reason:'Сохранить решение',by:'u-manager',at:'2026-10-09T09:00:00Z' })
    delete legacy.tasks[1].submissions
    const {state,migrated} = migrateDemoState(legacy)
    expect(migrated).toBe(true)
    expect(state.ledger).toEqual(legacy.ledger)
    expect(state.tasks[1].reviews).toEqual(legacy.tasks[1].reviews)
    expect(state.tasks[1].submissions).toEqual([legacy.tasks[1].submission])
    expect(state.applications[0]).toMatchObject(legacy.applications[0])
    expect(state.applications[0].formVersion).toBeUndefined()
    expect(state.teams).toEqual([])
    expect(state.projects[0].memberIds).toEqual(legacy.projects[0].teamIds)
    expect(migrateDemoState(state)).toEqual({state,migrated:false})
  })
  it('rejects incomplete and future states without mutating the input', () => {
    const state = createInitialState()
    const before = structuredClone(state)
    expect(()=>migrateDemoState({...state,ledger:{}})).toThrow('invalid')
    expect(()=>migrateDemoState({...state,schemaVersion:999})).toThrow('future')
    expect(()=>migrateDemoState({...state,tasks:[{id:'broken'}]})).toThrow('invalid')
    expect(state).toEqual(before)
  })
  it('keeps compatibility memberships synchronized and conceals them from applicants', () => {
    const state = migrateDemoState(createInitialState()).state
    state.tasks = state.tasks.filter(t => t.projectId !== 'html')
    const next = applyAction(state,'u-admin',{type:'updateProject',payload:{id:'html',teamIds:['u-member','u-manager']}})
    expect(next.projects[0].memberIds).toEqual(next.projects[0].teamIds)
  })
})
