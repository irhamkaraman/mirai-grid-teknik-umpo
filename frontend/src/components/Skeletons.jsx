import React from 'react'

export function SkeletonBox({ className = '', light = false }) {
  const shimmerClass = light ? 'skeleton-shimmer-light' : 'skeleton-shimmer'
  return <div className={`${shimmerClass} rounded-xl ${className}`}></div>
}

export function SkeletonCard({ light = false }) {
  if (light) {
    return (
      <div className="bg-[#FDFBF7] border border-[#D4C1AC] p-5 rounded-2xl space-y-3 shadow-sm">
        <div className="flex justify-between items-center">
          <SkeletonBox light className="h-4 w-28" />
          <SkeletonBox light className="h-5 w-5 rounded-full" />
        </div>
        <SkeletonBox light className="h-8 w-16" />
        <SkeletonBox light className="h-2 w-full rounded-full" />
      </div>
    )
  }
  return (
    <div className="bg-warmdark-850 border border-warmdark-750 p-5 rounded-2xl space-y-3">
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-4 w-28" />
        <SkeletonBox className="h-5 w-5 rounded-full" />
      </div>
      <SkeletonBox className="h-8 w-16" />
      <SkeletonBox className="h-2 w-full rounded-full" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, light = false }) {
  if (light) {
    return (
      <div className="bg-[#FDFBF7] border border-[#D4C1AC] rounded-2xl overflow-hidden p-4 space-y-3 shadow-sm">
        <SkeletonBox light className="h-5 w-1/4 mb-3" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex space-x-4 items-center py-2.5 border-b border-[#EADAC5]/70 last:border-0">
            <SkeletonBox light className="h-4 w-24" />
            <SkeletonBox light className="h-4 w-44" />
            <SkeletonBox light className="h-4 w-28" />
            <div className="ml-auto">
              <SkeletonBox light className="h-6 w-16 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="bg-warmdark-850 border border-warmdark-750 rounded-2xl overflow-hidden p-4 space-y-3">
      <SkeletonBox className="h-6 w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex space-x-4 items-center py-2 border-b border-warmdark-750/50">
          <SkeletonBox className="h-4 w-24" />
          <SkeletonBox className="h-4 w-40" />
          <SkeletonBox className="h-4 w-28" />
          <div className="ml-auto">
            <SkeletonBox className="h-6 w-16 rounded-lg" />
          </div>
        </div>
      ))}
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
