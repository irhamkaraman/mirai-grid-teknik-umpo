import React from 'react'

export function SkeletonBox({ className = '' }) {
  return <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`}></div>
}

export function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="animate-pulse space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-4 bg-slate-200 rounded w-1/3"></div>
          <div className="h-5 w-5 bg-slate-100 rounded-full"></div>
        </div>
        <div className="h-8 bg-slate-100 rounded-lg w-1/2"></div>
        <div className="h-2 bg-slate-100 rounded-full w-full"></div>
      </div>
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Spinner({ size = 'sm', className = '' }) {
  const sizeMap = {
    xs: 'h-3.5 w-3.5 border-2',
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  }

  return (
    <div
      className={`inline-block animate-spin rounded-full border-current border-t-transparent ${sizeMap[size] || sizeMap.sm} ${className}`}
    ></div>
  )
}
