import { useState } from 'react'
import { MessageCircle, ChevronDown, ChevronUp, RefreshCw, Loader2, Sparkles } from 'lucide-react'
import { Button } from '../ui/Button'
import type { InterviewQuestion } from '../../../shared/types'

interface InterviewPrepProps {
  questions: InterviewQuestion[]
  generating: boolean
  onGenerate: () => void
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
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{q.question}</p>
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
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{q.answer}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export function InterviewPrep({ questions, generating, onGenerate }: InterviewPrepProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="text-base font-semibold">Preparación para la Entrevista</h3>
        </div>
        <div className="flex items-center gap-2">
          {questions.length > 0 && (
            <span className="text-xs text-gray-400">{questions.length} preguntas</span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
            ) : questions.length > 0 ? (
              <><RefreshCw className="w-3.5 h-3.5" /> Regenerar</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Generar Preguntas</>
            )}
          </Button>
        </div>
      </div>

      {generating ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Generando preguntas personalizadas...</span>
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
            Genera preguntas de entrevista personalizadas para esta vacante basadas en tu perfil y el reporte ATS
          </p>
        </div>
      )}
    </div>
  )
}
