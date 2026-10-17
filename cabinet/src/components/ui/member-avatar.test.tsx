import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemberAvatar } from './member-avatar'
const { read } = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../../services/local-files', () => ({ readLocalFile: read }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
describe('local member avatar lifecycle', () => {
  it('uses initials for missing local photos and inaccessible storage', async () => {
    read.mockRejectedValue(new Error('Browser storage disabled'))
    await act(async () => render(<MemberAvatar fileId="missing" name="Айша Тарап" />))
    expect(screen.getByRole('img', { name: 'Айша Тарап' })).toHaveTextContent('АТ')
    expect(screen.getByRole('img', { name: 'Айша Тарап' }).querySelector('img')).toBeNull()
  })
  it('ignores a stale read and revokes only the URL that belongs to the displayed file', async () => {
    let first!: (blob: Blob) => void
    const makeURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:second-photo')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    read
      .mockImplementationOnce(
        () =>
          new Promise<Blob>((resolve) => {
            first = resolve
          }),
      )
      .mockResolvedValueOnce(new Blob(['photo'], { type: 'image/jpeg' }))
    const rendered = render(<MemberAvatar fileId="first" name="Айша Тарап" />)
    await act(async () => rendered.rerender(<MemberAvatar fileId="second" name="Айша Тарап" />))
    expect(screen.getByRole('img', { name: 'Айша Тарап' }).querySelector('img')).toHaveAttribute(
      'src',
      'blob:second-photo',
    )
    await act(async () => first(new Blob(['old'], { type: 'image/jpeg' })))
    expect(makeURL).toHaveBeenCalledOnce()
    rendered.unmount()
    expect(revoke).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:second-photo')
  })
})
