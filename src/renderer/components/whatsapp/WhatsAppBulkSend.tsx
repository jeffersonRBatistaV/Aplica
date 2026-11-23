import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Send, Mail, MessageCircle, Loader2, Check, AlertCircle, MinusCircle, Square } from 'lucide-react'
import type { AutomationConfig, EmailConfig, JobApplication, WhatsAppVacancy } from '../../../shared/types'
import { Button } from '../ui/Button'
import { useNotification } from '../../contexts/NotificationContext'
import { friendlyMessage } from '../../lib/friendly-error'
import { notifyJobsChanged } from '../../lib/agenda'
import { useCertificates } from '../profile/CertificateFiles'

interface WhatsAppBulkSendProps {
  vacancies: WhatsAppVacancy[]
  onClose: () => void
  /** Se llama al terminar (o cancelar) para refrescar la cola. */
  onFinished: () => void
}

type Channel = 'email' | 'whatsapp'
type ItemState = 'pending' | 'generating' | 'sending' | 'waiting' | 'sent' | 'failed' | 'skipped'

interface ItemResult {
  state: ItemState
  detail?: string
}

const TEMPLATES_KEY = 'aplica:bulkSendTemplates'
/** Pausa aleatoria entre envíos por WhatsApp (ms) para no parecer spam y evitar bloqueos. */
const WA_DELAY_MIN = 20_000
const WA_DELAY_MAX = 40_000
const EMAIL_DELAY = 3_000

function loadTemplates(): { subject?: string; body?: string } {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveTemplates(subject: string, body: string): void {
  try {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify({ subject, body }))
  } catch {
    /* sin almacenamiento: no se recuerdan las plantillas */
  }
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(puesto|empresa|nombre|position|company|name)\}/gi, (_, key: string) => {
    const k = key.toLowerCase()
    if (k === 'puesto' || k === 'position') return vars.puesto
    if (k === 'empresa' || k === 'company') return vars.empresa
    return vars.nombre
  })
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Envío automático del CV a varias vacantes de la cola de WhatsApp: genera un CV por
 * vacante con el estilo/resumen de la automatización, lo envía por correo (si la vacante
 * tiene email) o por WhatsApp (si tiene teléfono) y la registra como postulada.
 */
