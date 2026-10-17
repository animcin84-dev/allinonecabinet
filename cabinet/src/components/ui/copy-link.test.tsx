import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { CopyLinkButton } from './copy-link'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('../../app/context', () => ({ useClub: () => ({ tx: (ru: string) => ru, toast }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  toast.mockClear()
})

describe('copy project/task link', () => {
  it('waits for clipboard success, blocks a second click and preserves the action label while pending', async () => {
    let finish!: () => void
    const writeText = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CopyLinkButton />)
    const button = screen.getByRole('button', { name: 'Скопировать ссылку' })
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(toast).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    await act(async () => finish())
    expect(screen.getByRole('button', { name: 'Скопировано' })).toBeEnabled()
    expect(toast).toHaveBeenCalledWith('Ссылка скопирована')
  })

  it('announces clipboard failure without showing false success, and lets the user retry', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValueOnce(new Error('Permission denied'))
      .mockResolvedValueOnce(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CopyLinkButton />)
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Скопировать ссылку' })),
    )
    expect(screen.queryByRole('button', { name: 'Скопировано' })).not.toBeInTheDocument()
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('Не удалось скопировать'))
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Скопировать ссылку' })),
    )
    expect(screen.getByRole('button', { name: 'Скопировано' })).toBeEnabled()
  })

  it('clears the previous success when a subsequent copy fails', async () => {
    const writeText = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Clipboard unavailable'))
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    render(<CopyLinkButton />)
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Скопировать ссылку' })),
    )
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Скопировано' })))
    expect(screen.queryByRole('button', { name: 'Скопировано' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Скопировать ссылку' })).toBeEnabled()
    expect(toast).toHaveBeenLastCalledWith(expect.stringContaining('Не удалось скопировать'))
  })
})
