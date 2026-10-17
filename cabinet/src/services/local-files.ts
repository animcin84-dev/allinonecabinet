import type { LocalAttachment } from '../domain/types'

export type LocalFileKind = 'avatar' | 'portfolio' | 'material'
type FileErrorCode = 'type' | 'size' | 'empty' | 'invalid' | 'storage'
export class LocalFileError extends Error {
  constructor(public code: FileErrorCode) {
    super(code)
    this.name = 'LocalFileError'
  }
}
const imageTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
const documentTypes: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
export const localFileAccept = (kind: LocalFileKind) =>
  kind === 'avatar' ? '.jpg,.jpeg,.png,.webp' : kind === 'portfolio' ? '.jpg,.jpeg,.png,.webp,.pdf' : '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx'
export function validateLocalFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  kind: LocalFileKind = 'portfolio',
) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const type = imageTypes[extension] ?? (kind === 'material' ? documentTypes[extension] : kind === 'portfolio' && extension === 'pdf' ? documentTypes.pdf : undefined)
  if (!type || (file.type && file.type !== type)) throw new LocalFileError('type')
  if (file.size <= 0) throw new LocalFileError('empty')
  if (file.size > (kind === 'avatar' ? 5 : 10) * 1024 * 1024) throw new LocalFileError('size')
  return type
}
function safeFileName(name: string) {
  return name.replace(/[\u0000-\u001f\u007f/\\]/g, '_').slice(0, 180) || 'file'
}
async function validateContents(file: File, type: string) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  const word = (start: number, value: string) =>
    [...value].every((char, index) => bytes[start + index] === char.charCodeAt(0))
  const valid =
    type === 'image/jpeg'
      ? starts(0xff, 0xd8, 0xff)
      : type === 'image/png'
        ? starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
        : type === 'image/webp'
          ? word(0, 'RIFF') && word(8, 'WEBP')
          : type === 'application/pdf'
            ? word(0, '%PDF-')
            : type === 'application/msword'
              ? starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
              : starts(0x50, 0x4b, 0x03, 0x04)
  if (!valid) throw new LocalFileError('invalid')
}
async function prepareImage(file: File, avatar: boolean): Promise<Blob> {
  let source: CanvasImageSource
  let width: number
  let height: number
  let release = () => {}
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file)
      source = bitmap
      width = bitmap.width
      height = bitmap.height
      release = () => bitmap.close()
    } else {
      const url = URL.createObjectURL(file)
      release = () => URL.revokeObjectURL(url)
      const image = new Image()
      image.src = url
      await image.decode()
      source = image
      width = image.naturalWidth
      height = image.naturalHeight
    }
    if (!width || !height || width * height > 40_000_000) throw new LocalFileError('invalid')
    if (!avatar) return file
    const side = Math.min(512, width, height)
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side
    const context = canvas.getContext('2d')
    if (!context) throw new LocalFileError('invalid')
    context.fillStyle = '#f5f0e8'
    context.fillRect(0, 0, side, side)
    const crop = Math.min(width, height)
    context.drawImage(source, (width - crop) / 2, (height - crop) / 2, crop, crop, 0, 0, side, side)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new LocalFileError('invalid'))),
        'image/jpeg',
        0.88,
      )
    })
  } catch {
    throw new LocalFileError('invalid')
  } finally {
    release()
  }
}
function openFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new LocalFileError('storage'))
    let request: IDBOpenDBRequest
    let cancelled = false
    try {
      request = indexedDB.open('allinone-local-files', 1)
    } catch {
      reject(new LocalFileError('storage'))
      return
    }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files'))
        request.result.createObjectStore('files', { keyPath: 'id' })
    }
    request.onsuccess = () => {
      if (cancelled) {
        request.result.close()
        return
      }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(new LocalFileError('storage'))
    request.onblocked = () => {
      cancelled = true
      reject(new LocalFileError('storage'))
    }
  })
}
async function operateFiles<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openFileDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('files', mode)
      const request = operation(transaction.objectStore('files'))
      let result: T
      request.onsuccess = () => {
        result = request.result
      }
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(new LocalFileError('storage'))
      transaction.onabort = () => reject(new LocalFileError('storage'))
    })
  } catch {
    throw new LocalFileError('storage')
  } finally {
    db.close()
  }
}
export async function saveLocalFile(
  file: File,
  kind: LocalFileKind = 'portfolio',
): Promise<LocalAttachment> {
  const type = validateLocalFile(file, kind)
  await validateContents(file, type)
  const blob = type.startsWith('image/') ? await prepareImage(file, kind === 'avatar') : file
  const metadata: LocalAttachment = {
    id: crypto.randomUUID(),
    name:
      kind === 'avatar'
        ? `${safeFileName(file.name).replace(/\.[^.]+$/, '')}.jpg`
        : safeFileName(file.name),
    type: kind === 'avatar' ? 'image/jpeg' : type,
    size: blob.size,
    createdAt: new Date().toISOString(),
  }
  await operateFiles('readwrite', (store) =>
    store.put({ ...metadata, blob: new Blob([blob], { type: metadata.type }) }),
  )
  return metadata
}
export async function readLocalFile(id: string): Promise<Blob | undefined> {
  const result = await operateFiles<{ blob: Blob } | undefined>('readonly', (store) =>
    store.get(id),
  )
  return result?.blob
}
export async function getLocalFileInfo(id: string): Promise<LocalAttachment | undefined> {
  const result = await operateFiles<(LocalAttachment & { blob: Blob }) | undefined>(
    'readonly',
    (store) => store.get(id),
  )
  if (!result) return undefined
  const { blob: _blob, ...metadata } = result
  return metadata
}
export async function deleteLocalFile(id: string): Promise<void> {
  await operateFiles('readwrite', (store) => store.delete(id))
}

export async function clearLocalFiles():Promise<void> { await operateFiles('readwrite', store => store.clear()) }
