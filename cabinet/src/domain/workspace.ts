import type { Action, Localized, Project, State, Task, User } from './types'
import { CORES } from './types'
import { DomainError } from './errors'
import { validLocalAttachment } from './application'
import { validMaterialFile } from './file-metadata'
import { previewMonthlyXP } from './policy'
import { projectChanges, taskChanges } from './workspace-history'

const fail = (code: string, status = 422): never => {
  throw new DomainError(status, code)
}
const text = (v: unknown, max = 4000) =>
  typeof v === 'string' && v.trim() && v.trim().length <= max ? v.trim() : fail('required')
const optional = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const localized = (v: unknown): Localized => {
  const x = v as Localized
  return { ru: text(x?.ru), kk: text(x?.kk) }
}
const validDate = (v: unknown) => {
  const x = text(v)
  if (!Number.isFinite(Date.parse(x))) return fail('invalidDate')
  if (
    /^\d{4}-\d{2}-\d{2}/.test(x) &&
    new Date(`${x.slice(0, 10)}T12:00:00Z`).toISOString().slice(0, 10) !== x.slice(0, 10)
  )
    return fail('invalidDate')
  return x
}
const url = (v: unknown) => {
  const x = optional(v)
  if (!x) return ''
  try {
    const u = new URL(x)
    if (['https:', 'http:'].includes(u.protocol) && !u.username && !u.password) return u.href
  } catch {
    /* report below */
  }
  return fail('invalidURL')
}
const core = (v: unknown) => (CORES.some((c) => c.id === v) ? String(v) : fail('invalidCore'))
const ids = (v: unknown) =>
  Array.isArray(v) && v.every((x) => typeof x === 'string')
    ? [...new Set(v as string[])]
    : fail('notFound')
export function canManageProject(state: State, actor: User, projectId: string) {
  const p = state.projects.find((x) => x.id === projectId)
  return (
    !!p &&
    (actor.role === 'admin' ||
      (actor.role === 'head' && p.coreId === actor.coreId) ||
      (actor.role === 'manager' && actor.projectIds.includes(projectId)))
  )
}
export function canManageUser(actor: User, user: User) {
  return (
    actor.role === 'admin' ||
    (actor.role === 'head' &&
      actor.coreId === user.coreId &&
      !['head', 'admin'].includes(user.role))
  )
}
export function isTaskAccessible(state: State, actor: User, task: Task) {
  return task.assigneeId === actor.id || canManageProject(state, actor, task.projectId)
}
export function monthOf(at: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(at))
  return `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}`
}

