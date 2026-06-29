import { useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '../ui/Button'

const DEFAULT_SYSTEM_PROMPT = `Eres un profesional con experiencia en tecnología. Responde SIEMPRE en PRIMERA PERSONA (Yo / Mi / Me). Habla de tu experiencia, proyectos y habilidades usando la información de tu perfil profesional. Sé conversacional, natural y conciso. Nunca repitas la misma frase. Si no sabes algo, dilo una vez.

Idioma: español (a menos que te hablen en otro idioma).`

interface SystemPromptsProps {
  systemPrompt: string
  onChange: (prompt: string) => void
}

export function SystemPrompts({ systemPrompt, onChange }: SystemPromptsProps) {
  const [value, setValue] = useState(systemPrompt)
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    onChange(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setValue(DEFAULT_SYSTEM_PROMPT)
    onChange(DEFAULT_SYSTEM_PROMPT)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Instrucciones personalizadas del sistema
        </label>
        <button
          onClick={handleReset}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
          title="Restaurar prompt por defecto"
        >
          <RotateCcw className="w-3 h-3" />
          Restaurar
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
        placeholder="Escribe las instrucciones del sistema..."
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Este prompt se inyecta al inicio de cada conversación como mensaje del sistema.
        </p>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={!value.trim() || saved}
        >
          {saved ? 'Guardado ✓' : 'Guardar'}
        </Button>
      </div>
    </div>
  )
}
