import type { ComponentType, CSSProperties } from 'react'

export type PhosphorIcon = ComponentType<{
  size?: number
  weight?: any
  color?: string
  style?: CSSProperties
}>

export function UiIcon(props: {
  icon: PhosphorIcon
  size: number
  weight?: any
  color?: string
  boxed?: boolean
  boxStyle?: CSSProperties
  iconStyle?: CSSProperties
}) {
  const { icon: Icon, size, weight, color, boxed = false, boxStyle, iconStyle } = props
  const iconProps: { size: number; weight?: any; color?: string; style: CSSProperties } = {
    size,
    style: { display: 'block', ...iconStyle },
    ...(weight !== undefined ? { weight } : {}),
    ...(color !== undefined ? { color } : {}),
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        lineHeight: 0,
        verticalAlign: 'middle',
        ...(boxed
          ? {
              backgroundColor: 'var(--toko-icon-bg, transparent)',
              border: '1px solid var(--toko-icon-border, transparent)',
              borderRadius: 'var(--toko-icon-radius, 8px)',
              boxSizing: 'border-box',
            }
          : {}),
        ...boxStyle,
      }}
    >
      <Icon {...iconProps} />
    </span>
  )
}
