import type { ReactNode } from 'react'
import { Dialog } from '@base-ui/react'
import type { FileManagerTheme } from '../theme/fileManagerTheme'
import { UiIcon } from './UiIcon'
import { X } from '@phosphor-icons/react'

export function Modal({
  open,
  onClose,
  title,
  children,
  theme,
  portalContainer,
  closeDisabled = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  theme: FileManagerTheme
  portalContainer?: HTMLElement
  closeDisabled?: boolean
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(open) => {
        if (!open && !closeDisabled) onClose()
      }}
    >
      <Dialog.Portal container={portalContainer}>
        <Dialog.Backdrop
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            backgroundColor: theme.bg === '#ffffff' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        />
        <Dialog.Popup
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 101,
            width: '100%',
            maxWidth: 400,
            backgroundColor: theme.bg,
            border: `1px solid ${theme.border}`,
            boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
            outline: 'none',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: `1px solid ${theme.border}`,
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: theme.text,
              }}
            >
              {title}
            </Dialog.Title>
            <Dialog.Close
              disabled={closeDisabled}
              style={{
                background: 'none',
                border: 'none',
                cursor: closeDisabled ? 'not-allowed' : 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.text,
                opacity: closeDisabled ? 0.5 : 1,
              }}
            >
              <UiIcon icon={X} size={18} />
            </Dialog.Close>
          </div>
          <div style={{ padding: 24 }}>{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
