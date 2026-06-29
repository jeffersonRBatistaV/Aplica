import { useState, useEffect } from 'react'
import './types/ipc'
import { AppProvider, useNavigation, useSettings } from './contexts/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { ChatView } from './components/chat/ChatView'
import { Vacantes } from './components/vacantes/Vacantes'
import { Analytics } from './components/analytics/Analytics'
import { NotificationContainer } from './components/ui/NotificationContainer'
import { ProfileWizard } from './components/profile/ProfileWizard'
import { ApiSetupModal } from './components/settings/ApiSetupModal'
import type { Profile } from '../shared/types'

function AppContent() {
  const { currentView } = useNavigation()
  const { settings, loaded: settingsLoaded } = useSettings()
  const [profile, setProfile] = useState<Profile | null | 'loading'>('loading')
  const [showWizard, setShowWizard] = useState(false)
  const [showApiSetup, setShowApiSetup] = useState(false)
  const [profileJustCreated, setProfileJustCreated] = useState(false)

  useEffect(() => {
    if (window.api) {
      window.api.getProfile().then((p) => {
        setProfile(p)
        if (!p) setShowWizard(true)
      })
    } else {
      setProfile(null)
      setShowWizard(true)
    }
  }, [])

  useEffect(() => {
    if (!profileJustCreated) return
    if (!settingsLoaded) return
    if (!settings.api.configured) {
      setShowApiSetup(true)
    }
  }, [profileJustCreated, settingsLoaded, settings.api.configured])

  const handleWizardComplete = (p: Profile) => {
    setProfile(p)
    setProfileJustCreated(true)
    setShowWizard(false)
  }

  const handleApiSetupComplete = () => {
    setShowApiSetup(false)
  }

  return (
    <MainLayout>
        {currentView === 'chat' ? <ChatView /> : currentView === 'analytics' ? <Analytics /> : <Vacantes />}

      {showWizard && (
        <ProfileWizard
          onClose={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
        />
      )}

      {!showWizard && showApiSetup && (
        <ApiSetupModal onComplete={handleApiSetupComplete} />
      )}

      <NotificationContainer />
    </MainLayout>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
