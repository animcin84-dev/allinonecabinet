import type { State } from './types'
export const XP_POLICY = {
  policyStatus: 'draft',
  source: 'spreadsheet',
  version: '2026-10-09',
  unresolvedRules: ['rankNaming', 'W3', 'rewardStacking', 'manualRankOverride'],
  rankBands: [
    { name: 'Intern', min: 0, max: 30 },
    { name: 'Novice', min: 30, max: 90 },
    { name: 'Consultant', min: 90, max: 180 },
    { name: 'Senior Consultant', min: 180, max: 540 },
    { name: 'Deputy Manager', min: 540, max: 1024 },
    { name: 'Manager', min: 1024, max: null },
  ],
  rewardCategories: [
    { id: 'standard', title: { ru: 'Стандартная задача', kk: 'Стандартты тапсырма' }, points: 5 },
    { id: 'complex', title: { ru: 'Сложная задача', kk: 'Күрделі тапсырма' }, points: 10 },
    { id: 'urgent', title: { ru: 'Срочная задача', kk: 'Шұғыл тапсырма' }, points: 15 },
    { id: 'early', title: { ru: 'Досрочно', kk: 'Мерзімінен бұрын' }, points: 3 },
    { id: 'clean', title: { ru: 'Период без замечаний', kk: 'Ескертусіз кезең' }, points: 10 },
    { id: 'initiative', title: { ru: 'Инициатива', kk: 'Бастама' }, points: 20 },
    { id: 'lead', title: { ru: 'Руководство проектом', kk: 'Жобаны басқару' }, points: 50 },
    { id: 'participation', title: { ru: 'Участие в проекте', kk: 'Жобаға қатысу' }, points: 15 },
    { id: 'event', title: { ru: 'Мероприятие', kk: 'Іс-шара' }, points: 25 },
    { id: 'partner', title: { ru: 'Партнер / спонсор', kk: 'Серіктес / демеуші' }, points: 25 },
    { id: 'recruit', title: { ru: 'Новый участник', kk: 'Жаңа қатысушы' }, points: 10 },
    { id: 'help', title: { ru: 'Помощь подразделению', kk: 'Бөлімге көмек' }, points: 10 },
    { id: 'document', title: { ru: 'Документ / регламент', kk: 'Құжат / регламент' }, points: 15 },
    { id: 'automation', title: { ru: 'Автоматизация', kk: 'Автоматтандыру' }, points: 25 },
    { id: 'thanks', title: { ru: 'Благодарность', kk: 'Алғыс' }, points: 10 },
  ],
} as const
export function rankFor(points: number): { name: string; min: number; max: number | null } {
  return XP_POLICY.rankBands.find((b) => b.max === null || points < b.max) ?? XP_POLICY.rankBands[5]
}
export function totalXP(state: State, userId: string): number {
  return (
    Math.round(
      state.ledger.filter((e) => e.userId === userId).reduce((sum, e) => sum + e.points, 0) * 10,
    ) / 10
  )
}
/** Spreadsheet preview only; warning mutations do not silently apply this draft formula. */
export function previewMonthlyXP(
  previous: number,
  monthly: number,
  w1: boolean,
  w2: boolean,
): number {
  const deduction = w1 ? Math.min(monthly * 0.3, 100) : 0
  return previous + Math.round((monthly - deduction) * (w2 ? 0.5 : 1) * 10) / 10
}