export function WhatsAppBulkSend({ vacancies, onClose, onFinished }: WhatsAppBulkSendProps) {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const certificates = useCertificates()
  const certCount = certificates.filter((c) => c.includeInCv).length

  const stored = useMemo(loadTemplates, [])
  const [subject, setSubject] = useState(stored.subject || t('whatsapp.bulk.defaultSubject'))
  const [body, setBody] = useState(stored.body || t('whatsapp.bulk.defaultBody'))
  const [attachCerts, setAttachCerts] = useState(true)

  const [emailConfig, setEmailConfig] = useState<EmailConfig | null>(null)
  const [waConnected, setWaConnected] = useState(false)
  const [automation, setAutomation] = useState<AutomationConfig | null>(null)
  const [profileName, setProfileName] = useState('')
  const [loading, setLoading] = useState(true)

  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [results, setResults] = useState<Record<string, ItemResult>>({})
  const cancelRef = useRef(false)

  useEffect(() => {
    if (!window.api) return
    Promise.all([
      window.api.getEmailConfig().catch(() => null),
      window.api.whatsappStatus().catch(() => null),
      window.api.getAutomationConfig().catch(() => null),
      window.api.getProfile().catch(() => null),
    ]).then(([email, wa, auto, profile]) => {
      setEmailConfig(email)
      setWaConnected(wa?.status === 'connected')
      setAutomation(auto)
      setProfileName(profile?.name || '')
      setLoading(false)
    })
  }, [])

  const emailReady = !!(emailConfig?.configured && emailConfig.user && emailConfig.pass)

  /** Canal de cada vacante: correo primero, luego WhatsApp; null si no hay forma de contactar. */
  const plan = useMemo(
    () =>
      vacancies.map((v) => {
        let channel: Channel | null = null
        let reason = ''
        if (v.email && emailReady) channel = 'email'
        else if (v.phone && waConnected) channel = 'whatsapp'
        else if (v.email) reason = t('whatsapp.bulk.skipNoEmailConfig')
        else if (v.phone) reason = t('whatsapp.bulk.skipWaDisconnected')
        else reason = t('whatsapp.bulk.skipNoContact')
        return { vacancy: v, channel, reason }
      }),
    [vacancies, emailReady, waConnected, t],
  )
  const sendable = plan.filter((p) => p.channel)
  const emailCount = sendable.filter((p) => p.channel === 'email').length
  const waCount = sendable.filter((p) => p.channel === 'whatsapp').length
  const usesEmail = emailCount > 0

  const setResult = (id: string, r: ItemResult) => setResults((prev) => ({ ...prev, [id]: r }))

  const handleStart = async () => {
    if (!window.api || running || sendable.length === 0) return
    saveTemplates(subject, body)
    cancelRef.current = false
    setRunning(true)
    setFinished(false)
    const initial: Record<string, ItemResult> = {}
    for (const p of plan) initial[p.vacancy.id] = p.channel ? { state: 'pending' } : { state: 'skipped', detail: p.reason }
    setResults(initial)

    const style = automation?.cvStyle || 'ats'
    const includeCertificates = attachCerts && certCount > 0
    let sent = 0
    let failed = 0
    let lastChannel: Channel | null = null

    for (const { vacancy: v, channel } of sendable) {
      if (cancelRef.current) break
      if (!channel) continue

      // Pausa entre envíos (más larga en WhatsApp para no parecer spam).
      if (lastChannel) {
        const wait = lastChannel === 'whatsapp' && channel === 'whatsapp'
          ? WA_DELAY_MIN + Math.random() * (WA_DELAY_MAX - WA_DELAY_MIN)
          : EMAIL_DELAY
        setResult(v.id, { state: 'waiting', detail: t('whatsapp.bulk.waiting', { seconds: Math.round(wait / 1000) }) })
        await sleep(wait)
        if (cancelRef.current) break
      }

      const text = v.vacancyText || v.snippet
      const company = v.company || ''
      const vars = { puesto: v.title, empresa: company || t('whatsapp.bulk.companyFallback'), nombre: profileName }
      try {
        setResult(v.id, { state: 'generating' })
        let summary: string | undefined
        if (automation?.cvSummaryId) {
          try {
            const options = await window.api.generateSummaryOptions(text, null)
            summary = options.find((o) => o.id === automation.cvSummaryId)?.summary || options[0]?.summary
          } catch { /* el generador elige el resumen */ }
        }
        const cv = await window.api.generateCV(text, null, style, undefined, summary)
        if (!cv?.trim()) throw new Error(t('whatsapp.bulk.cvFailed'))
        const pdf = await window.api.renderCvPdfBase64(cv, style, { includeCertificates })
        if (!pdf) throw new Error(t('sendCv.pdfError'))

        setResult(v.id, { state: 'sending' })
        const filename = `CV-${(profileName || 'CV').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'CV'}.pdf`
        const message = fill(body, vars)
        const emailSubject = fill(subject, vars)
        const res = channel === 'email'
          ? await window.api.sendEmail(emailConfig as EmailConfig, {
              to: v.email!,
              subject: emailSubject,
              body: message,
              attachments: [{ filename, contentBase64: pdf }],
            })
          : await window.api.whatsappSend({
              phone: v.phone!,
              message,
              attachment: { filename, contentBase64: pdf, mimetype: 'application/pdf' },
            })
        if (!res.ok) throw new Error(res.error || t('sendCv.sendError'))

        // Registrar la postulación (job:save fija appliedAt y el historial de estado).
        const now = Date.now()
        const job: JobApplication = {
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          company: company || v.groupName,
          position: v.title,
          category: v.category || '',
          status: 'applied',
          vacancyText: text,
          atsReport: null,
          coverLetterA: channel === 'email' ? message : '',
          coverLetterB: '',
          cvStyle: style,
          cvContent: cv,
          recipientEmail: v.email || '',
          ...(v.phone ? { recipientPhone: v.phone } : {}),
          emailSubject: channel === 'email' ? emailSubject : '',
          interviewQuestions: [],
          ...(v.sourceUrl ? { sourceUrl: v.sourceUrl } : {}),
          notes: t('whatsapp.bulk.jobNote', { channel: channel === 'email' ? v.email : v.phone, group: v.groupName }),
        }
        await window.api.saveJob(job)
        await window.api.whatsappMarkImported(v.id).catch(() => {})
        notifyJobsChanged()
        sent++
        lastChannel = channel
        setResult(v.id, { state: 'sent', detail: channel === 'email' ? v.email : v.phone })
      } catch (err) {
        failed++
        lastChannel = channel
        setResult(v.id, { state: 'failed', detail: friendlyMessage(err) })
      }
    }

    setRunning(false)
    setFinished(true)
    onFinished()
    if (cancelRef.current) notify(t('whatsapp.bulk.cancelled', { sent }), 'info')
    else if (failed > 0) notify(t('whatsapp.bulk.doneWithErrors', { sent, failed }), 'error')
    else notify(t('whatsapp.bulk.done', { sent }), 'success')
  }

  const stateIcon = (r: ItemResult | undefined) => {
    switch (r?.state) {
      case 'generating':
      case 'sending':
      case 'waiting':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500 shrink-0" />
      case 'sent':
        return <Check className="w-4 h-4 text-green-600 shrink-0" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
      case 'skipped':
        return <MinusCircle className="w-4 h-4 text-gray-400 shrink-0" />
      default:
        return null
    }
  }

  const started = running || finished

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Send className="w-4 h-4 text-green-600" />
            {t('whatsapp.bulk.title', { count: vacancies.length })}
          </h3>
          <button
            onClick={onClose}
            disabled={running}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {!started && (
                <>
                  <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                    <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-blue-500" />{t('whatsapp.bulk.byEmail', { count: emailCount })}</p>
                    <p className="flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5 text-green-600" />{t('whatsapp.bulk.byWhatsapp', { count: waCount })}</p>
                    {plan.length - sendable.length > 0 && (
                      <p className="flex items-center gap-1.5"><MinusCircle className="w-3.5 h-3.5 text-gray-400" />{t('whatsapp.bulk.skipped', { count: plan.length - sendable.length })}</p>
                    )}
                    <p className="pt-1">{t('whatsapp.bulk.cvInfo', { style: automation?.cvStyle || 'ats' })}</p>
                    {waCount > 1 && <p>{t('whatsapp.bulk.waPacing')}</p>}
                  </div>

                  {usesEmail && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('whatsapp.bulk.subject')}</label>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{t('whatsapp.bulk.message')}</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/40 resize-y"
                    />
                    <p className="mt-1 text-xs text-gray-400">{t('whatsapp.bulk.variables')}</p>
                  </div>
                  {certCount > 0 && (
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
                      <input type="checkbox" checked={attachCerts} onChange={(e) => setAttachCerts(e.target.checked)} />
                      {t('cvGenerator.attachCerts', { count: certCount })}
                    </label>
                  )}
                </>
              )}

              <ul className="space-y-1.5">
                {plan.map(({ vacancy: v, channel, reason }) => {
                  const r = results[v.id]
                  const detail = r?.detail
                    ?? (r?.state === 'generating' ? t('whatsapp.bulk.generating')
                      : r?.state === 'sending' ? t('whatsapp.bulk.sending')
                        : !started && !channel ? reason : '')
                  return (
                    <li key={v.id} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700">
                      {channel === 'email' ? <Mail className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                        : channel === 'whatsapp' ? <MessageCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                          : <MinusCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                          {v.title}{v.company ? <span className="text-gray-500"> · {v.company}</span> : null}
                        </p>
                        {detail && <p className={`text-xs ${r?.state === 'failed' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>{detail}</p>}
                      </div>
                      {stateIcon(r)}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 dark:border-gray-700">
          {running ? (
            <Button variant="secondary" size="sm" onClick={() => { cancelRef.current = true }}>
              <Square className="w-3.5 h-3.5" />
              {t('whatsapp.bulk.stop')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onClose}>{finished ? t('whatsapp.bulk.close') : t('profile.cancel')}</Button>
              {!finished && (
                <Button variant="primary" size="sm" onClick={() => void handleStart()} disabled={loading || sendable.length === 0 || !body.trim()}>
                  <Send className="w-3.5 h-3.5" />
                  {t('whatsapp.bulk.start', { count: sendable.length })}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
