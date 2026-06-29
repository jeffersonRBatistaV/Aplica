import { useState, useEffect, useRef } from 'react'
import { Copy, Check } from 'lucide-react'
import type { HLJSApi } from 'highlight.js'

interface CodeBlockProps {
  code: string
  language?: string
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [hljs, setHljs] = useState<HLJSApi | null>(null)
  const highlightedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    import('highlight.js').then((mod) => setHljs(mod.default))
  }, [])

  const detectedLang =
    language ||
    hljs?.highlightAuto(code).language ||
    'text'

  const highlighted =
    hljs
      ? hljs.highlight(code, { language: detectedLang, ignoreIllegals: true }).value
      : escapeHtml(code)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      if (window.api) {
        await window.api.copyToClipboard(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    }
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-gray-700 bg-gray-900 dark:bg-gray-950">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
        <span className="text-xs font-mono text-gray-400 uppercase">
          {detectedLang}
        </span>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
          title="Copiar código"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="overflow-x-auto" ref={highlightedRef}>
        <pre className="p-4 text-sm leading-relaxed">
          <code
            className={`language-${detectedLang}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      </div>
    </div>
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
