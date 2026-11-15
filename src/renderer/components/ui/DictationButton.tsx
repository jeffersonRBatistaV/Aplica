import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface DictationButtonProps {
  /** Recibe cada fragmento de texto dictado ya finalizado. */
  onText: (text: string) => void
  className?: string
}

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: any) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}

function getRecognitionCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Botón de micrófono para dictar en vez de escribir (útil en respuestas largas). */
export function DictationButton({ onText, className = '' }: DictationButtonProps) {
  const { t, i18n } = useTranslation()
  const [listening, setListening] = useState(false)
  const recRef = useRef<Recognition | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const Ctor = getRecognitionCtor()

  useEffect(() => () => recRef.current?.abort(), [])

  if (!Ctor) return null

  const toggle = () => {
    if (listening) {
      recRef.current?.stop()
      return
    }
    const rec = new Ctor()
    rec.lang = i18n.language?.startsWith('en') ? 'en-US' : 'es-ES'
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) onTextRef.current(String(r[0].transcript).trim())
      }
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? t('dictation.stop') : t('dictation.start')}
      aria-pressed={listening}
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors ${
        listening ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800'
      } ${className}`}
    >
      {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
      {listening ? t('dictation.listening') : t('dictation.start')}
    </button>
  )
}
