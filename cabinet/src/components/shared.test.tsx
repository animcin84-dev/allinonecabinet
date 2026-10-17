import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { Field } from './shared'

afterEach(cleanup)
describe('field accessibility during validation', () => {
  it('keeps the name and typed value stable while announcing and clearing an error', async () => {
    const view = render(
      <Field label="Ссылка на работу">
        <input />
      </Field>,
    )
    const input = screen.getByRole('textbox', { name: 'Ссылка на работу' })
    await userEvent.type(input, 'не ссылка')
    view.rerender(
      <Field label="Ссылка на работу" error="Укажи полную HTTP/HTTPS-ссылку.">
        <input />
      </Field>,
    )
    expect(screen.getByLabelText('Ссылка на работу', { exact: true })).toBe(input)
    expect(input).toHaveValue('не ссылка')
    expect(input).toHaveAccessibleDescription('Укажи полную HTTP/HTTPS-ссылку.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Укажи полную HTTP/HTTPS-ссылку.')
    view.rerender(
      <Field label="Ссылка на работу">
        <input />
      </Field>,
    )
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(input).not.toHaveAttribute('aria-invalid')
  })
  it('preserves an existing input ID and description when adding validation feedback', () => {
    render(
      <>
        <p id="hint">Адрес опубликованной работы.</p>
        <Field label="Материал" error="Проверь ссылку.">
          <input id="material" aria-describedby="hint" />
        </Field>
      </>,
    )
    const input = screen.getByLabelText('Материал', { exact: true })
    expect(input).toHaveAttribute('id', 'material')
    expect(input).toHaveAccessibleDescription('Адрес опубликованной работы. Проверь ссылку.')
  })
})
