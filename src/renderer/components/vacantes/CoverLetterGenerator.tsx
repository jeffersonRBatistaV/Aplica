import { useState } from 'react'
import { FileText, Mail, AtSign, Copy, Check, Pencil, Loader2, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '../ui/Button'
import { useNotification } from '../../contexts/NotificationContext'

interface CoverLetterGeneratorProps {
  coverLetterA: string
  coverLetterB: string
  generating: boolean
  onSave: (type: 'A' | 'B', content: string) => void
  recruiterEmail: string
  subject: string
}

function extractLetterContent(raw: string, key: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('"')) return raw
  try {
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'object' && parsed[key]) return parsed[key]
  } catch {
    const match = trimmed.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`))
    if (match) return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
  }
  return raw
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      if (window.api) {
        await window.api.copyToClipboard(text)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="inline-flex items-center gap-1 cursor-pointer text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" onClick={handleCopy} title={label || 'Copiar'}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="text-xs">{copied ? 'Copiado' : 'Copiar'}</span>
    </span>
  )
}

export function CoverLetterGenerator({
  coverLetterA,
  coverLetterB,
  generating,
  onSave,
  recruiterEmail,
  subject,
}: CoverLetterGeneratorProps) {
  const { notify } = useNotification()
  const [activeLetter, setActiveLetter] = useState<'A' | 'B'>('A')
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')

  const currentContent = activeLetter === 'A' ? coverLetterA : coverLetterB
  const displayedContent = extractLetterContent(currentContent, activeLetter === 'A' ? 'coverLetterA' : 'coverLetterB')
  const hasContent = currentContent.length > 0

  const handleCopyAll = async () => {
    const body = `To: ${recruiterEmail}
Subject: ${subject}

${displayedContent}`
    try {
      await navigator.clipboard.writeText(body)
    } catch {
      if (window.api) {
        await window.api.copyToClipboard(body)
      }
    }
  }

  const handleSendEmail = () => {
    const mailto = `mailto:${encodeURIComponent(recruiterEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(displayedContent)}`
    window.location.href = mailto
    notify('Cliente de correo abierto para enviar la carta', 'info')
  }

  const handleStartEdit = () => {
    setEditContent(displayedContent)
    setEditing(true)
  }

  const handleSaveEdit = () => {
    onSave(activeLetter, editContent)
    setEditing(false)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">Cartas Generadas</h3>

      {/* Selector de variación */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveLetter('A')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeLetter === 'A'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <Mail className="w-4 h-4" />
          Variación A · Cold Email
        </button>
        <button
          onClick={() => setActiveLetter('B')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeLetter === 'B'
              ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-transparent hover:border-gray-300 dark:hover:border-gray-600'
          }`}
        >
          <FileText className="w-4 h-4" />
          Variación B · Cover Letter
        </button>
      </div>

      {/* Destinatario (de la IA) */}
      {recruiterEmail && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
          <AtSign className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm text-blue-700 dark:text-blue-300 flex-1">{recruiterEmail}</span>
          <CopyBtn text={recruiterEmail} label="Copiar email del destinatario" />
        </div>
      )}

      {/* Asunto (de la IA) */}
      {subject && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <Mail className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{subject}</span>
          <CopyBtn text={subject} label="Copiar asunto" />
        </div>
      )}

      {/* Cuerpo */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {activeLetter === 'A' ? 'Cold Email' : 'Cover Letter'}
          </span>
          <div className="flex items-center gap-1">
            {hasContent && (
              <>
                <button
                  onClick={handleCopyAll}
                  className="p-1.5 rounded text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title="Copiar todo (To + Asunto + Cuerpo)"
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>
                {recruiterEmail && (
                  <button
                    onClick={handleSendEmail}
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                    title="Abrir en cliente de correo"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
                <CopyBtn text={displayedContent} label="Copiar solo el texto" />
                <button
                  onClick={editing ? handleSaveEdit : handleStartEdit}
                  className="p-1.5 rounded text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title={editing ? 'Guardar' : 'Editar'}
                >
                  {editing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-4">
          {generating ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Generando cartas...</span>
            </div>
          ) : editing ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full min-h-[300px] px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
            />
          ) : hasContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {displayedContent}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              Las cartas se generarán automáticamente después del análisis ATS
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
