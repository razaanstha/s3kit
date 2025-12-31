import type { CSSProperties, ReactNode } from 'react'
import { Button as BaseButton } from '@base-ui/react'
import type { FileManagerTheme } from '../theme/fileManagerTheme'

export function Button({
  children,
  variant = 'secondary',
  onClick,
  style,
  theme,
  disabled = false,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'danger'
  onClick?: () => void
  style?: CSSProperties
  theme: FileManagerTheme
  disabled?: boolean
}) {
  const baseStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    border: '1px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 0.15s',
    opacity: disabled ? 0.6 : 1,
    ...style,
  }

  const variants = {
    primary: {
      backgroundColor: theme.accent,
      color: theme.bg,
      borderColor: theme.accent,
    },
    secondary: {
      backgroundColor: theme.bg,
      color: theme.text,
      borderColor: theme.border,
    },
    danger: {
      backgroundColor: theme.bg,
      color: theme.danger,
      borderColor: theme.danger,
    },
  }

  return (
    <BaseButton
      type="button"
      style={{ ...baseStyle, ...variants[variant] }}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {children}
    </BaseButton>
  )
}
