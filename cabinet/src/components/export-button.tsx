import { useState } from 'react'
import { Button } from './shared'
import { useClub } from '../app/context'
export function ExportButton({ label, disabled, onExport }: {
  label: string; disabled?: boolean; onExport: () => void
}) {
  const { tx } = useClub()
  const [message, setMessage] = useState('')
  const [failed, setFailed] = useState(false)
  return <div className="local-export">
    <Button variant="secondary" disabled={disabled} onClick={() => {
      try {
        onExport()
        setFailed(false)
        setMessage(tx('Файл подготовлен для скачивания', 'Файл жүктеп алуға дайын'))
      } catch {
        setFailed(true)
        setMessage(tx('Не удалось подготовить файл. Попробуй ещё раз.', 'Файл дайындалмады. Қайта көріңіз.'))
      }
    }}>{label} <span aria-hidden="true">↓</span></Button>
    <span className={failed ? 'export-error' : 'muted'} role="status" aria-live="polite">{message}</span>
  </div>
}
