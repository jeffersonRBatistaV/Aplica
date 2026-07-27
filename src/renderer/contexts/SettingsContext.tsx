import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { AppSettings, ThemeMode } from '../../shared/types'
import i18n from '../i18n'

const DEFAULT_SETTINGS: AppSettings = {
  api: { baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'llama3', configured: false },
  appearance: { mode: 'system' },
  privacy: { storeHistory: true, excludeFromTraining: false },
  systemPrompt: '',
  locale: 'en',
  ttsVoice: '',
  preferredCurrency: 'USD',
}

export function useLocale() {
  const locale = i18n.language?.startsWith('es') ? 'es' : 'en'
  const setLocale = async (lng: string) => {
    await i18n.changeLanguage(lng)
  }
  return { locale, setLocale }
}

interface SettingsContextValue {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  setThemeMode: (mode: ThemeMode) => Promise<void>
  loaded: boolean
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!window.api) {
      setLoaded(true)
      return
    }
    window.api.getSettings().then((saved) => {
      if (saved) {
        const merged = { ...DEFAULT_SETTINGS, ...saved, appearance: { ...DEFAULT_SETTINGS.appearance, ...saved.appearance } }
        setSettings(merged)
        if (saved.locale) {
          i18n.changeLanguage(saved.locale)
        }
      }
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    const handler = () => {
      if (!window.api) return
      window.api.getSettings().then((saved) => {
        if (saved) {
          const merged = { ...DEFAULT_SETTINGS, ...saved, appearance: { ...DEFAULT_SETTINGS.appearance, ...saved.appearance } }
          setSettings(merged)
          if (saved.locale) {
            i18n.changeLanguage(saved.locale)
          }
        }
      })
    }
    window.addEventListener('data:imported', handler)
    return () => window.removeEventListener('data:imported', handler)
  }, [])

  const persist = useCallback(async (next: AppSettings) => {
    setSettings(next)
    if (window.api) {
      await window.api.setSettings(next)
    }
  }, [])

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = { ...settings, ...partial }
      if (partial.locale) {
        i18n.changeLanguage(partial.locale)
      }
      await persist(next)
    },
    [settings, persist],
  )

  const setThemeMode = useCallback(
    async (mode: ThemeMode) => {
      await updateSettings({ appearance: { ...settings.appearance, mode } })
    },
    [updateSettings, settings.appearance],
  )

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, setThemeMode, loaded }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
