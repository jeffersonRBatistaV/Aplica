import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { FormEvent } from 'react'
import { FileText, Copy, Check, Download, Sparkles, BarChart3, ScrollText, Loader2, Eye, EyeOff, Wand2, AlertCircle, Plus, Trash2, ChevronDown, ChevronRight, ArrowLeft, History, X, Pencil, Send, HelpCircle, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotification } from '../../contexts/NotificationContext'
import { useSettings } from '../../contexts/SettingsContext'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { ATSReport, CvTemplate, CvVersion, EmailConfig } from '../../../shared/types'
import { friendlyMessage } from '../../lib/friendly-error'
import { getShowAdvanced } from '../../lib/ui-prefs'
import { TemplateDesigner } from './TemplateDesigner'
import { useCertificates } from '../profile/CertificateFiles'

interface SummaryOption {
  id: string
  label: string
  summary: string
}

interface CVGeneratorProps {
  vacancyText: string
  atsReport: ATSReport | null
  currentStyle: string | null
  currentContent: string
  onSave: (style: string, content: string) => void
  jobId?: string
  recipientEmail?: string
  /** Teléfono de contacto de la vacante: habilita el envío por WhatsApp si está vinculado. */
  recipientPhone?: string
  onPhoneChange?: (phone: string) => void
  emailSubject?: string
  coverLetterBody?: string
  companyName?: string
  positionName?: string
  onSent?: () => void | Promise<void>
  /** Al cambiar, abre el envío por el canal disponible (WhatsApp si no hay correo). */
  sendRequest?: number
}

type CvTab = 'preview' | 'edit'
type CvStep = 'style' | 'summary' | 'generated'

const SUMMARY_CARD_ICONS: Record<string, any> = {
  tecnicista: BarChart3,
  ejecutivo: Sparkles,
  creativo: ScrollText,
}

