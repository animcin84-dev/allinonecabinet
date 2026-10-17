# Передача frontend Allinone

10 октября 2026. Это описание существующей демонстрационной реализации и границ будущей интеграции. Сервер здесь не реализован.

## Сборка и проверка

Node.js 24+, `npm ci`, `npm run check`, `npm test`, `npm run build`, `npm run report:bundle`. Выход — `dist`; static ZIP — `verification/allinone-cabinet-static.zip`. Примитивы Base UI, Motion и Recharts уже установлены, лицензии выбранных образцов в `dist/licenses`. Preview запускается только на 127.0.0.1:4319, dev — 127.0.0.1:4318.

SPA должна возвращать `index.html` для маршрутов `/ru/*` и `/kk/*`; существующие assets отдаются как файлы. `public/_redirects` и `vercel.json` содержат соответствующие настройки. Статическая папка не содержит черновиков, пользовательских blob-файлов или browser localStorage.

## Контракт адаптера

Точка замены — `src/services/api.ts`. Интерфейс текущего адаптера:

```ts
state(actor: string, scenario: Scenario): Promise<State>
action(actor: string, action: Action, scenario: Scenario): Promise<State>
```

DEV использует MSW и `httpApi`, production-демо — ленивый `mocks/store`. HTTP-эскиз: `GET /api/state` и `POST /api/action`, JSON. Заголовки `x-demo-actor`/`x-demo-scenario` нужны исключительно симуляции; сервер не должен доверять им или клиентской роли. При настоящей интеграции личность/права берутся из доверенной сессии, а демо-переключатель и сценарии удаляются.

`Action`: `type`, `requestId?`, `taskId?`, `revision?`, `text?`, `url?`, `reason?`, `decision?`, `points?`, `userId?`, `payload?`. Типы полной модели — `src/domain/types.ts`. Локальные правила — `actions.ts`, `workspace.ts`, `access.ts`; это контракт поведения frontend, не серверная защита.

| Действия | Основные данные | Важный результат |
|---|---|---|
| start / submit / review | taskId, revision; text/url; decision/reason/requestId | История отправок/решений, единственное начисление XP |
| createTask / updateTask / archiveTask | payload с RU/KK, projectId, teamId, assigneeId, reviewerId, dueAt, points, category, materialIds; редакция с taskId/revision | Конфликт не затирает введённое; завершённые назначения/награда заблокированы |
| commentTask / editComment / checklistTask | taskId/revision; text/replyTo; id/text; items либо id/done | История собственных правок, без начисления XP |
| createProject / updateProject / archiveProject | id при изменении, title, description RU/KK, coreId, date, lifecycle, category, memberIds, ownerId, clubId, image, archived | Состав синхронизирован с доступом; архив сохраняет историю |
| createTeam / updateTeam / archiveTeam | id, title, description RU/KK, coreId, memberIds, projectIds, leaderId, archived | Команда независима от кора и не выдаёт проектные права |
| createMaterial / updateMaterial / archiveMaterial | id, projectId, title, category, URL **или** file, archived | Материал виден только в разрешённом проекте |
| createMeeting / updateMeeting | id, title RU/KK, projectId, startAt, endAt, place, format, status, demo | Встреча явно демонстрационная, время Asia/Almaty |
| application / reviewApplication | formVersion:2, answers, поля кандидата, draft/submitted; решение, comment, явный coreId при приёме | 22 вопроса, история уточнений, личность кандидата сохраняется |
| profile / manualRank / closeMonth | профиль и avatarId; userId/title/reason; userId/month/w1/w2/reason/demo/confirmed | Ранг отдельно от должности/доступа; месяц закрывается явно и однократно |

Остальные существующие назначения участников, ручные корректировки, предупреждения и прочитанные уведомления также проходят через `action`. Таблица не заменяет исходные TypeScript-типы и валидацию.

HTTP-отказы уже отображаются: 401 — сессия, 403 — доступ, 404 — объект, 409 — устаревшая ревизия/конфликт, 422 — поля/правило, 503 — недоступность. `ApiError` содержит `status`, `message`, `code`; код переводится в `src/locales`. Сохранять пользовательский ввод после отказа и менять UI на успех только после завершения Promise. React Query инвалидирует связанные данные после успешного действия.

## Модель и миграция

Схема 2: `users/projects/tasks/ledger/notices/applications/warnings`, добавлены `teams/materials/meetings/closures`. `Project.teamIds` — старое название массива **участников**, не ID самостоятельных команд; новый `memberIds` синхронизируется с ним для совместимости. Настоящие команды лежат в `State.teams`. XP вычисляется из ledger, ручной ранг хранится отдельно.

localStorage: `allinone-cabinet-demo-v1`, резервная копия `allinone-cabinet-demo-v1-backup`. Перед миграцией сохранена исходная строка; неверная/будущая структура не перезаписывается. Старые заявки остаются историческими, без выдуманного заполнения 22 вопросов. JSON модели не переносится автоматически при смене origin/домена.

Черновики формы, настройки, onboarding и сохранённые виды имеют собственные ключи, виды разделены по пользователю. Фильтры URL сохраняют только разрешённые параметры, не результаты, роли или токены. Календарные месяцы/дни вычисляются в IANA Asia/Almaty, включая исторические изменения часового пояса.

## Файлы

`src/services/local-files.ts`: IndexedDB `allinone-local-files`, версия 1, store `files`. Метаданные `LocalAttachment`: id/name/type/size/createdAt; blob хранится отдельно. Запись Promise завершается на commit транзакции. Ошибка хранения видна пользователю; отсутствующий blob не выдаётся за существующий файл. Object URL создаётся для preview/download и освобождается.

Аватар: JPG/PNG/WebP, до 5 MiB, квадратный JPEG 512px после локальной обработки. Портфолио: изображения/PDF до 10 MiB на файл. Материалы также принимают DOC/DOCX; Office скачивается, не отображается как изображение. Проверяются MIME, расширение, сигнатура и декодирование поддерживаемых изображений. Это не антивирусная обработка и не публичный файловый сервер.

Будущий файловый адаптер должен заменить локальные ID на подтверждённые сервером объекты с областью доступа. Портфолио кандидата не становится автоматически материалом проекта. Браузерные blob URL нельзя отправлять в качестве постоянной публичной ссылки.

## Границы интеграции

Серверной команде понадобятся сессия, авторизация каждого действия/чтения, ревизии и идемпотентность, постоянные файлы, аудит, реальные уведомления и доставка писем. До подключения серверной проверки демоверсия не принимает реальные личные данные. Автоматических санкций W3 нет; W1/W2 и ранги требуют утверждения клуба. Нагрузка показывает числа задач, не часы и не рейтинг продуктивности.

Публичная часть остаётся во Framer. Демо не является источником публичных участников, XP или документов. Пакет контента и переводов: `PUBLIC-CONTENT-RU-KK.md`. Реальный Google Form сохраняется до отдельного решения о настоящем потоке заявок.
