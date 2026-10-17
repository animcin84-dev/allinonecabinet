import type { State } from './types'
import { validMaterialFile } from './file-metadata'
import { emptyApplicationAnswers, validLocalAttachment } from './application'
export const DEMO_SCHEMA_VERSION = 2 as const
export class MigrationError extends Error {
  constructor(public code: 'invalid' | 'future') {
    super(code)
  }
}
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const strings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')
const localized = (v: unknown) => object(v) && typeof v.ru === 'string' && typeof v.kk === 'string'
const textKeys = (v: Record<string, unknown>, keys: string[]) =>
  keys.every((k) => typeof v[k] === 'string')
const submission = (v: unknown) => object(v) && textKeys(v, ['text', 'url', 'at'])
const applicationAnswers = (v: unknown) => {
  if (!object(v)) return false
  const defaults = emptyApplicationAnswers()
  return Object.entries(defaults).every(([key, defaultValue]) => {
    if (key === 'portfolio') return Array.isArray(v[key]) && v[key].every(validLocalAttachment)
    return Array.isArray(defaultValue) ? strings(v[key]) : typeof v[key] === 'string'
  })
}
const applicationHistory = (v: unknown) =>
  object(v) &&
  textKeys(v, ['id', 'at', 'by', 'status', 'comment']) &&
  (!v.snapshot ||
    (object(v.snapshot) &&
      textKeys(v.snapshot, ['name', 'email', 'school', 'motivation', 'skills', 'coreId']) &&
      (!v.snapshot.answers || applicationAnswers(v.snapshot.answers))))
