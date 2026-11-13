import React from 'react'
import { twMerge } from 'tailwind-merge'
import clsx from 'clsx'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  className?: string
  hover?: boolean
  padding?: CardPadding
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  className?: string
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
}

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode
  className?: string
}

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  className?: string
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
  className?: string
}

/**
 * Reusable Card component for Miraigrid SaaS V2.
 * Pure clean white container with subtle border and optional hover state.
 */
export default function Card({
  children,
  className = '',
  hover = false,
  padding = 'md',
  ...props
}: CardProps) {
  const paddingClasses: Record<CardPadding, string> = {
    none: 'p-0',
    sm: 'p-3.5 sm:p-4',
    md: 'p-5 sm:p-6',
    lg: 'p-6 sm:p-8',
  }

  return (
    <div
      className={twMerge(
        clsx(
          'bg-white border border-slate-200/90 rounded-xl shadow-xs transition-all duration-200 font-sans',
          hover && 'hover:border-slate-300 hover:shadow-sm',
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

Card.Header = function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
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

Card.Title = function CardTitle({ children, className = '', as = 'h3', ...props }: CardTitleProps) {
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

Card.Description = function CardDescription({ children, className = '', ...props }: CardDescriptionProps) {
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

Card.Content = function CardContent({ children, className = '', ...props }: CardContentProps) {
  return (
    <div className={twMerge(clsx('space-y-4', className))} {...props}>
      {children}
    </div>
  )
}

Card.Footer = function CardFooter({ children, className = '', ...props }: CardFooterProps) {
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
