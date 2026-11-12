import React from 'react'
import { Cloud, Sparkles } from 'lucide-react'

export default function ThemeToggle({ theme = 'v1', onToggle }) {
  const isV2 = theme === 'v2'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={isV2 ? 'Beralih ke Tema Klasik Vintage (v1)' : 'Beralih ke Tema Modern MiG-Cloud (v2)'}
      className={`group relative flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300 shadow-sm hover:scale-[1.02] active:scale-95 ${
        isV2
          ? 'bg-white hover:bg-emerald-50/60 border border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-700'
          : 'bg-[#3A2216] hover:bg-[#4D2E1F] border border-[#5C3825] hover:border-[#8A5132] text-[#FAF5EC]'
      }`}
    >
      {isV2 ? (
        <>
          <Sparkles className="h-4 w-4 text-amber-500 transition-transform group-hover:rotate-12 duration-300" />
          <span className="hidden sm:inline font-sans font-semibold">Beralih ke Klasik Vintage</span>
          <span className="inline sm:hidden font-sans font-semibold">Klasik</span>
          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-mono font-bold tracking-tight">
            v1
          </span>
        </>
      ) : (
        <>
          <Cloud className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
          <span className="hidden sm:inline font-sans font-semibold">Beralih ke MiG-Cloud</span>
          <span className="inline sm:hidden font-sans font-semibold">MiG-Cloud</span>
          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-bold tracking-tight">
            v2
          </span>
        </>
      )}
    </button>
  )
}
