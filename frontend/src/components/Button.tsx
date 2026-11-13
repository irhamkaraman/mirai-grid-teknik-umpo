import React from 'react'
import { Loader2 } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'emerald' | 'danger' | 'danger-solid' | 'ghost' | 'outline'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type IconPosition = 'left' | 'right'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ComponentType<{ className?: string }> | React.ReactElement
  iconPosition?: IconPosition
  loading?: boolean
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

/**
 * Reusable Button component adhering to Miraigrid SaaS V2 clean design guidelines.
 * Supports primary, secondary, emerald, danger variants with customizable size and loading state.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center font-medium font-sans transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]'

  const variantClasses: Record<ButtonVariant, string> = {
    primary:
      'bg-slate-900 hover:bg-slate-800 text-white rounded-lg border border-transparent shadow-sm focus:ring-slate-900',
    secondary:
      'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg shadow-xs focus:ring-slate-300',
    emerald:
      'bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg border border-transparent shadow-sm focus:ring-emerald-500',
    danger:
      'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg focus:ring-rose-400',
    'danger-solid':
      'bg-rose-600 hover:bg-rose-700 text-white rounded-lg border border-transparent shadow-sm focus:ring-rose-500',
    ghost:
      'bg-transparent hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg border border-transparent focus:ring-slate-200',
    outline:
      'bg-transparent hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg focus:ring-slate-300',
  }

  const sizeClasses: Record<ButtonSize, string> = {
    xs: 'px-2.5 py-1 text-xs gap-1.5 rounded-md',
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
    md: 'px-4 py-2 text-sm gap-2 rounded-lg',
    lg: 'px-5 py-2.5 text-base gap-2.5 rounded-lg',
  }

  const iconSizes: Record<ButtonSize, string> = {
    xs: 'h-3.5 w-3.5',
    sm: 'h-4 w-4',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  const resolvedVariant = variantClasses[variant] || variantClasses.primary
  const resolvedSize = sizeClasses[size] || sizeClasses.md
  const iconSizeClass = iconSizes[size] || iconSizes.md

  const renderIcon = () => {
    if (loading) {
      return <Loader2 className={clsx(iconSizeClass, 'animate-spin shrink-0')} />
    }
    if (!Icon) return null
    if (React.isValidElement(Icon)) {
      return React.cloneElement(Icon as React.ReactElement<{ className?: string }>, {
        className: twMerge(iconSizeClass, 'shrink-0', (Icon.props as { className?: string }).className),
      })
    }
    const IconComponent = Icon as React.ComponentType<{ className?: string }>
    return <IconComponent className={clsx(iconSizeClass, 'shrink-0')} />
  }

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={twMerge(clsx(baseClasses, resolvedVariant, resolvedSize, className))}
      {...props}
    >
      {iconPosition === 'left' && renderIcon()}
      {children && <span>{children}</span>}
      {iconPosition === 'right' && renderIcon()}
    </button>
  )
}
