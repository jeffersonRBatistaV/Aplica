import { type ReactNode } from 'react'
import { ThemeProvider } from './ThemeContext'
import { SettingsProvider, useSettings } from './SettingsContext'
import { ChatProvider } from './ChatContext'
import { NavigationProvider } from './NavigationContext'
import { NotificationProvider } from './NotificationContext'
import type { ThemeMode } from '../../shared/types'

function ThemeProviderWithSettings({ children }: { children: ReactNode }) {
  const { settings, loaded } = useSettings()
  const initialMode = loaded ? (settings.appearance.mode as ThemeMode) : undefined

  return <ThemeProvider initialMode={initialMode}>{children}</ThemeProvider>
}

export function AppProvider({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <ThemeProviderWithSettings>
        <NavigationProvider>
          <ChatProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </ChatProvider>
        </NavigationProvider>
      </ThemeProviderWithSettings>
    </SettingsProvider>
  )
}

export { useTheme } from './ThemeContext'
export { useSettings } from './SettingsContext'
export { useChat } from './ChatContext'
export { useNavigation } from './NavigationContext'
export { useNotification } from './NotificationContext'
