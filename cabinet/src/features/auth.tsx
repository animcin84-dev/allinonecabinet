import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useClub } from '../app/context'
import { AppLink, Button, Field, PageHeader, Sheet } from '../components/shared'
export { ApplicationPage } from './application'

type AuthValues = { name: string; email: string; password: string; code: string }
export function AuthPage() {
  const { authMode } = useParams()
  const { locale, tx, setRole } = useClub()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const mode = ['sign-in', 'sign-up', 'verify-email', 'forgot-password', 'reset-password'].includes(
    authMode ?? '',
  )
    ? authMode!
    : 'sign-in'
  const form = useForm<AuthValues>({
    defaultValues: { name: '', email: '', password: '', code: '' },
  })
  const titles = {
    'sign-in': tx('СНОВА В КОМАНДЕ', 'ҚАЙТА КОМАНДАДА'),
    'sign-up': tx('ТВОЯ ИДЕЯ НУЖНА', 'СЕНІҢ ИДЕЯҢ ҚАЖЕТ'),
    'verify-email': tx('ЕЩЕ ОДИН ШАГ', 'ТАҒЫ БІР ҚАДАМ'),
    'forgot-password': tx('ВОССТАНОВИМ ДОСТУП', 'ҚОЛЖЕТІМДІЛІКТІ ҚАЛПЫНА КЕЛТІРУ'),
    'reset-password': tx('НОВОЕ НАЧАЛО', 'ЖАҢА БАСТАМА'),
  }
  useEffect(() => {
    form.reset()
    setNote('')
  }, [mode, form])
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors()
    const shape: Record<string, z.ZodType> = {}
    if (mode === 'sign-in' || mode === 'sign-up' || mode === 'forgot-password')
      shape.email = z.email(tx('Проверь формат почты', 'Пошта пішімін тексер'))
    if (mode === 'sign-up')
      shape.name = z.string().trim().min(2, tx('Укажи демо-имя', 'Демо атын енгіз'))
    if (mode === 'sign-in' || mode === 'sign-up' || mode === 'reset-password')
      shape.password = z.string().min(8, tx('Минимум 8 символов', 'Кемінде 8 таңба'))
    if (mode === 'verify-email')
      shape.code = z.literal('123456', {
        error: tx('Для демо введи 123456', 'Демо үшін 123456 енгіз'),
      })
    const result = z.object(shape).safeParse(values)
    if (!result.success) {
      for (const issue of result.error.issues)
        form.setError(issue.path[0] as keyof AuthValues, { message: issue.message })
      return
    }
    setBusy(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      form.setValue('password', '')
      if (mode === 'sign-in') {
        setRole('member')
        navigate(`/${locale}/app`)
      } else if (mode === 'sign-up') navigate(`/${locale}/auth/verify-email`)
      else if (mode === 'verify-email') {
        setRole('applicant')
        navigate(`/${locale}/application`)
      } else if (mode === 'forgot-password')
        setNote(
          tx(
            'В демо письмо не отправляется. Перейди к экрану смены пароля по ссылке ниже.',
            'Демода хат жіберілмейді. Төмендегі сілтеме арқылы құпиясөзді өзгерту экранына өт.',
          ),
        )
      else {
        setNote(
          tx(
            'Демо-проверка пройдена. Пароль не сохранен; можешь вернуться ко входу.',
            'Демо тексеру аяқталды. Құпиясөз сақталмады; кіру экранына орала аласың.',
          ),
        )
        form.reset()
      }
    } finally {
      setBusy(false)
    }
  })
  return (
    <div className="auth-layout">
      <section className="auth-brand">
        <Link className="brand" to={`/${locale}/auth/sign-in`}>
          ALLINONE<span>ONE TEAM. ENDLESS POSSIBILITIES.</span>
        </Link>
        <div>
          <div className="eyebrow">ALL FOR ONE / ONE FOR ALL</div>
          <h1>{tx('ТВОЙ ВКЛАД. ОБЩИЙ РЕЗУЛЬТАТ.', 'СЕНІҢ ҮЛЕСІҢ. ОРТАҚ НӘТИЖЕ.')}</h1>
          <p>
            {tx(
              'Рабочее пространство команды, которая превращает идеи в действия.',
              'Идеяларды әрекетке айналдыратын команданың жұмыс кеңістігі.',
            )}
          </p>
        </div>
        <a className="text-link" href="https://allinoneclub.framer.website/">
          ← {tx('На публичный сайт', 'Жария сайтқа')}
        </a>
      </section>
      <section className="auth-form-panel">
        <div className="row">
          <Link
            className={locale === 'ru' ? 'chip active' : 'chip'}
            to={`/ru/auth/${mode}`}
            lang="ru"
          >
            RU
          </Link>
          <Link
            className={locale === 'kk' ? 'chip active' : 'chip'}
            to={`/kk/auth/${mode}`}
            lang="kk"
          >
            ҚАЗ
          </Link>
        </div>
        <Sheet>
          <PageHeader
            eyebrow="ALLINONE / DEMO ACCESS"
            title={titles[mode as keyof typeof titles]}
            description={tx(
              'Это прототип входа. Используй выдуманную почту и пароль: реальные аккаунты и письма пока не создаются.',
              'Бұл кіру прототипі. Ойдан шығарылған пошта мен құпиясөзді қолдан: нақты тіркелгілер мен хаттар әзірге жасалмайды.',
            )}
          />
          <form className="stack" onSubmit={submit}>
            {mode === 'sign-up' && (
              <Field label={tx('Демо-имя', 'Демо аты')} error={form.formState.errors.name?.message}>
                <input
                  {...form.register('name')}
                  autoComplete="off"
                  placeholder={tx('Например, Демо Участник', 'Мысалы, Демо Қатысушы')}
                />
              </Field>
            )}
            {['sign-in', 'sign-up', 'forgot-password'].includes(mode) && (
              <Field
                label={tx('Демо-почта', 'Демо пошта')}
                error={form.formState.errors.email?.message}
              >
                <input
                  {...form.register('email')}
                  type="email"
                  autoComplete="off"
                  placeholder="demo@example.com"
                />
              </Field>
            )}
            {['sign-in', 'sign-up', 'reset-password'].includes(mode) && (
              <Field
                label={tx('Демо-пароль', 'Демо құпиясөз')}
                error={form.formState.errors.password?.message}
              >
                <input
                  {...form.register('password')}
                  type="password"
                  autoComplete="off"
                  placeholder={tx(
                    'Выдуманный, от 8 символов',
                    'Ойдан шығарылған, 8 таңбадан бастап',
                  )}
                />
              </Field>
            )}
            {mode === 'verify-email' && (
              <>
                <p>
                  {tx(
                    'Для демонстрации код всегда 123456. В реальном кабинете код должен отправляться и проверяться сервером.',
                    'Демонстрация үшін код әрқашан 123456. Нақты кабинетте кодты сервер жіберіп, тексеруі керек.',
                  )}
                </p>
                <Field
                  label={tx('Демо-код', 'Демо коды')}
                  error={form.formState.errors.code?.message}
                >
                  <input
                    {...form.register('code')}
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="off"
                    placeholder="123456"
                  />
                </Field>
              </>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? tx('Проверяем…', 'Тексерілуде…')
                : mode === 'sign-up'
                  ? tx('Продолжить регистрацию', 'Тіркелуді жалғастыру')
                  : mode === 'verify-email'
                    ? tx('Подтвердить демо-код', 'Демо кодты растау')
                    : mode === 'forgot-password'
                      ? tx('Проверить почту', 'Поштаны тексеру')
                      : mode === 'reset-password'
                        ? tx('Проверить новый пароль', 'Жаңа құпиясөзді тексеру')
                        : tx('Демо-вход', 'Демо кіру')}
            </Button>
            {note && (
              <p className="notice" role="status">
                {note}
              </p>
            )}
          </form>
          <div className="divider" />
          <div className="stack">
            {mode === 'sign-in' ? (
              <>
                <AppLink to="auth/forgot-password">
                  {tx('Забыли пароль?', 'Құпиясөзді ұмыттың ба?')}
                </AppLink>
                <AppLink to="auth/sign-up">
                  {tx('Вступить в команду', 'Командаға қосылу')} ↗
                </AppLink>
              </>
            ) : (
              <AppLink to="auth/sign-in">
                ← {tx('Вернуться ко входу', 'Кіру экранына оралу')}
              </AppLink>
            )}
            {mode === 'forgot-password' && note && (
              <AppLink to="auth/reset-password">
                {tx('Открыть демо-смену пароля', 'Демо құпиясөз өзгертуді ашу')} ↗
              </AppLink>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setRole('member')
                navigate(`/${locale}/app`)
              }}
            >
              {tx('Посмотреть кабинет без формы', 'Кабинетті формасыз қарау')}
            </Button>
          </div>
          <p className="fine-print">
            {tx(
              'Пароль не отправляется, не сохраняется в браузере и не подтверждает реальную личность. Демо-права задаются переключателем роли.',
              'Құпиясөз жіберілмейді, браузерде сақталмайды және нақты тұлғаны растамайды. Демо құқықтар рөл ауыстырғышымен беріледі.',
            )}
          </p>
        </Sheet>
      </section>
    </div>
  )
}
