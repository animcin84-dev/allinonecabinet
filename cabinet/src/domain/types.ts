export type Locale = 'ru' | 'kk'
export type Role = 'applicant' | 'member' | 'manager' | 'head' | 'admin'
export type Status = 'todo' | 'in_progress' | 'review' | 'done'
export type Localized = { ru: string; kk: string }
export interface User {
  id: string
  name: string
  role: Role
  coreId: string
  projectIds: string[]
  bio: string
  skills: string[]
  email: string
  avatarId?: string
  manualRank?: { title: string; reason: string; by: string; at: string }
}
export type ProjectLifecycle = 'in_progress' | 'completed' | 'frozen' | 'soon'
export type ProjectCategory = 'research' | 'diplomacy' | 'digital' | 'community'
export interface Project {
  id: string
  title: string
  description: Localized
  coreId: string
  image: string
  date: string
  clubId?: string
  teamIds: string[]
  memberIds?: string[]
  facts: Localized[]
  lifecycle?: ProjectLifecycle
  category?: ProjectCategory
  archived?: boolean
  ownerId?: string
  history?: { id: string; at: string; by: string; detail: Localized }[]
}
export interface Submission {
  text: string
  url: string
  at: string
}
export interface Task {
  id: string
  title: Localized
  description: Localized
  projectId: string
  assigneeId: string
  reviewerId: string
  status: Status
  points: number
  dueAt: string
  revision: number
  archived?: boolean
  category?: string
  teamId?: string
  materialIds?: string[]
  history?: { id: string; at: string; by: string; detail: Localized }[]
  checklist?: { id: string; text: string; done: boolean }[]
  comments?: {
    id: string
    text: string
    by: string
    at: string
    replyTo?: string
    edits: { text: string; at: string }[]
  }[]
  submission?: Submission
  submissions?: Submission[]
  reviews: {
    id: string
    decision: 'approved' | 'returned'
    reason: string
    by: string
    at: string
  }[]
}
export interface LedgerEntry {
  id: string
  userId: string
  taskId?: string
  points: number
  reason: Localized
  at: string
  kind: 'award' | 'adjustment'
  decisionId?: string
}
export interface Notice {
  id: string
  userId: string
  title: Localized
  body: Localized
  at: string
  read: boolean
  taskId?: string
  kind?: 'task' | 'application' | 'project' | 'system'
  projectId?: string
}
export interface LocalAttachment {
  id: string
  name: string
  type: string
  size: number
  createdAt: string
}
export interface ApplicationAnswers {
  birthDate: string
  phone: string
  grade: string
  languages: string
  hasComputer: 'yes' | 'no' | ''
  telegram: string
  instagram: string
  gender: 'female' | 'male' | ''
  location: string
  departmentIds: string[]
  priority1: string
  priority2: string
  tools: string[]
  toolsOther: string
  skillIds: string[]
  skillsOther: string
  experience: string
  availability: 'under3' | '3to5' | '5to8' | 'over8' | ''
  additional: string
  portfolio: LocalAttachment[]
}
export interface ApplicationHistoryEntry {
  id: string
  at: string
  by: string
  status: Application['status']
  comment: string
  snapshot?: {
    name: string
    email: string
    school: string
    motivation: string
    skills: string
    coreId: string
    formVersion?: 2
    answers?: ApplicationAnswers
  }
}
export interface Application {
  id: string
  userId: string
  status: 'draft' | 'submitted' | 'reviewing' | 'needs_info' | 'accepted' | 'rejected'
  name: string
  email: string
  school: string
  motivation: string
  coreId: string
  skills: string
  comment: string
  formVersion?: 2
  answers?: ApplicationAnswers
  history?: ApplicationHistoryEntry[]
}
export interface Warning {
  id: string
  userId: string
  reason: string
  by: string
  at: string
  resolved: boolean
  resolvedReason?: string
  resolvedBy?: string
  resolvedAt?: string
}
export interface Team {
  id: string
  title: string
  coreId: string
  memberIds: string[]
  projectIds: string[]
  description?: Localized
  leaderId?: string
  archived?: boolean
}
export interface Material {
  id: string
  projectId: string
  title: string
  category: string
  url?: string
  file?: LocalAttachment
  by: string
  at: string
  archived?: boolean
}
export interface Meeting {
  id: string
  title: Localized
  projectId: string
  startAt: string
  endAt: string
  place: string
  format: 'online' | 'offline'
  status: 'scheduled' | 'cancelled'
  by: string
  demo: true
}
export interface MonthlyClosure {
  id: string
  userId: string
  month: string
  by: string
  at: string
  previous: number
  monthly: number
  result: number
  w1: boolean
  w2: boolean
  demo: true
  reason: string
}
export interface State {
  schemaVersion?: 2
  teams?: Team[]
  materials?: Material[]
  meetings?: Meeting[]
  closures?: MonthlyClosure[]
  users: User[]
  projects: Project[]
  tasks: Task[]
  ledger: LedgerEntry[]
  notices: Notice[]
  applications: Application[]
  warnings: Warning[]
}
export interface Action {
  type: string
  taskId?: string
  revision?: number
  requestId?: string
  text?: string
  url?: string
  reason?: string
  decision?: string
  points?: number
  userId?: string
  payload?: Record<string, unknown>
}
export const CORES = [
  {
    id: 'main',
    title: 'Main Team',
    description: { ru: 'Стратегия и координация', kk: 'Стратегия және үйлестіру' },
  },
  {
    id: 'design',
    title: 'Design & Media',
    description: { ru: 'Дизайн, съемка и коммуникация', kk: 'Дизайн, түсірілім және коммуникация' },
  },
  {
    id: 'partnerships',
    title: 'Partnerships & Resources',
    description: { ru: 'Партнеры и ресурсы', kk: 'Серіктестер және ресурстар' },
  },
  {
    id: 'admin',
    title: 'Administration & IT',
    description: { ru: 'Организация и технологии', kk: 'Ұйымдастыру және технологиялар' },
  },
  {
    id: 'community',
    title: 'HR & Community',
    description: { ru: 'Участники и сообщество', kk: 'Қатысушылар және қауымдастық' },
  },
]
