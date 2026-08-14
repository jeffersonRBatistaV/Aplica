import { useState, useEffect, useCallback, useRef } from 'react'
import './types/ipc'
import { AppProvider, useNavigation, useSettings } from './contexts/AppContext'
import { MainLayout } from './components/layout/MainLayout'
import { ChatView } from './components/chat/ChatView'
import { Vacantes } from './components/vacantes/Vacantes'
import { Analytics } from './components/analytics/Analytics'
import { RoadmapView } from './components/roadmap/RoadmapView'
import { NotificationContainer } from './components/ui/NotificationContainer'
import UpdateBanner from './components/updater/UpdateBanner'
import { ProfileWizard } from './components/profile/ProfileWizard'
import { ApiSetupModal } from './components/settings/ApiSetupModal'
import { useTutorial } from './components/layout/TutorialGuide'
import type { Profile } from '../shared/types'

function AppContent() {
  const { currentView } = useNavigation()
  const { settings, loaded: settingsLoaded } = useSettings()
  const [profile, setProfile] = useState<Profile | null | 'loading'>('loading')
  const [showWizard, setShowWizard] = useState(false)
  const [showApiSetup, setShowApiSetup] = useState(false)
  const [profileJustCreated, setProfileJustCreated] = useState(false)
  const startTutorial = useTutorial()
  const tutorialShown = useRef(false)

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

  useEffect(() => {
    const handler = () => {
      if (window.api) {
        window.api.getProfile().then((p) => setProfile(p))
      }
    }
    window.addEventListener('profile:imported', handler)
    return () => window.removeEventListener('profile:imported', handler)
  }, [])

  const handleWizardComplete = (p: Profile) => {
    setProfile(p)
    setProfileJustCreated(true)
    setShowWizard(false)
  }

  const handleApiSetupComplete = () => {
    setShowApiSetup(false)
  }

  useEffect(() => {
    if (tutorialShown.current) return
    const hasSeenTutorial = localStorage.getItem('aplica:tutorialSeen')
    if (hasSeenTutorial) return
    if (profileJustCreated && !showApiSetup && !showWizard && settings.api.configured) {
      tutorialShown.current = true
      localStorage.setItem('aplica:tutorialSeen', 'true')
      setTimeout(() => startTutorial(), 500)
    }
  }, [profileJustCreated, showApiSetup, showWizard, settings.api.configured, startTutorial])



  return (
    <MainLayout>
        {/* Mantener todos los views montados (ocultos via CSS) para no perder estado en vuelo
            como analisis de vacantes o generacion de CV al cambiar de pestana.
            Los wrappers mantienen la cadena flex-1 para que el scroll interno funcione. */}
        <div className={`flex-1 flex flex-col min-h-0 ${currentView === 'chat' ? '' : 'hidden'}`}>
          <ChatView />
        </div>
        <div className={`flex-1 flex flex-col min-h-0 ${currentView === 'analytics' ? '' : 'hidden'}`}>
          <Analytics />
        </div>
        <div className={`flex-1 flex flex-col min-h-0 ${currentView === 'roadmap' ? '' : 'hidden'}`}>
          <RoadmapView />
        </div>
        <div className={`flex-1 flex flex-col min-h-0 ${currentView === 'jobs' ? '' : 'hidden'}`}>
          <Vacantes />
        </div>

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
      <UpdateBanner />
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
