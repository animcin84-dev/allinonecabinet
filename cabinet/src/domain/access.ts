import type { State, Task, User } from './types'
import { DomainError } from './errors'
const fail = (status: number, code: string): never => {
  throw new DomainError(status, code)
}
const findActor = (state: State, id: string) =>
  state.users.find((u) => u.id === id) ?? fail(401, 'sessionExpired')
export function managesProject(state: State, actor: User, projectId: string): boolean {
  if (actor.role === 'admin') return true
  if (actor.role === 'manager') return actor.projectIds.includes(projectId)
  return (
    actor.role === 'head' &&
    state.projects.some((p) => p.id === projectId && p.coreId === actor.coreId)
  )
}
export const managesUser = (actor: User, user: User) =>
  actor.role === 'admin' || (actor.role === 'head' && actor.coreId === user.coreId)
export function visibleTasks(state: State, actorId: string): Task[] {
  const actor = findActor(state, actorId)
  if (actor.role === 'applicant') return []
  return state.tasks.filter(
    (t) => t.assigneeId === actorId || managesProject(state, actor, t.projectId),
  )
}
export function canReview(state: State, actorId: string, task: Task): boolean {
  const actor = findActor(state, actorId)
  return (
    task.status === 'review' &&
    !task.archived && !state.projects.find(p=>p.id===task.projectId)?.archived &&
    task.assigneeId !== actorId &&
    managesProject(state, actor, task.projectId)
  )
}
export function visibleWarnings(state: State, actorId: string) {
  const actor = findActor(state, actorId)
  return state.warnings.filter(
    (w) =>
      w.userId === actorId || state.users.some((u) => u.id === w.userId && managesUser(actor, u)),
  )
}
export function scopedState(state: State, actorId: string): State {
  const actor = findActor(state, actorId)
  const projectIds = state.projects
    .filter(
      (p) =>
        actor.role === 'applicant' ||
        actor.projectIds.includes(p.id) ||
        managesProject(state, actor, p.id),
    )
    .map((p) => p.id)
  const users = state.users.filter(
    (u) =>
      u.id === actorId ||
      (actor.role !== 'applicant' &&
        (actor.role === 'admin' ||
          (actor.role === 'head' && u.coreId === actor.coreId) ||
          u.projectIds.some((p) => projectIds.includes(p)))),
  )
  return {
    ...state,
    users: users.map((u) =>
      u.id === actorId || managesUser(actor, u) ? { ...u } : { ...u, email: '' },
    ),
    projects: state.projects
      .filter((p) => projectIds.includes(p.id))
      .map((p) => (actor.role === 'applicant' ? { ...p, teamIds: [], memberIds: [] } : p)),
    teams: (state.teams ?? []).filter(t => actor.role !== 'applicant' && (actor.role === 'admin' || t.memberIds.includes(actorId) || (actor.role === 'head' && t.coreId === actor.coreId) || (actor.role === 'manager' && t.projectIds.some(id => actor.projectIds.includes(id))))),
    materials: (state.materials ?? []).filter(m => actor.role !== 'applicant' && projectIds.includes(m.projectId)),
    meetings: (state.meetings ?? []).filter(m => actor.role !== 'applicant' && projectIds.includes(m.projectId)),
    closures: (state.closures ?? []).filter(c => c.userId === actorId || state.users.some(u => u.id === c.userId && managesUser(actor, u))),
    tasks: visibleTasks(state, actorId),
    ledger: state.ledger.filter(
      (e) =>
        e.userId === actorId || state.users.some((u) => u.id === e.userId && managesUser(actor, u)),
    ),
    notices: state.notices.filter((n) => n.userId === actorId),
    applications: state.applications.filter(
      (a) =>
        a.userId === actorId ||
        actor.role === 'admin' ||
        (actor.role === 'head' && !!a.coreId && a.coreId === actor.coreId),
    ),
    warnings: visibleWarnings(state, actorId),
  }
}
