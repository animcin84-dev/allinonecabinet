import { createInitialState } from './fixtures'
import { applyWorkspaceAction, syncMembers } from './workspace'
import { normalizeApplicationAnswers, validateFullApplication, validLocalAttachment } from './application'
import {
  CORES,
  type Action,
  type State,
  type Task,
  type User,
  type Role,
  type Localized,
} from './types'
import { DomainError } from './errors'
import { managesProject, managesUser } from './access'
export { DomainError } from './errors'
export { visibleTasks, canReview, visibleWarnings, scopedState } from './access'
const fail = (status:number,code:string):never => { throw new DomainError(status,code) }
const findActor = (state:State,id:string) => state.users.find(u=>u.id===id) ?? fail(401,'sessionExpired')
const required = (value: unknown, code = 'required'): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fail(422, code)
function requiredReason(value: unknown): string {
  const reason = required(value, 'reasonRequired')
  return reason.length >= 5 ? reason : fail(422, 'reasonRequired')
}
function localized(value: unknown): Localized {
  if (typeof value === 'string') return { ru: required(value), kk: required(value) }
  if (value && typeof value === 'object' && 'ru' in value && 'kk' in value)
    return { ru: required(value.ru), kk: required(value.kk) }
  return fail(422, 'required')
}
function safeURL(value: unknown): string {
  if (!value) return ''
  try {
    const url = new URL(required(value))
    if (!['http:', 'https:'].includes(url.protocol)) return fail(422, 'invalidURL')
    return url.href
  } catch {
    return fail(422, 'invalidURL')
  }
}
const email = (value: unknown) => {
  const text = required(value)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text) ? text : fail(422, 'invalidEmail')
}
function targetUser(state: State, id: unknown): User {
  return state.users.find((u) => u.id === id) ?? fail(404, 'notFound')
}
function validCore(value: unknown): string {
  return CORES.some((c) => c.id === value) ? (value as string) : fail(422, 'invalidCore')
}
/** Pure demo transition engine. Server authorization and atomic persistence remain future integration work. */
export function applyAction(input: State, actorId: string, action: Action): State {
  const actor = findActor(input, actorId)
  if (action.type === 'reset') return createInitialState()
  const state = structuredClone(input)
  const payload = action.payload ?? {}
  const at = typeof payload.at === 'string' ? payload.at : '2026-10-09T09:00:00Z'
  const requestId =
    action.requestId ?? `demo-${action.type}-${state.notices.length}-${state.ledger.length}`
  if (applyWorkspaceAction(state, actor, action, at, requestId)) return state
  const notify = (userId: string, title: Localized, body: Localized, taskId?: string) =>
    state.notices.push({
      id: `notice-${requestId}-${userId}`,
      userId,
      title,
      body,
      at,
      taskId,
      read: false,
      kind: taskId ? 'task' : action.type === 'reviewApplication' ? 'application' : 'system',
    })
  if (['start', 'submit', 'review'].includes(action.type)) {
    const task = state.tasks.find((t) => t.id === action.taskId) ?? fail(404, 'notFound')
    if (task.archived || state.projects.some(p => p.id === task.projectId && p.archived)) fail(422, 'archived')
    if (action.type === 'review') {
      if (task.assigneeId === actorId) fail(403, 'selfReview')
      if (!managesProject(state, actor, task.projectId)) fail(403, 'forbidden')
      const id = required(action.requestId, 'requestIdRequired')
      const previous = task.reviews.find((r) => r.id === id)
      if (previous) {
        if (previous.decision !== action.decision) fail(409, 'conflict')
        return state
      }
    } else if (actor.role === 'applicant' || task.assigneeId !== actorId) fail(403, 'forbidden')
    if (task.revision !== action.revision) fail(409, 'conflict')
    if (action.type === 'start') {
      if (task.status !== 'todo') fail(409, 'conflict')
      task.status = 'in_progress'
    } else if (action.type === 'submit') {
      if (task.status !== 'in_progress') fail(409, 'conflict')
      const text = required(action.text ?? payload.text, 'resultRequired')
      if (text.length < 10) fail(422, 'resultTooShort')
      const nextSubmission = { text, url: safeURL(action.url ?? payload.url), at }
      task.submissions ??= []
      // Migrate persisted demos that stored only the latest result before history was introduced.
      if (
        task.submission &&
        !task.submissions.some(
          (s) =>
            s.text === task.submission!.text &&
            s.url === task.submission!.url &&
            s.at === task.submission!.at,
        )
      )
        task.submissions.push({ ...task.submission })
      task.submissions.push(nextSubmission)
      task.submission = nextSubmission
      task.status = 'review'
      notify(
        task.reviewerId,
        { ru: 'Результат ожидает проверки', kk: 'Нәтиже тексеруді күтуде' },
        task.title,
        task.id,
      )
    } else {
      if (task.status !== 'review' || !task.submission) fail(409, 'conflict')
      if (!['approved', 'returned'].includes(action.decision ?? '')) fail(422, 'invalidDecision')
      const reason =
        action.decision === 'returned'
          ? requiredReason(action.reason)
          : (action.reason?.trim() ?? '')
      const decision = action.decision as 'approved' | 'returned'
      task.reviews.push({ id: action.requestId!, decision, reason, by: actorId, at })
      task.status = decision === 'approved' ? 'done' : 'in_progress'
      if (
        decision === 'approved' &&
        !state.ledger.some((e) => e.kind === 'award' && e.taskId === task.id)
      ) {
        state.ledger.push({
          id: `award-${task.id}`,
          userId: task.assigneeId,
          taskId: task.id,
          points: task.points,
          reason: task.title,
          at,
          kind: 'award',
          decisionId: action.requestId,
        })
      }
      notify(
        task.assigneeId,
        decision === 'approved'
          ? { ru: 'Работа подтверждена', kk: 'Жұмыс расталды' }
          : { ru: 'Нужна доработка', kk: 'Толықтыру қажет' },
        { ru: reason || task.title.ru, kk: reason || task.title.kk },
        task.id,
      )
    }
    task.revision++
    return state
  }
  if (action.type === 'createTask') {
    const projectId = required(payload.projectId)
    const project = state.projects.find(p => p.id === projectId) ?? fail(404, 'notFound')
    if(project.archived) fail(422, 'archived')
    if (!managesProject(state, actor, projectId)) fail(403, 'forbidden')
    const assignee = targetUser(state, payload.assigneeId)
    const reviewer = targetUser(state, payload.reviewerId)
    if (assignee.role === 'applicant' || !assignee.projectIds.includes(projectId))
      fail(422, 'invalidAssignee')
    if (assignee.id === reviewer.id || !managesProject(state, reviewer, projectId))
      fail(422, 'invalidReviewer')
    const points = Number(payload.points ?? action.points)
    if (![5, 10, 15].includes(points)) fail(422, 'invalidPoints')
    const dueAt = required(payload.dueAt)
    if (!Number.isFinite(Date.parse(dueAt))) fail(422, 'invalidDate')
    const id = `task-${requestId}`
    if (state.tasks.some((t) => t.id === id)) return state
    const newTask: Task = {
      id,
      title: localized(payload.title),
      description: localized(payload.description),
      projectId,
      assigneeId: assignee.id,
      reviewerId: reviewer.id,
      status: 'todo',
      points,
      dueAt,
      revision: 1,
      reviews: [],
    }
    state.tasks.push(newTask)
    notify(assignee.id, { ru: 'Назначена задача', kk: 'Тапсырма тағайындалды' }, newTask.title, id)
    return state
  }
  if (action.type === 'profile') {
    if (['role', 'coreId', 'projectIds'].some((key) => key in payload)) fail(403, 'forbidden')
    const user = targetUser(state, actorId)
    if ('name' in payload) user.name = required(payload.name)
    if ('bio' in payload) user.bio = String(payload.bio).slice(0, 1200)
    if ('email' in payload) user.email = email(payload.email)
    if ('avatarId' in payload) {
      if (typeof payload.avatarId !== 'string' || payload.avatarId.length > 160 || !/^[a-zA-Z0-9_-]*$/.test(payload.avatarId)) fail(422, 'invalidAvatar')
      user.avatarId = payload.avatarId as string
    }
    if ('skills' in payload)
      user.skills = Array.isArray(payload.skills)
        ? payload.skills.map(String).slice(0, 12)
        : String(payload.skills)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 12)
    return state
  }
  if (action.type === 'application') {
    let application = state.applications.find((a) => a.userId === actorId)
    if (application && !['draft', 'needs_info'].includes(application.status))
      fail(409, 'applicationLocked')
    if (!application) {
      application = {
        id: `application-${actorId}`,
        userId: actorId,
        status: 'draft',
        name: actor.name,
        email: actor.email,
        school: '',
        motivation: '',
        coreId: 'design',
        skills: '',
        comment: '',
      }
      state.applications.push(application)
    }
    if (application.status === 'needs_info' && !application.history?.length) {
      application.history = [{ id: `application-legacy-${requestId}`, at: '', by: '', status: 'needs_info', comment: application.comment, snapshot: { name: application.name, email: application.email, school: application.school, motivation: application.motivation, skills: application.skills, coreId: application.coreId, formVersion: application.formVersion, answers: application.answers } }]
    }
    for (const key of ['name', 'email', 'school', 'motivation', 'skills'] as const)
      if (key in payload) application[key] = String(payload[key])
    if (payload.status === 'submitted' && payload.answers && typeof payload.answers === 'object' && 'portfolio' in payload.answers && (!Array.isArray(payload.answers.portfolio) || payload.answers.portfolio.some(p => !validLocalAttachment(p)))) fail(422, 'invalidApplication')
    if (payload.formVersion === 2) {
      application.formVersion = 2
      application.coreId = ''
      application.answers = normalizeApplicationAnswers(payload.answers ?? application.answers)
    } else if (application.formVersion === 2) {
      if ('answers' in payload) application.answers = normalizeApplicationAnswers(payload.answers)
    } else if ('coreId' in payload) application.coreId = validCore(payload.coreId)
    if (payload.status === 'submitted') {
      if (application.formVersion === 2 && Object.keys(validateFullApplication({ ...application, answers: application.answers! })).length) fail(422, 'invalidApplication')
      required(application.name)
      email(application.email)
      required(application.school)
      if (application.motivation.trim().length < 20) fail(422, 'motivationTooShort')
      application.status = 'submitted'
      application.history ??= []
      application.history.push({
        id: `application-submit-${requestId}`, at, by: actorId, status: 'submitted', comment: '',
        snapshot: structuredClone({ name: application.name, email: application.email, school: application.school, motivation: application.motivation, skills: application.skills, coreId: application.coreId, formVersion: application.formVersion, answers: application.answers }),
      })
    } else if (payload.status && payload.status !== 'draft') fail(403, 'forbidden')
    return state
  }
  if (action.type === 'reviewApplication') {
    const application = state.applications.find((a) => a.id === payload.id) ?? fail(404, 'notFound')
    if (!(actor.role === 'admin' || (actor.role === 'head' && !!application.coreId && actor.coreId === application.coreId)))
      fail(403, 'forbidden')
    if (['accepted', 'rejected', 'draft'].includes(application.status))
      fail(409, 'applicationLocked')
    const status = String(payload.status ?? action.decision)
    if (!['reviewing', 'needs_info', 'accepted', 'rejected'].includes(status))
      fail(422, 'invalidDecision')
    const comment = String(payload.comment ?? action.reason ?? '').trim()
    if (['needs_info', 'rejected'].includes(status)) requiredReason(comment)
    if (status === 'accepted') {
      if ('coreId' in payload) application.coreId = validCore(payload.coreId)
      else application.coreId = validCore(application.coreId)
      if (actor.role === 'head' && application.coreId !== actor.coreId) fail(403, 'forbidden')
    }
    application.status = status as typeof application.status
    application.comment = comment
    application.history ??= []
    application.history.push({ id: `application-review-${requestId}`, at, by: actorId, status: application.status, comment })
    if (status === 'accepted') {
      const candidate = targetUser(state, application.userId)
      candidate.name = application.name.trim()
      candidate.email = application.email.trim()
      candidate.role = 'member'
      candidate.coreId = application.coreId
    }
    notify(
      application.userId,
      { ru: 'Статус заявки обновлен', kk: 'Өтінім мәртебесі жаңартылды' },
      { ru: comment || status, kk: comment || status },
    )
    return state
  }
  if (action.type === 'updateUser') {
    if (actor.role !== 'admin') fail(403, 'forbidden')
    const user = targetUser(state, payload.id ?? action.userId)
    const reason = requiredReason(action.reason ?? payload.reason)
    const before = `${user.role} / ${user.coreId} / ${user.projectIds.join(', ')}`
    if ('role' in payload) {
      if (!['applicant', 'member', 'manager', 'head', 'admin'].includes(String(payload.role)))
        fail(422, 'invalidRole')
      user.role = payload.role as Role
    }
    if ('coreId' in payload) user.coreId = validCore(payload.coreId)
    if ('projectIds' in payload) {
      const projectIds = payload.projectIds
      if (!Array.isArray(projectIds)) return fail(422, 'notFound')
      if (projectIds.some((id) => !state.projects.some((p) => p.id === id))) fail(422, 'notFound')
      const selected = [...new Set(projectIds.map(String))]
      if (user.role === 'applicant' && selected.length) fail(422, 'invalidAssignee')
      for (const project of state.projects) {
        const members = project.memberIds ?? project.teamIds
        const included = selected.includes(project.id)
        if (included !== members.includes(user.id) ||
          (!included && user.projectIds.includes(project.id))) {
          syncMembers(state, project, included
            ? [...members.filter((id) => id !== user.id), user.id]
            : members.filter((id) => id !== user.id))
        }
      }
      user.projectIds = selected
    }
    const audit = `${before} → ${user.role} / ${user.coreId} / ${user.projectIds.join(', ')}. ${reason}`
    notify(
      user.id,
      { ru: 'Назначения изменены', kk: 'Тағайындаулар өзгертілді' },
      { ru: audit, kk: audit },
    )
    if (user.id !== actorId)
      notify(
        actorId,
        { ru: 'Журнал: назначения изменены', kk: 'Журнал: тағайындаулар өзгертілді' },
        { ru: `${user.name}: ${audit}`, kk: `${user.name}: ${audit}` },
      )
    return state
  }
  if (action.type === 'updateProject') {
    const project = state.projects.find((p) => p.id === payload.id) ?? fail(404, 'notFound')
    if (!managesProject(state, actor, project.id)) fail(403, 'forbidden')
    const before = project.teamIds.join(', ')
    if ('description' in payload) project.description = localized(payload.description)
    if ('teamIds' in payload) {
      const teamIds = payload.teamIds
      if (!Array.isArray(teamIds)) return fail(422, 'required')
      const ids = teamIds.map(String)
      if (ids.some((id) => targetUser(state, id).role === 'applicant')) fail(422, 'invalidAssignee')
      project.teamIds = ids
      project.memberIds = [...ids]
      for (const user of state.users) {
        if (ids.includes(user.id) && !user.projectIds.includes(project.id))
          user.projectIds.push(project.id)
        else if (!ids.includes(user.id))
          user.projectIds = user.projectIds.filter((id) => id !== project.id)
      }
    }
    notify(
      actorId,
      { ru: 'Журнал: проект обновлен', kk: 'Журнал: жоба жаңартылды' },
      {
        ru: `${project.title}: ${before} → ${project.teamIds.join(', ')}`,
        kk: `${project.title}: ${before} → ${project.teamIds.join(', ')}`,
      },
    )
    return state
  }
  if (action.type === 'adjustXP') {
    if (actor.role !== 'admin') fail(403, 'forbidden')
    const user = targetUser(state, action.userId ?? payload.userId)
    const points = Number(action.points ?? payload.points)
    if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 1000)
      fail(422, 'invalidPoints')
    const reason = requiredReason(action.reason ?? payload.reason)
    const id = `adjustment-${requestId}`
    if (state.ledger.some((e) => e.id === id)) return state
    state.ledger.push({
      id,
      userId: user.id,
      points,
      reason: { ru: reason, kk: reason },
      at,
      kind: 'adjustment',
    })
    notify(
      user.id,
      { ru: 'Опыт скорректирован', kk: 'Тәжірибе түзетілді' },
      { ru: reason, kk: reason },
    )
    return state
  }
  if (action.type === 'warning') {
    const user = targetUser(state, action.userId ?? payload.userId)
    if (!managesUser(actor, user)) fail(403, 'forbidden')
    const reason = requiredReason(action.reason ?? payload.reason)
    const id = `warning-${requestId}`
    if (!state.warnings.some((w) => w.id === id))
      state.warnings.push({ id, userId: user.id, reason, by: actorId, at, resolved: false })
    if (!state.notices.some((n) => n.id === `notice-${requestId}-${user.id}`))
      notify(
        user.id,
        { ru: 'Приватное предупреждение', kk: 'Жеке ескерту' },
        { ru: reason, kk: reason },
      )
    return state
  }
  if (action.type === 'resolveWarning') {
    const warning = state.warnings.find((w) => w.id === payload.id) ?? fail(404, 'notFound')
    if (!managesUser(actor, targetUser(state, warning.userId))) fail(403, 'forbidden')
    const reason = requiredReason(action.reason ?? payload.reason)
    if (!warning.resolved) {
      warning.resolved = true
      warning.resolvedReason = reason
      warning.resolvedBy = actorId
      warning.resolvedAt = at
      notify(
        warning.userId,
        { ru: 'Предупреждение снято', kk: 'Ескерту шешілді' },
        { ru: reason, kk: reason },
      )
    }
    return state
  }
  if (action.type === 'readNotice') {
    const notice = state.notices.find((n) => n.id === payload.id) ?? fail(404, 'notFound')
    if (notice.userId !== actorId) fail(403, 'forbidden')
    notice.read = true
    return state
  }
  return fail(422, 'unknownAction')
}
