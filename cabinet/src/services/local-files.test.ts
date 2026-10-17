import { File as NodeFile } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalFileError, readLocalFile, saveLocalFile, validateLocalFile } from './local-files'
afterEach(() => vi.unstubAllGlobals())
describe('local attachment validation and persistence', () => {
  it('restricts avatars to supported images, checks MIME consistency, empty files and demo size limits', () => {
    expect(validateLocalFile({ name: 'PHOTO.JPG', type: 'image/jpeg', size: 1024 }, 'avatar')).toBe(
      'image/jpeg',
    )
    expect(validateLocalFile({ name: 'portfolio.pdf', type: '', size: 1024 })).toBe(
      'application/pdf',
    )
    for (const file of [
      { name: 'photo.svg', type: 'image/svg+xml', size: 20 },
      { name: 'photo.png', type: 'text/html', size: 20 },
      { name: 'document.pdf', type: 'application/pdf', size: 20 },
    ])
      expect(() => validateLocalFile(file, 'avatar')).toThrow(LocalFileError)
    expect(() =>
      validateLocalFile({ name: 'a.jpg', type: '', size: 5 * 1024 * 1024 + 1 }, 'avatar'),
    ).toThrowError('size')
    expect(() =>
      validateLocalFile({ name: 'a.pdf', type: '', size: 10 * 1024 * 1024 + 1 }),
    ).toThrowError('size')
    expect(() => validateLocalFile({ name: 'a.pdf', type: '', size: 0 })).toThrowError('empty')
  })
  it('rejects falsely labelled content before attempting storage', async () => {
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    const file = new NodeFile(['<html>not a pdf</html>'], 'pretend.pdf', {
      type: 'application/pdf',
    }) as unknown as File
    await expect(saveLocalFile(file)).rejects.toMatchObject({ code: 'invalid' })
    expect(open).not.toHaveBeenCalled()
  })
  it('does not claim persistence when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    await expect(readLocalFile('old-avatar')).rejects.toMatchObject({ code: 'storage' })
    const file = new NodeFile(['%PDF-1.4 test'], 'valid.pdf', {
      type: 'application/pdf',
    }) as unknown as File
    await expect(saveLocalFile(file)).rejects.toMatchObject({ code: 'storage' })
  })
  it('waits for transaction commit; an abort after a successful request remains an error', async () => {
    let openRequest: Record<string, unknown> = {}
    let transaction: Record<string, unknown> = {}
    let writeRequest: Record<string, unknown> = {}
    const close = vi.fn()
    const put = vi.fn(() => writeRequest)
    const db = { close, transaction: () => transaction, objectStoreNames: { contains: () => true } }
    vi.stubGlobal('indexedDB', { open: () => openRequest })
    openRequest = { result: db }
    transaction = { objectStore: () => ({ put }) }
    writeRequest = { result: 'attachment-id' }
    const file = new NodeFile(['%PDF-1.4 test'], 'valid.pdf', {
      type: 'application/pdf',
    }) as unknown as File
    const outcome = saveLocalFile(file)
    let settled = false
    void outcome.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )
    await vi.waitFor(() => expect(openRequest.onsuccess).toBeTypeOf('function'))
    ;(openRequest.onsuccess as () => void)()
    await vi.waitFor(() => expect(writeRequest.onsuccess).toBeTypeOf('function'))
    ;(writeRequest.onsuccess as () => void)()
    await Promise.resolve()
    expect(settled).toBe(false)
    ;(transaction.onabort as () => void)()
    await expect(outcome).rejects.toMatchObject({ code: 'storage' })
    expect(close).toHaveBeenCalledOnce()
  })
})
