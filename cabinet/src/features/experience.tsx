import { MonthlyExperience, ManualRankEditor } from './monthly-experience'
import { useSearchParams } from 'react-router'
import { useClub } from '../app/context'
import {
  PageHeader,
  Sheet,
  SectionTitle,
  AppLink,
  Empty,
  DemoNote,
  dateLabel,
} from '../components/shared'
import { XPCard, ChartSlot } from '../components/workspace'
import { XP_POLICY } from '../domain/policy'
import { ExportButton } from '../components/export-button'
import { csvFile, downloadText } from '../services/export'
export function ExperiencePage() {
  const { state, actor, tx, L, locale } = useClub()
  const [params, setParams] = useSearchParams()
  if (!state || !actor) return null
  const type = params.get('kind') ?? 'all'
  const entries = state.ledger.filter((e) => e.userId === actor.id)
  const rows = entries
    .filter((e) => type === 'all' || e.kind === type)
    .sort((a, b) => b.at.localeCompare(a.at))
  const days = params.get('period') === '56' ? 56 : 28
  return (
    <>
      <PageHeader
        eyebrow={tx('Мой опыт / подтверждённая история', 'Менің тәжірибем / расталған тарих')}
        title={tx('ВКЛАД ВИДЕН.\nКАЖДЫЙ ШАГ ВАЖЕН.', 'ҮЛЕСІҢ КӨРІНЕДІ.\nӘР ҚАДАМ МАҢЫЗДЫ.')}
        description={tx(
          'Каждое начисление связано с действием. Корректировки остаются в журнале.',
          'Әр есептеу әрекетпен байланысты. Түзетулер журналда қалады.',
        )}
        action={
          <AppLink className="button secondary" to="app/achievements">
            {tx('Достижения', 'Жетістіктер')} ↗
          </AppLink>
        }
      />
      <div className="experience-top">
        <XPCard />
        <Sheet>
          <SectionTitle
            action={
              <select
                aria-label={tx('Период графика', 'График кезеңі')}
                value={days}
                onChange={(e) =>
                  setParams((p) => {
                    p.set('period', e.target.value)
                    return p
                  })
                }
              >
                <option value="28">{tx('28 дней', '28 күн')}</option>
                <option value="56">{tx('56 дней', '56 күн')}</option>
              </select>
            }
          >
            {tx('Подтверждённый опыт', 'Расталған тәжірибе')}
          </SectionTitle>
          <ChartSlot days={days} />
        </Sheet>
      </div>
      <MonthlyExperience />
      <ManualRankEditor userId={actor.id} />
      <Sheet>
        <SectionTitle
          action={
            <div className="export-toolbar">
            <select
              aria-label={tx('Тип начисления', 'Есептеу түрі')}
              value={type}
              onChange={(e) =>
                setParams((p) => {
                  p.set('kind', e.target.value)
                  return p
                })
              }
            >
              <option value="all">{tx('Все записи', 'Барлық жазбалар')}</option>
              <option value="award">{tx('Начисления', 'Есептеулер')}</option>
              <option value="adjustment">{tx('Корректировки', 'Түзетулер')}</option>
            </select>
            <ExportButton key={`${locale}-${type}`} label={tx('Скачать CSV', 'CSV жүктеу')} disabled={!rows.length} onExport={() => {
              downloadText(csvFile([
                [tx('Дата · Алматы', 'Күні · Алматы'), tx('За что начислено', 'Есептеу себебі'), tx('Тип', 'Түрі'), 'XP'],
                ...rows.map((e) => [dateLabel(e.at, locale), L(e.reason), e.kind === 'award'
                  ? tx('Начисление · демо', 'Есептеу · демо') : tx('Корректировка · демо', 'Түзету · демо'), e.points]),
              ]), `allinone-xp-${type}-${locale}.csv`, 'text/csv;charset=utf-8')
            }} />
            </div>
          }
        >
          {tx('История XP', 'XP тарихы')}
        </SectionTitle>
        {rows.length ? (
          <div className="table-wrap">
            <table className="data-table ledger">
              <thead>
                <tr>
                  <th>{tx('Дата · Алматы', 'Күні · Алматы')}</th>
                  <th>{tx('За что начислено', 'Есептеу себебі')}</th>
                  <th>{tx('Тип', 'Түрі')}</th>
                  <th>XP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>{dateLabel(e.at, locale)}</td>
                    <td>
                      {e.taskId ? (
                        <AppLink to={`app/tasks/${e.taskId}`}>{L(e.reason)}</AppLink>
                      ) : (
                        L(e.reason)
                      )}
                      <small className="muted">
                        {tx('Демонстрационная запись', 'Демо жазба')}
                      </small>
                    </td>
                    <td>
                      <span className={`badge ${e.kind === 'adjustment' ? 'correction' : 'done'}`}>
                        {e.kind === 'award'
                          ? tx('Начисление', 'Есептеу')
                          : tx('Корректировка', 'Түзету')}
                      </span>
                    </td>
                    <td className={`xp-amount ${e.points < 0 ? 'negative' : ''}`}>
                      {e.points > 0 ? '+' : ''}
                      {e.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={tx('Записей пока нет', 'Әзірге жазбалар жоқ')} />
        )}
      </Sheet>
      <div className="rule-strip">
        <div>
          <span className="eyebrow">POLICY / DRAFT</span>
          <p>
            {tx(
              'Ранг не является должностью. Правила сверены с таблицей, спорные пункты отмечены отдельно.',
              'Деңгей лауазым емес. Ережелер кестемен салыстырылды, анықталмаған тармақтар бөлек белгіленген.',
            )}
          </p>
        </div>
        <AppLink to="app/experience/rules">{tx('Все правила', 'Барлық ережелер')} ↗</AppLink>
      </div>
      <DemoNote />
    </>
  )
}
export function RulesPage() {
  const { tx, L } = useClub()
  return (
    <>
      <PageHeader
        title={tx('ПРАВИЛА ВКЛАДА.', 'ҮЛЕС ЕРЕЖЕЛЕРІ.')}
        eyebrow="XP / POLICY DRAFT"
        description={tx(
          'Версия 09.10.2026 · черновик по исходной таблице Allinone.',
          '09.10.2026 нұсқасы · Allinone бастапқы кестесі негізіндегі жоба.',
        )}
      />
      <div className="grid-2">
        <Sheet>
          <SectionTitle>{tx('Категории начислений', 'Есептеу санаттары')}</SectionTitle>
          <table className="data-table">
            <thead>
              <tr>
                <th>{tx('Действие', 'Әрекет')}</th>
                <th>XP</th>
              </tr>
            </thead>
            <tbody>
              {XP_POLICY.rewardCategories.map((r) => (
                <tr key={r.id}>
                  <td>{L(r.title)}</td>
                  <td>+{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Sheet>
        <div className="stack">
          <Sheet>
            <SectionTitle>{tx('Расчётные уровни', 'Есептік деңгейлер')}</SectionTitle>
            {XP_POLICY.rankBands.map((r) => (
              <div className="rank-rule" key={r.name}>
                <strong>{r.name}</strong>
                <span>
                  {r.min}—{r.max === null ? '∞' : `${r.max - 0.1}`} XP
                </span>
              </div>
            ))}
            <p className="fine-print">
              {tx(
                'Верхние должности назначаются вручную. XP не даёт доступ к управлению.',
                'Жоғары лауазымдар қолмен тағайындалады. XP басқаруға рұқсат бермейді.',
              )}
            </p>
          </Sheet>
          <Sheet>
            <SectionTitle>{tx('Требуют подтверждения', 'Растауды қажет етеді')}</SectionTitle>
            <ul className="list">
              <li>Intern / Interm · Novice / Rookie</li>
              <li>
                {tx(
                  'Правило W3 в таблице не включено в формулу Total',
                  'Кестеде W3 ережесі Total формуласына қосылмаған',
                )}
              </li>
              <li>
                {tx(
                  'Совмещение наград и ручное изменение ранга',
                  'Сыйақыларды біріктіру және деңгейді қолмен өзгерту',
                )}
              </li>
            </ul>
            <p className="muted">
              {tx(
                'Предупреждения не вычитают XP автоматически в этом демо.',
                'Бұл демода ескертулер XP-ді автоматты түрде азайтпайды.',
              )}
            </p>
            <a
              className="text-link"
              href="https://docs.google.com/spreadsheets/d/1aE3kwmnQNmnglniQgXSkEFNo5Bn0NsVLXMp5hPFRReQ/edit"
              target="_blank"
              rel="noopener"
            >
              {tx('Исходная таблица', 'Бастапқы кесте')} ↗
            </a>
          </Sheet>
        </div>
      </div>
    </>
  )
}
