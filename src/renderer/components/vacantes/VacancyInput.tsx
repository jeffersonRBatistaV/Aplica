import { useState, useRef, useCallback, useEffect } from 'react'
import { Upload, FileText, Loader2, Scan } from 'lucide-react'
import { Button } from '../ui/Button'
import { isImageType } from '../../types/attachments'
import { useTranslation } from 'react-i18next'

interface VacancyInputProps {
  onAnalyze: (text: string) => void
  analyzing: boolean
  initialText?: string
}

export function VacancyInput({ onAnalyze, analyzing, initialText }: VacancyInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(initialText || '')
  const [dragOver, setDragOver] = useState(false)
  const [ocrProcessing, setOcrProcessing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)

  useEffect(() => {
    setText(initialText || '')
  }, [initialText])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setOcrError(null)
    if (isImageType(file.type)) {
      setOcrProcessing(true)
      try {
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        const result = await window.api?.imageToText(base64)
        if (result) {
          setText(result)
        } else {
          setOcrError(t('vacantes.extractingText'))
        }
      } catch (err) {
        setOcrError(err instanceof Error ? err.message : t('vacantes.errorUnknown'))
      } finally {
        setOcrProcessing(false)
      }
    } else {
      const text = await file.text()
      setText(text)
    }
  }, [])

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    setOcrError(null)
    const items = e.clipboardData.items
    for (const item of Array.from(items)) {
      if (item.type === 'text/plain') {
        item.getAsString((str) => {
          if (str.length > 200) {
            setText(str)
          }
        })
      } else if (item.kind === 'file' && isImageType(item.type)) {
        const file = item.getAsFile()
        if (file) {
          setOcrProcessing(true)
          handleFile(file).finally(() => setOcrProcessing(false))
        }
        return
      }
    }

    // fallback: read image from native clipboard
    if (!window.api) return
    const dataUrl = await window.api.readClipboardImage()
    if (!dataUrl) return
    setOcrProcessing(true)
    try {
      const result = await window.api.imageToText?.(dataUrl)
      if (result) {
        setText(result)
      } else {
        setOcrError('No se pudo extraer texto de la imagen')
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : 'Error al procesar la imagen')
    } finally {
      setOcrProcessing(false)
    }
  }, [handleFile])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) {
        if (isImageType(file.type)) {
          setOcrProcessing(true)
          handleFile(file).finally(() => setOcrProcessing(false))
        } else {
          handleFile(file)
        }
      }
    },
    [handleFile],
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await handleFile(file)
        e.target.value = ''
      }
    },
    [handleFile],
  )

  return (
    <div
      className={`rounded-xl border-2 transition-colors ${
        dragOver
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-200 dark:border-gray-700'
      }`}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('vacantes.vacancy')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".txt,.md,.png,.jpg,.jpeg,.bmp,.webp"
              onChange={handleFileSelect}
              className="hidden"
              id="vacancy-file-input"
            />
            <label
              htmlFor="vacancy-file-input"
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              {t('vacantes.uploadFile')}
            </label>
          </div>
        </div>

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            placeholder={t('vacantes.vacancyPlaceholder')}
            rows={8}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y min-h-[180px] font-mono"
          />
          {ocrProcessing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 rounded-lg z-10">
              <Scan className="w-8 h-8 text-blue-500 animate-pulse mb-2" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{t('vacantes.extractingText')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-xs">
            {ocrProcessing ? (
              <>
                <Scan className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                <span className="text-blue-500">{t('vacantes.extractingText')}</span>
              </>
            ) : ocrError ? (
              <span className="text-red-500">{ocrError}</span>
            ) : dragOver ? (
              <>
                <Upload className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-blue-500">{t('vacantes.dropFileHere')}</span>
              </>
            ) : (
              <span className="text-gray-400">{t('vacantes.dragOrPaste')}</span>
            )}
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => onAnalyze(text)}
            disabled={!text.trim() || analyzing || ocrProcessing}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('vacantes.processing')}
              </>
            ) : (
              t('vacantes.analyze')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
