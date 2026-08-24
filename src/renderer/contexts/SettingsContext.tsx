import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { AppSettings, ThemeMode, Profile } from '../../shared/types'
import i18n from '../i18n'

const DEFAULT_SETTINGS: AppSettings = {
  api: { baseUrl: 'http://localhost:11434/v1', apiKey: '', model: 'llama3', configured: false },
  investigate: { baseUrl: 'https://aplica.207.244.232.191.sslip.io', apiToken: '', configured: false },
  appearance: { mode: 'system' },
  privacy: { storeHistory: true, excludeFromTraining: false },
  systemPrompt: '',
  locale: 'en',
  ttsVoice: '',
  preferredCurrency: 'USD',
  emailConfig: { provider: 'gmail', host: '', port: 587, secure: false, user: '', pass: '', fromName: '', configured: false },
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
  profiles: Profile[]
  activeProfileId: string | null
  setActiveProfile: (id: string) => Promise<void>
  reloadProfiles: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)

  const reloadProfiles = useCallback(async () => {
    if (!window.api) return
    const [list, active] = await Promise.all([
      window.api.listProfiles(),
      window.api.getProfile(),
    ])
    setProfiles(list)
    setActiveProfileId(active?.id ?? null)
  }, [])

  useEffect(() => {
    if (!window.api) {
      setLoaded(true)
      return
    }
    window.api.getSettings().then((saved) => {
      if (saved) {
        const merged = {
          ...DEFAULT_SETTINGS,
          ...saved,
          api: { ...DEFAULT_SETTINGS.api, ...saved.api },
          appearance: { ...DEFAULT_SETTINGS.appearance, ...saved.appearance },
          investigate: { ...DEFAULT_SETTINGS.investigate, ...saved.investigate },
          emailConfig: { ...DEFAULT_SETTINGS.emailConfig, ...(saved.emailConfig ?? {}) },
        } as AppSettings
        setSettings(merged)
        if (saved.locale) {
          i18n.changeLanguage(saved.locale)
        }
      }
      setLoaded(true)
    })
    reloadProfiles()
  }, [reloadProfiles])

  useEffect(() => {
    const handler = () => {
      if (!window.api) return
      window.api.getSettings().then((r) => {
        const saved = r
        if (saved) {
          const merged = {
            ...DEFAULT_SETTINGS,
            ...saved,
            api: { ...DEFAULT_SETTINGS.api, ...saved.api },
            appearance: { ...DEFAULT_SETTINGS.appearance, ...saved.appearance },
            investigate: { ...DEFAULT_SETTINGS.investigate, ...saved.investigate },
            emailConfig: { ...DEFAULT_SETTINGS.emailConfig, ...(saved.emailConfig ?? {}) },
          } as AppSettings
          setSettings(merged)
          if (saved.locale) {
            i18n.changeLanguage(saved.locale)
          }
        }
        setLoaded(true)
      })
    }
    window.addEventListener('data:imported', handler)
    return () => window.removeEventListener('data:imported', handler)
  }, [])

  useEffect(() => {
    const handler = () => {
      reloadProfiles()
    }
    window.addEventListener('profile:updated', handler)
    window.addEventListener('profile:imported', handler)
    return () => {
      window.removeEventListener('profile:updated', handler)
      window.removeEventListener('profile:imported', handler)
    }
  }, [reloadProfiles])

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

  const setActiveProfile = useCallback(
    async (id: string) => {
      if (!window.api) return
      const profile = await window.api.setActiveProfile(id)
      setActiveProfileId(profile.id ?? null)
      window.dispatchEvent(new Event('profile:updated'))
      window.dispatchEvent(new Event('profile:imported'))
      reloadProfiles()
    },
    [reloadProfiles],
  )

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, setThemeMode, loaded, profiles, activeProfileId, setActiveProfile, reloadProfiles }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
