import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import * as m from 'motion/react-m'
import { useClub } from '../app/context'
import { Button, Field, InlineError, PageHeader, SectionTitle, Sheet } from '../components/shared'
import { useMotionPreference } from '../components/ui/motion'
import { Onboarding } from './onboarding'
import { ApplicationHistory } from './application-history'
import { LocalFilePicker } from '../components/ui/local-files'
import type { Application, ApplicationAnswers } from '../domain/types'
import {
  DEPARTMENTS,
  TOOLS,
  SKILLS,
  emptyApplicationAnswers,
  normalizeApplicationAnswers,
  validateFullApplication,
} from '../domain/application'

type Draft = Pick<Application, 'name' | 'email' | 'school' | 'motivation' | 'skills'> & {
  answers: ApplicationAnswers
}
const steps = [
  {
    ru: 'О тебе',
    kk: 'Сен туралы',
    detailRu: 'Личные данные',
    detailKk: 'Жеке деректер',
    fields: [
      'name',
      'answers.birthDate',
      'answers.phone',
      'school',
      'answers.grade',
      'answers.gender',
      'answers.location',
    ],
  },
  {
    ru: 'На связи',
    kk: 'Байланыс',
    detailRu: 'Контакты и условия',
    detailKk: 'Байланыс және жағдай',
    fields: [
      'answers.languages',
      'answers.hasComputer',
      'answers.telegram',
      'answers.instagram',
      'email',
    ],
  },
  {
    ru: 'Твой вклад',
    kk: 'Сенің үлесің',
    detailRu: 'Направления и навыки',
    detailKk: 'Бағыттар мен дағдылар',
    fields: [
      'answers.departmentIds',
      'answers.priority1',
      'answers.priority2',
      'answers.tools',
      'answers.toolsOther',
      'answers.skillIds',
      'answers.skillsOther',
    ],
  },
  {
    ru: 'Твоя история',
    kk: 'Сенің тарихың',
    detailRu: 'Опыт и мотивация',
    detailKk: 'Тәжірибе және ниет',
    fields: [
      'answers.experience',
      'motivation',
      'answers.availability',
      'answers.additional',
      'answers.portfolio',
    ],
  },
] as const
function fromApplication(application?: Application): Draft {
  return {
    name: application?.name ?? '',
    email: application?.email ?? '',
    school: application?.school ?? '',
    motivation: application?.motivation ?? '',
    skills: application?.skills ?? '',
    answers: { ...emptyApplicationAnswers(), ...application?.answers },
  }
}
export function restoreApplicationDraft(raw: string | null, fallback: Draft): Draft {
  if (!raw) return fallback
  try {
    const saved = JSON.parse(raw) as Partial<Draft>
    const draft = { ...fallback }
    for (const key of ['name', 'email', 'school', 'motivation', 'skills'] as const)
      if (typeof saved[key] === 'string') draft[key] = saved[key]
    if (saved.answers && typeof saved.answers === 'object') {
      draft.answers = normalizeApplicationAnswers({ ...fallback.answers, ...saved.answers })
    }
    return draft
  } catch {
    return fallback
  }
}
export function stepApplicationErrors(errors: Record<string, string>, step: number) {
  return Object.fromEntries(
    Object.entries(errors).filter(([path]) =>
      steps[step]?.fields.some((field) => path === field || path.startsWith(`${field}.`)),
    ),
  )
}

