import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { toFriendlyError, type FixTarget } from '../lib/friendly-error'

export type NotificationType = 'success' | 'error' | 'info'

export interface Notification {
  id: string
  type: NotificationType
  message: string
  /** Detalle técnico (solo errores traducidos). */
  technical?: string
  /** Sección de Ajustes donde se arregla el error. */
  fix?: FixTarget
}

interface NotificationContextValue {
  notifications: Notification[]
  notify: (message: string, type?: NotificationType) => void
  dismiss: (id: string) => void
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

let counter = 0

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const notify = useCallback(
    (message: string, type: NotificationType = 'info') => {
      const id = `notif-${++counter}`
      let entry: Notification = { id, type, message }
      // Los errores se traducen a un lenguaje comprensible y se les da más tiempo en pantalla.
      if (type === 'error') {
        const friendly = toFriendlyError(message)
        entry = {
          ...entry,
          message: friendly.message,
          technical: friendly.technical && friendly.technical !== friendly.message ? friendly.technical : undefined,
          fix: friendly.fix,
        }
      }
      setNotifications((prev) => [...prev, entry])
      setTimeout(() => dismiss(id), type === 'error' ? 8000 : 4000)
    },
    [dismiss],
  )

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotification(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider')
  return ctx
}
