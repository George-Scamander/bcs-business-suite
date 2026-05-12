import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  preference: ThemePreference
  resolvedTheme: ResolvedTheme
  setPreference: (value: ThemePreference) => void
}

const THEME_PREFERENCE_KEY = 'bcs-theme-preference'
const DARK_QUERY = '(prefers-color-scheme: dark)'
const LIGHT_THEME_COLOR = '#f8fafc'
const DARK_THEME_COLOR = '#0b1220'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function resolvePreference(value: string | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }
  return 'system'
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreference] = useState<ThemePreference>(() => resolvePreference(localStorage.getItem(THEME_PREFERENCE_KEY)))
  const [prefersDark, setPrefersDark] = useState<boolean>(() => window.matchMedia(DARK_QUERY).matches)

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const listener = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches)
    }

    media.addEventListener('change', listener)
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(THEME_PREFERENCE_KEY, preference)
  }, [preference])

  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (preference === 'system') {
      return prefersDark ? 'dark' : 'light'
    }

    return preference
  }, [preference, prefersDark])

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', resolvedTheme)
    root.style.colorScheme = resolvedTheme

    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', resolvedTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
    }
  }, [resolvedTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme,
      setPreference,
    }),
    [preference, resolvedTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useAppTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useAppTheme must be used within ThemeProvider')
  }
  return context
}
