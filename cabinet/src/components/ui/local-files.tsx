import { useEffect, useId, useRef, useState } from 'react'
import { useClub } from '../../app/context'
import type { LocalAttachment } from '../../domain/types'
import {
  deleteLocalFile,
  localFileAccept,
  LocalFileError,
  saveLocalFile,
  type LocalFileKind,
} from '../../services/local-files'
import { Button } from '../shared'
import { Dialog } from './dialog'
import { useLocalBlobURL } from './member-avatar'

export function localFileErrorText(
  error: unknown,
  tx: (ru: string, kk: string) => string,
  kind: LocalFileKind,
) {
  if (error instanceof LocalFileError) {
    if (error.code === 'size')
      return tx(
        `Файл больше ${kind === 'avatar' ? 5 : 10} МБ. Выберите меньший файл.`,
        `Файл ${kind === 'avatar' ? 5 : 10} МБ-тан үлкен. Кішірек файлды таңдаңыз.`,
      )
    if (error.code === 'type')
      return tx(
        'Неподдерживаемый формат. Проверьте список допустимых типов.',
        'Файл пішімі қолдау көрсетілмейді. Рұқсат етілген түрлерді тексеріңіз.',
      )
    if (error.code === 'empty')
      return tx('Файл пуст. Выберите другой файл.', 'Файл бос. Басқа файл таңдаңыз.')
    if (error.code === 'invalid')
      return tx(
        'Не удалось прочитать файл. Возможно, он повреждён или имеет неверный формат.',
        'Файл оқылмады. Ол бүлінген немесе пішімі қате болуы мүмкін.',
      )
  }
  return tx(
    'Браузер не сохранил файл. Проверьте доступ к локальному хранилищу и свободное место, затем повторите.',
    'Браузер файлды сақтамады. Жергілікті сақтау рұқсаты мен бос орынды тексеріп, қайталаңыз.',
  )
}
function sizeLabel(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
function AttachmentRow({ file, remove }: { file: LocalAttachment; remove?: () => void }) {
  const { tx } = useClub()
  const preview = useLocalBlobURL(file.id)
  const [open, setOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const image = file.type.startsWith('image/')
  const canPreview = image || file.type === 'application/pdf'
  return (
    <li className="local-file-row">
      <span className="local-file-thumb" aria-hidden="true">
        {image && preview.url && !imageFailed ? (
          <img src={preview.url} alt="" onError={() => setImageFailed(true)} />
        ) : (
          <span>{file.name.split('.').pop()?.toUpperCase()}</span>
        )}
      </span>
      <div className="local-file-info">
        <strong>{file.name}</strong>
        <span>
          {sizeLabel(file.size)} · {tx('В этом браузере', 'Осы браузерде')}
        </span>
        {preview.state === 'loading' && (
          <span role="status">{tx('Читаем файл…', 'Файл оқылуда…')}</span>
        )}
        {preview.state === 'missing' && (
          <span className="local-file-missing">
            {tx(
              'Файл недоступен в этом браузере. Добавьте его заново.',
              'Файл осы браузерде қолжетімсіз. Қайта қосыңыз.',
            )}
          </span>
        )}
      </div>
      <div className="local-file-actions">
        {canPreview && preview.url && (
          <Button
            variant="ghost"
            type="button"
            onClick={() => setOpen(true)}
            aria-label={`${tx('Просмотреть', 'Қарау')}: ${file.name}`}
          >
            {tx('Открыть', 'Ашу')}
          </Button>
        )}
        {preview.url && (
          <a
            className="button ghost"
            href={preview.url}
            download={file.name}
            aria-label={`${tx('Скачать', 'Жүктеу')}: ${file.name}`}
          >
            {tx('Скачать', 'Жүктеу')}
          </a>
        )}
        {remove && (
          <Button
            variant="ghost"
            type="button"
            onClick={remove}
            aria-label={`${tx('Убрать файл', 'Файлды алып тастау')}: ${file.name}`}
          >
            ×
          </Button>
        )}
      </div>
      {canPreview && (
        <Dialog
          open={open}
          closeLabel={tx('Закрыть', 'Жабу')}
          onOpenChange={setOpen}
          title={file.name}
          description={tx(
            'Локальный предпросмотр. Файл не отправляется на сервер.',
            'Жергілікті алдын ала қарау. Файл серверге жіберілмейді.',
          )}
          className="local-file-dialog"
        >
          {preview.url ? (
            image ? (
              <img className="local-file-full-image" src={preview.url} alt={file.name} />
            ) : (
              <object
                className="local-file-pdf"
                data={preview.url}
                type="application/pdf"
                aria-label={file.name}
              >
                <p>
                  {tx(
                    'Браузер не поддерживает предпросмотр PDF.',
                    'Браузер PDF қарауды қолдамайды.',
                  )}
                </p>
                <a className="text-link" href={preview.url} download={file.name}>
                  {tx('Скачать PDF', 'PDF жүктеу')}
                </a>
              </object>
            )
          ) : (
            <p>{tx('Файл недоступен.', 'Файл қолжетімсіз.')}</p>
          )}
        </Dialog>
      )}
    </li>
  )
}
export function LocalFilePicker({
  value,
  onChange,
  kind = 'portfolio',
  disabled = false,
  multiple = true,
  onBusyChange,
}: {
  value: LocalAttachment[]
  onChange: (next: LocalAttachment[]) => void
  kind?: LocalFileKind
  disabled?: boolean
  multiple?: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  const { tx } = useClub()
  const id = useId()
  const mounted = useRef(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const limit = kind === 'avatar' || !multiple ? 1 : 5
  const replace = limit === 1
  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  async function choose(files: File[]) {
    if (!files.length || busy || disabled) return
    setError('')
    setFeedback('')
    if (files.length + (replace ? 0 : value.length) > limit) {
      setError(
        tx(
          `Можно выбрать не более ${limit} ${limit === 1 ? 'файла' : 'файлов'}.`,
          `${limit} файлдан артық таңдауға болмайды.`,
        ),
      )
      return
    }
    setBusy(true)
    const saved: LocalAttachment[] = []
    try {
      for (const file of files) saved.push(await saveLocalFile(file, kind))
      if (!mounted.current) {
        await Promise.all(saved.map((file) => deleteLocalFile(file.id).catch(() => {})))
        return
      }
      onChange(replace ? saved : [...value, ...saved])
      setFeedback(tx('Файлы сохранены в этом браузере.', 'Файлдар осы браузерде сақталды.'))
    } catch (cause) {
      await Promise.all(saved.map((file) => deleteLocalFile(file.id).catch(() => {})))
      if (mounted.current) setError(localFileErrorText(cause, tx, kind))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }
  const formats =
    kind === 'avatar' ? 'JPG, PNG, WebP · 5 MB'
      : kind === 'portfolio' ? 'JPG, PNG, WebP, PDF · 10 MB'
        : 'JPG, PNG, WebP, PDF, DOC, DOCX · 10 MB'
  return (
    <div className={`local-files local-files-${kind}`} aria-busy={busy}>
      {!disabled && (
        <div className="local-file-select">
          <div>
            <label htmlFor={id} className="local-file-label">
              {tx(
                kind === 'avatar' ? 'Фото профиля' : 'Файлы портфолио / материалы',
                kind === 'avatar' ? 'Профиль суреті' : 'Портфолио файлдары / материалдар',
              )}
            </label>
            <p id={`${id}-hint`} className="fine-print">
              {formats} ·{' '}
              {tx(
                `Демо-лимит: ${limit} ${limit === 1 ? 'файл' : 'файлов'}.`,
                `Демо шектеуі: ${limit} файл.`,
              )}
            </p>
          </div>
          <input
            id={id}
            type="file"
            accept={localFileAccept(kind)}
            multiple={multiple && kind !== 'avatar'}
            disabled={busy || (!replace && value.length >= limit)}
            aria-describedby={`${id}-hint ${id}-status${error ? ` ${id}-error` : ''}`}
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              event.target.value = ''
              void choose(files)
            }}
          />
        </div>
      )}
      <ul className="local-file-list" aria-label={tx('Прикреплённые файлы', 'Тіркелген файлдар')}>
        {value.map((file) => (
          <AttachmentRow
            key={file.id}
            file={file}
            remove={
              !disabled && !busy
                ? () => {
                    onChange(value.filter((item) => item.id !== file.id))
                    setFeedback(tx('Файл убран из списка.', 'Файл тізімнен алынды.'))
                    setError('')
                  }
                : undefined
            }
          />
        ))}
      </ul>
      {!value.length && disabled && (
        <p className="fine-print">{tx('Файлы не прикреплены.', 'Файлдар тіркелмеген.')}</p>
      )}
      <div id={`${id}-status`} role="status" aria-live="polite" className="local-file-feedback">
        {busy ? tx('Читаем и сохраняем файлы…', 'Файлдар оқылып, сақталуда…') : feedback}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="field-error">
          {error}
        </p>
      )}
      {!disabled && (
        <p className="fine-print local-file-demo">
          {tx(
            'Демо: файлы доступны только в этом браузере и не загружаются на сервер. Очистка данных браузера удалит их. Удаление из списка сохраняет копию для ранее отправленных анкет.',
            'Демо: файлдар тек осы браузерде қолжетімді және серверге жүктелмейді. Браузер деректерін тазалау оларды жояды. Тізімнен алып тастағанда бұрын жіберілген сауалнамалар үшін көшірме сақталады.',
          )}
        </p>
      )}
    </div>
  )
}
