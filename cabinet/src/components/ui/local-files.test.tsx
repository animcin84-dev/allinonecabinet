import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { LocalAttachment } from '../../domain/types'
import { LocalFileError } from '../../services/local-files'
import { LocalFilePicker } from './local-files'
const { save, read, remove } = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn(), remove: vi.fn() }))
vi.mock('../../app/context', () => ({ useClub: () => ({ tx: (ru: string) => ru }) }))
vi.mock('../../services/local-files', async (original) => ({
  ...(await original<typeof import('../../services/local-files')>()),
  saveLocalFile: save,
  readLocalFile: read,
  deleteLocalFile: remove,
}))
const old: LocalAttachment = {
  id: 'old',
  name: 'old.pdf',
  type: 'application/pdf',
  size: 1024,
  createdAt: '2026-10-09T00:00:00Z',
}
const added: LocalAttachment = { ...old, id: 'new', name: 'new.pdf' }
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
describe('local file picker', () => {
  it('preserves existing attachments after storage failure and announces the real error', async () => {
    read.mockResolvedValue(undefined)
    save.mockRejectedValue(new LocalFileError('storage'))
    const onChange = vi.fn()
    render(<LocalFilePicker value={[old]} onChange={onChange} />)
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Файлы портфолио / материалы'), {
        target: { files: [new File(['pdf'], 'new.pdf', { type: 'application/pdf' })] },
      }),
    )
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Браузер не сохранил файл')
    expect(screen.getByText('old.pdf')).toBeInTheDocument()
    expect(screen.getByLabelText('Файлы портфолио / материалы')).toBeEnabled()
  })
  it('rolls back only newly saved batch files when a later file fails', async () => {
    read.mockResolvedValue(undefined)
    save.mockResolvedValueOnce(added).mockRejectedValueOnce(new LocalFileError('invalid'))
    remove.mockResolvedValue(undefined)
    const onChange = vi.fn()
    render(<LocalFilePicker value={[old]} onChange={onChange} />)
    await act(async () =>
      fireEvent.change(screen.getByLabelText('Файлы портфолио / материалы'), {
        target: { files: [new File(['pdf'], 'new.pdf'), new File(['bad'], 'bad.pdf')] },
      }),
    )
    expect(onChange).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('new')
    expect(remove).not.toHaveBeenCalledWith('old')
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось прочитать файл')
  })
  it('blocks another selection while saving, then exposes committed metadata', async () => {
    read.mockResolvedValue(undefined)
    let complete!: (value: LocalAttachment) => void
    save.mockImplementationOnce(
      () =>
        new Promise<LocalAttachment>((resolve) => {
          complete = resolve
        }),
    )
    const onChange = vi.fn()
    render(<LocalFilePicker value={[old]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Файлы портфолио / материалы'), {
      target: { files: [new File(['pdf'], 'new.pdf')] },
    })
    expect(screen.getByLabelText('Файлы портфолио / материалы')).toBeDisabled()
    expect(onChange).not.toHaveBeenCalled()
    await act(async () => complete(added))
    expect(onChange).toHaveBeenCalledWith([old, added])
    expect(screen.getByRole('status', { name: '' })).toHaveTextContent(
      'Файлы сохранены в этом браузере',
    )
  })
  it('retains download and preview actions in read-only reviews and does not offer removal', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:local-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    read.mockResolvedValue(new Blob(['%PDF-'], { type: 'application/pdf' }))
    await act(async () => render(<LocalFilePicker value={[old]} onChange={vi.fn()} disabled />))
    expect(screen.queryByLabelText('Файлы портфолио / материалы')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Скачать: old.pdf' })).toHaveAttribute(
      'href',
      'blob:local-test',
    )
    expect(screen.getByRole('button', { name: 'Просмотреть: old.pdf' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Убрать файл: old.pdf' })).not.toBeInTheDocument()
  })
})
