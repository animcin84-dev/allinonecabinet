import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
void i18n
  .use(initReactI18next)
  .init({
    lng: 'ru',
    fallbackLng: 'ru',
    resources: {
      ru: {
        translation: {
          overview: 'Обзор',
          tasks: 'Задачи',
          projects: 'Проекты',
          calendar: 'Календарь',
          team: 'Команда',
          club: 'Young Diplomacy',
          experience: 'Мой опыт',
          profile: 'Профиль',
          settings: 'Настройки',
          manage: 'Управление',
          inbox: 'Уведомления',
        },
      },
      kk: {
        translation: {
          overview: 'Шолу',
          tasks: 'Тапсырмалар',
          projects: 'Жобалар',
          calendar: 'Күнтізбе',
          team: 'Команда',
          club: 'Young Diplomacy',
          experience: 'Менің тәжірибем',
          profile: 'Профиль',
          settings: 'Баптаулар',
          manage: 'Басқару',
          inbox: 'Хабарламалар',
        },
      },
    },
    interpolation: { escapeValue: false },
  })
export default i18n
