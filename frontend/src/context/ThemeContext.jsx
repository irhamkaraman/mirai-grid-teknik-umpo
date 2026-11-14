import React, { createContext, useContext } from 'react'

export const ThemeContext = createContext({
  theme: 'v2',
  isV2: true,
  toggleTheme: () => {},
  setTheme: () => {},
})

export function ThemeProvider({ children, value }) {
  return (
    <ThemeContext.Provider value={value || { theme: 'v2', isV2: true, toggleTheme: () => {}, setTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    return {
      theme: 'v2',
      isV2: true,
      toggleTheme: () => {},
      setTheme: () => {},
    }
  }
  return context
}