function members(state: State, value: unknown) {
  const result = ids(value)
  if (result.some((id) => !state.users.some((u) => u.id === id && u.role !== 'applicant')))
    fail('invalidAssignee')
  return result
}
function projectAllowed(state: State, actor: User, id: unknown) {
  const p = state.projects.find((x) => x.id === id) ?? fail('notFound', 404)
  if (!canManageProject(state, actor, p.id)) fail('forbidden', 403)
  return p
}
export function syncMembers(state: State, p: Project, selected: string[]) {
  const removed = p.memberIds ?? p.teamIds
  if (
    state.tasks.some(
      (t) =>
        t.projectId === p.id &&
        !t.archived &&
        t.status !== 'done' &&
        !selected.includes(t.assigneeId),
    )
  )
    fail('activeAssignments')
  p.memberIds = selected
  p.teamIds = [...selected]
  for (const u of state.users) {
    if (selected.includes(u.id) && !u.projectIds.includes(p.id)) u.projectIds.push(p.id)
    else if (removed.includes(u.id) && !selected.includes(u.id))
      u.projectIds = u.projectIds.filter((id) => id !== p.id)
  }
}
/** Mutates only a cloned state. All new frontend workflows share the existing transition boundary. */
export function applyWorkspaceAction(
  state: State,
  actor: User,
  action: Action,
  at: string,
  requestId: string,
): boolean {
  const p = action.payload ?? {}
  const notify = (userId: string, title: Localized, taskId?: string) => {
    const id = `notice-${requestId}-${userId}`
    if (!state.notices.some((n) => n.id === id))
      state.notices.push({
        id,
        userId,
        title,
        body: title,
        at,
        read: false,
        taskId,
        kind: taskId ? 'task' : action.type.includes('Project') ? 'project' : 'system',
        projectId: action.type.includes('Project')
          ? String(p.id ?? `project-${requestId}`)
          : undefined,
      })
  }
  if (['createProject', 'updateProject', 'archiveProject'].includes(action.type)) {
    let project: Project
    if (action.type === 'createProject') {
      if (!['admin', 'head'].includes(actor.role)) fail('forbidden', 403)
      const coreId = core(p.coreId)
      if (actor.role === 'head' && actor.coreId !== coreId) fail('forbidden', 403)
      const id = `project-${requestId}`
      if (state.projects.some((x) => x.id === id)) return true
      project = {
        id,
        title: text(p.title, 160),
        description: localized(p.description),
        coreId,
        image: '',
        date: validDate(p.date).slice(0, 10),
        teamIds: [],
        memberIds: [],
        facts: [],
        lifecycle: 'soon',
        category: 'community',
      }
      state.projects.push(project)
    } else project = projectAllowed(state, actor, p.id)
    const before = structuredClone(project)
    const record = (ru: string, kk: string) =>
      (project.history ??= []).push({ id: requestId, at, by: actor.id, detail: { ru, kk } })
    if (action.type === 'archiveProject') {
      if (typeof p.archived !== 'boolean') fail('required')
      project.archived = p.archived === true
      record(
        project.archived ? 'Проект архивирован' : 'Проект восстановлен',
        project.archived ? 'Жоба мұрағатталды' : 'Жоба қалпына келтірілді',
      )
      return true
    }
    if (project.archived) fail('archived')
    if ('title' in p) project.title = text(p.title, 160)
    if ('description' in p) project.description = localized(p.description)
    if ('coreId' in p && p.coreId !== project.coreId) {
      if (actor.role !== 'admin') fail('forbidden', 403)
      project.coreId = core(p.coreId)
    }
    if ('lifecycle' in p) {
      if (!['in_progress', 'completed', 'frozen', 'soon'].includes(String(p.lifecycle)))
        fail('invalidDecision')
      project.lifecycle = p.lifecycle as Project['lifecycle']
    }
    if ('category' in p) {
      if (!['research', 'diplomacy', 'digital', 'community'].includes(String(p.category)))
        fail('invalidDecision')
      project.category = p.category as Project['category']
    }
    if ('date' in p) project.date = validDate(p.date).slice(0, 10)
    if ('image' in p) project.image = url(p.image)
    if ('clubId' in p) {
      if (p.clubId && p.clubId !== 'young-diplomacy') fail('notFound')
      project.clubId = optional(p.clubId) || undefined
    }
    if ('memberIds' in p || 'teamIds' in p)
      syncMembers(state, project, members(state, p.memberIds ?? p.teamIds))
    if ('ownerId' in p) {
      const owner = optional(p.ownerId)
      if (owner && !state.users.some((u) => u.id === owner && u.role !== 'applicant'))
        fail('invalidAssignee')
      project.ownerId = owner || undefined
    }
    const changes = projectChanges(state, before, project)
    record(changes.ru, changes.kk)
    notify(actor.id, {
      ru: `Проект обновлён: ${project.title}`,
      kk: `Жоба жаңартылды: ${project.title}`,
    })
    return true
  }
  if (['createTeam', 'updateTeam', 'archiveTeam'].includes(action.type)) {
    const teams = (state.teams ??= [])
    const existing = teams.find((t) => t.id === p.id)
    const coreId =
      action.type === 'createTeam' ? core(p.coreId) : (existing?.coreId ?? fail('notFound', 404))
    if (!(
      actor.role === 'admin' ||
      (actor.role === 'head' && coreId === actor.coreId) ||
      (actor.role === 'manager' && existing?.leaderId === actor.id)
    ))
      fail('forbidden', 403)
    if (action.type === 'archiveTeam') {
      if (typeof p.archived !== 'boolean') fail('required')
      existing!.archived = p.archived === true
      return true
    }
    if (existing?.archived) fail('archived')
    const selected = members(state, p.memberIds)
    const projectIds = ids(p.projectIds)
    if (projectIds.some((id) => !canManageProject(state, actor, id))) fail('forbidden', 403)
    const leaderId = text(p.leaderId)
    if (!selected.includes(leaderId)) fail('invalidAssignee')
    const next = {
      id: existing?.id ?? `team-${requestId}`,
      title: text(p.title, 160),
      description: localized(p.description),
      coreId,
      memberIds: selected,
      projectIds,
      leaderId,
      archived: existing?.archived ?? false,
    }
    if (existing) Object.assign(existing, next)
    else if (!teams.some((t) => t.id === next.id)) teams.push(next)
    return true
  }
  if (
    ['updateTask', 'archiveTask', 'commentTask', 'editComment', 'checklistTask'].includes(
      action.type,
    )
  ) {
    const task = state.tasks.find((t) => t.id === (action.taskId ?? p.id)) ?? fail('notFound', 404)
    if (!isTaskAccessible(state, actor, task)) fail('forbidden', 403)
    if (action.revision !== task.revision) fail('conflict', 409)
    const manager = canManageProject(state, actor, task.projectId)
    if (['updateTask', 'archiveTask'].includes(action.type) && !manager) fail('forbidden', 403)
    if (
      (task.archived || state.projects.find((p) => p.id === task.projectId)?.archived) &&
      action.type !== 'archiveTask'
    )
      fail('archived')
    const event = (ru: string, kk: string) =>
      (task.history ??= []).push({ id: requestId, at, by: actor.id, detail: { ru, kk } })
    if (action.type === 'archiveTask') {
      if (typeof p.archived !== 'boolean') fail('required')
      task.archived = p.archived === true
      event(
        task.archived ? 'Задача архивирована' : 'Задача восстановлена',
        task.archived ? 'Тапсырма мұрағатталды' : 'Тапсырма қалпына келтірілді',
      )
    }
    if (action.type === 'updateTask') {
      const destination = String(p.projectId ?? task.projectId)
      const project = projectAllowed(state, actor, destination)
      if (project.archived) fail('archived')
      const assigneeId = String(p.assigneeId ?? task.assigneeId),
        reviewerId = String(p.reviewerId ?? task.reviewerId)
      const assignee = state.users.find((u) => u.id === assigneeId)
      const reviewer = state.users.find((u) => u.id === reviewerId)
      if (!assignee || assignee.role === 'applicant' || !assignee.projectIds.includes(destination))
        fail('invalidAssignee')
      if (!reviewer || assigneeId === reviewerId || !canManageProject(state, reviewer, destination))
        fail('invalidReviewer')
      if (
        task.status === 'done' &&
        (assigneeId !== task.assigneeId ||
          destination !== task.projectId ||
          ('points' in p && Number(p.points) !== task.points))
      )
        fail('completedTaskLocked')
      const before = structuredClone(task)
      if ('title' in p) task.title = localized(p.title)
      if ('description' in p) task.description = localized(p.description)
      if ('dueAt' in p) task.dueAt = validDate(p.dueAt)
      if ('points' in p) {
        const points = Number(p.points)
        if (![5, 10, 15].includes(points)) fail('invalidPoints')
        task.points = points
      }
      if ('teamId' in p) {
        const teamId = optional(p.teamId)
        if (
          teamId &&
          !state.teams?.some(
            (t) => t.id === teamId && !t.archived && t.projectIds.includes(destination),
          )
        )
          fail('notFound')
        task.teamId = teamId || undefined
      }
      if ('category' in p) task.category = optional(p.category).slice(0, 80)
      if ('materialIds' in p) {
        const selected = ids(p.materialIds)
        if (
          selected.some(
            (id) =>
              !state.materials?.some(
                (m) => m.id === id && m.projectId === destination && !m.archived,
              ),
          )
        )
          fail('notFound')
        task.materialIds = selected
      }
      Object.assign(task, { projectId: destination, assigneeId, reviewerId })
      const changes = taskChanges(state, before, task)
      event(changes.ru, changes.kk)
      for (const id of new Set([assigneeId, reviewerId]))
        notify(id, { ru: 'Условия задачи обновлены', kk: 'Тапсырма шарттары жаңартылды' }, task.id)
    }
    if (action.type === 'commentTask') {
      const comments = (task.comments ??= [])
      const replyTo = optional(p.replyTo)
      if (replyTo && !comments.some((c) => c.id === replyTo)) fail('notFound')
      if (!comments.some((c) => c.id === requestId))
        comments.push({
          id: requestId,
          text: text(p.text),
          by: actor.id,
          at,
          replyTo: replyTo || undefined,
          edits: [],
        })
      for (const id of new Set([task.assigneeId, task.reviewerId]))
        if (
          id !== actor.id &&
          state.users.some((u) => u.id === id && isTaskAccessible(state, u, task))
        )
          notify(id, { ru: 'Новый комментарий к задаче', kk: 'Тапсырмаға жаңа пікір' }, task.id)
    }
    if (action.type === 'editComment') {
      const comment = task.comments?.find((c) => c.id === p.id) ?? fail('notFound', 404)
      if (comment.by !== actor.id) fail('forbidden', 403)
      const next = text(p.text)
      if (comment.text !== next) {
        comment.edits.push({ text: comment.text, at })
        comment.text = next
      }
    }
    if (action.type === 'checklistTask') {
      if ('items' in p) {
        if (!manager) fail('forbidden', 403)
        if (!Array.isArray(p.items) || p.items.length > 50) fail('required')
        const old = task.checklist ?? []
        const next = (p.items as { id?: string; text?: string }[]).map((x, i) => {
          if (!x || typeof x !== 'object') return fail('required')
          return {
            id: optional(x.id) || `${requestId}-${i}`,
            text: text(x.text, 300),
            done: old.find((o) => o.id === x.id)?.done ?? false,
          }
        })
        task.checklist = next
        if (new Set(next.map((x) => x.id)).size !== next.length) fail('required')
      } else {
        if (!manager && task.assigneeId !== actor.id) fail('forbidden', 403)
        const item = task.checklist?.find((x) => x.id === p.id) ?? fail('notFound', 404)
        if (typeof p.done !== 'boolean') fail('required')
        item.done = p.done as boolean
      }
    }
    task.revision++
    return true
  }
  if (action.type === 'manualRank') {
    const user = state.users.find((u) => u.id === p.userId) ?? fail('notFound', 404)
    if (!canManageUser(actor, user)) fail('forbidden', 403)
    const reason = text(p.reason)
    if (reason.length < 5) fail('reasonRequired')
    user.manualRank = { title: text(p.title, 80), reason, by: actor.id, at }
    notify(user.id, {
      ru: `Назначен ручной ранг: ${user.manualRank.title}`,
      kk: `Қолмен берілген дәреже: ${user.manualRank.title}`,
    })
    return true
  }
  if (['createMaterial', 'updateMaterial', 'archiveMaterial'].includes(action.type)) {
    const materials = (state.materials ??= [])
    const existing = materials.find((m) => m.id === p.id)
    const projectId =
      action.type === 'createMaterial'
        ? text(p.projectId)
        : (existing?.projectId ?? fail('notFound', 404))
    const project = projectAllowed(state, actor, projectId)
    if (action.type === 'archiveMaterial') {
      if (typeof p.archived !== 'boolean') fail('required')
      existing!.archived = p.archived === true
      return true
    }
    if (existing?.archived) fail('archived')
    if (project.archived) fail('archived')
    const link = url(p.url)
    if (p.file && !validLocalAttachment(p.file) && !validMaterialFile(p.file))
      fail('invalidPortfolio')
    if ((!link && !p.file) || (link && p.file)) fail('required')
    const next = {
      id: existing?.id ?? `material-${requestId}`,
      projectId,
      title: text(p.title, 160),
      category: text(p.category, 80),
      url: link || undefined,
      file: p.file as import('./types').LocalAttachment | undefined,
      by: existing?.by ?? actor.id,
      at: existing?.at ?? at,
      archived: existing?.archived ?? false,
    }
    if (existing) Object.assign(existing, next)
    else if (!materials.some((m) => m.id === next.id)) materials.push(next)
    return true
  }
  if (['createMeeting', 'updateMeeting'].includes(action.type)) {
    const meetings = (state.meetings ??= [])
    const existing = meetings.find((m) => m.id === p.id)
    if (action.type === 'updateMeeting' && !existing) fail('notFound', 404)
    const projectId = text(p.projectId ?? existing?.projectId)
    if (existing) projectAllowed(state, actor, existing.projectId)
    if (projectAllowed(state, actor, projectId).archived) fail('archived')
    const startAt = validDate(p.startAt),
      endAt = validDate(p.endAt)
    if (Date.parse(endAt) <= Date.parse(startAt)) fail('invalidDate')
    if (
      !['online', 'offline'].includes(String(p.format)) ||
      !['scheduled', 'cancelled'].includes(String(p.status))
    )
      fail('invalidDecision')
    const next = {
      id: existing?.id ?? `meeting-${requestId}`,
      title: localized(p.title),
      projectId,
      startAt,
      endAt,
      place: p.format === 'online' ? url(p.place) : text(p.place, 300),
      format: p.format as 'online' | 'offline',
      status: p.status as 'scheduled' | 'cancelled',
      by: existing?.by ?? actor.id,
      demo: true as const,
    }
    if (existing) Object.assign(existing, next)
    else if (!meetings.some((m) => m.id === next.id)) meetings.push(next)
    return true
  }
  if (action.type === 'closeMonth') {
    if (actor.role !== 'admin') fail('forbidden', 403)
    const user = state.users.find((u) => u.id === p.userId) ?? fail('notFound', 404)
    const month = text(p.month)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month >= monthOf(at)) fail('invalidDate')
    if (
      p.confirmed !== true ||
      p.demo !== true ||
      typeof p.w1 !== 'boolean' ||
      typeof p.w2 !== 'boolean'
    )
      fail('invalidDecision')
    const reason = text(p.reason)
    if (reason.length < 5) fail('reasonRequired')
    const closures = (state.closures ??= []),
      id = `closure-${user.id}-${month}`
    const previousClosure = closures.find((c) => c.id === id)
    if (previousClosure) {
      if (previousClosure.w1 !== p.w1 || previousClosure.w2 !== p.w2) fail('conflict', 409)
      return true
    }
    const entries = state.ledger.filter((e) => e.userId === user.id)
    const previous = entries
      .filter((e) => monthOf(e.at) < month)
      .reduce((sum, e) => sum + e.points, 0)
    const monthly = entries
      .filter((e) => monthOf(e.at) === month)
      .reduce((sum, e) => sum + e.points, 0)
    if (monthly < 0) fail('invalidPoints')
    const result = previewMonthlyXP(previous, monthly, p.w1 as boolean, p.w2 as boolean),
      correction = Math.round((result - previous - monthly) * 10) / 10
    closures.push({
      id,
      userId: user.id,
      month,
      by: actor.id,
      at,
      previous,
      monthly,
      result,
      w1: p.w1 as boolean,
      w2: p.w2 as boolean,
      demo: true,
      reason,
    })
    if (correction)
      state.ledger.push({
        id,
        userId: user.id,
        points: correction,
        reason: { ru: `Демо-закрытие ${month}: ${reason}`, kk: `${month} демо жабу: ${reason}` },
        kind: 'adjustment',
        at,
      })
    return true
  }
  return false
}
