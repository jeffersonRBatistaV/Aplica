import { useEffect, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotification } from '../../contexts/NotificationContext'
import type { AutomationConfig as AutomationConfigType, CvTemplate } from '../../../shared/types'

const SUMMARY_OPTIONS = [
  { id: '', labelKey: 'automation.summaryAuto' },
  { id: 'tecnicista', labelKey: 'automation.summaryTecnicista' },
  { id: 'ejecutivo', labelKey: 'automation.summaryEjecutivo' },
  { id: 'creativo', labelKey: 'automation.summaryCreativo' },
]

function styleValue(template: CvTemplate): string {
  return template.id.startsWith('seed-') ? template.id : `custom:${template.id}`
}

export function AutomationConfig() {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const [config, setConfig] = useState<AutomationConfigType | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api?.getAutomationConfig().then(setConfig).catch(() => {})
  }, [])

  const update = async (patch: Partial<AutomationConfigType>) => {
    if (!window.api) return
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev))
    setSaving(true)
    try {
      const saved = await window.api.saveAutomationConfig(patch)
      setConfig(saved)
      notify(t('automation.saved'), 'success')
    } catch {
      // Silencioso: se reintenta al siguiente cambio.
    } finally {
      setSaving(false)
    }
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Bot className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('automation.title')}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('automation.description')}</p>
        </div>
      </div>

      <ToggleRow
        label={t('automation.enabled')}
        hint={t('automation.enabledHint')}
        checked={config.enabled}
        onChange={(v) => void update({ enabled: v })}
      />

      <div className="space-y-3 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <ToggleRow
          label={t('automation.autoCv')}
          hint={t('automation.autoCvHint')}
          checked={config.autoCv}
          onChange={(v) => void update({ autoCv: v })}
        />
        {config.autoCv && (
          <div className="pl-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('automation.cvStyle')}</label>
            <select
              value={config.cvStyle || 'ats'}
              onChange={(e) => void update({ cvStyle: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="ats">ATS-Friendly</option>
              <option value="moderno">Moderno</option>
              <option value="tradicional">Tradicional</option>
              <StyleTemplates />
            </select>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mt-3 mb-1">{t('automation.summary')}</label>
            <select
              value={config.cvSummaryId || ''}
              onChange={(e) => void update({ cvSummaryId: e.target.value || null })}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {SUMMARY_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{t(o.labelKey)}</option>
              ))}
            </select>
          </div>
        )}
        <ToggleRow
          label={t('automation.autoQuestions')}
          hint={t('automation.autoQuestionsHint')}
          checked={config.autoQuestions}
          onChange={(v) => void update({ autoQuestions: v })}
        />
        <ToggleRow
          label={t('automation.askBeforeApply')}
          hint={t('automation.askBeforeApplyHint')}
          checked={config.askBeforeApply}
          onChange={(v) => void update({ askBeforeApply: v })}
        />
      </div>

      <ToggleRow
        label={t('automation.dontOfferAgain')}
        hint={t('automation.dontOfferAgainHint')}
        checked={config.dontOfferAgain}
        onChange={(v) => void update({ dontOfferAgain: v })}
      />

      {saving && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('automation.saving')}
        </div>
      )}
    </div>
  )
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <div className="flex-1">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
      >
        <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
    </label>
  )
}

function StyleTemplates() {
  const [templates, setTemplates] = useState<CvTemplate[]>([])
  useEffect(() => {
    // ats/moderno/tradicional ya están arriba como opciones fijas; el resto (incluidas las
    // predeterminadas con foto y las propias) se listan aquí.
    const builtIn = new Set(['seed-ats', 'seed-moderno', 'seed-tradicional'])
    window.api?.getCvTemplates().then((list) => setTemplates(list.filter((t) => !builtIn.has(t.id)))).catch(() => {})
  }, [])
  if (templates.length === 0) return null
  return (
    <>
      {templates.map((t) => (
        <option key={t.id} value={styleValue(t)}>{t.name}</option>
      ))}
    </>
  )
}