export function ApplicationPage() {
  const { state, actor, act, pending, error, tx, L, toast, locale, setRole } = useClub()
  const navigate = useNavigate()
  const reduced = useMotionPreference()
  const application = state?.applications.find((a) => a.userId === actor?.id)
  const key = `allinone:application-draft:${actor?.id ?? 'applicant'}`
  const loadedKey = useRef('')
  const [values, setValues] = useState<Draft>(() => fromApplication(application))
  const [step, setStep] = useState(0)
  const [review, setReview] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [filesBusy, setFilesBusy] = useState(false)
  const [storageError, setStorageError] = useState(false)
  const [localError, setLocalError] = useState<Error | null>(null)
  const [finished, setFinished] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const stepTitle = useRef<HTMLHeadingElement>(null)
  const status = application?.status ?? 'draft'
  const editable = ['draft', 'needs_info'].includes(status) && !finished
  useEffect(() => {
    if (!actor || loadedKey.current === key) return
    let restored = fromApplication(application)
    try {
      restored = restoreApplicationDraft(sessionStorage.getItem(key), restored)
    } catch {
      setStorageError(true)
    }
    loadedKey.current = key
    setValues(restored)
    setSaved(false)
    setStep(0)
    setReview(false)
    setFinished(false)
    setErrors({})
  }, [actor, application, key])
  useEffect(() => {
    if (!actor || loadedKey.current !== key || !editable) return
    try {
      sessionStorage.setItem(key, JSON.stringify(values))
      setSaved(true)
      setStorageError(false)
    } catch {
      setStorageError(true)
      setSaved(false)
    }
  }, [values, actor, key, editable])
  const statusName = {
    draft: tx('Черновик', 'Қаралама'),
    submitted: tx('Подана', 'Жіберілді'),
    reviewing: tx('На рассмотрении', 'Қаралуда'),
    needs_info: tx('Нужно уточнение', 'Нақтылау қажет'),
    accepted: tx('Принята', 'Қабылданды'),
    rejected: tx('Не принята', 'Қабылданбады'),
  }
  const errorText = (path: string) => {
    const code = errors[path]
    if (!code) return undefined
    const names: Record<string, string> = {
      required: tx('Заполни этот ответ', 'Бұл жауапты толтыр'),
      invalidEmail: tx('Проверь формат почты', 'Пошта пішімін тексер'),
      invalidDate: tx('Укажи корректную дату в прошлом', 'Өткен күнді дұрыс көрсет'),
      invalidPhone: tx('Проверь номер телефона', 'Телефон нөмірін тексер'),
      invalidOption: tx('Выбери вариант из списка', 'Тізімнен нұсқаны таңда'),
      tooManyDepartments: tx(
        'Выбери не больше двух департаментов',
        'Екіден артық департамент таңдама',
      ),
      invalidPriorities: tx(
        'Приоритеты должны быть разными и входить в выбранные направления',
        'Басымдықтар әртүрлі әрі таңдалған бағыттарда болуы керек',
      ),
      motivationTooShort: tx(
        'Расскажи подробнее: минимум 20 символов',
        'Толығырақ жаз: кемінде 20 таңба',
      ),
      invalidPortfolio: tx(
        'Добавь хотя бы один поддерживаемый демо-файл',
        'Кемінде бір қолдау көрсетілетін демо файлды қос',
      ),
      tooLong: tx('Ответ слишком длинный', 'Жауап тым ұзын'),
    }
    return names[code] ?? tx('Проверь этот ответ', 'Бұл жауапты тексер')
  }
  function update<K extends keyof Draft>(field: K, value: Draft[K]) {
    setValues((old) => ({ ...old, [field]: value }))
    setLocalError(null)
  }
  function answer<K extends keyof ApplicationAnswers>(field: K, value: ApplicationAnswers[K]) {
    setValues((old) => ({ ...old, answers: { ...old.answers, [field]: value } }))
    setLocalError(null)
  }
  function focusError(nextErrors: Record<string, string>, all = false) {
    const first = Object.keys(nextErrors)[0]
    if (!first) return
    if (all) {
      const destination = steps.findIndex((item) =>
        item.fields.some((field) => first === field || first.startsWith(`${field}.`)),
      )
      setStep(Math.max(0, destination))
      setReview(false)
    }
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>(`[data-answer="${first}"]`)?.focus(),
    )
  }
  function move(next: number) {
    setStep(next)
    setReview(false)
    setErrors({})
    requestAnimationFrame(() => stepTitle.current?.focus())
  }
  function next() {
    if (filesBusy || pending) return
    const all = validateFullApplication(values)
    const current = stepApplicationErrors(all, step)
    setErrors(current)
    if (Object.keys(current).length) {
      focusError(current)
      return
    }
    if (step === 3) {
      if (Object.keys(all).length) {
        setErrors(all)
        focusError(all, true)
        return
      }
      setReview(true)
      requestAnimationFrame(() => stepTitle.current?.focus())
    } else move(step + 1)
  }
  async function save(submit: boolean) {
    if (filesBusy || pending) return
    if (submit) {
      const all = validateFullApplication(values)
      if (Object.keys(all).length) {
        setErrors(all)
        focusError(all, true)
        return
      }
    }
    setLocalError(null)
    try {
      await act({
        type: 'application',
        payload: {
          ...values,
          skills: [
            ...values.answers.skillIds.map((id) => L(SKILLS.find((s) => s.id === id)?.title ?? id)),
            values.answers.skillsOther,
          ]
            .filter(Boolean)
            .join(', '),
          formVersion: 2,
          coreId: '',
          status: submit ? 'submitted' : 'draft',
        },
      })
      if (submit) {
        setFinished(true)
        try {
          sessionStorage.removeItem(key)
        } catch {
          /* Already persisted by demo adapter. */
        }
        setSaved(false)
      }
      toast(
        submit
          ? tx('Демо-заявка отправлена на рассмотрение', 'Демо өтінім қарауға жіберілді')
          : tx('Демо-черновик сохранён в кабинете', 'Демо қаралама кабинетте сақталды'),
      )
    } catch (caught) {
      setLocalError(
        caught instanceof Error
          ? caught
          : new Error(
              tx(
                'Не удалось сохранить. Ответы остались в форме.',
                'Сақталмады. Жауаптар формада қалды.',
              ),
            ),
      )
    }
  }
  const a = values.answers
  function input(
    path: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    type = 'text',
    limit = 160,
  ) {
    return (
      <Field label={label} error={errorText(path)}>
        <input
          data-answer={path}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          maxLength={limit}
          autoComplete="off"
        />
      </Field>
    )
  }
  function select(
    path: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: { id: string; title: string }[],
    disabled = false,
  ) {
    return (
      <Field label={label} error={errorText(path)}>
        <select
          data-answer={path}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">{tx('Выбрать', 'Таңдау')}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.title}
            </option>
          ))}
        </select>
      </Field>
    )
  }
  function text(
    path: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    limit = 1500,
  ) {
    return (
      <div className="stack application-text-field">
        <Field label={label} error={errorText(path)}>
          <textarea
            data-answer={path}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={4}
            maxLength={limit}
          />
        </Field>
        <span className="application-count" aria-hidden="true">
          {value.length} / {limit}
        </span>
      </div>
    )
  }
  function choices(
    path: string,
    label: string,
    items: { id: string; title: { ru: string; kk: string } }[],
    selected: string[],
    onChange: (next: string[]) => void,
    max?: number,
  ) {
    return (
      <fieldset
        className="application-choices"
        aria-describedby={errors[path] ? `${path}-error` : undefined}
      >
        <legend>{label}</legend>
        <div className="application-choice-grid">
          {items.map((item, index) => (
            <label
              className={`application-choice ${selected.includes(item.id) ? 'selected' : ''}`}
              key={item.id}
            >
              <input
                data-answer={index === 0 ? path : undefined}
                type="checkbox"
                checked={selected.includes(item.id)}
                disabled={!selected.includes(item.id) && Boolean(max && selected.length >= max)}
                onChange={() =>
                  onChange(
                    selected.includes(item.id)
                      ? selected.filter((id) => id !== item.id)
                      : [...selected, item.id],
                  )
                }
              />
              <span>{L(item.title)}</span>
              <span className="application-choice-check" aria-hidden="true">
                {selected.includes(item.id) ? '✓' : '+'}
              </span>
            </label>
          ))}
        </div>
        {errorText(path) && (
          <span id={`${path}-error`} className="field-error" role="alert">
            {errorText(path)}
          </span>
        )}
      </fieldset>
    )
  }
  const displayed =
    finished && application
      ? application
      : {
          ...application,
          ...values,
          id: application?.id ?? 'preview',
          userId: actor?.id ?? '',
          status,
          coreId: '',
          comment: application?.comment ?? '',
          formVersion: 2 as const,
        }
  return (
    <div className="application-layout application-v2">
      <PageHeader
        eyebrow="ALLINONE / MEMBERSHIP"
        title={tx('ТВОЙ ПЕРВЫЙ ШАГ', 'СЕНІҢ АЛҒАШҚЫ ҚАДАМЫҢ')}
        description={tx(
          'Расскажи о себе. Найди своё место в команде.',
          'Өзің туралы айт. Командадан өз орныңды тап.',
        )}
        action={
          <div className="row">
            <Link
              className={locale === 'ru' ? 'chip active' : 'chip'}
              to="/ru/application"
              lang="ru"
            >
              RU
            </Link>
            <Link
              className={locale === 'kk' ? 'chip active' : 'chip'}
              to="/kk/application"
              lang="kk"
            >
              ҚАЗ
            </Link>
            <a className="text-link" href="https://allinoneclub.framer.website/">
              {tx('Публичный сайт', 'Жария сайт')} ↗
            </a>
          </div>
        }
      />
      <Onboarding />
      <div className="application-workspace">
        <aside className="application-outline">
          <div className="application-manifesto">
            <div className="eyebrow">ONE TEAM / YOUR NEXT CHAPTER</div>
            <h2>{tx('ТВОЯ ИДЕЯ. НАША КОМАНДА.', 'СЕНІҢ ИДЕЯҢ. БІЗДІҢ КОМАНДА.')}</h2>
            <p>
              {tx(
                'Не нужно уметь всё. Важно быть готовым учиться, действовать и отвечать за свой вклад.',
                'Барлығын білу міндетті емес. Үйренуге, әрекет етуге және өз үлесіңе жауап беруге дайын бол.',
              )}
            </p>
            <span className="application-brand-arrow" aria-hidden="true">
              ›››
            </span>
          </div>
          {editable && (
            <nav
              className="application-step-nav"
              aria-label={tx('Шаги заявки', 'Өтінім қадамдары')}
            >
              {steps.map((item, index) => (
                <button
                  type="button"
                  className={step === index && !review ? 'current' : ''}
                  aria-current={step === index && !review ? 'step' : undefined}
                  onClick={() => move(index)}
                  key={item.ru}
                >
                  <span className="application-step-number">0{index + 1}</span>
                  <span>
                    <strong>{locale === 'kk' ? item.kk : item.ru}</strong>
                    <small>{locale === 'kk' ? item.detailKk : item.detailRu}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </button>
              ))}
            </nav>
          )}
          <div className="application-after">
            <div className="eyebrow">NEXT / WHAT HAPPENS</div>
            <p>
              {tx(
                'После отправки руководитель рассмотрит заявку. Если нужны детали, ты получишь запрос на уточнение.',
                'Жіберген соң жетекші өтінімді қарайды. Мәлімет қажет болса, нақтылау сұрауын аласың.',
              )}
            </p>
            <Button
              variant="ghost"
              onClick={() => {
                setRole('admin')
                navigate(`/${locale}/manage/applications`)
              }}
            >
              {tx('Рассмотрение в демо', 'Демода қарау')} ↗
            </Button>
          </div>
        </aside>
        <Sheet className="application-form-sheet">
          <SectionTitle
            action={
              <span className="badge">{finished ? statusName.submitted : statusName[status]}</span>
            }
          >
            {tx('Моя заявка', 'Менің өтінімім')}
          </SectionTitle>
          {application && <ApplicationHistory application={application} renderSnapshot={snapshot => <FullApplicationSummary application={snapshot} />} />}
          <p className="notice application-demo">
            {tx(
              'Демо-анкета. Используй выдуманные данные и тестовые файлы. Ответы сохраняются только в этом браузере и не отправляются в реальный клуб.',
              'Демо сауалнама. Ойдан шығарылған деректер мен тест файлдарын қолдан. Жауаптар тек осы браузерде сақталады, нақты клубқа жіберілмейді.',
            )}
          </p>
          {application?.comment && (
            <div className="notice">
              <strong>{tx('Комментарий руководителя', 'Жетекшінің пікірі')}</strong>
              <p>{application.comment}</p>
            </div>
          )}
          {!editable ? (
            <>
              <FullApplicationSummary application={finished ? displayed : application!} />
              {status === 'accepted' && (
                <div className="notice">
                  <h3>{tx('Добро пожаловать в команду', 'Командаға қош келдің')}</h3>
                  <p>
                    {tx(
                      'Заявка принята в демо. Открой свой рабочий кабинет.',
                      'Демода өтінім қабылданды. Жұмыс кабинетіңді аш.',
                    )}
                  </p>
                  <Button onClick={() => navigate(`/${locale}/app`)}>
                    {tx('Открыть кабинет', 'Кабинетті ашу')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <form
              ref={formRef}
              noValidate
              onSubmit={(event) => {
                event.preventDefault()
                if (review) void save(true)
                else next()
              }}
            >
              <div className="application-stage-head">
                <div>
                  <div className="eyebrow">
                    {review
                      ? tx('ПРОВЕРКА / ПЕРЕД ОТПРАВКОЙ', 'ТЕКСЕРУ / ЖІБЕРУ АЛДЫНДА')
                      : `${tx('ШАГ', 'ҚАДАМ')} 0${step + 1} / 04`}
                  </div>
                  <h2 ref={stepTitle} tabIndex={-1}>
                    {review
                      ? tx('Всё на своих местах?', 'Бәрі дұрыс па?')
                      : locale === 'kk'
                        ? steps[step].kk
                        : steps[step].ru}
                  </h2>
                </div>
                <span className="application-question-count">
                  {review
                    ? tx('22 ответа', '22 жауап')
                    : `${steps[step].fields.filter((field) => !field.endsWith('Other')).length} ${tx('вопросов', 'сұрақ')}`}
                </span>
              </div>
              {review ? (
                <>
                  <p className="fine-print">
                    {tx(
                      'Проверь ответы. После отправки редактирование откроется только при запросе уточнения.',
                      'Жауаптарды тексер. Жібергеннен кейін өңдеу тек нақтылау сұрауынан соң ашылады.',
                    )}
                  </p>
                  <FullApplicationSummary application={displayed} />
                </>
              ) : (
                <m.fieldset
                  key={step}
                  disabled={pending}
                  className="application-fields stack"
                  initial={reduced ? false : { opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduced ? 0 : 0.18 }}
                >
                  {step === 0 && (
                    <>
                      <div className="form-grid">
                        {input('name', tx('01 · ФИО', '01 · Аты-жөні'), values.name, (v) =>
                          update('name', v),
                        )}
                        {input(
                          'answers.birthDate',
                          tx('02 · Дата рождения', '02 · Туған күні'),
                          a.birthDate,
                          (v) => answer('birthDate', v),
                          'date',
                        )}
                        {input(
                          'answers.phone',
                          tx('03 · Номер телефона', '03 · Телефон нөмірі'),
                          a.phone,
                          (v) => answer('phone', v),
                          'tel',
                          40,
                        )}
                        {input(
                          'school',
                          tx('04 · Место учёбы', '04 · Оқу орны'),
                          values.school,
                          (v) => update('school', v),
                        )}
                        {input(
                          'answers.grade',
                          tx('05 · Класс / курс', '05 · Сынып / курс'),
                          a.grade,
                          (v) => answer('grade', v),
                          'text',
                          40,
                        )}
                        {select(
                          'answers.gender',
                          tx('11 · Пол', '11 · Жынысы'),
                          a.gender,
                          (v) => answer('gender', v as ApplicationAnswers['gender']),
                          [
                            { id: 'female', title: tx('Женский', 'Әйел') },
                            { id: 'male', title: tx('Мужской', 'Ер') },
                          ],
                        )}
                      </div>
                      {input(
                        'answers.location',
                        tx('12 · Город и страна', '12 · Қала және ел'),
                        a.location,
                        (v) => answer('location', v),
                      )}
                    </>
                  )}
                  {step === 1 && (
                    <>
                      {input(
                        'answers.languages',
                        tx('06 · Языки', '06 · Тілдер'),
                        a.languages,
                        (v) => answer('languages', v),
                      )}
                      {select(
                        'answers.hasComputer',
                        tx('07 · Есть ПК / ноутбук?', '07 · Компьютер / ноутбук бар ма?'),
                        a.hasComputer,
                        (v) => answer('hasComputer', v as ApplicationAnswers['hasComputer']),
                        [
                          { id: 'yes', title: tx('Да', 'Иә') },
                          { id: 'no', title: tx('Нет', 'Жоқ') },
                        ],
                      )}
                      <div className="form-grid">
                        {input('answers.telegram', '08 · Telegram username', a.telegram, (v) =>
                          answer('telegram', v),
                        )}
                        {input('answers.instagram', '09 · Instagram', a.instagram, (v) =>
                          answer('instagram', v),
                        )}
                      </div>
                      {input(
                        'email',
                        tx('10 · Демо-почта', '10 · Демо пошта'),
                        values.email,
                        (v) => update('email', v),
                        'email',
                      )}
                    </>
                  )}
                  {step === 2 && (
                    <>
                      {choices(
                        'answers.departmentIds',
                        tx(
                          '13 · Интересующие департаменты · до двух',
                          '13 · Қызықтыратын департаменттер · екеуге дейін',
                        ),
                        DEPARTMENTS,
                        a.departmentIds,
                        (ids) => {
                          answer('departmentIds', ids)
                          setValues((old) => ({
                            ...old,
                            answers: {
                              ...old.answers,
                              priority1: ids.includes(old.answers.priority1)
                                ? old.answers.priority1
                                : '',
                              priority2:
                                ids.length > 1 && ids.includes(old.answers.priority2)
                                  ? old.answers.priority2
                                  : '',
                            },
                          }))
                        },
                        2,
                      )}
                      <p className="fine-print">
                        {tx('Выбрано', 'Таңдалды')}: {a.departmentIds.length} / 2.{' '}
                        {tx(
                          'При одном направлении второй приоритет не нужен.',
                          'Бір бағыт таңдасаң, екінші басымдық қажет емес.',
                        )}
                      </p>
                      <div className="form-grid">
                        {select(
                          'answers.priority1',
                          tx('14 · Первый приоритет', '14 · Бірінші басымдық'),
                          a.priority1,
                          (v) => answer('priority1', v),
                          DEPARTMENTS.filter((d) => a.departmentIds.includes(d.id)).map((d) => ({
                            id: d.id,
                            title: L(d.title),
                          })),
                        )}
                        {select(
                          'answers.priority2',
                          tx('15 · Второй приоритет', '15 · Екінші басымдық'),
                          a.priority2,
                          (v) => answer('priority2', v),
                          DEPARTMENTS.filter(
                            (d) => a.departmentIds.includes(d.id) && d.id !== a.priority1,
                          ).map((d) => ({ id: d.id, title: L(d.title) })),
                          a.departmentIds.length < 2,
                        )}
                      </div>
                      {choices(
                        'answers.tools',
                        tx('16 · Программы и сервисы', '16 · Бағдарламалар мен сервистер'),
                        TOOLS,
                        a.tools,
                        (v) => answer('tools', v),
                      )}
                      {a.tools.includes('other') &&
                        input(
                          'answers.toolsOther',
                          tx('Какие ещё программы?', 'Қандай басқа бағдарламалар?'),
                          a.toolsOther,
                          (v) => answer('toolsOther', v),
                        )}
                      {choices(
                        'answers.skillIds',
                        tx('17 · Навыки', '17 · Дағдылар'),
                        SKILLS,
                        a.skillIds,
                        (v) => answer('skillIds', v),
                      )}
                      {a.skillIds.includes('other') &&
                        input(
                          'answers.skillsOther',
                          tx('Какие ещё навыки?', 'Қандай басқа дағдылар?'),
                          a.skillsOther,
                          (v) => answer('skillsOther', v),
                        )}
                    </>
                  )}
                  {step === 3 && (
                    <>
                      {text(
                        'answers.experience',
                        tx(
                          '18 · Опыт проектов и мероприятий',
                          '18 · Жобалар мен іс-шаралар тәжірибесі',
                        ),
                        a.experience,
                        (v) => answer('experience', v),
                      )}
                      {text(
                        'motivation',
                        tx(
                          '19 · Мотивация и твой вклад в Allinone',
                          '19 · Ниетің және Allinone-ға қосатын үлесің',
                        ),
                        values.motivation,
                        (v) => update('motivation', v),
                      )}
                      {select(
                        'answers.availability',
                        tx('20 · Время в неделю', '20 · Аптасына бөлетін уақыт'),
                        a.availability,
                        (v) => answer('availability', v as ApplicationAnswers['availability']),
                        [
                          { id: 'under3', title: tx('До 3 часов', '3 сағатқа дейін') },
                          { id: '3to5', title: tx('3–5 часов', '3–5 сағат') },
                          { id: '5to8', title: tx('5–8 часов', '5–8 сағат') },
                          { id: 'over8', title: tx('Более 8 часов', '8 сағаттан артық') },
                        ],
                      )}
                      {text(
                        'answers.additional',
                        tx('21 · Дополнительная информация', '21 · Қосымша ақпарат'),
                        a.additional,
                        (v) => answer('additional', v),
                      )}
                      <div className="field" data-answer="answers.portfolio" tabIndex={-1}>
                        <label>{tx('22 · Документы портфолио', '22 · Портфолио құжаттары')}</label>
                        <LocalFilePicker
                          value={a.portfolio}
                          onChange={(v) => answer('portfolio', v)}
                          kind="portfolio"
                          onBusyChange={setFilesBusy}
                          disabled={pending}
                        />
                        {errorText('answers.portfolio') && (
                          <span className="field-error" role="alert">
                            {errorText('answers.portfolio')}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </m.fieldset>
              )}
              {(localError || error) && <InlineError error={localError || error} />}
              {storageError && (
                <p className="error-box" role="alert">
                  {tx(
                    'Браузер не смог сохранить черновик. Ответы остаются на экране; не закрывай вкладку до успешного сохранения.',
                    'Браузер қараламаны сақтай алмады. Жауаптар экранда тұр; сақталғанша қойындыны жаппа.',
                  )}
                </p>
              )}
              <div className="application-actions">
                <div className="row">
                  {(step > 0 || review) && (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending}
                      onClick={() => (review ? setReview(false) : move(step - 1))}
                    >
                      ←{' '}
                      {review ? tx('Изменить ответы', 'Жауаптарды өзгерту') : tx('Назад', 'Артқа')}
                    </Button>
                  )}
                  <Button type="submit" loading={pending} disabled={filesBusy}>
                    {review
                      ? tx('Отправить демо-заявку', 'Демо өтінімді жіберу')
                      : step === 3
                        ? tx('Проверить ответы', 'Жауаптарды тексеру')
                        : `${tx('Далее', 'Әрі қарай')}: ${locale === 'kk' ? steps[step + 1].kk : steps[step + 1].ru} →`}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={filesBusy || pending}
                  onClick={() => void save(false)}
                >
                  {tx('Сохранить черновик', 'Қараламаны сақтау')}
                </Button>
              </div>
              <p className="application-save-note fine-print" role="status">
                {saved && !storageError
                  ? tx(
                      'Черновик автоматически сохранён в этой вкладке',
                      'Қаралама осы қойындыда автоматты сақталды',
                    )
                  : tx(
                      'Ответы остаются в форме до отправки',
                      'Жауаптар жіберілгенше формада қалады',
                    )}
              </p>
            </form>
          )}
          <a
            className="text-link application-source"
            href="https://docs.google.com/forms/d/e/1FAIpQLScS5FoI88pNbnVC_GT-GglLZBJuVvJcTYzuOyYwx4OAInycAg/viewform"
            target="_blank"
            rel="noreferrer"
          >
            {tx('Исходная анкета · Google Forms', 'Бастапқы сауалнама · Google Forms')} ↗
          </a>
        </Sheet>
      </div>
    </div>
  )
}

export function FullApplicationSummary({ application }: { application: Application }) {
  const { tx, L } = useClub()
  const a = application.answers
  function row(label: string, content: ReactNode) {
    return (
      <div className="application-summary-row" key={label}>
        <dt>{label}</dt>
        <dd>{content || <span className="muted">{tx('Не указано', 'Көрсетілмеген')}</span>}</dd>
      </div>
    )
  }
  const department = (id: string) => L(DEPARTMENTS.find((item) => item.id === id)?.title ?? id)
  const list = (ids: string[], options: { id: string; title: { ru: string; kk: string } }[]) =>
    ids.map((id) => L(options.find((item) => item.id === id)?.title ?? id)).join(', ')
  const availability: Record<string, string> = {
    under3: tx('До 3 часов', '3 сағатқа дейін'),
    '3to5': tx('3–5 часов', '3–5 сағат'),
    '5to8': tx('5–8 часов', '5–8 сағат'),
    over8: tx('Более 8 часов', '8 сағаттан артық'),
  }
  return (
    <div className="application-summary">
      {!a && (
        <p className="notice">
          {tx(
            'Заявка из предыдущей версии. Сохранены исходные ответы; дополнительные поля не были заполнены.',
            'Бұрынғы нұсқадағы өтінім. Бастапқы жауаптар сақталған; қосымша өрістер толтырылмаған.',
          )}
        </p>
      )}
      <dl>
        {row(tx('01 · ФИО', '01 · Аты-жөні'), application.name)}
        {a && row(tx('02 · Дата рождения', '02 · Туған күні'), a.birthDate)}
        {a && row(tx('03 · Телефон', '03 · Телефон'), a.phone)}
        {row(tx('04 · Место учёбы', '04 · Оқу орны'), application.school)}
        {a && row(tx('05 · Класс / курс', '05 · Сынып / курс'), a.grade)}
        {a && row(tx('06 · Языки', '06 · Тілдер'), a.languages)}
        {a &&
          row(
            tx('07 · Компьютер', '07 · Компьютер'),
            a.hasComputer === 'yes'
              ? tx('Есть', 'Бар')
              : a.hasComputer === 'no'
                ? tx('Нет', 'Жоқ')
                : '',
          )}
        {a && row('08 · Telegram', a.telegram)}
        {a && row('09 · Instagram', a.instagram)}
        {row('10 · Email', application.email)}
        {a &&
          row(
            tx('11 · Пол', '11 · Жынысы'),
            a.gender === 'female'
              ? tx('Женский', 'Әйел')
              : a.gender === 'male'
                ? tx('Мужской', 'Ер')
                : '',
          )}
        {a && row(tx('12 · Город / страна', '12 · Қала / ел'), a.location)}
        {a &&
          row(
            tx('13 · Департаменты', '13 · Департаменттер'),
            a.departmentIds.map(department).join(', '),
          )}
        {a && row(tx('14 · Первый приоритет', '14 · Бірінші басымдық'), department(a.priority1))}
        {a &&
          row(
            tx('15 · Второй приоритет', '15 · Екінші басымдық'),
            a.priority2
              ? department(a.priority2)
              : a.departmentIds.length === 1
                ? tx(
                    'Не требуется: выбран один департамент',
                    'Қажет емес: бір департамент таңдалған',
                  )
                : '',
          )}
        {a &&
          row(
            tx('16 · Программы / сервисы', '16 · Бағдарламалар / сервистер'),
            [list(a.tools, TOOLS), a.toolsOther].filter(Boolean).join(' · '),
          )}
        {row(
          tx('17 · Навыки', '17 · Дағдылар'),
          a
            ? [list(a.skillIds, SKILLS), a.skillsOther].filter(Boolean).join(' · ')
            : application.skills,
        )}
        {a && row(tx('18 · Опыт', '18 · Тәжірибе'), a.experience)}
        {row(tx('19 · Мотивация', '19 · Ниет'), application.motivation)}
        {a && row(tx('20 · Часов в неделю', '20 · Аптасына сағат'), availability[a.availability])}
        {a && row(tx('21 · Дополнительно', '21 · Қосымша'), a.additional)}
      </dl>
      {a && (
        <div className="application-summary-files">
          <h3>{tx('22 · Документы портфолио', '22 · Портфолио құжаттары')}</h3>
          <LocalFilePicker value={a.portfolio} onChange={() => {}} kind="portfolio" disabled />
        </div>
      )}
    </div>
  )
}
