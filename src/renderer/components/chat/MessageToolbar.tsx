import { Copy, RefreshCw, Check } from 'lucide-react'
import { useState } from 'react'

interface MessageToolbarProps {
  onCopy: () => void
  onRegenerate: () => void
}

export function MessageToolbar({
  onCopy,
  onRegenerate,
}: MessageToolbarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-200 dark:border-gray-700/50 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="Copiar mensaje"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
      </button>

      <div className="flex-1" />

      <button
        onClick={onRegenerate}
        className="p-1.5 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        title="Regenerar respuesta"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
