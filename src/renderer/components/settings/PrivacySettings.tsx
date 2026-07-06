import { Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PrivacySettingsProps {
  storeHistory: boolean
  excludeFromTraining: boolean
  onChange: (privacy: { storeHistory: boolean; excludeFromTraining: boolean }) => void
}

export function PrivacySettings({
  storeHistory,
  excludeFromTraining,
  onChange,
}: PrivacySettingsProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('privacy.storeHistory')}
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('privacy.storeHistoryDesc')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={storeHistory}
            onChange={(e) =>
              onChange({ storeHistory: e.target.checked, excludeFromTraining })
            }
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full peer bg-gray-300 dark:bg-gray-700 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500/40 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('privacy.excludeTraining')}
          </label>
          <p className="text-xs text-gray-400 mt-0.5">
            {t('privacy.excludeTrainingDesc')}
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={excludeFromTraining}
            onChange={(e) =>
              onChange({ storeHistory, excludeFromTraining: e.target.checked })
            }
            className="sr-only peer"
          />
          <div className="w-9 h-5 rounded-full peer bg-gray-300 dark:bg-gray-700 peer-checked:bg-blue-600 peer-focus:ring-2 peer-focus:ring-blue-500/40 after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
        </label>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
        <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          {t('privacy.localStorageInfo')}
        </p>
      </div>
    </div>
  )
}
