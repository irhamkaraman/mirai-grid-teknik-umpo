import React from 'react'
import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'

export default function Card({
  children,
  className = '',
  hover = false,
  padding = 'md',
  ...props
}) {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3.5 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  }

  return (
    <div
      className={twMerge(
        clsx(
          'bg-white border border-slate-200/80 rounded-xl transition-colors duration-150 font-sans',
          hover && 'hover:border-slate-300 hover:bg-slate-50/50',
          paddingClasses[padding] || paddingClasses.md,
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  )
}

Card.Header = function CardHeader({ children, className = '', ...props }) {
  return (
    <div
      className={twMerge(
        clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100', className)
      )}
      {...props}
    >
      {children}
    </div>
  )
}

Card.Title = function CardTitle({ children, className = '', as = 'h3', ...props }) {
  const Component = as
  return (
    <Component
      className={twMerge(
        clsx('text-base font-bold text-slate-900 font-sans tracking-tight', className)
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

Card.Description = function CardDescription({ children, className = '', ...props }) {
  return (
    <p
      className={twMerge(
        clsx('text-xs text-slate-500 font-sans mt-0.5 leading-relaxed', className)
      )}
      {...props}
    >
      {children}
    </p>
  )
}

Card.Content = function CardContent({ children, className = '', ...props }) {
  return (
    <div className={twMerge(clsx('space-y-4', className))} {...props}>
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={twMerge(
        clsx('flex items-center justify-end gap-2.5 mt-5 pt-3.5 border-t border-slate-100', className)
      )}
      {...props}
    >
      {children}
    </div>
  )
}
