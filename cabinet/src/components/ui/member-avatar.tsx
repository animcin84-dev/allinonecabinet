import { useEffect, useState } from 'react'
import { readLocalFile } from '../../services/local-files'

type LocalPreview = {
  id?: string
  url?: string
  type?: string
  state: 'loading' | 'ready' | 'missing'
}
export function useLocalBlobURL(fileId?: string): LocalPreview {
  const [preview, setPreview] = useState<LocalPreview>({ state: 'missing' })
  useEffect(() => {
    let active = true
    let objectURL: string | undefined
    if (!fileId) {
      setPreview({ state: 'missing' })
      return
    }
    setPreview({ id: fileId, state: 'loading' })
    void readLocalFile(fileId)
      .then((blob) => {
        if (!active) return
        if (!blob) {
          setPreview({ id: fileId, state: 'missing' })
          return
        }
        objectURL = URL.createObjectURL(blob)
        setPreview({ id: fileId, url: objectURL, type: blob.type, state: 'ready' })
      })
      .catch(() => {
        if (active) setPreview({ id: fileId, state: 'missing' })
      })
    return () => {
      active = false
      if (objectURL) URL.revokeObjectURL(objectURL)
    }
  }, [fileId])
  return preview.id === fileId
    ? preview
    : { id: fileId, state: fileId ? ('loading' as const) : ('missing' as const) }
}
export function MemberAvatar({
  fileId,
  name,
  className = '',
}: {
  fileId?: string
  name: string
  className?: string
}) {
  const preview = useLocalBlobURL(fileId)
  const [failedURL, setFailedURL] = useState<string>()
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => [...part][0])
      .join('')
      .toLocaleUpperCase() || 'A'
  return (
    <span className={`member-avatar ${className}`} aria-label={name} role="img">
      {preview.url && preview.type?.startsWith('image/') && preview.url !== failedURL ? (
        <img src={preview.url} alt="" onError={() => setFailedURL(preview.url)} />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  )
}
