import { describe, expect, it } from 'vitest'
import {
  applyAction,
  createInitialState,
  migrateDemoState,
  monthOf,
  scopedState,
  totalXP,
  type Action,
  type State,
} from './index'
const call = (
  s: State,
  type: string,
  payload: Record<string, unknown> = {},
  actor = 'u-admin',
  extra: Partial<Action> = {},
) =>
  applyAction(s, actor, {
    type,
    requestId: `test-${type}`,
    payload: { ...payload, at: '2026-10-10T08:00:00Z' },
    ...extra,
  })
const target = (s: State) =>
  s.tasks.find((t) => t.assigneeId === 'u-member' && t.status === 'todo')!
describe('connected frontend workspace', () => {
  it('refuses removal through user assignments while active tasks exist, without mutating input', () => {
    const state = createInitialState(), before = structuredClone(state)
    expect(() => call(state, 'updateUser', { id: 'u-member', projectIds: [] }, 'u-admin', { reason:'Демо: снять назначение' })).toThrow('activeAssignments')
    expect(state).toEqual(before)
  })
  it('removes inactive user assignments from both project membership aliases', () => {
    const state = createInitialState()
    state.tasks.filter(t=>t.assigneeId==='u-other').forEach(t=>{t.archived=true})
    const next = call(state, 'updateUser', { id:'u-other',projectIds:[] }, 'u-admin', {reason:'Демо: снять назначение'})
    expect(next.users.find(u=>u.id==='u-other')?.projectIds).toEqual([])
    for (const project of next.projects) {
      expect(project.memberIds ?? project.teamIds).not.toContain('u-other')
      expect(project.teamIds).not.toContain('u-other')
    }
  })
  it('uses the calendar month in Almaty at the UTC boundary', () => {
    expect(monthOf('2026-09-30T20:00:00Z')).toBe('2026-10')
    expect(monthOf('2026-09-30T18:59:00Z')).toBe('2026-09')
  })
  it('creates a project idempotently and keeps member aliases and user access aligned', () => {
    const s = createInitialState(),
      p = {
        title: 'Демо проект',
        description: { ru: 'Описание', kk: 'Сипаттама' },
        date: '2026-10-10',
        coreId: 'design',
        memberIds: ['u-member'],
        lifecycle: 'soon',
        category: 'digital',
      }
    const next = call(s, 'createProject', p)
    expect(next.projects.find((p) => p.id === 'project-test-createProject')?.teamIds).toEqual([
      'u-member',
    ])
    expect(next.users.find((u) => u.id === 'u-member')?.projectIds).toContain(
      'project-test-createProject',
    )
    expect(call(next, 'createProject', p).projects).toHaveLength(next.projects.length)
    expect(s.projects).toHaveLength(next.projects.length - 1)
  })
  it('refuses a head creating outside their core and unsafe media URLs', () => {
    const s = createInitialState(),
      p = {
        title: 'Project',
        description: { ru: 'RU', kk: 'KK' },
        date: '2026-10-10',
        coreId: 'community',
        memberIds: [],
      }
    expect(() => call(s, 'createProject', p, 'u-head')).toThrow('forbidden')
    expect(() => call(s, 'updateProject', { id: 'html', image: 'javascript:alert(1)' })).toThrow(
      'invalidURL',
    )
  })
  it('does not silently remove active assignees from a project', () => {
    const s = createInitialState()
    expect(() => call(s, 'updateProject', { id: target(s).projectId, memberIds: [] })).toThrow(
      'activeAssignments',
    )
  })
  it('archives reversibly without removing tasks, submissions or XP', () => {
    const s = createInitialState(),
      next = call(s, 'archiveProject', { id: 'html', archived: true })
    expect(next.tasks).toEqual(s.tasks)
    expect(next.ledger).toEqual(s.ledger)
    expect(
      call(next, 'archiveProject', { id: 'html', archived: false }).projects.find(
        (p) => p.id === 'html',
      )?.archived,
    ).toBe(false)
  })
  it('creates an independent team without granting project access', () => {
    const s = createInitialState(),
      prior = s.users.find((u) => u.id === 'u-member')!.projectIds
    const next = call(s, 'createTeam', {
      title: 'Team',
      description: { ru: 'Команда', kk: 'Команда' },
      coreId: 'design',
      leaderId: 'u-member',
      memberIds: ['u-member'],
      projectIds: ['yrt'],
    })
    expect(next.teams?.at(-1)?.projectIds).toEqual(['yrt'])
    expect(next.users.find((u) => u.id === 'u-member')?.projectIds).toEqual(prior)
  })
  it('checks revisions before editing and preserves awarded ledger', () => {
    const s = createInitialState(),
      t = target(s)
    expect(() =>
      call(s, 'updateTask', { title: { ru: 'RU', kk: 'KK' } }, 'u-admin', {
        taskId: t.id,
        revision: t.revision - 1,
      }),
    ).toThrow('conflict')
    const next = call(s, 'updateTask', { dueAt: '2026-11-01T10:00:00+05:00' }, 'u-admin', {
      taskId: t.id,
      revision: t.revision,
    })
    expect(next.tasks.find((x) => x.id === t.id)?.history).toHaveLength(1)
    expect(next.ledger).toEqual(s.ledger)
  })
  it('locks points and ownership of a completed task', () => {
    const s = createInitialState(),
      t = s.tasks.find((t) => t.status === 'done')!
    expect(() =>
      call(s, 'updateTask', { points: t.points === 5 ? 10 : 5 }, 'u-admin', {
        taskId: t.id,
        revision: t.revision,
      }),
    ).toThrow('completedTaskLocked')
  })
  it('stores checklist completion without awarding XP and preserves completed items on reorder', () => {
    let s = createInitialState()
    let t = target(s)
    s = call(
      s,
      'checklistTask',
      {
        items: [
          { id: 'a', text: 'First' },
          { id: 'b', text: 'Second' },
        ],
      },
      'u-admin',
      { taskId: t.id, revision: t.revision },
    )
    t = s.tasks.find((x) => x.id === t.id)!
    s = call(s, 'checklistTask', { id: 'a', done: true }, t.assigneeId, {
      taskId: t.id,
      revision: t.revision,
    })
    t = s.tasks.find((x) => x.id === t.id)!
    const next = call(
      s,
      'checklistTask',
      {
        items: [
          { id: 'b', text: 'Second' },
          { id: 'a', text: 'First' },
        ],
      },
      'u-admin',
      { taskId: t.id, revision: t.revision },
    )
    expect(next.tasks.find((x) => x.id === t.id)?.checklist?.[1].done).toBe(true)
    expect(next.ledger).toEqual(s.ledger)
  })
  it('retains original comments in edits and blocks another author', () => {
    let s = createInitialState(),
      t = target(s)
    s = call(s, 'commentTask', { text: '<script>example</script>' }, t.assigneeId, {
      taskId: t.id,
      revision: t.revision,
    })
    t = s.tasks.find((x) => x.id === t.id)!
    expect(() =>
      call(s, 'editComment', { id: 'test-commentTask', text: 'Other' }, 'u-admin', {
        taskId: t.id,
        revision: t.revision,
      }),
    ).toThrow('forbidden')
    const next = call(s, 'editComment', { id: 'test-commentTask', text: 'Changed' }, t.assigneeId, {
      taskId: t.id,
      revision: t.revision,
    })
    expect(next.tasks.find((x) => x.id === t.id)?.comments?.[0].edits[0].text).toBe(
      '<script>example</script>',
    )
  })
  it('requires a valid related project for material access and isolates applicants', () => {
    const s = createInitialState()
    const next = call(s, 'createMaterial', {
      projectId: 'html',
      title: 'Guidelines',
      category: 'Документы',
      url: 'https://example.com/guide',
    })
    expect(scopedState(next, 'u-applicant').materials).toEqual([])
    expect(() =>
      call(
        s,
        'createMaterial',
        { projectId: 'aspan', title: 'Guide', category: 'Docs', url: 'https://example.com' },
        'u-manager',
      ),
    ).toThrow('forbidden')
  })
  it('accepts local office material metadata while rejecting contradictory sources', () => {
    const s = createInitialState(),
      file = {
        id: 'local-one',
        name: 'guide.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1200,
        createdAt: '2026-10-10T08:00:00Z',
      }
    expect(
      call(s, 'createMaterial', {
        projectId: 'html',
        title: 'Office',
        category: 'Docs',
        file,
      }).materials?.at(-1)?.file,
    ).toEqual(file)
    expect(() =>
      call(s, 'createMaterial', {
        projectId: 'html',
        title: 'Office',
        category: 'Docs',
        file,
        url: 'https://example.com',
      }),
    ).toThrow('required')
  })
  it('validates meeting end time and supports cancellation', () => {
    const s = createInitialState(),
      payload = {
        title: { ru: 'Встреча', kk: 'Кездесу' },
        projectId: 'html',
        startAt: '2026-10-10T09:00:00Z',
        endAt: '2026-10-10T10:00:00Z',
        place: 'Room 1',
        format: 'offline',
        status: 'scheduled',
      }
    expect(() => call(s, 'createMeeting', { ...payload, endAt: payload.startAt })).toThrow(
      'invalidDate',
    )
    const next = call(s, 'createMeeting', payload)
    expect(
      call(next, 'updateMeeting', {
        ...payload,
        id: 'meeting-test-createMeeting',
        status: 'cancelled',
      }).meetings?.[0].status,
    ).toBe('cancelled')
  })
  it('manual rank cannot elevate permissions or alter XP', () => {
    const s = createInitialState(),
      next = call(s, 'manualRank', {
        userId: 'u-member',
        title: 'Founder',
        reason: 'Демо назначение',
      })
    expect(next.users.find((u) => u.id === 'u-member')?.role).toBe('member')
    expect(totalXP(next, 'u-member')).toBe(totalXP(s, 'u-member'))
    expect(() =>
      call(s, 'manualRank', { userId: 'u-admin', title: 'Rank', reason: 'Test reason' }, 'u-head'),
    ).toThrow('forbidden')
  })
  it('only explicitly closes a past demo month and never duplicates a deduction', () => {
    const s = createInitialState(),
      p = {
        userId: 'u-member',
        month: '2026-09',
        w1: true,
        w2: true,
        reason: 'Демонстрационный расчёт',
        demo: true,
        confirmed: true,
      }
    expect(() => call(s, 'closeMonth', { ...p, confirmed: false })).toThrow('invalidDecision')
    expect(() => call(s, 'closeMonth', { ...p, month: '2026-10' })).toThrow('invalidDate')
    const next = call(s, 'closeMonth', p),
      repeat = call(next, 'closeMonth', p)
    expect(repeat.closures).toHaveLength(1)
    expect(repeat.ledger).toEqual(next.ledger)
    expect(totalXP(next, 'u-member')).toBeLessThanOrEqual(totalXP(s, 'u-member'))
  })
  it('reloads extended workflows and refuses corrupt nested comments', () => {
    const s = createInitialState(),
      t = target(s),
      next = call(s, 'commentTask', { text: 'Hello' }, t.assigneeId, {
        taskId: t.id,
        revision: t.revision,
      })
    expect(
      migrateDemoState(JSON.parse(JSON.stringify(next))).state.tasks.find((x) => x.id === t.id)
        ?.comments?.[0].text,
    ).toBe('Hello')
    const invalid = structuredClone(next)
    invalid.tasks.find((x) => x.id === t.id)!.comments![0].edits = null as never
    expect(() => migrateDemoState(invalid)).toThrow('invalid')
  })
  it('shows actual category changes instead of IDs or an equivalent deadline conversion', () => {
    const s = createInitialState(),
      t = target(s)
    const next = call(
      s,
      'updateTask',
      {
        category: 'Медиаматериалы',
        dueAt: new Date(t.dueAt).toISOString(),
      },
      'u-admin',
      { taskId: t.id, revision: t.revision },
    )
    const detail = next.tasks.find((x) => x.id === t.id)!.history!.at(-1)!.detail
    expect(detail.ru).toBe('Категория: — → Медиаматериалы')
    expect(detail.kk).toBe('Санат: — → Медиаматериалы')
  })
  it('preserves malformed team data by refusing migration rather than rendering it', () => {
    const s = createInitialState()
    s.teams = [
      {
        id: 'team',
        title: 'Team',
        coreId: 'design',
        memberIds: [],
        projectIds: [],
        description: { ru: 'RU', kk: 42 } as never,
      },
    ]
    expect(() => migrateDemoState(s)).toThrow('invalid')
    expect(s.teams[0].description?.kk).toBe(42)
  })
})
