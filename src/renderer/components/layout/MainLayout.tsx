import { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Sun, Moon, Monitor, MessageSquare, Languages } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext'
import { useChat } from '../../contexts/ChatContext'
import { useSettings } from '../../contexts/SettingsContext'
import { Button } from '../ui/Button'
import { SettingsPanel } from '../settings/SettingsPanel'
import { useTranslation } from 'react-i18next'

interface MainLayoutProps {
  children: React.ReactNode
}

const themeIcons = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

export function MainLayout({ children }: MainLayoutProps) {
  const { t, i18n } = useTranslation()
  const { mode, isDark, setMode } = useTheme()
  const { settings, updateSettings } = useSettings()
  const { activeConversation } = useChat()
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'api' | 'prompts' | 'privacy' | 'appearance' | 'profile'>('api')

  const cycleMode = () => {
    const modes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const idx = modes.indexOf(mode)
    const nextMode = modes[(idx + 1) % modes.length]
    setMode(nextMode)
    updateSettings({ appearance: { mode: nextMode } })
  }

  const toggleLanguage = () => {
    const next = i18n.language?.startsWith('es') ? 'en' : 'es'
    updateSettings({ locale: next })
  }

  const ThemeIcon = themeIcons[mode]

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar onOpenSettings={() => { setSettingsTab('api'); setShowSettings(true) }} onOpenProfile={() => { setSettingsTab('profile'); setShowSettings(true) }} />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b flex items-center justify-between px-6 flex-shrink-0 bg-white dark:bg-gray-950">
          <div className="flex items-center gap-3 min-w-0">
            {activeConversation ? (
              <>
                <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {activeConversation.title}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {activeConversation.messages.length} {t('common.messages')}
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400">{t('mainLayout.noActiveConversation')}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              title={i18n.language?.startsWith('es') ? 'English' : 'Español'}
            >
              <Languages className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleMode}
              title={`${t('mainLayout.theme')}: ${t(`mainLayout.${mode}`)}${mode === 'system' ? ` (${isDark ? t('mainLayout.dark') : t('mainLayout.light')})` : ''}`}
            >
              <ThemeIcon className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {children}
      </div>

      {/* Settings drawer overlay */}
      {showSettings && (
        <>
          <div
            className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40"
            onClick={() => setShowSettings(false)}
          />
          <SettingsPanel onClose={() => setShowSettings(false)} initialTab={settingsTab} />
        </>
      )}
    </div>
  )
}
