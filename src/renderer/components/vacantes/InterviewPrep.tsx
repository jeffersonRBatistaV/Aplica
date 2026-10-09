import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MessageCircle, ChevronDown, ChevronUp, RefreshCw, Loader2, Sparkles, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui/Button'
import { useNotification } from '../../contexts/NotificationContext'
import type { InterviewQuestion } from '../../../shared/types'

interface InterviewPrepProps {
  questions: InterviewQuestion[]
  generating: boolean
  onGenerate: () => void
  company?: string
  position?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  'Experiencia': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'Técnica': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  'Comportamental': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  'Empresa/Industria': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'Motivación': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
}

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderText(markdown: string): string {
  return escapeHtml(markdown || '')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

function QuestionCard({ q }: { q: InterviewQuestion }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <MessageCircle className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getCategoryColor(q.category)}`}>
              {q.category}
            </span>
          </div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.question}</ReactMarkdown>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 border-t border-gray-100 dark:border-gray-700/50">
          <div className="pl-7">
            <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{q.answer}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function InterviewPrep({ questions, generating, onGenerate, company, position }: InterviewPrepProps) {
  const { t } = useTranslation()
  const { notify } = useNotification()
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const handleDownloadPdf = async () => {
    if (!window.api || questions.length === 0) return
    setDownloadingPdf(true)
    try {
      const subtitle = [company, position].filter(Boolean).join(' · ')
      const rows = questions
        .map(
          (q) => `
        <section style="margin-bottom:14px;page-break-inside:avoid;">
          <div style="font-size:9pt;text-transform:uppercase;letter-spacing:.04em;color:#6b7280;margin-bottom:2px;">${escapeHtml(q.category)}</div>
          <div style="font-weight:600;margin-bottom:4px;">${renderText(q.question)}</div>
          <div style="color:#374151;">${renderText(q.answer)}</div>
        </section>`,
        )
        .join('')
      const html = `<div style="padding:18mm 16mm;">
        <h1 style="font-size:18pt;margin:0 0 2px;">${escapeHtml(t('interviewPrep.title'))}</h1>
        ${subtitle ? `<p style="margin:0 0 16px;color:#6b7280;">${escapeHtml(subtitle)}</p>` : ''}
        ${rows}
      </div>`
      const path = await window.api.downloadCvPdf(html, 'entrevista')
      if (path) notify(`${t('interviewPrep.pdfSaved')} ${path}`, 'success')
    } catch {
      notify(t('interviewPrep.errorDownloading'), 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-base font-semibold">{t('interviewPrep.title')}</h3>
        </div>
        <div className="flex items-center gap-2">
          {questions.length > 0 && (
            <span className="text-xs text-gray-400">{t('interviewPrep.questionsCount', { count: questions.length })}</span>
          )}
          {questions.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => void handleDownloadPdf()} disabled={downloadingPdf}>
              {downloadingPdf ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('interviewPrep.generatingPdf')}</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> {t('interviewPrep.download')}</>
              )}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('interviewPrep.generating')}</>
            ) : questions.length > 0 ? (
              <><RefreshCw className="w-3.5 h-3.5" /> {t('interviewPrep.regenerate')}</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> {t('interviewPrep.generate')}</>
            )}
          </Button>
        </div>
      </div>

      {generating ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">{t('interviewPrep.generatingQuestions')}</span>
        </div>
      ) : questions.length > 0 ? (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <QuestionCard key={i} q={q} />
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-600">
          <p className="text-sm text-gray-400 text-center">
            {t('interviewPrep.emptyState')}
          </p>
        </div>
      )}
    </div>
  )
}
