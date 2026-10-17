import type { State, Task, Localized, User } from './types'
const l = (ru: string, kk: string): Localized => ({ ru, kk })
const user = (
  id: string,
  name: string,
  role: User['role'],
  coreId: string,
  projectIds: string[],
): User => ({
  id,
  name: `Демо: ${name}`,
  role,
  coreId,
  projectIds,
  bio: '',
  skills: ['Design', 'Teamwork'],
  email: `${id}@example.test`,
})
const task = (
  id: string,
  title: Localized,
  status: Task['status'],
  projectId = 'html',
  assigneeId = 'u-member',
  points = 10,
  dueAt = '2026-10-11T13:00:00+05:00',
): Task => {
  const submission =
    status === 'review'
      ? {
          text: 'Демонстрационный результат подготовлен. Проверьте структуру, доступность и двуязычную версию.',
          url: 'https://example.com/demo',
          at: '2026-10-08T09:00:00Z',
        }
      : undefined
  return {
    id,
    title,
    description: l(
      'Подготовить результат и приложить описание работы. Это демонстрационная задача, не реальное поручение клуба.',
      'Нәтижені дайындап, жұмыс сипаттамасын тіркеңіз. Бұл клубтың нақты тапсырмасы емес, демонстрациялық тапсырма.',
    ),
    projectId,
    assigneeId,
    reviewerId: 'u-manager',
    status,
    points,
    dueAt,
    revision: 1,
    reviews: [],
    submission,
    submissions: submission ? [{ ...submission }] : [],
  }
}
export function createInitialState(): State {
  return {
    schemaVersion: 2,
    teams: [],
    users: [
      user('u-member', 'Алина', 'member', 'design', ['html', 'yrt', 'aspan']),
      user('u-manager', 'Данияр', 'manager', 'main', ['html', 'yrt']),
      user('u-head', 'Мадина', 'head', 'design', ['html']),
      user('u-admin', 'Алекс', 'admin', 'admin', ['html', 'yrt', 'amuse', 'aspan']),
      user('u-applicant', 'Кандидат', 'applicant', '', []),
      user('u-other', 'Артем', 'member', 'design', ['html', 'yrt']),
      user('u-club', 'София', 'member', 'community', ['aspan']),
    ],
    projects: [
      {
        id: 'html',
        title: 'HTML Challenge 2026',
        description: l(
          'Командный конкурс веб-разработки. Исторический проект; задачи кабинета демонстрационные.',
          'Веб-әзірлеу бойынша командалық байқау. Өткен жоба; кабинет тапсырмалары демонстрациялық.',
        ),
        coreId: 'design',
        image: '',
        date: '2026-09-30',
        teamIds: ['u-member', 'u-manager', 'u-head', 'u-other'],
        memberIds: ['u-member', 'u-manager', 'u-head', 'u-other'],
        facts: [
          l('Август — сентябрь 2026', 'Тамыз — қыркүйек 2026'),
          l('28 команд, по 1–3 человека', '28 команда, әрқайсысында 1–3 адам'),
          l('Призовой фонд 400 000 ₸', 'Жүлде қоры 400 000 ₸'),
        ],
      },
      {
        id: 'yrt',
        title: 'Young Researchers Tournament',
        description: l(
          'Исследовательский турнир школьников: зимний и летний сезоны 2026.',
          'Оқушыларға арналған зерттеу турнирі: 2026 жылғы қысқы және жазғы маусымдар.',
        ),
        coreId: 'main',
        image: '',
        date: '2026-07-10',
        teamIds: ['u-member', 'u-manager', 'u-other'],
        memberIds: ['u-member', 'u-manager', 'u-other'],
        facts: [
          l('Зима: 7–8 февраля, РФМШ, 204 участника', 'Қыс: 7–8 ақпан, РФМШ, 204 қатысушы'),
          l('Лето: 7–10 июля, KIMEP', 'Жаз: 7–10 шілде, KIMEP'),
          l(
            '627 участников отбора, 145 основного этапа летом',
            'Жазда іріктеуде 627, негізгі кезеңде 145 қатысушы',
          ),
        ],
      },
      {
        id: 'amuse',
        title: 'AMUSE MUN',
        description: l(
          'Модель ООН в Алматы. Три комитета, три рабочих языка.',
          'Алматыдағы БҰҰ моделі. Үш комитет, үш жұмыс тілі.',
        ),
        coreId: 'main',
        image: 'https://framerusercontent.com/images/Nts1ep55LOYwzaQNn010J7PaR4A.webp',
        date: '2026-05-03',
        teamIds: ['u-admin'],
        memberIds: ['u-admin'],
        facts: [
          l('3 мая 2026, Бөбек, Алматы', '3 мамыр 2026, Бөбек, Алматы'),
          l('Около 60 делегатов', 'Шамамен 60 делегат'),
          l('ECOSOC · UNICEF · UNSC', 'ECOSOC · UNICEF · UNSC'),
        ],
      },
      {
        id: 'aspan',
        title: 'Aspan MUN',
        description: l(
          'Конференция Young Diplomacy Club совместно с Unity. Архив мероприятия.',
          'Young Diplomacy Club және Unity бірлескен конференциясы. Іс-шара мұрағаты.',
        ),
        coreId: 'community',
        image: 'https://framerusercontent.com/images/Upr7MV9qAgi3RfcHiA1L400DpWo.webp',
        date: '2026-03-29',
        clubId: 'young-diplomacy',
        teamIds: ['u-member', 'u-club', 'u-admin'],
        memberIds: ['u-member', 'u-club', 'u-admin'],
        facts: [
          l(
            '29 марта 2026, Kunaev University, Алматы',
            '29 наурыз 2026, Kunaev University, Алматы',
          ),
          l('250 делегатов', '250 делегат'),
          l('7 комитетов: 6 очно, 1 онлайн', '7 комитет: 6 офлайн, 1 онлайн'),
        ],
      },
    ],
    tasks: [
      task(
        'task-01',
        l('Собрать двуязычный медиакит', 'Екі тілдегі медиакитті жинау'),
        'in_progress',
      ),
      task(
        'task-02',
        l('Проверить мобильные макеты', 'Мобильді макеттерді тексеру'),
        'review',
        'html',
        'u-member',
        15,
      ),
      task(
        'task-03',
        l('Описать итоги летнего YRT', 'Жазғы YRT қорытындысын сипаттау'),
        'todo',
        'yrt',
        'u-member',
        5,
        '2026-10-14T18:00:00+05:00',
      ),
      task(
        'task-04',
        l('Подготовить архив конференции', 'Конференция мұрағатын дайындау'),
        'todo',
        'aspan',
        'u-member',
        10,
        '2026-10-18T18:00:00+05:00',
      ),
      {
        ...task('task-05', l('Подготовить структуру страницы', 'Бет құрылымын дайындау'), 'done'),
        reviews: [
          {
            id: 'seed-approved',
            decision: 'approved',
            reason: 'Демо: структура принята',
            by: 'u-manager',
            at: '2026-10-07T09:00:00Z',
          },
        ],
      },
      task(
        'task-06',
        l('Проверить контраст карточек', 'Карточкалардың контрастын тексеру'),
        'review',
        'html',
        'u-other',
        10,
        '2026-10-10T12:00:00+05:00',
      ),
      task(
        'task-07',
        l('Собрать материалы партнеров', 'Серіктестер материалдарын жинау'),
        'in_progress',
        'yrt',
        'u-other',
        5,
      ),
      {
        ...task(
          'task-08',
          l('Согласовать план команды', 'Команда жоспарын келісу'),
          'review',
          'html',
          'u-manager',
          10,
        ),
        reviewerId: 'u-head',
      },
      {
        ...task(
          'task-09',
          l('Описать комитеты Aspan', 'Aspan комитеттерін сипаттау'),
          'in_progress',
          'aspan',
          'u-club',
          5,
        ),
        reviewerId: 'u-admin',
      },
    ],
    ledger: [
      ...[20, 25, 15, 50, 25, 15, 20].map((points, i) => ({
        id: `seed-ledger-${i}`,
        userId: 'u-member',
        points,
        reason: l(
          [
            'Инициатива',
            'Мероприятие',
            'Документ / регламент',
            'Руководство демо-проектом',
            'Помощь с автоматизацией',
            'Участие в проекте',
            'Инициатива',
          ][i],
          [
            'Бастама',
            'Іс-шара',
            'Құжат / регламент',
            'Демо-жобаны басқару',
            'Автоматтандыруға көмек',
            'Жобаға қатысу',
            'Бастама',
          ][i],
        ),
        at: `2026-${i < 3 ? '09' : '10'}-${String(i < 3 ? 14 + i * 5 : i - 1).padStart(2, '0')}T09:00:00Z`,
        kind: 'award' as const,
      })),
      {
        id: 'seed-task-award',
        userId: 'u-member',
        taskId: 'task-05',
        points: 10,
        reason: l('Подготовить структуру страницы', 'Бет құрылымын дайындау'),
        at: '2026-10-07T09:00:00Z',
        kind: 'award',
        decisionId: 'seed-approved',
      },
      {
        id: 'seed-adjustment',
        userId: 'u-member',
        points: -6,
        reason: l('Демо: исправление ошибочного начисления', 'Демо: қате есептеуді түзету'),
        at: '2026-10-08T09:00:00Z',
        kind: 'adjustment',
      },
    ],
    notices: [
      {
        id: 'notice-01',
        userId: 'u-member',
        title: l('Мобильные макеты на проверке', 'Мобильді макеттер тексерілуде'),
        body: l(
          'XP появится после подтверждения результата.',
          'Нәтиже расталғаннан кейін XP беріледі.',
        ),
        at: '2026-10-08T09:00:00Z',
        read: false,
        taskId: 'task-02',
      },
      {
        id: 'notice-02',
        userId: 'u-member',
        title: l('Новая задача YRT', 'Жаңа YRT тапсырмасы'),
        body: l(
          'Демо: назначено описание итогов турнира.',
          'Демо: турнир қорытындысын сипаттау тапсырылды.',
        ),
        at: '2026-10-07T09:00:00Z',
        read: false,
        taskId: 'task-03',
      },
    ],
    applications: [
      {
        id: 'application-01',
        history: [],
        userId: 'u-applicant',
        status: 'draft',
        name: 'Демо: Кандидат',
        email: 'candidate@example.test',
        school: 'Демо-школа',
        motivation: '',
        coreId: 'design',
        skills: 'Дизайн, коммуникация',
        comment: '',
      },
    ],
    warnings: [
      {
        id: 'warning-01',
        userId: 'u-member',
        reason:
          'Демо: пропущена встреча без предварительного уведомления. Не реальное предупреждение.',
        by: 'u-admin',
        at: '2026-10-01T09:00:00Z',
        resolved: true,
      },
      {
        id: 'warning-02',
        userId: 'u-club',
        reason: 'Демо: уточнить договоренности с организаторами.',
        by: 'u-admin',
        at: '2026-10-07T09:00:00Z',
        resolved: false,
      },
    ],
  }
}
