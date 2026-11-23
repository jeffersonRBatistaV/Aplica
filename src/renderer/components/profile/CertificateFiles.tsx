import { useCallback, useEffect, useState } from 'react'
import { FileText, Image as ImageIcon, Plus, Trash2, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CertificateFile } from '../../../shared/types'
import { useNotification } from '../../contexts/NotificationContext'
import { friendlyMessage } from '../../lib/friendly-error'

/** Evento global para que el generador de CV refresque el número de certificados. */
export const CERTIFICATES_CHANGED_EVENT = 'aplica:certificatesChanged'

/** Lista los certificados del perfil activo y se mantiene al día con los cambios. */
export function useCertificates(): CertificateFile[] {
  const [certs, setCerts] = useState<CertificateFile[]>([])
  useEffect(() => {
    const load = () => { window.api?.listCertificates().then(setCerts).catch(() => setCerts([])) }
    load()
    window.addEventListener(CERTIFICATES_CHANGED_EVENT, load)
    window.addEventListener('profile:updated', load)
    return () => {
      window.removeEventListener(CERTIFICATES_CHANGED_EVENT, load)
      window.removeEventListener('profile:updated', load)
    }
  }, [])
  return certs
}

/** Gestor de archivos de certificados (se guardan al instante, fuera del borrador del perfil). */
export function CertificateFiles() {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const certs = useCertificates()
  const [busy, setBusy] = useState(false)

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await fn()
      window.dispatchEvent(new Event(CERTIFICATES_CHANGED_EVENT))
    } catch (e) {
      notify(e instanceof Error ? friendlyMessage(e) : t('profile.certFiles.error'), 'error')
    } finally {
      setBusy(false)
    }
  }, [notify, t])

  const handleAdd = () => run(async () => {
    const res = await window.api.addCertificates()
    if (res?.rejected.length) notify(t('profile.certFiles.rejected', { files: res.rejected.join(', ') }), 'error')
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('profile.certFiles.title')}</span>
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy}
          className="flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {t('profile.certFiles.add')}
        </button>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{t('profile.certFiles.hint')}</p>
      {certs.length === 0 ? (
        <p className="text-xs italic text-gray-400 dark:text-gray-500">{t('profile.certFiles.empty')}</p>
      ) : (
        <ul className="space-y-1.5">
          {certs.map((c) => {
            const Icon = c.mime === 'application/pdf' ? FileText : ImageIcon
            return (
              <li key={c.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  defaultValue={c.name}
                  onBlur={(e) => {
                    const name = e.target.value.trim()
                    if (name && name !== c.name) void run(() => window.api.updateCertificate(c.id, { name }))
                  }}
                  className="flex-1 min-w-0 bg-transparent text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500/40 rounded px-1"
                />
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 shrink-0 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.includeInCv}
                    disabled={busy}
                    onChange={(e) => run(() => window.api.updateCertificate(c.id, { includeInCv: e.target.checked }))}
                  />
                  {t('profile.certFiles.include')}
                </label>
                <button
                  type="button"
                  title={t('profile.certFiles.delete')}
                  disabled={busy}
                  onClick={() => run(() => window.api.deleteCertificate(c.id))}
                  className="text-red-400 hover:text-red-600 disabled:opacity-50 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
