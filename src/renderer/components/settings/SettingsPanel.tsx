import { useState, useEffect } from 'react'
import { X, Cloud, BookText, Shield, Palette, User, Download, Languages } from 'lucide-react'
import { useSettings } from '../../contexts/SettingsContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useNotification } from '../../contexts/NotificationContext'
import { ApiConfig } from './ApiConfig'
import { SystemPrompts } from './SystemPrompts'
import { PrivacySettings } from './PrivacySettings'
import { ProfileView } from '../profile/ProfileView'
import { ProfileWizard } from '../profile/ProfileWizard'
import { DataExport } from './DataExport'
import type { ThemeMode, Profile } from '../../../shared/types'
import { useTranslation } from 'react-i18next'

type Tab = 'api' | 'prompts' | 'privacy' | 'appearance' | 'profile' | 'data'

const tabs: { id: Tab; labelKey: string; icon: typeof Cloud }[] = [
  { id: 'profile', labelKey: 'settingsPanel.tabs.profile', icon: User },
  { id: 'api', labelKey: 'settingsPanel.tabs.api', icon: Cloud },
  { id: 'prompts', labelKey: 'settingsPanel.tabs.prompts', icon: BookText },
  { id: 'privacy', labelKey: 'settingsPanel.tabs.privacy', icon: Shield },
  { id: 'appearance', labelKey: 'settingsPanel.tabs.appearance', icon: Palette },
  { id: 'data', labelKey: 'settingsPanel.tabs.data', icon: Download },
]

interface SettingsPanelProps {
  onClose: () => void
  initialTab?: Tab
}

export function SettingsPanel({ onClose, initialTab = 'profile' }: SettingsPanelProps) {
  const { t, i18n } = useTranslation()
  const { settings, updateSettings, setThemeMode } = useSettings()
  const { mode, setMode } = useTheme()
  const { notify } = useNotification()
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if (window.api) {
      window.api.getProfile().then((p) => {
        setProfile(p ? { ...p, projects: p.projects ?? [], portfolio: p.portfolio ?? '' } : null)
        setProfileLoaded(true)
      })
    } else {
      setProfileLoaded(true)
    }
  }, [])

  useEffect(() => {
    const handler = () => {
      if (window.api) {
        window.api.getProfile().then((p) => {
          setProfile(p ? { ...p, projects: p.projects ?? [], portfolio: p.portfolio ?? '' } : null)
        })
      }
    }
    window.addEventListener('profile:imported', handler)
    return () => window.removeEventListener('profile:imported', handler)
  }, [])

  const handleSaveProfile = async (p: Profile) => {
    if (window.api) {
      await window.api.saveProfile(p)
    }
    setProfile(p)
    notify(t('settingsPanel.profileSaved'), 'success')
  }

  const handleWizardComplete = (p: Profile) => {
    setProfile(p)
    setShowWizard(false)
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[30rem] max-w-[90vw] bg-white dark:bg-gray-950 border-l shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">{t('settingsPanel.title')}</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-800 px-4" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(tab.labelKey)}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6">
        {activeTab === 'api' && (
          <ApiConfig
            baseUrl={settings.api.baseUrl}
            apiKey={settings.api.apiKey}
            model={settings.api.model}
            onChange={(api) => updateSettings({ api })}
          />
        )}

        {activeTab === 'prompts' && (
          <SystemPrompts
            systemPrompt={settings.systemPrompt}
            onChange={(systemPrompt) => updateSettings({ systemPrompt })}
          />
        )}

        {activeTab === 'privacy' && (
          <PrivacySettings
            storeHistory={settings.privacy.storeHistory}
            excludeFromTraining={settings.privacy.excludeFromTraining}
            onChange={(privacy) => updateSettings({ privacy })}
          />
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            {!profileLoaded ? (
              <div className="text-center py-8 text-sm text-gray-400">{t('settingsPanel.loadingProfile')}</div>
            ) : profile ? (
              <>
                <ProfileView profile={profile} onSave={handleSaveProfile} onEdit={() => setShowWizard(true)} />
                {showWizard && <ProfileWizard onClose={() => setShowWizard(false)} onComplete={handleWizardComplete} />}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">👤</div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t('settingsPanel.profileNotFound')}</p>
                <button
                  onClick={() => setShowWizard(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {t('settingsPanel.createProfile')}
                </button>
                {showWizard && <ProfileWizard onClose={() => setShowWizard(false)} onComplete={handleWizardComplete} />}
              </div>
            )}
          </div>
        )}

        {activeTab === 'data' && (
          <DataExport />
        )}

        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settingsPanel.appearanceMode')}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {(['light', 'dark', 'system'] as ThemeMode[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setMode(option)}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      mode === option
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-lg mb-1">
                      {option === 'light' ? '☀️' : option === 'dark' ? '🌙' : '🖥️'}
                    </div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {option === 'light' ? t('settingsPanel.light') : option === 'dark' ? t('settingsPanel.dark') : t('settingsPanel.system')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('language.language')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['en', 'es'] as const).map((locale) => (
                  <button
                    key={locale}
                    onClick={() => {
                      updateSettings({ locale })
                    }}
                    className={`p-4 rounded-xl border-2 text-center transition-all ${
                      (i18n.language?.startsWith('es') ? 'es' : 'en') === locale
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="text-lg mb-1">
                      {locale === 'en' ? '🇺🇸' : '🇪🇸'}
                    </div>
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {locale === 'en' ? t('language.en') : t('language.es')}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setThemeMode(mode)
                notify(t('settingsPanel.preferencesSaved'), 'success')
              }}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              {t('settingsPanel.savePreferences')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
