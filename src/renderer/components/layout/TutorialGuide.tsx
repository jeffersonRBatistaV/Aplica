import { useCallback } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import i18n from '../../i18n'

function t(key: string): string {
  return i18n.t(key)
}

export function useTutorial() {
  const startTutorial = useCallback(() => {
    const drive = driver({
      steps: [
        {
          element: '#sidebar-footer',
          popover: {
            title: t('tutorial.welcomeTitle'),
            description: t('tutorial.welcomeDesc'),
            side: 'right' as const,
            align: 'start' as const,
          },
        },
        {
          element: '#nav-chat',
          popover: {
            title: t('tutorial.chatTitle'),
            description: t('tutorial.chatDesc'),
            side: 'right' as const,
          },
        },
        {
          element: '#nav-jobs',
          popover: {
            title: t('tutorial.jobsTitle'),
            description: t('tutorial.jobsDesc'),
            side: 'right' as const,
          },
        },
        {
          element: '#nav-stats',
          popover: {
            title: t('tutorial.statsTitle'),
            description: t('tutorial.statsDesc'),
            side: 'right' as const,
          },
        },
        {
          element: '#nav-roadmap',
          popover: {
            title: t('tutorial.roadmapTitle'),
            description: t('tutorial.roadmapDesc'),
            side: 'right' as const,
          },
        },
        {
          element: '#btn-profile',
          popover: {
            title: t('tutorial.profileTitle'),
            description: t('tutorial.profileDesc'),
            side: 'right' as const,
          },
        },
        {
          element: '#btn-tutorial',
          popover: {
            title: t('tutorial.tutorialTitle'),
            description: t('tutorial.tutorialDesc'),
            side: 'right' as const,
          },
        },
        {
          element: '#btn-settings',
          popover: {
            title: t('tutorial.settingsTitle'),
            description: t('tutorial.settingsDesc'),
            side: 'right' as const,
          },
        },
      ],
      showProgress: true,
      showButtons: ['next', 'close'],
      nextBtnText: t('tutorial.continue'),
      prevBtnText: t('tutorial.previous'),
      doneBtnText: t('tutorial.skipGuide'),
      closeBtnText: t('tutorial.skipGuide'),
      allowClose: true,
      overlayOpacity: 0.6,
      smoothScroll: true,
      animate: true,
    })
    drive.drive()
  }, [])

  return startTutorial
}
