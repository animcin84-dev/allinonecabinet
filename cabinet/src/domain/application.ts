import type { ApplicationAnswers, LocalAttachment } from './types'
const option = (id: string, ru: string, kk: string, dr = ru, dk = kk) => ({ id, title: { ru, kk }, description: { ru: dr, kk: dk } })
export const DEPARTMENTS = [
  option('media', 'Media & Design', 'Медиа және дизайн', 'Дизайн, фото, видео и контент', 'Дизайн, фото, видео және контент'),
  option('pr', 'PR', 'PR', 'Продвижение и внешние коммуникации', 'Ілгерілету және сыртқы коммуникация'),
  option('partnerships', 'Partnerships', 'Серіктестік', 'Партнёры и сотрудничество', 'Серіктестер және ынтымақтастық'),
  option('finance', 'Finance', 'Қаржы', 'Бюджет и финансовое планирование', 'Бюджет және қаржылық жоспарлау'),
  option('hr', 'HR', 'HR', 'Поддержка и развитие участников', 'Қатысушыларды қолдау және дамыту'),
  option('recruitment', 'Recruitment', 'Қатысушыларды қабылдау', 'Набор новых участников', 'Жаңа қатысушыларды қабылдау'),
  option('community', 'Community', 'Қауымдастық', 'Сообщество и вовлечение', 'Қауымдастық және белсенді қатысу'),
  option('quality', 'Standards & Quality', 'Стандарттар және сапа', 'Качество работы и результатов', 'Жұмыс пен нәтижелердің сапасы'),
  option('administration', 'Administration', 'Әкімшілік', 'Документы и организационная работа', 'Құжаттар және ұйымдастыру жұмысы'),
  option('it', 'IT', 'IT', 'Сайт, техническая поддержка и автоматизация', 'Сайт, техникалық қолдау және автоматтандыру'),
]
export const TOOLS = [option('canva', 'Canva', 'Canva'), option('capcut', 'CapCut', 'CapCut'), option('figma', 'Figma', 'Figma'), option('docs', 'Google Docs', 'Google Docs'), option('sheets', 'Google Sheets', 'Google Sheets'), option('notion', 'Notion', 'Notion'), option('other', 'Другое', 'Басқа')]
export const SKILLS = [
  option('leadership', 'Лидерство', 'Көшбасшылық'), option('communication', 'Коммуникация', 'Коммуникация'),
  option('project-management', 'Управление проектами', 'Жобаларды басқару'), option('organization', 'Организация и управление временем', 'Ұйымдастыру және уақытты басқару'),
  option('public-speaking', 'Публичные выступления', 'Көпшілік алдында сөйлеу'), option('research', 'Исследования', 'Зерттеу'),
  option('graphic-design', 'Графический дизайн', 'Графикалық дизайн'), option('video-editing', 'Видеомонтаж', 'Бейнемонтаж'),
  option('social-media', 'Ведение социальных сетей', 'Әлеуметтік желілерді жүргізу'), option('negotiation', 'Переговоры', 'Келіссөздер'),
  option('teamwork', 'Командная работа', 'Командалық жұмыс'), option('problem-solving', 'Решение проблем', 'Мәселелерді шешу'),
  option('data-analysis', 'Анализ данных', 'Деректерді талдау'), option('google-workspace', 'Google Workspace (Docs, Sheets, Forms, Drive)', 'Google Workspace (Docs, Sheets, Forms, Drive)'),
  option('notion', 'Notion', 'Notion'), option('event-management', 'Организация мероприятий', 'Іс-шараларды ұйымдастыру'),
  option('web-development', 'Веб-разработка', 'Веб-әзірлеу'), option('writing', 'Написание текстов', 'Мәтін жазу'),
  option('sponsorship', 'Привлечение спонсоров', 'Демеушілерді тарту'), option('finance-management', 'Управление финансами', 'Қаржыны басқару'),
  option('logistics', 'Логистика', 'Логистика'), option('multilingual', 'Многоязычная коммуникация', 'Көптілді коммуникация'), option('other', 'Другое', 'Басқа'),
]
export function emptyApplicationAnswers(): ApplicationAnswers {
  return { birthDate: '', phone: '', grade: '', languages: '', hasComputer: '', telegram: '', instagram: '', gender: '', location: '', departmentIds: [], priority1: '', priority2: '', tools: [], toolsOther: '', skillIds: [], skillsOther: '', experience: '', availability: '', additional: '', portfolio: [] }
}
export interface FullApplicationValues { name: string; email: string; school: string; motivation: string; skills: string; answers: ApplicationAnswers }
export const APPLICATION_PORTFOLIO_LIMIT = 5
export const APPLICATION_FILE_LIMIT = 10 * 1024 * 1024
export const APPLICATION_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export function validLocalAttachment(value: unknown): value is LocalAttachment {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && !!v.id.trim() && typeof v.name === 'string' && !!v.name.trim() && typeof v.type === 'string' && APPLICATION_FILE_TYPES.includes(v.type) && typeof v.size === 'number' && Number.isFinite(v.size) && v.size > 0 && v.size <= APPLICATION_FILE_LIMIT && typeof v.createdAt === 'string' && Number.isFinite(Date.parse(v.createdAt))
}
/** All 22 source questions are required. With one department, second priority is explicitly unused. */
export function validateFullApplication(values: FullApplicationValues, today = new Date()): Record<string, string> {
  const errors: Record<string, string> = {}
  const required = (path: string, value: unknown) => { if (typeof value !== 'string' || !value.trim()) errors[path] = 'required' }
  const a = values.answers ?? emptyApplicationAnswers()
  for (const key of ['name', 'school', 'email', 'motivation'] as const) required(key, values[key])
  if (values.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'invalidEmail'
  if (values.motivation?.trim() && values.motivation.trim().length < 20) errors.motivation = 'motivationTooShort'
  for (const key of ['birthDate', 'phone', 'grade', 'languages', 'telegram', 'instagram', 'location', 'experience', 'additional'] as const) required(`answers.${key}`, a[key])
  const date = new Date(`${a.birthDate}T00:00:00Z`)
  if (a.birthDate && (!/^\d{4}-\d{2}-\d{2}$/.test(a.birthDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== a.birthDate || a.birthDate > today.toISOString().slice(0, 10))) errors['answers.birthDate'] = 'invalidDate'
  if (a.phone && (!/^[+\d\s().-]+$/.test(a.phone) || a.phone.replace(/\D/g, '').length < 7 || a.phone.replace(/\D/g, '').length > 20)) errors['answers.phone'] = 'invalidPhone'
  for (const [key, options] of [['hasComputer', ['yes', 'no']], ['gender', ['female', 'male']], ['availability', ['under3', '3to5', '5to8', 'over8']]] as const) if (!options.includes(a[key] as never)) errors[`answers.${key}`] = a[key] ? 'invalidOption' : 'required'
  const departments = Array.isArray(a.departmentIds) ? a.departmentIds : []
  if (!departments.length) errors['answers.departmentIds'] = 'required'
  else if (departments.length > 2) errors['answers.departmentIds'] = 'tooManyDepartments'
  else if (new Set(departments).size !== departments.length || departments.some(id => !DEPARTMENTS.some(d => d.id === id))) errors['answers.departmentIds'] = 'invalidOption'
  if (!a.priority1) errors['answers.priority1'] = 'required'
  else if (!departments.includes(a.priority1)) errors['answers.priority1'] = 'invalidPriorities'
  if (departments.length === 2 && !a.priority2) errors['answers.priority2'] = 'required'
  else if (a.priority2 && (!departments.includes(a.priority2) || a.priority1 === a.priority2)) errors['answers.priority2'] = 'invalidPriorities'
  for (const [key, otherKey, choices] of [['tools', 'toolsOther', TOOLS], ['skillIds', 'skillsOther', SKILLS]] as const) {
    const ids = Array.isArray(a[key]) ? a[key] : []
    if (!ids.length) errors[`answers.${key}`] = 'required'
    else if (new Set(ids).size !== ids.length || ids.some(id => !choices.some(c => c.id === id))) errors[`answers.${key}`] = 'invalidOption'
    if (ids.includes('other')) required(`answers.${otherKey}`, a[otherKey])
  }
  if (!Array.isArray(a.portfolio) || !a.portfolio.length) errors['answers.portfolio'] = 'required'
  else if (a.portfolio.length > APPLICATION_PORTFOLIO_LIMIT || a.portfolio.some(p => !validLocalAttachment(p)) || new Set(a.portfolio.map(p => p.id)).size !== a.portfolio.length) errors['answers.portfolio'] = 'invalidPortfolio'
  return errors
}
export function normalizeApplicationAnswers(value: unknown): ApplicationAnswers {
  const result = emptyApplicationAnswers()
  if (!value || typeof value !== 'object') return result
  const source = value as Record<string, unknown>
  for (const key of Object.keys(result) as (keyof ApplicationAnswers)[]) {
    if (key === 'portfolio') result.portfolio = Array.isArray(source.portfolio) ? source.portfolio.filter(validLocalAttachment).map(p => ({ ...p })) : []
    else if (key === 'departmentIds' || key === 'tools' || key === 'skillIds') result[key] = Array.isArray(source[key]) ? source[key].filter((item): item is string => typeof item === 'string').slice(0, 30) : []
    else if (typeof source[key] === 'string') (result as unknown as Record<string, unknown>)[key] = source[key].slice(0, 10000)
  }
  return result
}