/** Refuse unsafe structures instead of silently replacing saved work. Optional additions are non-destructive. */
export function migrateDemoState(value: unknown): { state: State; migrated: boolean } {
  if (!object(value)) throw new MigrationError('invalid')
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1 && value.schemaVersion !== 2)
    throw new MigrationError('future')
  const checks: Record<string, (v: Record<string, unknown>) => boolean> = {
    users: (v) =>
      textKeys(v, ['id', 'name', 'coreId', 'bio', 'email']) &&
      ['applicant', 'member', 'manager', 'head', 'admin'].includes(String(v.role)) &&
      strings(v.projectIds) &&
      strings(v.skills) &&
      (v.avatarId === undefined || typeof v.avatarId === 'string'),
    projects: (v) =>
      textKeys(v, ['id', 'title', 'coreId', 'image', 'date']) &&
      localized(v.description) &&
      strings(v.teamIds) &&
      Array.isArray(v.facts) &&
      v.facts.every(localized) &&
      (v.memberIds === undefined || strings(v.memberIds)),
    tasks: (v) =>
      textKeys(v, ['id', 'projectId', 'assigneeId', 'reviewerId', 'dueAt']) &&
      localized(v.title) &&
      localized(v.description) &&
      ['todo', 'in_progress', 'review', 'done'].includes(String(v.status)) &&
      typeof v.points === 'number' &&
      Number.isFinite(v.points) &&
      typeof v.revision === 'number' &&
      Number.isInteger(v.revision) &&
      Array.isArray(v.reviews) &&
      v.reviews.every(
        (r) =>
          object(r) &&
          textKeys(r, ['id', 'reason', 'by', 'at']) &&
          ['approved', 'returned'].includes(String(r.decision)),
      ) &&
      (v.submission === undefined || submission(v.submission)) &&
      (v.submissions === undefined ||
        (Array.isArray(v.submissions) && v.submissions.every(submission))),
    ledger: (v) =>
      textKeys(v, ['id', 'userId', 'at']) &&
      localized(v.reason) &&
      typeof v.points === 'number' &&
      Number.isFinite(v.points) &&
      ['award', 'adjustment'].includes(String(v.kind)),
    notices: (v) =>
      textKeys(v, ['id', 'userId', 'at']) &&
      localized(v.title) &&
      localized(v.body) &&
      typeof v.read === 'boolean',
    applications: (v) =>
      textKeys(v, [
        'id',
        'userId',
        'name',
        'email',
        'school',
        'motivation',
        'coreId',
        'skills',
        'comment',
      ]) &&
      ['draft', 'submitted', 'reviewing', 'needs_info', 'accepted', 'rejected'].includes(
        String(v.status),
      ) &&
      (v.answers === undefined || applicationAnswers(v.answers)) &&
      (v.history === undefined ||
        (Array.isArray(v.history) && v.history.every(applicationHistory))),
    warnings: (v) =>
      textKeys(v, ['id', 'userId', 'reason', 'by', 'at']) && typeof v.resolved === 'boolean',
  }
  // The oldest demos lack optional notices/applications/warnings; never discard existing entries.
  for (const [key, check] of Object.entries(checks)) {
    const list = value[key]
    if (list === undefined && ['notices', 'applications', 'warnings'].includes(key)) continue
    if (!Array.isArray(list) || !list.every((v) => object(v) && check(v)))
      throw new MigrationError('invalid')
    if (new Set(list.map((v) => v.id)).size !== list.length) throw new MigrationError('invalid')
  }
  if (
    value.teams !== undefined &&
    (!Array.isArray(value.teams) ||
      !value.teams.every(
        (v) =>
          object(v) &&
          textKeys(v, ['id', 'title', 'coreId']) &&
          strings(v.memberIds) &&
          strings(v.projectIds) &&
          (v.description === undefined || localized(v.description)) &&
          (v.leaderId === undefined || typeof v.leaderId === 'string') &&
          (v.archived === undefined || typeof v.archived === 'boolean'),
      ))
  )
    throw new MigrationError('invalid')
  const history = (v: unknown) =>
    Array.isArray(v) &&
    v.every((x) => object(x) && textKeys(x, ['id', 'at', 'by']) && localized(x.detail))
  for (const task of value.tasks as Record<string, unknown>[]) {
    if (task.materialIds !== undefined && !strings(task.materialIds))
      throw new MigrationError('invalid')
    if (
      (task.archived !== undefined && typeof task.archived !== 'boolean') ||
      (task.history !== undefined && !history(task.history)) ||
      (task.checklist !== undefined &&
        (!Array.isArray(task.checklist) ||
          !task.checklist.every(
            (x) => object(x) && textKeys(x, ['id', 'text']) && typeof x.done === 'boolean',
          ))) ||
      (task.comments !== undefined &&
        (!Array.isArray(task.comments) ||
          !task.comments.every(
            (x) =>
              object(x) &&
              textKeys(x, ['id', 'text', 'by', 'at']) &&
              Array.isArray(x.edits) &&
              x.edits.every((e) => object(e) && textKeys(e, ['text', 'at'])),
          )))
    )
      throw new MigrationError('invalid')
  }
  for (const project of value.projects as Record<string, unknown>[])
    if (
      (project.archived !== undefined && typeof project.archived !== 'boolean') ||
      (project.history !== undefined && !history(project.history)) ||
      (project.lifecycle !== undefined &&
        !['in_progress', 'completed', 'frozen', 'soon'].includes(String(project.lifecycle))) ||
      (project.category !== undefined &&
        !['research', 'diplomacy', 'digital', 'community'].includes(String(project.category)))
    )
      throw new MigrationError('invalid')
  for (const user of value.users as Record<string, unknown>[])
    if (
      user.manualRank !== undefined &&
      (!object(user.manualRank) || !textKeys(user.manualRank, ['title', 'reason', 'by', 'at']))
    )
      throw new MigrationError('invalid')
  const additions: Record<string, (v: Record<string, unknown>) => boolean> = {
    materials: (v) =>
      textKeys(v, ['id', 'projectId', 'title', 'category', 'by', 'at']) &&
      (v.url === undefined || typeof v.url === 'string') &&
      (v.file === undefined || validMaterialFile(v.file)) &&
      (v.archived === undefined || typeof v.archived === 'boolean'),
    meetings: (v) =>
      textKeys(v, ['id', 'projectId', 'startAt', 'endAt', 'place', 'by']) &&
      localized(v.title) &&
      ['online', 'offline'].includes(String(v.format)) &&
      ['scheduled', 'cancelled'].includes(String(v.status)) &&
      v.demo === true &&
      Number.isFinite(Date.parse(String(v.startAt))) &&
      Date.parse(String(v.endAt)) > Date.parse(String(v.startAt)),
    closures: (v) =>
      textKeys(v, ['id', 'userId', 'month', 'by', 'at', 'reason']) &&
      ['previous', 'monthly', 'result'].every(
        (k) => typeof v[k] === 'number' && Number.isFinite(v[k]),
      ) &&
      typeof v.w1 === 'boolean' &&
      typeof v.w2 === 'boolean' &&
      v.demo === true,
  }
  for (const [key, check] of Object.entries(additions))
    if (
      value[key] !== undefined &&
      (!Array.isArray(value[key]) || !(value[key] as unknown[]).every((v) => object(v) && check(v)))
    )
      throw new MigrationError('invalid')
  const state = structuredClone(value) as unknown as State
  let migrated = state.schemaVersion !== DEMO_SCHEMA_VERSION
  state.schemaVersion = DEMO_SCHEMA_VERSION
  for (const key of ['notices', 'applications', 'warnings', 'teams'] as const)
    if (!state[key]) {
      state[key] = []
      migrated = true
    }
  for (const project of state.projects)
    if (!project.memberIds) {
      project.memberIds = [...project.teamIds]
      migrated = true
    }
  for (const task of state.tasks)
    if (!task.submissions) {
      task.submissions = task.submission ? [{ ...task.submission }] : []
      migrated = true
    }
  for (const application of state.applications)
    if (!application.history) {
      application.history = []
      migrated = true
    }
  return { state, migrated }
}
