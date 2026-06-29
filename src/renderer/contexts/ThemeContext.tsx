import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { ThemeMode } from '../../shared/types'

interface ThemeContextValue {
  mode: ThemeMode
  isDark: boolean
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function getSystemIsDark(): boolean {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
}

function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
}

interface ThemeProviderProps {
  children: ReactNode
  initialMode?: ThemeMode
}

export function ThemeProvider({ children, initialMode }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode || 'system')
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    if (initialMode) {
      setModeState(initialMode)
    }
  }, [initialMode])

  const isDark = mode === 'system' ? systemDark : mode === 'dark'

  useEffect(() => {
    if (window.api) {
      window.api.getSystemTheme().then((dark) => setSystemDark(dark))
      const unsub = window.api.onSystemThemeChange((dark) => setSystemDark(dark))
      return unsub
    }
  }, [])

  useEffect(() => {
    applyTheme(isDark)
  }, [isDark])

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode)
  }, [])

  const toggle = useCallback(() => {
    setMode(isDark ? 'light' : 'dark')
  }, [isDark, setMode])

  return (
    <ThemeContext.Provider value={{ mode, isDark, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
