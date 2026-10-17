# Исходники Allinone · личный кабинет

Это React/TypeScript frontend с RU/ҚАЗ и локальными демонстрационными данными. Публичный сайт остаётся во Framer и не является частью React-исходников.

Опубликованный кабинет: https://allinone-vercel-deploy-2026-10-17.vercel.app/ru/app

## Запуск после распаковки

Нужен установленный Node.js 24.x. Перейти в папку `cabinet`, затем:

```sh
npm ci
npm run dev
```

Локальный адрес: http://127.0.0.1:4318/ru/app.

Проверка и production-сборка:

```sh
npm test
npm run build
npm run report:bundle
npm run preview
```

Preview: http://127.0.0.1:4319/ru/app. Vercel: корневая папка `cabinet`, preset Vite, build `npm run build`, output `dist`; SPA-маршруты заданы в `vercel.json`.

## Состав архива

Включены `src`, тесты, `public`, скрипты, package.json/package-lock.json, конфигурация TypeScript/Vite/Vercel, инструкции и лицензии. Lock-файл нужен для восстановления зависимостей через `npm ci`.

Исключены Node.js, `node_modules`, `dist`, кэши, `.git`, `.vercel`, `.env`, прежние ZIP, проверочные скриншоты и данные браузера. Реальные аккаунты, серверная база и облачные файлы не подключены. Действия сохраняются только в браузере посетителя; локальное демо не переносится автоматически на новый домен.
