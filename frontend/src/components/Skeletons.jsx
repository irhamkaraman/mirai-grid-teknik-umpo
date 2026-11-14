import React from 'react'
import { useTheme } from '../context/ThemeContext'

function useIsV2Theme() {
  const ctx = useTheme()
  if (ctx && typeof ctx.isV2 === 'boolean') {
    return ctx.isV2
  }
  if (typeof document !== 'undefined') {
    return (
      document.documentElement.classList.contains('theme-v2') ||
      document.documentElement.classList.contains('theme-mig-cloud')
    )
  }
  return false
}

export function SkeletonBox({ className = '', light = false }) {
  const isV2 = useIsV2Theme()
  if (isV2) {
    return <div className={`animate-pulse bg-slate-100 rounded-lg ${className}`}></div>
  }
  const shimmerClass = light ? 'skeleton-shimmer-light' : 'skeleton-shimmer'
  return <div className={`${shimmerClass} rounded-xl ${className}`}></div>
}

export function SkeletonCard({ light = false }) {
  const isV2 = useIsV2Theme()
  if (isV2) {
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
  const isV2 = useIsV2Theme()
  if (isV2) {
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
