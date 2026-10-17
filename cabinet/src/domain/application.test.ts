import { describe, expect, it } from 'vitest'
import { applyAction, createInitialState, DEPARTMENTS, emptyApplicationAnswers, scopedState, totalXP, validateFullApplication, type FullApplicationValues } from './index'
const values = (): FullApplicationValues => ({
  name: 'Демо: Кандидат', email: 'test@example.test', school: 'Демо-школа', skills: '', motivation: 'Хочу создавать полезные проекты и работать в команде.',
  answers: { ...emptyApplicationAnswers(), birthDate: '2010-04-12', phone: '+7 (700) 123-45-67', grade: '10', languages: 'Русский, қазақша', hasComputer: 'yes', telegram: '@demo', instagram: '@demo', gender: 'female', location: 'Алматы, Казахстан', departmentIds: ['media','it'], priority1: 'media', priority2: 'it', tools: ['figma'], skillIds: ['graphic-design'], experience: 'Учебный проект', availability: '3to5', additional: 'Дополнений нет', portfolio: [{ id: 'attachment-demo', name: 'portfolio.pdf', type: 'application/pdf', size: 1000, createdAt: '2026-10-09T09:00:00Z' }] },
})
describe('full application validation and review', () => {
  it('keeps accepted candidate identity, project membership and XP aligned through a complete journey', () => {
    let state = applyAction(createInitialState(), 'u-applicant', {type:'application',requestId:'journey-submit',payload:{...values(),formVersion:2,status:'submitted'}})
    state = applyAction(state, 'u-admin', {type:'reviewApplication',requestId:'journey-clarify',payload:{id:'application-01',status:'needs_info',comment:'Уточните опыт участия'}})
    state = applyAction(state, 'u-applicant', {type:'application',requestId:'journey-resubmit',payload:{...values(),formVersion:2,status:'submitted'}})
    state = applyAction(state, 'u-admin', {type:'reviewApplication',requestId:'journey-accept',payload:{id:'application-01',status:'accepted',coreId:'design'}})
    state = applyAction(state, 'u-admin', {type:'updateUser',reason:'Назначение после принятия',payload:{id:'u-applicant',projectIds:['html']}})
    const project = state.projects.find(p=>p.id==='html')!
    expect(project.memberIds).toContain('u-applicant')
    expect(project.teamIds).toContain('u-applicant')
    state = applyAction(state, 'u-admin', {type:'updateProject',payload:{id:'html',memberIds:project.memberIds}})
    expect(state.users.find(u=>u.id==='u-applicant')?.projectIds).toEqual(['html'])
    state = applyAction(state, 'u-admin', {type:'createTask',requestId:'journey-task',payload:{title:{ru:'Демо проверка',kk:'Демо тексеру'},description:{ru:'Проверить подписи',kk:'Жазуларды тексеру'},projectId:'html',assigneeId:'u-applicant',reviewerId:'u-manager',points:10,dueAt:'2026-10-14T18:00:00+05:00'}})
    const taskId = state.tasks.at(-1)!.id
    const revision = () => state.tasks.find(t=>t.id===taskId)!.revision
    const before = totalXP(state,'u-applicant')
    state = applyAction(state,'u-applicant',{type:'start',taskId,revision:revision()})
    state = applyAction(state,'u-applicant',{type:'submit',taskId,revision:revision(),text:'Демо: подготовлены все подписи'})
    state = applyAction(state,'u-manager',{type:'review',taskId,revision:revision(),decision:'returned',reason:'Уточнить казахский перевод',requestId:'journey-return'})
    expect(totalXP(state,'u-applicant')).toBe(before)
    state = applyAction(state,'u-applicant',{type:'submit',taskId,revision:revision(),text:'Демо: казахский перевод уточнён'})
    const approval = {type:'review',taskId,revision:revision(),decision:'approved' as const,requestId:'journey-approve'}
    state = applyAction(state,'u-manager',approval)
    state = applyAction(state,'u-manager',approval)
    expect(totalXP(state,'u-applicant')).toBe(before+10)
    expect(state.tasks.find(t=>t.id===taskId)?.submissions).toHaveLength(2)
    expect(state.ledger.filter(e=>e.taskId===taskId)).toHaveLength(1)
    expect(scopedState(state,'u-applicant').applications).toHaveLength(1)
    expect(scopedState(state,'u-other').applications).toHaveLength(0)
  })
  it('validates all source fields, keeping department IDs distinct from core IDs', () => {
    expect(DEPARTMENTS).toHaveLength(10)
    expect(validateFullApplication(values())).toEqual({})
    const empty = validateFullApplication({ name:'',email:'',school:'',skills:'',motivation:'',answers:emptyApplicationAnswers() })
    expect(empty).toMatchObject({ name:'required', 'answers.portfolio':'required', 'answers.hasComputer':'required', 'answers.additional':'required' })
  })
  it('requires distinct chosen priorities and an explained Other value', () => {
    const v = values()
    v.answers.departmentIds = ['media','it','hr']
    v.answers.priority2 = 'media'
    v.answers.tools = ['other']
    expect(validateFullApplication(v)).toMatchObject({ 'answers.departmentIds':'tooManyDepartments','answers.priority2':'invalidPriorities','answers.toolsOther':'required' })
    v.answers.departmentIds = ['media']; v.answers.priority2 = ''; v.answers.toolsOther = 'Photoshop'
    expect(validateFullApplication(v)).toEqual({})
  })
  it('rejects impossible/future dates, malformed phones, unknown choices and oversized files', () => {
    const v = values()
    v.answers.birthDate = '2010-02-30'; v.answers.phone = 'abc'; v.answers.skillIds = ['admin-access']; v.answers.portfolio[0].size = 20*1024*1024
    expect(validateFullApplication(v)).toMatchObject({ 'answers.birthDate':'invalidDate','answers.phone':'invalidPhone','answers.skillIds':'invalidOption','answers.portfolio':'invalidPortfolio' })
    v.answers.birthDate = '2099-01-01'
    expect(validateFullApplication(v)['answers.birthDate']).toBe('invalidDate')
  })
  it('saves partial drafts but never submits them; full submissions remain unassigned', () => {
    let state = createInitialState()
    state = applyAction(state,'u-applicant',{type:'application',payload:{formVersion:2,status:'draft',answers:emptyApplicationAnswers()}})
    expect(state.applications[0]).toMatchObject({ coreId:'',formVersion:2,status:'draft' })
    expect(() => applyAction(state,'u-applicant',{type:'application',payload:{status:'submitted'}})).toThrow('invalidApplication')
    state = applyAction(state,'u-applicant',{type:'application',requestId:'submit-v2',payload:{...values(),formVersion:2,status:'submitted'}})
    expect(state.applications[0].history).toHaveLength(1)
    expect(scopedState(state,'u-head').applications).toHaveLength(0)
    expect(scopedState(state,'u-admin').applications).toHaveLength(1)
    expect(() => applyAction(state,'u-admin',{type:'reviewApplication',payload:{id:'application-01',status:'accepted'}})).toThrow('invalidCore')
    const accepted = applyAction(state,'u-admin',{type:'reviewApplication',requestId:'accept-v2',payload:{id:'application-01',status:'accepted',coreId:'design'}})
    expect(accepted.users.find(u=>u.id==='u-applicant')).toMatchObject({ role:'member',coreId:'design',name:'Демо: Кандидат' })
    expect(() => applyAction(accepted,'u-admin',{type:'reviewApplication',payload:{id:'application-01',status:'accepted',coreId:'design'}})).toThrow('applicationLocked')
  })
  it('retains the previous answer snapshot and reviewer decision after resubmission', () => {
    let state = applyAction(createInitialState(),'u-applicant',{type:'application',requestId:'first',payload:{...values(),formVersion:2,status:'submitted'}})
    state = applyAction(state,'u-admin',{type:'reviewApplication',requestId:'clarify',payload:{id:'application-01',status:'needs_info',comment:'Уточнить опыт участия'}})
    const next = values(); next.answers.experience = 'Уточнённый учебный проект'
    state = applyAction(state,'u-applicant',{type:'application',requestId:'second',payload:{...next,formVersion:2,status:'submitted'}})
    expect(state.applications[0].history?.map(h=>h.status)).toEqual(['submitted','needs_info','submitted'])
    expect(state.applications[0].history?.[0].snapshot?.answers?.experience).toBe('Учебный проект')
    expect(state.applications[0].history?.[2].snapshot?.answers?.experience).toBe('Уточнённый учебный проект')
  })
  it('validates avatar IDs without permitting role changes or external URL values', () => {
    const initial = createInitialState()
    expect(applyAction(initial,'u-member',{type:'profile',payload:{avatarId:'attachment_123'}}).users[0].avatarId).toBe('attachment_123')
    expect(() => applyAction(initial,'u-member',{type:'profile',payload:{avatarId:'https://example.test/image'}})).toThrow('invalidAvatar')
    expect(() => applyAction(initial,'u-member',{type:'profile',payload:{avatarId:'ok',role:'admin'}})).toThrow('forbidden')
    expect(applyAction(initial,'u-member',{type:'profile',payload:{avatarId:''}}).users[0].avatarId).toBe('')
  })
})
