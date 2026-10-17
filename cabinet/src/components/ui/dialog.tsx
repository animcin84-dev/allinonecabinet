import { Dialog as BaseDialog } from '@base-ui/react/dialog'
import type { ReactNode } from 'react'
// Base UI composition following shadcn's Base preset: one primitive system.
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = '',
  trigger,
  closeLabel = 'Закрыть',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  trigger?: ReactNode
  closeLabel?: string
}) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <BaseDialog.Trigger className="button ghost">{trigger}</BaseDialog.Trigger>}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className="dialog-backdrop" />
        <BaseDialog.Popup className={`dialog-popup ${className}`}>
          <div className="section-title">
            <BaseDialog.Title className="dialog-title">{title}</BaseDialog.Title>
            <BaseDialog.Close className="icon-button" aria-label={closeLabel}>
              ×
            </BaseDialog.Close>
          </div>
          {description && (
            <BaseDialog.Description className="muted">{description}</BaseDialog.Description>
          )}
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  )
}