const colorClasses: Record<string, { bg: string; border: string; text: string; hover: string }> = {
  blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-500', text: 'text-blue-700 dark:text-blue-300', hover: 'hover:border-blue-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-500', text: 'text-purple-700 dark:text-purple-300', hover: 'hover:border-purple-400' },
  green: { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-500', text: 'text-green-700 dark:text-green-300', hover: 'hover:border-green-400' },
  slate: { bg: 'bg-slate-50 dark:bg-slate-900/20', border: 'border-slate-500', text: 'text-slate-700 dark:text-slate-300', hover: 'hover:border-slate-400' },
}

export function CVGenerator({ vacancyText, atsReport, currentStyle, currentContent, onSave, jobId, recipientEmail, recipientPhone, onPhoneChange, emailSubject, coverLetterBody, companyName, positionName, onSent, sendRequest }: CVGeneratorProps) {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const { settings, updateSettings } = useSettings()
  const emailConfig = settings.emailConfig

  const BUILTIN_STYLES = useMemo(() => [
    { id: 'ats', name: 'ATS-Friendly', icon: BarChart3, desc: t('cvGenerator.styleAtsDesc'), color: 'blue' as const },
    { id: 'moderno', name: 'Moderno', icon: Sparkles, desc: t('cvGenerator.styleModernoDesc'), color: 'purple' as const },
    { id: 'tradicional', name: 'Tradicional', icon: ScrollText, desc: t('cvGenerator.styleTraditionalDesc'), color: 'green' as const },
  ], [t])

  const getStyleName = useCallback((id: string | null, templates: CvTemplate[]): string => {
    const builtin = BUILTIN_STYLES.find(s => s.id === id)
    if (builtin) return builtin.name
    if (id) {
      const tmpl = templates.find(t => t.id === id || `custom:${t.id}` === id)
      if (tmpl) return tmpl.name
    }
    return id || ''
  }, [BUILTIN_STYLES])

  const templateIdFromStyle = useCallback((styleId: string): string =>
    styleId.startsWith('custom:')
      ? styleId.slice('custom:'.length)
      : styleId.startsWith('seed-')
        ? styleId
        : `seed-${styleId}`, [])
  const [step, setStep] = useState<CvStep>(currentStyle && currentContent ? 'generated' : 'style')
  const [generating, setGenerating] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(currentStyle)
  const [content, setContent] = useState(currentContent)
  const [profilePhoto, setProfilePhoto] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [savedPath, setSavedPath] = useState<string | null>(null)
  const [tab, setTab] = useState<CvTab>('preview')
  const [instructions, setInstructions] = useState('')
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLDivElement>(null)
  const lastEditedHtmlRef = useRef<string>('')
  const [editMode, setEditMode] = useState(false)
  // Certificados del perfil marcados para anexar (una página extra por certificado).
  const certificates = useCertificates()
  const certCount = certificates.filter((c) => c.includeInCv).length
  const [attachCerts, setAttachCerts] = useState(true)
  const pdfOpts = { includeCertificates: attachCerts && certCount > 0 }

  const [customTemplates, setCustomTemplates] = useState<CvTemplate[]>([])
  // Las plantillas seed-ats/moderno/tradicional ya se muestran como estilos integrados.
  const listedTemplates = useMemo(
    () => customTemplates.filter(t => !BUILTIN_STYLES.some(s => `seed-${s.id}` === t.id)),
    [customTemplates, BUILTIN_STYLES],
  )
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  const [summaryOptions, setSummaryOptions] = useState<SummaryOption[] | null>(null)
  const [loadingSummaries, setLoadingSummaries] = useState(false)
  const autoSelectedRef = useRef<string | null>(null)
  const [pendingRegenerate, setPendingRegenerate] = useState<string | null>(null)
  const [showSaveToTemplateDialog, setShowSaveToTemplateDialog] = useState(false)
  const [pendingInstruction, setPendingInstruction] = useState<string | null>(null)

  const [showHistory, setShowHistory] = useState(false)
  const [versions, setVersions] = useState<CvVersion[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [viewingContent, setViewingContent] = useState<string | null>(null)

  // ── Envío de CV por correo ──
  const [showSendModal, setShowSendModal] = useState(false)
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; message?: string } | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  // Config de email integrada (tipo modal de setup rápido)
  const [setupMode, setSetupMode] = useState(false)
  const [cfgUser, setCfgUser] = useState(emailConfig?.user || '')
  const [cfgPass, setCfgPass] = useState(emailConfig?.pass || '')
  const [cfgName, setCfgName] = useState(emailConfig?.fromName || '')
  const [showCfgPass, setShowCfgPass] = useState(false)
  const [showAppPasswordHelp, setShowAppPasswordHelp] = useState(false)
  const [testingCfg, setTestingCfg] = useState(false)

  // ── Envío de CV por WhatsApp ──
  const [waConnected, setWaConnected] = useState(false)
  const [showWaModal, setShowWaModal] = useState(false)
  const [waPhone, setWaPhone] = useState('')
  const [waMessage, setWaMessage] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waResult, setWaResult] = useState<{ ok: boolean; message?: string } | null>(null)

  useEffect(() => {
    if (!window.api?.whatsappStatus) return
    let alive = true
    window.api.whatsappStatus().then((s) => { if (alive) setWaConnected(s.status === 'connected') }).catch(() => {})
    const off = window.api.onWhatsAppEvent?.((ev) => {
      if (ev.type === 'status') setWaConnected(ev.payload.status === 'connected')
    })
    return () => { alive = false; off?.() }
  }, [])

  const canSendWhatsApp = waConnected && !!recipientPhone?.trim()

  const openWaModal = useCallback(() => {
    setWaPhone(recipientPhone || '')
    setWaMessage(
      positionName && companyName
        ? t('sendCvWhatsapp.defaultMessage', { position: positionName, company: companyName })
        : t('sendCvWhatsapp.defaultMessageGeneric'),
    )
    setWaResult(null)
    setShowWaModal(true)
  }, [recipientPhone, positionName, companyName, t])

  const handleSendWhatsApp = async () => {
    if (!window.api || waSending || !waPhone.trim()) return
    setWaSending(true)
    setWaResult(null)
    try {
      if (waPhone.trim() !== (recipientPhone || '').trim()) onPhoneChange?.(waPhone.trim())
      const pdfBase64 = await window.api.renderCvPdfBase64(withPhoto(content), selectedStyle || 'ats', pdfOpts)
      if (!pdfBase64) {
        setWaResult({ ok: false, message: t('sendCv.pdfError') })
        return
      }
      const result = await window.api.whatsappSend({
        phone: waPhone.trim(),
        message: waMessage,
        attachment: { filename: 'CV.pdf', contentBase64: pdfBase64, mimetype: 'application/pdf' },
      })
      setWaResult(result.ok ? { ok: true, message: t('sendCvWhatsapp.sentOk') } : { ok: false, message: friendlyMessage(result.error) })
      if (result.ok) {
        notify(t('sendCvWhatsapp.sentOk'), 'success')
        try { await onSent?.() } catch { /* no bloquea el cierre */ }
        closeTimerRef.current = window.setTimeout(() => setShowWaModal(false), 2000)
      }
    } catch (e) {
      setWaResult({ ok: false, message: e instanceof Error ? friendlyMessage(e) : t('sendCvWhatsapp.sendError') })
    } finally {
      setWaSending(false)
    }
  }

  /** Instrucciones frecuentes en un clic (no hace falta saber "pedirle" cosas a la IA). */
  const QUICK_INSTRUCTIONS = useMemo(() => [
    'shorter', 'formal', 'achievements', 'keywords', 'english', 'onePage',
  ].map((id) => ({ id, label: t(`cvQuick.${id}.label`), instruction: t(`cvQuick.${id}.instruction`) })), [t])
  const showHtmlEditor = useMemo(() => getShowAdvanced(), [])

  const openSendModal = useCallback(() => {
    setTo(recipientEmail || '')
    setSubject(emailSubject || (positionName ? t('sendCv.defaultSubject', { position: positionName }) : t('sendCv.defaultSubjectGeneric')))
    setBody(coverLetterBody || t('sendCv.defaultBody'))
    setSendResult(null)
    setSetupMode(false)
    setShowSendModal(true)
  }, [recipientEmail, emailSubject, positionName, coverLetterBody, t])

  // Petición externa de envío ("Siguiente paso" / "Postular rápido").
  const lastSendRequestRef = useRef(sendRequest ?? 0)
  useEffect(() => {
    if (!sendRequest || sendRequest === lastSendRequestRef.current) return
    lastSendRequestRef.current = sendRequest
    if (!content) return
    if (!recipientEmail?.trim() && canSendWhatsApp) openWaModal()
    else openSendModal()
  }, [sendRequest, content, recipientEmail, canSendWhatsApp, openWaModal, openSendModal])

  useEffect(() => {
    if (showSendModal) {
      const configured = !!(emailConfig?.user && emailConfig?.pass)
      setSetupMode(!configured)
      setCfgUser(emailConfig?.user || '')
      setCfgPass(emailConfig?.pass || '')
      setCfgName(emailConfig?.fromName || '')
      setShowCfgPass(false)
      setShowAppPasswordHelp(!configured)
      window.api.getProfile().then((profile) => {
        if (profile?.name) setCfgName(profile.name)
      }).catch(() => {})
    }
  }, [showSendModal, emailConfig])

  const buildCfgConfig = (): EmailConfig => ({
    provider: 'gmail' as const,
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    user: cfgUser.trim(),
    pass: cfgPass.trim(),
    fromName: cfgName.trim(),
    configured: !!(cfgUser.trim() && cfgPass.trim()),
  })

  const handleSend = async () => {
    if (!window.api || sending) return
    if (!cfgUser.trim() || !cfgPass.trim()) {
      setSendResult({ ok: false, message: t('sendCv.fillConfig') })
      return
    }
    setSending(true)
    setSendResult(null)
    try {
      const config = buildCfgConfig()
      await updateSettings({ emailConfig: config })

      const pdfBase64 = await window.api.renderCvPdfBase64(withPhoto(content), selectedStyle || 'ats', pdfOpts)
      if (!pdfBase64) {
        setSendResult({ ok: false, message: t('sendCv.pdfError') })
        return
      }
      const result = await window.api.sendEmail(config, {
        to: to.trim(),
        subject: subject.trim() || t('sendCv.defaultSubjectGeneric'),
        body: body,
        attachments: [{ filename: 'CV.pdf', contentBase64: pdfBase64 }],
      })
      setSendResult(result.ok ? { ok: true, message: t('sendCv.sentOk') } : { ok: false, message: friendlyMessage(result.error) })
      if (result.ok) {
        notify(t('sendCv.sentOk'), 'success')
        try { await onSent?.() } catch { /* no bloquea el cierre */ }
        closeTimerRef.current = window.setTimeout(() => setShowSendModal(false), 2000)
      }
    } catch (e) {
      setSendResult({ ok: false, message: e instanceof Error ? friendlyMessage(e) : t('sendCv.sendError') })
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    window.api?.getCvTemplates().then(setCustomTemplates)
  }, [])

  useEffect(() => {
    window.api?.getProfile().then((p) => {
      if (p?.photo) setProfilePhoto(p.photo)
    }).catch(() => {})
  }, [])

  const withPhoto = (html: string): string => {
    if (!profilePhoto || !html.includes('{{FOTO-PERFIL}}')) return html
    return html.split('{{FOTO-PERFIL}}').join(profilePhoto)
  }

  useEffect(() => { setContent(currentContent) }, [currentContent])
  useEffect(() => { setSelectedStyle(currentStyle) }, [currentStyle])
  useEffect(() => () => { if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current) }, [])

  useEffect(() => {
    if (!editRef.current) return
    if (editMode) {
      lastEditedHtmlRef.current = withPhoto(content)
      editRef.current.innerHTML = withPhoto(content)
    } else {
      const edited = lastEditedHtmlRef.current
      if (edited !== content) {
        setContent(edited)
        if (selectedStyle) onSave(selectedStyle, edited)
      }
    }
  }, [editMode])

  const handlePreviewInput = (e: FormEvent<HTMLDivElement>) => {
    lastEditedHtmlRef.current = e.currentTarget.innerHTML
  }

  const toggleEditMode = () => setEditMode((prev) => !prev)

  useEffect(() => {
    if (tab === 'preview' && editMode && editRef.current) {
      editRef.current.innerHTML = lastEditedHtmlRef.current || withPhoto(content)
    }
  }, [tab])

  useEffect(() => {
    // Si la vacante ya tiene un CV guardado, mostrarlo siempre (aunque el
    // estilo coincida con el de la vacante abierta antes): nunca obligar a
    // regenerarlo.
    if (currentContent) {
      if (step !== 'generated') setStep('generated')
      autoSelectedRef.current = currentStyle
      return
    }
    if (!currentStyle) {
      // Vacante nueva / sin CV: volver al selector de estilo.
      autoSelectedRef.current = null
      if (step === 'generated') setStep('style')
      return
    }
    if (autoSelectedRef.current === currentStyle) return
    if (generating || loadingSummaries) return
    autoSelectedRef.current = currentStyle
    if (step !== 'style') setStep('style')
    handleChooseStyle(currentStyle)
  }, [currentStyle, currentContent])

  const getCustomPrompt = useCallback((styleId: string): string | undefined => {
    if (!styleId.startsWith('custom:')) return undefined
    const t = customTemplates.find(t => `custom:${t.id}` === styleId)
    return t?.prompt
  }, [customTemplates])

  const persistInstructionToTemplate = useCallback(async (styleId: string, instruction: string): Promise<void> => {
    const templateId = templateIdFromStyle(styleId)
    const existing = customTemplates.find(t => t.id === templateId)
    const template: CvTemplate = {
      ...existing,
      id: templateId,
      name: existing?.name ?? (BUILTIN_STYLES.find(s => s.id === styleId)?.name ?? styleId),
      prompt: existing?.prompt ?? '',
      sampleHtml: existing?.sampleHtml ?? '',
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
      extraPrompt: `${existing?.extraPrompt ? existing.extraPrompt + '\n' : ''}- ${instruction}`,
    }
    await window.api.saveCvTemplate(template)
    setCustomTemplates(prev =>
      prev.some(t => t.id === templateId)
        ? prev.map(t => (t.id === templateId ? template : t))
        : [...prev, template],
    )
  }, [customTemplates, BUILTIN_STYLES, templateIdFromStyle])

  const handleChooseStyle = async (styleId: string) => {
    if (!window.api || generating) return
    setSelectedStyle(styleId)
    setError(null)
    setSummaryOptions(null)
    setLoadingSummaries(true)
    try {
      const options = await window.api.generateSummaryOptions(vacancyText, atsReport)
      setSummaryOptions(options)
      setStep('summary')
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorGeneratingSummary')
      setError(msg)
    } finally {
      setLoadingSummaries(false)
    }
  }

  const handleSelectSummary = async (summary: string) => {
    if (!window.api || !selectedStyle || generating) return
    setGenerating(true)
    setError(null)
    try {
      const customPrompt = getCustomPrompt(selectedStyle)
      const result = await window.api.generateCV(vacancyText, atsReport, selectedStyle, customPrompt, summary)
      setContent(result)
      onSave(selectedStyle, result)
      const summaryTmplId = templateIdFromStyle(selectedStyle)
      const summaryTmpl = customTemplates.find(t => t.id === summaryTmplId)
      if (summaryTmpl?.extraPrompt) notify(t('cvGenerator.templateHasInstructions'), 'info')
      setStep('generated')
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorGeneratingCv')
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  const handleRegenerate = async (styleId: string) => {
    if (!window.api || generating) return
    setGenerating(true)
    setError(null)
    setSelectedStyle(styleId)
    try {
      const customPrompt = getCustomPrompt(styleId)
      const result = await window.api.generateCV(vacancyText, atsReport, styleId, customPrompt)
      setContent(result)
      onSave(styleId, result)
      const regenTmplId = templateIdFromStyle(styleId)
      const regenTmpl = customTemplates.find(t => t.id === regenTmplId)
      if (regenTmpl?.extraPrompt) notify(t('cvGenerator.templateHasInstructions'), 'info')
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorGeneratingCv')
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  const handleApplyInstructions = async (preset?: string) => {
    const instruction = (preset ?? instructions).trim()
    if (!instruction || !selectedStyle || !window.api) return
    setApplying(true)
    setError(null)
    try {
      const customPrompt = getCustomPrompt(selectedStyle)
      const result = await window.api.regenerateCV({
        currentCv: content,
        style: selectedStyle,
        vacancyText,
        atsReport,
        instructions: instruction,
        customPrompt,
      })
      setContent(result)
      onSave(selectedStyle, result)
      setInstructions('')
      // Las instrucciones rápidas son puntuales: no se ofrece guardarlas en la plantilla.
      if (!preset) {
        setPendingInstruction(instruction)
        setShowSaveToTemplateDialog(true)
      } else {
        notify(t('cvQuick.applied'), 'success')
      }
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorApplying')
      setError(msg)
    } finally {
      setApplying(false)
    }
  }

  const handleConfirmSaveToTemplate = async (shouldSave: boolean) => {
    setShowSaveToTemplateDialog(false)
    const instruction = pendingInstruction
    const styleId = selectedStyle
    setPendingInstruction(null)
    if (!shouldSave || !instruction || !styleId) return
    try {
      await persistInstructionToTemplate(styleId, instruction)
      notify(`${t('cvGenerator.instructionSaved')} ${getStyleName(styleId, customTemplates)}`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorSavingTemplate')
      setError(msg)
    }
  }

  const openHistory = async () => {
    if (!jobId || !window.api) return
    setShowHistory(true)
    setViewingContent(null)
    setLoadingVersions(true)
    try {
      const result = await window.api.getCvVersions(jobId)
      setVersions(result)
    } catch {
      setVersions([])
    } finally {
      setLoadingVersions(false)
    }
  }

  const handleRestore = (version: CvVersion) => {
    onSave(version.style ?? selectedStyle ?? '', version.content)
    setShowHistory(false)
    setViewingContent(null)
    notify(t('cvGenerator.versionRestored'), 'success')
  }

  const handleCopy = async () => {
    await window.api?.copyToClipboard(withPhoto(content))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const certToggle = certCount > 0 ? (
    <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer shrink-0" title={t('cvGenerator.attachCertsHint')}>
      <input type="checkbox" checked={attachCerts} onChange={(e) => setAttachCerts(e.target.checked)} />
      {t('cvGenerator.attachCerts', { count: certCount })}
    </label>
  ) : null

  const handleDownloadPdf = async () => {
    if (!window.api || downloading) return
    setDownloading(true)
    setSavedPath(null)
    try {
      const path = await window.api.downloadCvPdf(withPhoto(content), selectedStyle!, pdfOpts)
      if (path) setSavedPath(path)
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorDownloading')
      setError(msg)
    } finally {
      setDownloading(false)
    }
  }

  const handleEditorChange = (value: string) => {
    setContent(value)
    if (selectedStyle) onSave(selectedStyle, value)
  }

  const handleCreateTemplate = async () => {
    if (!newName.trim() || !newPrompt.trim() || !window.api) return
    setSavingTemplate(true)
    try {
      const template: CvTemplate = {
        id: crypto.randomUUID(),
        name: newName.trim(),
        prompt: newPrompt.trim(),
        sampleHtml: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await window.api.saveCvTemplate(template)
      setCustomTemplates(prev => [...prev, template])
      setNewName('')
      setNewPrompt('')
      setShowCreateForm(false)
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorSavingTemplate')
      setError(msg)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!window.api) return
    try {
      await window.api.deleteCvTemplate(id)
      setCustomTemplates(prev => prev.filter(t => t.id !== id))
      if (selectedStyle === `custom:${id}`) {
        setSelectedStyle(null)
        setContent('')
      }
    } catch (err) {
      const msg = err instanceof Error ? friendlyMessage(err) : t('cvGenerator.errorDeletingTemplate')
      setError(msg)
    }
  }

  // ── Style Selection Step ──
  if (step === 'style') {
    return (
      <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('cvGenerator.title')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            {t('cvGenerator.selectStyle')}
          </p>
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Built-in styles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {BUILTIN_STYLES.map((s) => {
            const cc = colorClasses[s.color]
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => handleChooseStyle(s.id)}
                disabled={loadingSummaries}
                className={`p-4 rounded-xl border-2 text-left transition-all hover:border-blue-400 border-gray-200 dark:border-gray-700 disabled:opacity-50`}
              >
                {loadingSummaries && selectedStyle === s.id ? (
                  <Loader2 className={`w-6 h-6 mb-2 animate-spin ${cc.text}`} />
                ) : (
                  <Icon className="w-6 h-6 mb-2 text-gray-400" />
                )}
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.desc}</div>
              </button>
            )
          })}
        </div>

        {/* Custom templates */}
        {listedTemplates.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">{t('cvGenerator.yourTemplates')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {listedTemplates.map((t) => {
                const styleId = `custom:${t.id}`
                const isSelected = selectedStyle === styleId
                const cc = colorClasses.slate
                return (
                  <button
                    key={t.id}
                    onClick={() => handleChooseStyle(styleId)}
                    disabled={loadingSummaries}
                    className={`p-4 rounded-xl border-2 text-left transition-all relative group ${
                      isSelected ? `${cc.border} ${cc.bg}` : 'border-gray-200 dark:border-gray-700 hover:border-slate-400'
                    } disabled:opacity-50`}
                  >
                    {loadingSummaries && isSelected ? (
                      <Loader2 className={`w-6 h-6 mb-2 animate-spin ${cc.text}`} />
                    ) : (
                      <FileText className="w-6 h-6 mb-2 text-gray-400" />
                    )}
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{t.prompt.slice(0, 80)}...</div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id) }}
                      className="absolute top-2 right-2 p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Create template */}
        <div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {showCreateForm ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <Plus className="w-3.5 h-3.5" />
            {t('cvGenerator.createTemplate')}
          </button>

          {showCreateForm && (
            <div className="mt-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('cvGenerator.templateName')}</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={t('cvGenerator.templateNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  {t('templateDesigner.howShouldItLook')}
                </label>
                <TemplateDesigner value={newPrompt} onChange={setNewPrompt} />
              </div>
              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleCreateTemplate}
                  disabled={!newName.trim() || !newPrompt.trim() || savingTemplate}
                >
                  {savingTemplate ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t('cvGenerator.saveTemplate')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {loadingSummaries && selectedStyle && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {t('cvGenerator.preparingSummaries')}
          </div>
        )}
      </div>
    )
  }

  // ── Summary Selection Step ──
  if (step === 'summary' && summaryOptions) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep('style')}
            className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('cvGenerator.chooseSummary')}
          </h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('cvGenerator.selectSummary')}
        </p>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3">
          {summaryOptions.map((opt) => {
            const Icon = SUMMARY_CARD_ICONS[opt.id] || FileText
            return (
              <button
                key={opt.id}
                onClick={() => handleSelectSummary(opt.summary)}
                disabled={generating}
                className="p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 text-left transition-all disabled:opacity-50 group"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {t('cvGenerator.focusPrefix')}{opt.label}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {opt.summary}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {generating && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            {t('cvGenerator.generatingWithSummary')} <span className="opacity-70">· {t('timeHint.cv')}</span>
          </div>
        )}
      </div>
    )
  }

  // ── Generated View ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          {t('cvGenerator.cvPrefix')}{getStyleName(selectedStyle, customTemplates)}
        </h3>
        <div className="flex items-center gap-2">
          {jobId && (
            <Button variant="ghost" size="sm" onClick={openHistory} title={t('cvGenerator.history')}>
              <History className="w-4 h-4" />
              {t('cvGenerator.history')}
            </Button>
          )}
          <div className="flex gap-1 flex-wrap">
            {BUILTIN_STYLES.map((s) => {
              const cc = colorClasses[s.color]
              const isSelected = selectedStyle === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (content) {
                      setPendingRegenerate(s.id)
                    } else {
                      handleRegenerate(s.id)
                    }
                  }}
                  disabled={generating}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    isSelected ? `${cc.border} ${cc.bg} ${cc.text}` : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {s.name}
                </button>
              )
            })}
            {listedTemplates.map((t) => {
              const styleId = `custom:${t.id}`
              const isSelected = selectedStyle === styleId
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (content) {
                      setPendingRegenerate(styleId)
                    } else {
                      handleRegenerate(styleId)
                    }
                  }}
                  disabled={generating}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                    isSelected
                      ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/20 text-slate-700 dark:text-slate-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {t.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {generating && (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          {t('cvGenerator.regenerating')} <span className="opacity-70">· {t('timeHint.cv')}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!generating && content && (
        <>
          {/* Tab bar */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-4">
              <button
                onClick={() => setTab('preview')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  tab === 'preview'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {t('cvGenerator.preview')}
              </button>
              {showHtmlEditor && <button
                onClick={() => setTab('edit')}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1 ${
                  tab === 'edit'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                {t('cvGenerator.editor')}
              </button>}
            </div>
            <div className="flex items-center gap-1 pb-2">
              {tab === 'preview' && (
                <Button
                  variant={editMode ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={toggleEditMode}
                  title={editMode ? t('cvGenerator.doneEditing') : t('cvGenerator.editText')}
                >
                  {editMode ? <Check className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                  {editMode ? t('cvGenerator.doneEditing') : t('cvGenerator.editText')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleCopy} title={t('cvGenerator.copy')}>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button variant="secondary" size="sm" onClick={openSendModal}>
                <Send className="w-4 h-4" />
                {t('sendCv.sendButton')}
              </Button>
              {canSendWhatsApp && (
                <Button variant="secondary" size="sm" onClick={openWaModal} title={recipientPhone}>
                  <MessageCircle className="w-4 h-4 text-green-600" />
                  {t('sendCvWhatsapp.sendButton')}
                </Button>
              )}
              {certToggle}
              <Button variant="primary" size="sm" onClick={handleDownloadPdf} disabled={downloading}>
                {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {downloading ? t('cvGenerator.generatingPdf') : t('cvGenerator.download')}
              </Button>
            </div>
          </div>

          {/* Preview */}
          {tab === 'preview' && (
            <div
              ref={previewRef}
              className="cv-preview bg-white rounded-lg border border-gray-200 dark:border-gray-700 p-6 min-h-[300px] overflow-x-auto"
              style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
            >
              <style>{`
                .cv-preview * { max-width: 100%; box-sizing: border-box; }
                .cv-preview img, .cv-preview table, .cv-preview pre { max-width: 100%; height: auto; }
                .cv-preview p, .cv-preview li, .cv-preview h1, .cv-preview h2, .cv-preview h3,
                .cv-preview div, .cv-preview span, .cv-preview td, .cv-preview th { overflow-wrap: anywhere; }
              `}</style>
              <div
                ref={editRef}
                className={`w-full max-w-full ${editMode ? 'cursor-text outline-2 outline-dashed outline-blue-400 outline-offset-4' : 'cursor-default'}`}
                contentEditable={editMode}
                suppressContentEditableWarning={true}
                onInput={handlePreviewInput}
                {...(!editMode ? { dangerouslySetInnerHTML: { __html: withPhoto(content) } } : {})}
              />
            </div>
          )}

          {/* Editor */}
          {tab === 'edit' && (
            <textarea
              value={content}
              onChange={(e) => handleEditorChange(e.target.value)}
              className="w-full h-96 px-4 py-3 text-xs font-mono rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
              spellCheck={false}
            />
          )}

          {/* Instrucciones rápidas */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_INSTRUCTIONS.map((q) => (
              <button
                key={q.id}
                onClick={() => handleApplyInstructions(q.instruction)}
                disabled={applying}
                className="px-2.5 py-1 text-xs rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 disabled:opacity-50"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* AI Instructions */}
          <div className="flex gap-2">
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleApplyInstructions()
                }
              }}
              placeholder={t('cvGenerator.instructionsPlaceholder')}
              className="flex-1 px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleApplyInstructions()}
              disabled={!instructions.trim() || applying}
            >
              {applying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              {t('cvGenerator.apply')}
            </Button>
          </div>

          {/* Saved path banner */}
          {savedPath && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded-lg border border-green-200 dark:border-green-800">
              <Check className="w-3.5 h-3.5" />
              <span>{t('cvGenerator.pdfSaved')}{savedPath}</span>
            </div>
          )}
        </>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <History className="w-4 h-4" />
                {t('cvGenerator.versionsTitle')}
              </h3>
              <button
                onClick={() => { setShowHistory(false); setViewingContent(null) }}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {viewingContent ? (
                <div className="space-y-3">
                  <button
                    onClick={() => setViewingContent(null)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    ← {t('cvGenerator.versionsTitle')}
                  </button>
                  <pre className="whitespace-pre-wrap text-xs font-mono bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 max-h-[60vh] overflow-auto">
                    {viewingContent}
                  </pre>
                </div>
              ) : loadingVersions ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-6">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('cvGenerator.regenerating')}
                </div>
              ) : versions.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
                  {t('cvGenerator.noVersions')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((v, i) => (
                    <li
                      key={`${v.createdAt}-${i}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                    >
                      <div className="min-w-0">
                        <div className="text-sm text-gray-800 dark:text-gray-200">
                          {new Date(v.createdAt).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getStyleName(v.style, customTemplates)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => setViewingContent(v.content)}>
                          {t('cvGenerator.view')}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleRestore(v)}>
                          {t('cvGenerator.restore')}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingRegenerate !== null}
        title={t('cvGenerator.regenerateTitle')}
        message={t('cvGenerator.regenerateMessage')}
        confirmLabel={t('cvGenerator.regenerateConfirm')}
        cancelLabel={t('cvGenerator.regenerateCancel')}
        variant="default"
        onConfirm={() => {
          if (pendingRegenerate) {
            handleRegenerate(pendingRegenerate)
            setPendingRegenerate(null)
          }
        }}
        onCancel={() => setPendingRegenerate(null)}
      />

      <ConfirmDialog
        open={showSaveToTemplateDialog}
        title={t('cvGenerator.saveToTemplateQuestion')}
        message={t('cvGenerator.saveToTemplateDesc')}
        confirmLabel={t('cvGenerator.saveToTemplateConfirm')}
        cancelLabel={t('cvGenerator.saveThisTimeOnly')}
        variant="default"
        onConfirm={() => handleConfirmSaveToTemplate(true)}
        onCancel={() => handleConfirmSaveToTemplate(false)}
      />

      {/* ── Modal de envío de CV por WhatsApp ── */}
      {showWaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-green-600" />
                {t('sendCvWhatsapp.title')}
              </h3>
              <button
                onClick={() => setShowWaModal(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sendCvWhatsapp.phone')}
                </label>
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+505 8888 7777"
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500/40"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('sendCvWhatsapp.phoneHint')}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('sendCvWhatsapp.message')}
                  </label>
                  {coverLetterBody && (
                    <button
                      type="button"
                      onClick={() => setWaMessage(coverLetterBody)}
                      className="text-xs text-green-600 hover:text-green-700 dark:text-green-400"
                    >
                      {t('sendCvWhatsapp.useCoverLetter')}
                    </button>
                  )}
                </div>
                <textarea
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500/40 resize-y"
                />
              </div>

              <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">CV.pdf</span>
                <span className="text-xs text-gray-400">{t('sendCv.attachment')}</span>
                    {certToggle}
              </div>

              {waResult && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  waResult.ok
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                }`}>
                  {waResult.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{waResult.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" size="sm" onClick={() => setShowWaModal(false)}>
                {t('sendCv.cancel')}
              </Button>
              <Button variant="primary" size="sm" onClick={handleSendWhatsApp} disabled={waSending || !waPhone.trim() || !waConnected || waResult?.ok === true}>
                {waSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                {waSending ? t('sendCv.sending') : t('sendCv.send')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de envío de CV por correo ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Send className="w-4 h-4 text-blue-500" />
                {t('sendCv.title')}
              </h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Config de email si no está configurado */}
              {setupMode && (
                <div className="p-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 space-y-3">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">{t('sendCv.setupTitle')}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">{t('sendCv.setupSubtitle')}</p>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{t('emailConfig.user')}</label>
                    <input
                      type="email"
                      value={cfgUser}
                      onChange={(e) => setCfgUser(e.target.value)}
                      placeholder="tucorreo@gmail.com"
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">{t('emailConfig.appPassword')}</label>
                      <button
                        type="button"
                        onClick={() => setShowAppPasswordHelp(!showAppPasswordHelp)}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        {t('emailConfig.howToGet')}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showCfgPass ? 'text' : 'password'}
                        value={cfgPass}
                        onChange={(e) => setCfgPass(e.target.value)}
                        placeholder="xxxx xxxx xxxx xxxx"
                        className="w-full px-3 py-2 pr-10 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCfgPass(!showCfgPass)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showCfgPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {cfgName && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('emailConfig.fromProfile')}: <span className="font-medium text-gray-700 dark:text-gray-300">{cfgName}</span>
                    </p>
                  )}

                  {showAppPasswordHelp && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200">{t('emailConfig.helpTitle')}</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700 dark:text-blue-300">
                        <li>{t('emailConfig.helpStep1')}</li>
                        <li>{t('emailConfig.helpStep2')}</li>
                        <li>{t('emailConfig.helpStep3')}</li>
                      </ol>
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        <a
                          href="https://myaccount.google.com/apppasswords"
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          https://myaccount.google.com/apppasswords
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!setupMode && (
                <>
                  {/* Destinatario */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('sendCv.to')}
                    </label>
                    <input
                      type="email"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      placeholder="reclutador@empresa.com"
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  {/* Asunto */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('sendCv.subject')}
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </div>

                  {/* Cuerpo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {t('sendCv.body')}
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={8}
                      className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
                    />
                  </div>

                  {/* Adjunto */}
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">CV.pdf</span>
                    <span className="text-xs text-gray-400">{t('sendCv.attachment')}</span>
                    {certToggle}
                  </div>
                </>
              )}

              {sendResult && (
                <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  sendResult.ok
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                }`}>
                  {sendResult.ok ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{sendResult.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" size="sm" onClick={() => setShowSendModal(false)}>
                {t('sendCv.cancel')}
              </Button>
              {setupMode ? (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={testingCfg}
                  onClick={async () => {
                    if (!cfgUser.trim() || !cfgPass.trim()) {
                      setSendResult({ ok: false, message: t('sendCv.fillConfig') })
                      return
                    }
                    // Se comprueba la conexión antes de guardar: así el usuario sabe al instante si la clave sirve.
                    const config = buildCfgConfig()
                    setTestingCfg(true)
                    setSendResult(null)
                    try {
                      const test = await window.api.testEmailConnection(config)
                      if (!test.ok) {
                        setSendResult({ ok: false, message: friendlyMessage(test.error || t('sendCv.sendError')) })
                        return
                      }
                      await updateSettings({ emailConfig: config })
                      notify(t('sendCv.connectionOk'), 'success')
                      setSetupMode(false)
                    } catch (e) {
                      setSendResult({ ok: false, message: friendlyMessage(e) })
                    } finally {
                      setTestingCfg(false)
                    }
                  }}
                >
                  {testingCfg ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {testingCfg ? t('sendCv.testing') : t('sendCv.continue')}
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={handleSend} disabled={sending || !to.trim() || sendResult?.ok === true}>
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? t('sendCv.sending') : t('sendCv.send')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}