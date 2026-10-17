import {
  cloneElement,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import { useClub } from '../app/context'
import type { Status } from '../domain/types'
import { ApiError } from '../services/api'
import { errorMessages } from '../locales/errors'
export function Button({
  children,
  variant = 'primary',
  className = '',
  loading = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  loading?: boolean
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={loading || disabled}
      aria-busy={loading || props['aria-busy']}
      data-busy={loading || undefined}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{eyebrow ?? 'ALLINONE / WORKSPACE'}</div>
        <h1 tabIndex={-1}>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  )
}
export function Sheet({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`sheet ${className}`}>{children}</section>
}
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  )
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="eyebrow">ALLINONE / 00</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      {action}
    </div>
  )
}
export function StatusBadge({ status }: { status: Status }) {
  const { tx } = useClub()
  const names: Record<Status, string> = {
    todo: tx('К выполнению', 'Орындау керек'),
    in_progress: tx('В работе', 'Орындалуда'),
    review: tx('На проверке', 'Тексерілуде'),
    done: tx('Подтверждено', 'Расталды'),
  }
  return (
    <span className={`badge ${status}`}>
      <span aria-hidden="true" className="status-dot" />
      {names[status]}
    </span>
  )
}
export function Field({
  label,
  children,
  error,
}: {
  label: string
  children: ReactNode
  error?: string
}) {
  const fieldId = useId()
  const control = isValidElement<{
    id?: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }>(children)
    ? children
    : null
  const controlId = control?.props.id ?? fieldId
  const errorId = `${fieldId}-error`
  const description =
    [control?.props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') ||
    undefined
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {control
        ? cloneElement(control, {
            id: controlId,
            'aria-describedby': description,
            'aria-invalid': error ? true : control.props['aria-invalid'],
          })
        : children}
      {error && (
        <span id={errorId} className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
export function InlineError({ error }: { error: unknown }) {
  const { tx, retry } = useClub()
  const translated = error instanceof ApiError ? errorMessages[error.code] : null
  return (
    <div className="error-box" role="alert">
      <strong>{tx('Не удалось завершить действие', 'Әрекет аяқталмады')}</strong>
      <p>
        {translated ? tx(...translated) : error instanceof Error ? error.message : String(error)}
      </p>
      <Button variant="secondary" onClick={retry}>
        {tx('Обновить данные', 'Деректерді жаңарту')}
      </Button>
    </div>
  )
}
export function AppLink({
  to,
  children,
  className = 'text-link',
}: {
  to: string
  children: ReactNode
  className?: string
}) {
  const { locale } = useClub()
  return (
    <Link className={className} to={`/${locale}/${to}`}>
      {children}
    </Link>
  )
}
export function DemoNote() {
  const { tx } = useClub()
  return (
    <p className="fine-print">
      {tx(
        'Демонстрационные участники, задачи и XP. Названия проектов и сведения о прошедших событиях — из материалов Allinone.',
        'Қатысушылар, тапсырмалар және XP — демо деректер. Жоба атаулары мен өткен іс-шаралар туралы ақпарат Allinone материалдарынан алынған.',
      )}
    </p>
  )
}
export function dateLabel(date: string, locale: 'ru' | 'kk', time = false) {
  if (locale === 'ru')
    return new Intl.DateTimeFormat('ru-KZ', {
      day: 'numeric',
      month: 'short',
      ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
      timeZone: 'Asia/Almaty',
    }).format(new Date(date))
  // Some embedded browsers lack kk ICU data and render months as M10.
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'numeric',
    hour: time ? '2-digit' : undefined,
    minute: time ? '2-digit' : undefined,
    hourCycle: 'h23',
    timeZone: 'Asia/Almaty',
  }).formatToParts(new Date(date))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const months = [
    'қаң.',
    'ақп.',
    'нау.',
    'сәу.',
    'мам.',
    'мау.',
    'шіл.',
    'там.',
    'қыр.',
    'қаз.',
    'қар.',
    'жел.',
  ]
  return `${Number(part('day'))} ${months[Number(part('month')) - 1]}${time ? `, ${part('hour')}:${part('minute')}` : ''}`
}
