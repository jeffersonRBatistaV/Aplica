import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Bot, Loader2, Sparkles, HelpCircle, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import type { AutomationConfig } from '../../../shared/types'

interface AutomationOfferModalProps {
  open: boolean
  appliedCount: number
  initial: AutomationConfig
  running: boolean
  onConfirm: (config: Partial<AutomationConfig>) => void
  onSkip: (dontOfferAgain: boolean) => void
}

export function AutomationOfferModal({ open, appliedCount, initial, running, onConfirm, onSkip }: AutomationOfferModalProps) {
  const { t } = useTranslation()
  const [autoCv, setAutoCv] = useState(initial.autoCv)
  const [autoQuestions, setAutoQuestions] = useState(initial.autoQuestions)
  const [askBeforeApply, setAskBeforeApply] = useState(initial.askBeforeApply)
  const [dontOfferAgain, setDontOfferAgain] = useState(initial.dontOfferAgain)

  useEffect(() => {
    if (open) {
      setAutoCv(initial.autoCv)
      setAutoQuestions(initial.autoQuestions)
      setAskBeforeApply(initial.askBeforeApply)
      setDontOfferAgain(initial.dontOfferAgain)
    }
  }, [open, initial])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="flex items-start gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
            <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('automation.offerTitle')}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('automation.offerDescription', { count: appliedCount })}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <CheckRow
            icon={<Sparkles className="w-4 h-4 text-purple-500" />}
            label={t('automation.autoCv')}
            hint={t('automation.autoCvHint')}
            checked={autoCv}
            onChange={setAutoCv}
          />
          <CheckRow
            icon={<HelpCircle className="w-4 h-4 text-blue-500" />}
            label={t('automation.autoQuestions')}
            hint={t('automation.autoQuestionsHint')}
            checked={autoQuestions}
            onChange={setAutoQuestions}
          />
          <CheckRow
            icon={<Mail className="w-4 h-4 text-green-500" />}
            label={t('automation.askBeforeApply')}
            hint={t('automation.askBeforeApplyHint')}
            checked={askBeforeApply}
            onChange={setAskBeforeApply}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
            {t('automation.offerEmailNote')}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
          <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={dontOfferAgain}
              onChange={(e) => setDontOfferAgain(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            {t('automation.dontOfferAgain')}
          </label>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onSkip(dontOfferAgain)} disabled={running}>
              {t('automation.offerSkip')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirm({ autoCv, autoQuestions, askBeforeApply, dontOfferAgain, enabled: true })}
              disabled={running}
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
              {t('automation.offerConfirm')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckRow({ icon, label, hint, checked, onChange }: { icon: ReactNode; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-gray-300 dark:border-gray-600"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{label}</span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{hint}</p>
      </div>
    </label>
  )
}
