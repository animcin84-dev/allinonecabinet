import { useEffect, useRef, useState } from 'react'
import { useClub } from '../../app/context'
import { Button } from '../shared'

// Adapted from Ruixen ButtonCopy (MIT). No audio, blur, suppressed errors or
// unowned timers: success follows the Clipboard API result and announces once.
export function CopyLinkButton() {
  const { tx, toast } = useClub()
  const [copied, setCopied] = useState(false)
  const [pending, setPending] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
    }
  }, [])
  async function copy() {
    if (pending) return
    clearTimeout(timer.current)
    setCopied(false)
    setPending(true)
    try {
      await navigator.clipboard.writeText(window.location.href)
      if (!mounted.current) return
      setCopied(true)
      toast(tx('Ссылка скопирована', 'Сілтеме көшірілді'))
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2500)
    } catch {
      if (mounted.current)
        toast(
          tx(
            'Не удалось скопировать. Скопируй адрес из строки браузера.',
            'Көшіру мүмкін болмады. Браузер жолынан мекенжайды көшір.',
          ),
        )
    } finally {
      if (mounted.current) setPending(false)
    }
  }
  return (
    <Button variant="secondary" className="copy-link" onClick={() => void copy()} loading={pending}>
      <svg
        key={String(copied)}
        className="copy-icon"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        {copied ? (
          <path d="m5 12 4 4 10-10" />
        ) : (
          <>
            <rect x="9" y="9" width="12" height="12" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
      {copied ? tx('Скопировано', 'Көшірілді') : tx('Скопировать ссылку', 'Сілтемені көшіру')}
    </Button>
  )
}
