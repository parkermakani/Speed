import React from 'react'

interface TextProps {
  children: React.ReactNode
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label'
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl'
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  color?: 'primary' | 'secondary' | 'muted' | 'inverse' | 'accent' | 'success' | 'warning' | 'error'
  align?: 'left' | 'center' | 'right'
  leading?: 'tight' | 'normal' | 'relaxed'
  font?: 'sans' | 'mono'
  truncate?: boolean
  className?: string
  htmlFor?: string
  role?: string
  style?: React.CSSProperties
  id?: string
}

const sizeMap = {
  xs: 'var(--text-xs)',
  sm: 'var(--text-sm)',
  base: 'var(--text-base)',
  lg: 'var(--text-lg)',
  xl: 'var(--text-xl)',
  '2xl': 'var(--text-2xl)',
  '3xl': 'var(--text-3xl)',
  '4xl': 'var(--text-4xl)'
}

const weightMap = {
  normal: 'var(--font-weight-normal)',
  medium: 'var(--font-weight-medium)',
  semibold: 'var(--font-weight-semibold)',
  bold: 'var(--font-weight-bold)'
}

const colorMap = {
  primary: 'var(--color-text)',
  secondary: 'var(--color-text-secondary)',
  muted: 'var(--color-text-muted)',
  inverse: 'var(--color-text-inverse)',
  accent: 'var(--color-accent)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)'
}

const leadingMap = {
  tight: 'var(--line-height-tight)',
  normal: 'var(--line-height-normal)',
  relaxed: 'var(--line-height-relaxed)'
}

const fontMap = {
  sans: 'var(--font-sans)',
  mono: 'var(--font-mono)'
}

export function Text({
  children,
  as = 'p',
  size = 'base',
  weight = 'normal',
  color = 'primary',
  align = 'left',
  leading = 'normal',
  font = 'sans',
  truncate = false,
  className = '',
  htmlFor,
  role,
  style: userStyle,
  id
}: TextProps) {
  const Component = as
  
  const style: React.CSSProperties = {
    fontSize: sizeMap[size],
    fontWeight: weightMap[weight],
    color: colorMap[color],
    textAlign: align,
    lineHeight: leadingMap[leading],
    fontFamily: fontMap[font],
    margin: 0,
    ...(truncate && {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }),
    ...userStyle
  }

  const props: any = {
    className,
    style,
    ...(htmlFor && { htmlFor }),
    ...(role && { role }),
    ...(id && { id })
  }

  return (
    <Component {...props}>
      {children}
    </Component>
  )
}