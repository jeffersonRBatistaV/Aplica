import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from 'react'
import { Send, Square, X, Image as ImageIcon, FileText, Table } from 'lucide-react'
import { useFileAttachments } from '../../hooks/useFileAttachments'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { isImageType, isTextType, isExcelType, formatFileSize } from '../../types/attachments'
import { useTranslation } from 'react-i18next'

interface ChatInputProps {
  onSend: (content: string, attachments?: string) => void
  onAbort: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onAbort, isStreaming, disabled }: ChatInputProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    attachments,
    isDragging,
    setIsDragging,
    addFiles,
    removeAttachment,
    clearAttachments,
  } = useFileAttachments()

  const {
    isListening,
    transcript,
    interimTranscript,
    support: voiceSupport,
    toggleListening,
  } = useSpeechRecognition()

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = '0'
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`
    }
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  // Flush voice transcript when mic is toggled off
  const prevListeningRef = useRef(isListening)
  useEffect(() => {
    if (prevListeningRef.current && !isListening && transcript) {
      setValue((prev) => {
        const separator = prev ? ` ${transcript}` : transcript
        return prev + separator
      })
    }
    prevListeningRef.current = isListening
  }, [isListening, transcript])

  const buildAttachmentContext = useCallback((): string | undefined => {
    if (attachments.length === 0) return undefined
    return attachments
      .map((att) => {
        const header = `[${t('chatInput.filePrefix')}: ${att.name}]`
        return `${header}\n${att.data}`
      })
      .join('\n\n---\n\n')
  }, [attachments])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if ((!trimmed && attachments.length === 0) || isStreaming || disabled) return
    const context = buildAttachmentContext()
    onSend(trimmed, context)
    setValue('')
    clearAttachments()
  }, [value, attachments, isStreaming, disabled, onSend, buildAttachmentContext, clearAttachments])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(true)
    },
    [setIsDragging],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
    },
    [setIsDragging],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files)
      }
    },
    [setIsDragging, addFiles],
  )

  const ocrProcessedRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    attachments.forEach(async (att) => {
      if (!att.preview || ocrProcessedRef.current.has(att.id) || !window.api) return
      ocrProcessedRef.current.add(att.id)
      const text = await window.api.imageToText(att.data)
      if (text) {
        setValue((prev) => {
          const sep = prev ? `\n\n--- Texto extraído de imagen (${att.name}) ---\n${text}\n---` : text
          return prev + sep
        })
      }
    })
  }, [attachments])

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files)
        e.target.value = ''
      }
    },
    [addFiles],
  )

  const getFileIcon = (type: string, name: string) => {
    if (isImageType(type)) return <ImageIcon className="w-3.5 h-3.5" />
    if (isTextType(type, name)) return <FileText className="w-3.5 h-3.5" />
    if (isExcelType(name)) return <Table className="w-3.5 h-3.5" />
    return <FileText className="w-3.5 h-3.5" />
  }

  const hasInput = value.trim().length > 0 || attachments.length > 0

  return (
    <div
      className="border-t bg-white dark:bg-gray-950 px-4 py-3 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-4xl mx-auto">
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-600/10 dark:bg-blue-500/10 backdrop-blur-sm border-t border-dashed border-blue-500">
            <div className="text-center">
              <svg
                className="w-10 h-10 mx-auto mb-2 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {t('chatInput.dropFilesHere')}
              </p>
              <p className="text-xs text-blue-500/70 mt-1">
                {t('chatInput.fileTypes')}
              </p>
            </div>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".txt,.md,.csv,.xlsx,.xls,.json,.png,.jpg,.jpeg,.gif,.webp,.svg"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg pl-2 pr-1 py-1 text-sm border border-gray-200 dark:border-gray-700"
              >
                {att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.name}
                    className="w-6 h-6 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="flex-shrink-0 text-gray-400">
                    {getFileIcon(att.type, att.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate max-w-[100px]">{att.name}</p>
                  <p className="text-[10px] text-gray-400">{formatFileSize(att.size)}</p>
                </div>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-2 focus-within:border-blue-500 dark:focus-within:border-blue-400 transition-colors">
          {/* File picker button */}
          <button
            onClick={() => inputRef.current?.click()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 flex-shrink-0 self-end mb-1"
            title={t('chatInput.attachFile')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chatInput.placeholder')}
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none py-1.5 max-h-[200px]"
          />

          {/* Voice input */}
          {voiceSupport && (
            <button
              onClick={() => {
                if (isListening) {
                  toggleListening()
                } else {
                  toggleListening()
                }
              }}
              className={`p-1.5 rounded-lg flex-shrink-0 self-end mb-1 transition-all ${
                isListening
                  ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
              title={isListening ? t('chatInput.stopDictation') : t('chatInput.voiceDictation')}
            >
              {isListening ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              )}
            </button>
          )}

          {/* Interim voice indicator */}
          {isListening && interimTranscript && (
            <div className="absolute bottom-full right-4 mb-2 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg shadow-lg max-w-[240px] truncate">
              {interimTranscript}
            </div>
          )}

          {/* Send / Stop button */}
          {isStreaming ? (
            <button
              onClick={onAbort}
              className="p-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors flex-shrink-0 self-end"
              title={t('chatInput.stop')}
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!hasInput || disabled}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white disabled:text-gray-500 dark:disabled:text-gray-400 transition-colors flex-shrink-0 self-end"
              title={t('chatInput.send')}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
