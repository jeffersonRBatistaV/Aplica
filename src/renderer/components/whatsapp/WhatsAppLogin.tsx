import { useTranslation } from 'react-i18next'
import { MessageCircle, QrCode, Loader2, ShieldAlert } from 'lucide-react'
import type { WhatsAppStatusEvent } from '../../types/ipc'
import { Button } from '../ui/Button'

interface WhatsAppLoginProps {
  statusEvent: WhatsAppStatusEvent
  connecting: boolean
  onConnect: () => void
}

export function WhatsAppLogin({ statusEvent, connecting, onConnect }: WhatsAppLoginProps) {
  const { t } = useTranslation()
  const { status, qr, message } = statusEvent

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10 overflow-y-auto">
      <div className="w-full max-w-md">
        {status === 'qr' && qr && (
          <div className="text-center">
            <div className="mx-auto mb-4 w-fit rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-white">
              <img src={qr} alt="QR" className="w-56 h-56" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{t('whatsapp.qrHint')}</p>
            <p className="text-xs text-gray-400 mb-6">{t('whatsapp.qrHint2')}</p>
          </div>
        )}

        {status === 'connecting' && (
          <div className="text-center">
            <Loader2 className="w-10 h-10 animate-spin text-green-500 mx-auto mb-4" />
            <p className="text-sm text-gray-600 dark:text-gray-300">{t('whatsapp.connecting')}</p>
          </div>
        )}

        {status === 'failed' && (
          <div className="text-center">
            <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-4" />
            <p className="text-sm text-red-600 dark:text-red-400 mb-1">{t('whatsapp.connectFailed')}</p>
            {message && <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 break-words">{message}</p>}
            <Button onClick={onConnect} disabled={connecting}>
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              {t('whatsapp.retry')}
            </Button>
          </div>
        )}

        {status === 'disconnected' && (
          <div className="text-center">
            <div className="mx-auto mb-4 w-fit rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-8">
              <QrCode className="w-20 h-20 text-gray-300 dark:text-gray-600" />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{t('whatsapp.notConnected')}</p>
            <Button onClick={onConnect} disabled={connecting} size="lg">
              {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              {t('whatsapp.connect')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}