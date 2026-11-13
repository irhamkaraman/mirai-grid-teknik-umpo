import React, { createContext, useContext, useState, useEffect } from 'react'

export const ThemeContext = createContext({
  theme: 'v1',
  isV2: false,
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children, value }) {
  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context || !context.theme) {
    const isV2 =
      typeof document !== 'undefined' &&
      (document.documentElement.classList.contains('theme-v2') ||
        document.body.classList.contains('theme-v2') ||
        localStorage.getItem('miraigrid_theme_mode') === 'v2')

    return {
      theme: isV2 ? 'v2' : 'v1',
      isV2,
      toggleTheme: () => {},
      setTheme: () => {},
    }
  }
  return context
}
