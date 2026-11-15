import { Check, ClipboardPaste, Gauge, FileText, Send, MessagesSquare, Zap, Loader2, PartyPopper, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { JobStatus } from '../../../shared/types'

export type StepId = 'paste' | 'match' | 'cv' | 'send' | 'interview'

export const STEP_SECTION_ID: Record<StepId, string> = {
  paste: 'vac-step-paste',
  match: 'vac-step-match',
  cv: 'vac-step-cv',
  send: 'vac-step-cv',
  interview: 'vac-step-interview',
}

interface ApplicationStepsProps {
  hasVacancy: boolean
  hasReport: boolean
  hasCv: boolean
  status: JobStatus | null
  hasQuestions: boolean
  busy: boolean
  /** Ejecuta el siguiente paso recomendado. */
  onNext: (step: StepId) => void
  /** Crea el CV y abre el envío en un clic. */
  onQuickApply?: () => void
  quickApplying?: boolean
}

export function scrollToStep(step: StepId): void {
  document.getElementById(STEP_SECTION_ID[step])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** Barra de progreso de la postulación + tarjeta "Siguiente paso". */
export function ApplicationSteps({ hasVacancy, hasReport, hasCv, status, hasQuestions, busy, onNext, onQuickApply, quickApplying }: ApplicationStepsProps) {
  const { t } = useTranslation()
  const sent = !!status && status !== 'draft'

  const steps: { id: StepId; icon: typeof Check; done: boolean }[] = [
    { id: 'paste', icon: ClipboardPaste, done: hasVacancy && hasReport },
    { id: 'match', icon: Gauge, done: hasReport },
    { id: 'cv', icon: FileText, done: hasCv },
    { id: 'send', icon: Send, done: sent },
    { id: 'interview', icon: MessagesSquare, done: hasQuestions },
  ]
  const current = steps.find((s) => !s.done)?.id ?? null
  const doneCount = steps.filter((s) => s.done).length

  // Paso 1 lo resuelve el propio formulario de la vacante: no hay "siguiente" que sugerir.
  const next: StepId | null = current === 'paste' ? null : current

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('steps.progress', { done: doneCount, total: steps.length })}</span>
        <div className="flex-1 mx-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div className="h-full bg-blue-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>

      <ol className="grid grid-cols-5 gap-1">
        {steps.map((s, i) => {
          const Icon = s.done ? Check : s.icon
          const isCurrent = s.id === current
          return (
            <li key={s.id}>
              <button
                onClick={() => scrollToStep(s.id)}
                className="w-full flex flex-col items-center gap-1 text-center group"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                  s.done
                    ? 'bg-green-500 border-green-500 text-white'
                    : isCurrent
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 text-gray-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className={`text-[11px] leading-tight ${isCurrent ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'} group-hover:text-blue-600`}>
                  {i + 1}. {t(`steps.${s.id}`)}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {next ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{t(`steps.next.${next}.title`)}</p>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-0.5">{t(`steps.next.${next}.desc`)}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {next === 'cv' && onQuickApply && (
              <button
                onClick={onQuickApply}
                disabled={busy || quickApplying}
                title={t('steps.quickApplyHint')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
              >
                {quickApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                {quickApplying ? t('steps.quickApplying') : t('steps.quickApply')}
              </button>
            )}
            <button
              onClick={() => onNext(next)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {t(`steps.next.${next}.action`)}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : current === null ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-sm text-green-700 dark:text-green-300">
          <PartyPopper className="w-4 h-4 shrink-0" />
          <span>{t('steps.allDone')}</span>
        </div>
      ) : null}
    </div>
  )
}
