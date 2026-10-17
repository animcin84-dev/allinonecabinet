import type { Localized, Project, State, Task } from './types'
import { CORES } from './types'

type Entry = { label: Localized; before: unknown; after: unknown; date?: boolean }
const l = (ru: string, kk: string): Localized => ({ ru, kk })
const date = (value: unknown, locale: 'ru' | 'kk') => {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return String(value ?? '—')
  return new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'kk-KZ', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(!/^\d{4}-\d{2}-\d{2}$/.test(value) ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(new Date(value))
}
function details(entries: Entry[]): Localized {
  const changed = entries.filter((e) =>
    e.date
      ? Date.parse(String(e.before)) !== Date.parse(String(e.after))
      : JSON.stringify(e.before) !== JSON.stringify(e.after),
  )
  const display = (value: unknown, locale: 'ru' | 'kk', isDate?: boolean): string => {
    if (isDate) return date(value, locale)
    if (value && typeof value === 'object' && !Array.isArray(value))
      return String((value as Localized)[locale] ?? '—')
    if (Array.isArray(value)) return value.join(', ') || '—'
    return String(value || '—')
  }
  const text = (locale: 'ru' | 'kk') =>
    changed
      .map(
        (e) =>
          `${e.label[locale]}: ${display(e.before, locale, e.date)} → ${display(e.after, locale, e.date)}`,
      )
      .join('\n') ||
    (locale === 'ru'
      ? 'Редакция сохранена. Условия не изменились.'
      : 'Өңдеу сақталды. Шарттар өзгерген жоқ.')
  return { ru: text('ru'), kk: text('kk') }
}
export function taskChanges(state: State, before: Task, after: Task): Localized {
  const user = (id: string) => state.users.find((u) => u.id === id)?.name ?? '—'
  const project = (id: string) => state.projects.find((p) => p.id === id)?.title ?? '—'
  const team = (id?: string) => state.teams?.find((t) => t.id === id)?.title ?? '—'
  const materials = (ids?: string[]) =>
    (ids ?? []).map((id) => state.materials?.find((m) => m.id === id)?.title ?? '—')
  return details([
    { label: l('Название', 'Атауы'), before: before.title, after: after.title },
    { label: l('Описание', 'Сипаттама'), before: before.description, after: after.description },
    {
      label: l('Проект', 'Жоба'),
      before: project(before.projectId),
      after: project(after.projectId),
    },
    {
      label: l('Исполнитель', 'Орындаушы'),
      before: user(before.assigneeId),
      after: user(after.assigneeId),
    },
    {
      label: l('Проверяющий', 'Тексеруші'),
      before: user(before.reviewerId),
      after: user(after.reviewerId),
    },
    {
      label: l('Дедлайн · Алматы', 'Мерзімі · Алматы'),
      before: before.dueAt,
      after: after.dueAt,
      date: true,
    },
    { label: l('Награда XP', 'XP марапаты'), before: before.points, after: after.points },
    { label: l('Команда', 'Команда'), before: team(before.teamId), after: team(after.teamId) },
    { label: l('Категория', 'Санат'), before: before.category, after: after.category },
    {
      label: l('Материалы', 'Материалдар'),
      before: materials(before.materialIds),
      after: materials(after.materialIds),
    },
  ])
}
export function projectChanges(state: State, before: Project, after: Project): Localized {
  const names = (ids: string[]) =>
    ids.map((id) => state.users.find((u) => u.id === id)?.name ?? '—')
  const statuses: Record<string, Localized> = {
    in_progress: l('В работе', 'Орындалуда'),
    completed: l('Завершён', 'Аяқталды'),
    frozen: l('Приостановлен', 'Тоқтатылды'),
    soon: l('Скоро', 'Жақында'),
  }
  const categories: Record<string, Localized> = {
    research: l('Исследования', 'Зерттеулер'),
    diplomacy: l('Дипломатия', 'Дипломатия'),
    digital: l('Цифровые проекты', 'Цифрлық жобалар'),
    community: l('Сообщество', 'Қауымдастық'),
  }
  return details([
    { label: l('Название', 'Атауы'), before: before.title, after: after.title },
    { label: l('Описание', 'Сипаттама'), before: before.description, after: after.description },
    {
      label: l('Кор', 'Бағыт'),
      before: CORES.find((c) => c.id === before.coreId)?.title,
      after: CORES.find((c) => c.id === after.coreId)?.title,
    },
    {
      label: l('Статус', 'Мәртебе'),
      before: statuses[before.lifecycle ?? ''],
      after: statuses[after.lifecycle ?? ''],
    },
    {
      label: l('Категория', 'Санат'),
      before: categories[before.category ?? ''],
      after: categories[after.category ?? ''],
    },
    { label: l('Дата', 'Күні'), before: before.date, after: after.date, date: true },
    {
      label: l('Участники', 'Қатысушылар'),
      before: names(before.teamIds),
      after: names(after.teamIds),
    },
    {
      label: l('Ответственный', 'Жауапты'),
      before: names(before.ownerId ? [before.ownerId] : []),
      after: names(after.ownerId ? [after.ownerId] : []),
    },
    {
      label: l('Клуб', 'Клуб'),
      before: before.clubId ? 'Young Diplomacy' : 'Allinone',
      after: after.clubId ? 'Young Diplomacy' : 'Allinone',
    },
    ...(before.image !== after.image
      ? [
          {
            label: l('Обложка', 'Мұқаба'),
            before: l('Предыдущая', 'Алдыңғы'),
            after: l('Обновлена', 'Жаңартылды'),
          },
        ]
      : []),
  ])
}
