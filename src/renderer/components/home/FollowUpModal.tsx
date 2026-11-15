import { useEffect, useState } from 'react'
import { Loader2, Copy, Send, Check, X, RefreshCw, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { JobApplication } from '../../../shared/types'
import { Button } from '../ui/Button'
import { useNotification } from '../../contexts/AppContext'
import { notifyJobsChanged } from '../../lib/agenda'
import { friendlyMessage } from '../../lib/friendly-error'

interface FollowUpModalProps {
  job: JobApplication
  onClose: () => void
}

/** Redacta (IA), edita y envía un correo de seguimiento para una postulación sin respuesta. */
export function FollowUpModal({ job, onClose }: FollowUpModalProps) {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const [to, setTo] = useState(job.recipientEmail || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailReady, setEmailReady] = useState(false)

  const generate = async () => {
    if (!window.api) return
    setGenerating(true)
    setError(null)
    try {
      const draft = await window.api.generateFollowUp(job.id)
      setSubject(draft.subject)
      setBody(draft.body)
    } catch (e) {
      setError(e instanceof Error ? friendlyMessage(e) : t('home.followUp.error'))
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    void generate()
    window.api?.getEmailConfig().then((c) => setEmailReady(!!c?.configured)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id])

  const markDone = async () => {
    if (!window.api) return
    const fresh = (await window.api.getJob(job.id)) ?? job
    await window.api.saveJob({ ...fresh, lastFollowUpAt: Date.now(), updatedAt: Date.now() })
    notifyJobsChanged()
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${subject}\n\n${body}`)
    notify(t('home.followUp.copied'), 'success')
  }

  const handleSend = async () => {
    if (!window.api || !to.trim()) return
    setSending(true)
    setError(null)
    try {
      const config = await window.api.getEmailConfig()
      if (!config?.configured) throw new Error(t('home.followUp.noEmailConfig'))
      const result = await window.api.sendEmail(config, { to: to.trim(), subject: subject.trim(), body })
      if (!result.ok) throw new Error(result.error || t('home.followUp.sendError'))
      await markDone()
      notify(t('home.followUp.sent'), 'success')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? friendlyMessage(e) : t('home.followUp.sendError'))
    } finally {
      setSending(false)
    }
  }

  const handleMarkDone = async () => {
    await markDone()
    notify(t('home.followUp.marked'), 'success')
    onClose()
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t('home.followUp.title')}</h2>
            <p className="text-xs text-gray-500 truncate">{job.position} · {job.company}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('common.close', 'Cerrar')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto scrollbar-thin">
          {generating ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('home.followUp.generating')}
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('home.followUp.to')}</label>
                <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="reclutador@empresa.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('home.followUp.subject')}</label>
                <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('home.followUp.body')}</label>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className={`${inputCls} resize-y leading-relaxed`} />
              </div>
            </>
          )}
          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {!emailReady && !generating && (
            <p className="text-[11px] text-gray-400">{t('home.followUp.emailHint')}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" size="sm" onClick={generate} disabled={generating || sending}>
            <RefreshCw className="w-3.5 h-3.5" />
            {t('home.followUp.regenerate')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleCopy} disabled={generating || !body}>
              <Copy className="w-3.5 h-3.5" />
              {t('home.followUp.copy')}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleMarkDone} disabled={sending}>
              <Check className="w-3.5 h-3.5" />
              {t('home.followUp.markDone')}
            </Button>
            {emailReady && (
              <Button size="sm" onClick={handleSend} disabled={generating || sending || !to.trim() || !body}>
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {t('home.followUp.send')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
