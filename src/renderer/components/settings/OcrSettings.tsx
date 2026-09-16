import { ScanLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { OcrConfig, OcrMethod } from '../../../shared/types'

interface OcrSettingsProps {
  method: OcrMethod
  onChange: (ocr: OcrConfig) => void
}

export function OcrSettings({ method, onChange }: OcrSettingsProps) {
  const { t } = useTranslation()
  const options = [
    { id: 'auto', label: t('ocr.auto'), description: t('ocr.autoDesc') },
    { id: 'tesseract', label: t('ocr.tesseract'), description: t('ocr.tesseractDesc') },
    { id: 'vision', label: t('ocr.vision'), description: t('ocr.visionDesc') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('ocr.method')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('ocr.methodDesc')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange({ method: option.id as OcrMethod })}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              method === option.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-2">
              <ScanLine className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{option.label}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{option.description}</p>
          </button>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
        <ScanLine className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">{t('ocr.info')}</p>
      </div>
    </div>
  )
}