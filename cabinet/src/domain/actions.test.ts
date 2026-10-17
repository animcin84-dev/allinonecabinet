import { describe, expect, it } from 'vitest'
import {
  applyAction,
  canReview,
  createInitialState,
  DomainError,
  previewMonthlyXP,
  rankFor,
  scopedState,
  totalXP,
} from './index'
function errorCode(fn: () => unknown, status: number, code: string) {
  try {
    fn()
    throw new Error('expected rejection')
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError)
    expect(error).toMatchObject({ status, code })
  }
}
describe('task result → review → XP', () => {
  it('awards only after approval, records decision, and ignores a repeated decision', () => {
    const initial = createInitialState()
    const before = totalXP(initial, 'u-member')
    const submitted = applyAction(initial, 'u-member', {
      type: 'submit',
      taskId: 'task-01',
      revision: 1,
      text: 'Готова двуязычная структура медиакита.',
      url: 'https://example.test/result',
      requestId: 'submit-1',
    })
    expect(totalXP(submitted, 'u-member')).toBe(before)
    expect(initial.tasks[0].status).toBe('in_progress')
    const action = {
      type: 'review',
      taskId: 'task-01',
      revision: 2,
      decision: 'approved',
      requestId: 'approve-1',
    }
    const approved = applyAction(submitted, 'u-manager', action)
    expect(totalXP(approved, 'u-member')).toBe(before + 10)
    expect(approved.tasks[0].status).toBe('done')
    const repeated = applyAction(approved, 'u-manager', action)
    expect(repeated.ledger.filter((e) => e.taskId === 'task-01')).toHaveLength(1)
    expect(totalXP(repeated, 'u-member')).toBe(before + 10)
  })
  it('requires return reason and preserves submission separate from reviewer comment', () => {
    const initial = createInitialState()
    errorCode(
      () =>
        applyAction(initial, 'u-manager', {
          type: 'review',
          taskId: 'task-02',
          revision: 1,
          decision: 'returned',
          requestId: 'return-1',
        }),
      422,
      'reasonRequired',
    )
    const returned = applyAction(initial, 'u-manager', {
      type: 'review',
      taskId: 'task-02',
      revision: 1,
      decision: 'returned',
      reason: 'Проверить казахскую версию',
      requestId: 'return-1',
    })
    const task = returned.tasks.find((t) => t.id === 'task-02')!
    expect(task.status).toBe('in_progress')
    expect(task.submission?.text).toBe(initial.tasks[1].submission?.text)
    expect(task.reviews[0].reason).toBe('Проверить казахскую версию')
    expect(returned.ledger).toEqual(initial.ledger)
  })
  it('rejects self-review, out-of-scope review, stale revision and unsafe URLs', () => {
    const state = createInitialState()
    errorCode(
      () =>
        applyAction(state, 'u-manager', {
          type: 'review',
          taskId: 'task-08',
          revision: 1,
          decision: 'approved',
          requestId: 'self',
        }),
      403,
      'selfReview',
    )
    errorCode(
      () =>
        applyAction(state, 'u-club', {
          type: 'review',
          taskId: 'task-02',
          revision: 1,
          decision: 'approved',
          requestId: 'out',
        }),
      403,
      'forbidden',
    )
    errorCode(
      () =>
        applyAction(state, 'u-manager', {
          type: 'review',
          taskId: 'task-02',
          revision: 0,
          decision: 'approved',
          requestId: 'stale',
        }),
      409,
      'conflict',
    )
    errorCode(
      () =>
        applyAction(state, 'u-member', {
          type: 'submit',
          taskId: 'task-01',
          revision: 1,
          text: 'Описание достаточно подробное.',
          url: 'javascript:alert(1)',
        }),
      422,
      'invalidURL',
    )
  })
  it('supports a returned result, new submission and approval without duplicating XP', () => {
    let state = createInitialState()
    const before = totalXP(state, 'u-member')
    const firstResult = { ...state.tasks[1].submission! }
    state = applyAction(state, 'u-manager', {
      type: 'review',
      taskId: 'task-02',
      revision: 1,
      decision: 'returned',
      reason: 'Добавить казахский текст',
      requestId: 'return-flow',
    })
    state = applyAction(state, 'u-member', {
      type: 'submit',
      taskId: 'task-02',
      revision: 2,
      text: 'Казахская версия обновлена, верстка проверена.',
      requestId: 'resubmit-flow',
    })
    const action = {
      type: 'review',
      taskId: 'task-02',
      revision: 3,
      decision: 'approved',
      requestId: 'approve-flow',
    }
    state = applyAction(state, 'u-manager', action)
    state = applyAction(state, 'u-manager', action)
    expect(state.tasks[1].reviews).toHaveLength(2)
    expect(state.tasks[1].submissions).toHaveLength(2)
    expect(state.tasks[1].submissions?.[0]).toEqual(firstResult)
    expect(state.tasks[1].submissions?.[1].text).toBe(
      'Казахская версия обновлена, верстка проверена.',
    )
    expect(state.tasks[1].submission).toEqual(state.tasks[1].submissions?.[1])
    expect(totalXP(state, 'u-member')).toBe(before + 15)
  })
  it('migrates a previously persisted single result without losing it during resubmission', () => {
    const state = createInitialState()
    const task = state.tasks[1]
    const previous = { ...task.submission! }
    delete task.submissions
    task.status = 'in_progress'
    const submitted = applyAction(state, 'u-member', {
      type: 'submit',
      taskId: task.id,
      revision: 1,
      text: 'Новый исправленный результат.',
      requestId: 'legacy-submit',
    })
    expect(submitted.tasks[1].submissions?.[0]).toEqual(previous)
    expect(submitted.tasks[1].submissions).toHaveLength(2)
  })
})
describe('scope is independent from rank', () => {
  it('member receives only assigned tasks, own journal/warnings and no foreign contacts/applications', () => {
    const visible = scopedState(createInitialState(), 'u-member')
    expect(visible.tasks.every((t) => t.assigneeId === 'u-member')).toBe(true)
    expect(visible.ledger.every((e) => e.userId === 'u-member')).toBe(true)
    expect(visible.warnings.every((w) => w.userId === 'u-member')).toBe(true)
    expect(visible.applications).toHaveLength(0)
    expect(visible.users.filter((u) => u.id !== 'u-member').every((u) => u.email === '')).toBe(true)
    expect(canReview(createInitialState(), 'u-member', createInitialState().tasks[1])).toBe(false)
  })
  it('applicant has public archives but no team, task, XP or warning data', () => {
    const visible = scopedState(createInitialState(), 'u-applicant')
    expect(visible.tasks).toHaveLength(0)
    expect(visible.ledger).toHaveLength(0)
    expect(visible.warnings).toHaveLength(0)
    expect(visible.users.map((u) => u.id)).toEqual(['u-applicant'])
    expect(visible.projects.every((p) => p.teamIds.length === 0)).toBe(true)
    expect(visible.applications.map((a) => a.userId)).toEqual(['u-applicant'])
  })
  it('large XP never grants a member management capability', () => {
    const state = createInitialState()
    state.ledger.push({
      id: 'huge',
      userId: 'u-member',
      points: 9999,
      reason: { ru: 'Демо', kk: 'Демо' },
      at: '2026-10-09T09:00:00Z',
      kind: 'award',
    })
    expect(rankFor(totalXP(state, 'u-member')).name).toBe('Manager')
    errorCode(
      () =>
        applyAction(state, 'u-member', {
          type: 'warning',
          userId: 'u-other',
          reason: 'Нет полномочий',
        }),
      403,
      'forbidden',
    )
    errorCode(
      () => applyAction(state, 'u-member', { type: 'profile', payload: { role: 'admin' } }),
      403,
      'forbidden',
    )
  })
})
describe('XP policy, corrections and draft warning calculations', () => {
  it.each([
    [29.9, 'Intern'],
    [30, 'Novice'],
    [89.9, 'Novice'],
    [90, 'Consultant'],
    [179.9, 'Consultant'],
    [180, 'Senior Consultant'],
    [539.9, 'Senior Consultant'],
    [540, 'Deputy Manager'],
    [1023.9, 'Deputy Manager'],
    [1024, 'Manager'],
  ])('rank at %s is %s', (points, rank) => expect(rankFor(Number(points)).name).toBe(rank))
  it('keeps corrections as new history and requires a reason', () => {
    const state = createInitialState()
    errorCode(
      () => applyAction(state, 'u-admin', { type: 'adjustXP', userId: 'u-member', points: -10 }),
      422,
      'reasonRequired',
    )
    const adjusted = applyAction(state, 'u-admin', {
      type: 'adjustXP',
      userId: 'u-member',
      points: -10,
      reason: 'Исправление демо-ошибки',
      requestId: 'correction',
    })
    expect(adjusted.ledger).toHaveLength(state.ledger.length + 1)
    expect(
      applyAction(adjusted, 'u-admin', {
        type: 'adjustXP',
        userId: 'u-member',
        points: -10,
        reason: 'Исправление демо-ошибки',
        requestId: 'correction',
      }).ledger,
    ).toHaveLength(adjusted.ledger.length)
    expect(previewMonthlyXP(50, 400, true, true)).toBe(200)
  })
  it('head cannot access or issue a warning outside own core', () => {
    const state = createInitialState()
    errorCode(
      () =>
        applyAction(state, 'u-head', { type: 'warning', userId: 'u-club', reason: 'Outside core' }),
      403,
      'forbidden',
    )
    const issued = applyAction(state, 'u-head', {
      type: 'warning',
      userId: 'u-other',
      reason: 'Демо: уточнить срок',
      requestId: 'head-warning',
    })
    expect(issued.warnings).toHaveLength(state.warnings.length + 1)
    expect(totalXP(issued, 'u-other')).toBe(totalXP(state, 'u-other'))
  })
  it('resolving warnings keeps original reason, issuer and separate resolution history', () => {
    const initial = createInitialState()
    const resolved = applyAction(initial, 'u-admin', {
      type: 'resolveWarning',
      payload: { id: 'warning-02' },
      reason: 'Демо: вопрос прояснен',
      requestId: 'resolve',
    })
    expect(resolved.warnings[1]).toMatchObject({
      reason: initial.warnings[1].reason,
      by: initial.warnings[1].by,
      resolved: true,
      resolvedReason: 'Демо: вопрос прояснен',
      resolvedBy: 'u-admin',
    })
  })
})
describe('application and assignments', () => {
  it('registration/application does not equal membership; accepting grants no admin role', () => {
    const initial = createInitialState()
    const submitted = applyAction(initial, 'u-applicant', {
      type: 'application',
      payload: {
        status: 'submitted',
        motivation: 'Хочу работать над дизайном и помогать команде.',
      },
    })
    expect(submitted.users.find((u) => u.id === 'u-applicant')?.role).toBe('applicant')
    const accepted = applyAction(submitted, 'u-admin', {
      type: 'reviewApplication',
      payload: { id: 'application-01', status: 'accepted' },
    })
    expect(accepted.users.find((u) => u.id === 'u-applicant')?.role).toBe('member')
    expect(scopedState(accepted, 'u-applicant').tasks).toHaveLength(0)
  })
  it('creation validates assigned project, reviewer and non-stacking reward', () => {
    const initial = createInitialState()
    const payload = {
      title: { ru: 'Демо-задача', kk: 'Демо-тапсырма' },
      description: { ru: 'Описание', kk: 'Сипаттама' },
      projectId: 'html',
      assigneeId: 'u-member',
      reviewerId: 'u-manager',
      points: 10,
      dueAt: '2026-10-14T18:00:00+05:00',
    }
    const created = applyAction(initial, 'u-manager', {
      type: 'createTask',
      payload,
      requestId: 'create-1',
    })
    expect(created.tasks).toHaveLength(initial.tasks.length + 1)
    errorCode(
      () =>
        applyAction(initial, 'u-manager', {
          type: 'createTask',
          payload: { ...payload, points: 30 },
        }),
      422,
      'invalidPoints',
    )
    errorCode(
      () => applyAction(initial, 'u-member', { type: 'createTask', payload }),
      403,
      'forbidden',
    )
  })
  it('system assignments require admin and retain before/after journal', () => {
    const state = createInitialState()
    errorCode(
      () =>
        applyAction(state, 'u-admin', {
          type: 'updateUser',
          payload: { id: 'u-other', role: 'head' },
        }),
      422,
      'reasonRequired',
    )
    errorCode(
      () =>
        applyAction(state, 'u-manager', {
          type: 'updateUser',
          payload: { id: 'u-other', role: 'head' },
          reason: 'Демо',
        }),
      403,
      'forbidden',
    )
    const changed = applyAction(state, 'u-admin', {
      type: 'updateUser',
      payload: { id: 'u-other', role: 'head', coreId: 'design', projectIds: [...new Set([...state.users.find((u) => u.id === 'u-other')!.projectIds, 'html'])] },
      reason: 'Демо: назначение ответственного',
      requestId: 'assign',
    })
    expect(changed.users.find((u) => u.id === 'u-other')?.role).toBe('head')
    expect(
      changed.notices.some((n) => n.userId === 'u-admin' && n.body.ru.includes('member / design')),
    ).toBe(true)
  })
  it.each(['review', 'reviewApplication', 'adjustXP', 'warning', 'resolveWarning', 'updateUser'])(
    'requires at least five reason characters for %s',
    (type) => {
      let state = createInitialState()
      if (type === 'reviewApplication')
        state = applyAction(state, 'u-applicant', {
          type: 'application',
          payload: {
            status: 'submitted',
            motivation: 'Хочу создавать полезные проекты вместе с командой.',
          },
        })
      const action =
        type === 'review'
          ? {
              type,
              taskId: 'task-02',
              revision: 1,
              decision: 'returned',
              requestId: 'short-review',
              reason: 'oops',
            }
          : type === 'reviewApplication'
            ? { type, payload: { id: 'application-01', status: 'needs_info', comment: 'oops' } }
            : type === 'adjustXP'
              ? { type, userId: 'u-member', points: -10, reason: 'oops' }
              : type === 'warning'
                ? { type, userId: 'u-member', reason: 'oops' }
                : type === 'resolveWarning'
                  ? { type, payload: { id: 'warning-02' }, reason: 'oops' }
                  : { type, payload: { id: 'u-other', role: 'head' }, reason: 'oops' }
      errorCode(() => applyAction(state, 'u-admin', action), 422, 'reasonRequired')
    },
  )
})
