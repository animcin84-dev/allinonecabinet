# Allinone Cabinet

Двуязычный frontend личного кабинета Allinone: русский и қазақша.

**[Открыть кабинет](https://allinone-vercel-deploy-2026-10-17.vercel.app/ru/app)** · [Публичный сайт](https://allinoneclub.framer.website/)

## Запуск

Нужен Node.js 24.x. Исходники приложения находятся в `cabinet/`.

```sh
cd cabinet
npm ci
npm run dev
```

Открыть http://127.0.0.1:4318/ru/app. Казахская версия: `/kk/app`.

```sh
npm test
npm run build
npm run report:bundle
npm run preview
```

## Возможности

Заявка и рассмотрение, профиль/аватар, проекты и команды, задачи и проверка результата, комментарии и checklist, XP и графики, материалы, календарь, уведомления и управление. React 19, TypeScript, Vite, Base UI, Motion и Recharts.

Это frontend-демоверсия. Переключение ролей демонстрирует интерфейс, не является настоящей авторизацией. Изменения хранятся в localStorage/IndexedDB браузера посетителя; backend, общая база и облачное файловое хранилище не подключены.

## Vercel

Root Directory: `cabinet`, Framework: Vite, Build Command: `npm run build`, Output Directory: `dist`. Версия Node.js закреплена в package.json; вложенные маршруты настроены в vercel.json.

Подробности: [README приложения](cabinet/README-RU.md), [контракт frontend](cabinet/FRONTEND-HANDOFF-RU.md), [размещение](cabinet/DEPLOY-RU.md), [лицензии компонентов](cabinet/THIRD-PARTY-NOTICES.md).

В репозиторий не включены зависимости, собранный dist, кэши, ZIP-архивы, проверочные скриншоты, секреты и локальные данные посетителей.
