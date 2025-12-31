import { useEffect, useState } from 'react'

export type FileManagerTheme = {
  bg: string
  bgSecondary: string
  text: string
  textSecondary: string
  border: string
  accent: string
  hover: string
  selected: string
  danger: string
}

export const lightTheme: FileManagerTheme = {
  bg: '#ffffff',
  bgSecondary: '#fafafa',
  text: '#111111',
  textSecondary: '#666666',
  border: '#eaeaea',
  accent: '#000000',
  hover: '#f4f4f4',
  selected: '#eeeeee',
  danger: '#d32f2f',
}

export const darkTheme: FileManagerTheme = {
  bg: '#0a0a0a',
  bgSecondary: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#a1a1aa',
  border: '#27272a',
  accent: '#ffffff',
  hover: '#18181b',
  selected: '#27272a',
  danger: '#ef4444',
}

export function useTheme(themeMode: 'light' | 'dark' | 'system' = 'light') {
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

      const handleChange = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? 'dark' : 'light')
      }

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [themeMode])

  const activeTheme = themeMode === 'system' ? systemTheme : themeMode
  return activeTheme === 'dark' ? darkTheme : lightTheme
}
