import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'
import { useTranslation } from 'react-i18next'

interface SystemPromptsProps {
  systemPrompt: string
  onChange: (prompt: string) => void
}

export function SystemPrompts({ systemPrompt, onChange }: SystemPromptsProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(systemPrompt)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onChange(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const defaultPrompt = t('systemPrompts.defaultPrompt')
  const handleReset = () => {
    setValue(defaultPrompt)
    onChange(defaultPrompt)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('systemPrompts.title')}
        </label>
        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
          title={t('systemPrompts.resetTitle')}
        >
          <RotateCcw className="w-3 h-3" />
          {t('systemPrompts.reset')}
        </button>
      </div>

      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setSaved(false)
        }}
        rows={8}
        className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 font-mono placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y min-h-[160px]"
        placeholder={t('systemPrompts.placeholder')}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {t('systemPrompts.description')}
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!value.trim() || saved}
        >
          {saved ? t('systemPrompts.saved') : t('systemPrompts.save')}
        </Button>
      </div>
    </div>
  )
}
