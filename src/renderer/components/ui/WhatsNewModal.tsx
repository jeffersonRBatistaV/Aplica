import { Sparkles, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const CHANGELOG: Record<string, { title: string; items: string[] }> = {
  '1.0.2': {
    title: 'Aplica 1.0.2',
    items: [
      'Vision real en OCR: elige un modelo con vision para extraer texto de imagenes',
      'Recordatorios de entrevistas: agenda fecha/hora y la app te notifica',
      'Estadisticas de busqueda: embudo de conversion, tendencia mensual y tiempo a entrevista',
      'Comparador salarial: consulta cuanto gana tu rol con investigacion automatica',
      'Modo sin conexion: indicador de conexion y errores claros',
      'Multiples perfiles: cambia entre perfiles profesionales A/B',
      'Historial de versiones de CV: recupera versiones anteriores',
      'Privacidad: excluye tus datos del entrenamiento en todas las funciones',
      'Seguridad: Electron actualizado y validacion de handlers',
    ],
  },
  '1.0.1': {
    title: 'Aplica 1.0.1',
    items: [
      'Chat con tus datos: pregunta cuantas vacantes has aplicado y responde con datos reales',
      'Markdown en preparacion de entrevistas: respuestas formateadas',
    ],
  },
}

interface WhatsNewModalProps {
  open: boolean
  version: string
  onClose: () => void
}

export function WhatsNewModal({ open, version, onClose }: WhatsNewModalProps) {
  const { t } = useTranslation()
  if (!open) return null

  const entry = CHANGELOG[version]
  const title = entry?.title ?? `Aplica ${version}`
  const items = entry?.items ?? [
    `Actualizacion de Aplica ${version}`,
    'Correcciones y mejoras de rendimiento',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
            <Sparkles className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {t('whatsNew.title')}
            </h3>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2.5 max-h-[50vh] overflow-y-auto">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            {t('whatsNew.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
