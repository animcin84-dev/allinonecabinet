import { validLocalAttachment } from './application'
export function validMaterialFile(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const f = value as Record<string, unknown>
  return (
    validLocalAttachment(value) ||
    ([
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(String(f.type)) &&
      validLocalAttachment({ ...f, type: 'application/pdf' }))
  )
}
