import { readJSON } from './storage'
import { SETTINGS_FILE } from '../utils/paths'
import { addUsage, calculateCost } from './usage-service'
import { postCompletion } from './reasoning'
import type {
  AppSettings,
  BrowserAgentEvent,
  BrowserCvOption,
  BrowserPageSnapshot,
  Profile,
} from '../../shared/types'
import { buildProfileValues, getDomain, planAutofill } from '../../shared/autofill'
import { getActiveProfile } from './profile-scope'
import {
  attachCv,
  clickElement,
  fillFields,
  getBrowserState,
  inspectPage,
  listCvs,
  navigate,
} from './browser-service'

const MAX_STEPS = 14
const TOOL_RESULT_LIMIT = 6000

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_page',
      description:
        'Devuelve la URL, el texto visible, los campos del formulario (con id, etiqueta, valor actual y valor sugerido desde el perfil) y los botones/enlaces de la página. Úsala al empezar y después de cada acción importante.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fill_from_profile',
      description:
        'Rellena automáticamente con los datos del perfil los campos que se detecten (nombre, email, teléfono, ubicación, empresa, experiencia, educación, skills, idiomas, etc.). No rellena contraseñas, pagos ni campos ambiguos.',
      parameters: {
        type: 'object',
        properties: {
          overwrite: {
            type: 'boolean',
            description: 'Si es true, sobrescribe campos que ya tengan contenido. Por defecto false.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'fill_fields',
      description:
        'Rellena campos concretos usando su id de campo (por ejemplo "f0-3"). Úsala solo para valores que no vengan del perfil o para corregir uno.',
      parameters: {
        type: 'object',
        properties: {
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field_id: { type: 'string', description: 'Id del campo devuelto por get_page.' },
                value: { type: 'string', description: 'Valor a escribir.' },
              },
              required: ['field_id', 'value'],
            },
          },
        },
        required: ['fields'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'click',
      description:
        'Hace clic en un botón o enlace. Indica el id del botón devuelto por get_page o su texto visible. Para "Enviar postulación" se pedirá confirmación si está activada.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Id del botón (por ejemplo "b0-1").' },
          text: { type: 'string', description: 'Texto visible del botón o enlace.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate',
      description: 'Navega la pestaña del navegador a una URL http/https.',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'attach_cv',
      description:
        'Adjunta un CV en PDF al campo de archivo del formulario. Si no se indica field_id, usa el primer campo de archivo. Si no se indica cv_id, usa el CV seleccionado por el usuario o el más reciente.',
      parameters: {
        type: 'object',
        properties: {
          field_id: { type: 'string' },
          cv_id: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_cvs',
      description: 'Lista los CV disponibles (desde el perfil, por vacante y versiones anteriores).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wait',
      description: 'Espera un momento a que la página cargue o actualice su contenido (máximo 5 segundos).',
      parameters: {
        type: 'object',
        properties: { ms: { type: 'number' } },
        required: ['ms'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'finish',
      description:
        'Termina la tarea. Resume lo hecho y enumera lo que queda pendiente para el usuario (por ejemplo, revisar o pulsar Enviar postulación).',
      parameters: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          pending: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary'],
      },
    },
  },
]

interface AgentToolCall {
  id: string
  type?: string
  function?: { name?: string; arguments?: string }
}

interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AgentToolCall[]
  tool_call_id?: string
}

interface LlmResponse {
  choices?: {
    message?: {
      role?: string
      content?: string | null
      tool_calls?: AgentToolCall[]
    }
  }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

function compactSnapshot(snapshot: BrowserPageSnapshot): string {
  const fields = snapshot.fields.slice(0, 90).map((field) => ({
    id: field.id,
    label: field.label || field.placeholder || field.name,
    type: field.type,
    required: field.required,
    visible: field.visible,
    value: field.value.slice(0, 80),
    suggested: field.suggestedValue ? field.suggestedValue.slice(0, 80) : undefined,
    options: field.options.slice(0, 20).map((option) => option.label || option.value),
  }))
  const buttons = snapshot.buttons
    .filter((button) => button.visible)
    .slice(0, 32)
    .map((button) => ({ id: button.id, text: button.text, type: button.type }))
  return JSON.stringify({
    url: snapshot.url,
    title: snapshot.title,
    text: snapshot.text.slice(0, 5000),
    fields,
    buttons,
  })
}

function truncate(value: string): string {
  return value.length > TOOL_RESULT_LIMIT ? `${value.slice(0, TOOL_RESULT_LIMIT)}…` : value
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const SUBMIT_TEXT =
  /(enviar|envia|postular|postulaci[oó]n|aplicar|aplicaci[oó]n|solicitud|candidatura|apply|submit|send application)/i
const JOB_TEXT = /(postul|solicitud|candidatura|aplicaci[oó]n|vacante|empleo|job|position|puesto|application|apply)/i
const NON_SUBMIT_TEXT = /(filtro|filter|buscar|search|guardar|save|continuar|continue|siguiente|next|volver|back)/i

function looksLikeSubmit(text: string): boolean {
  if (!text || NON_SUBMIT_TEXT.test(text)) return false
  return SUBMIT_TEXT.test(text)
}

function userAskedToSubmit(prompt: string): boolean {
  if (/\b(no|sin|nunca|never|don'?t|do not|without)\b[^.]{0,24}\b(envi|postul|aplic|submit|apply|send)/i.test(prompt)) {
    return false
  }
  return /(env[ií]a|enviar|postula|postular|aplica|aplicar|submit|apply|send)/i.test(prompt) && JOB_TEXT.test(prompt)
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}

function buildSystemPrompt(profile: Profile | null, cvs: BrowserCvOption[], confirmBeforeSubmit: boolean): string {
  const data = buildProfileValues(profile)
  const profileValues = Object.fromEntries(
    Object.entries(data.values).filter(([, value]) => String(value || '').trim().length > 0),
  )
  return [
    'Eres un asistente que controla la pestaña del navegador integrado de Aplica (una app de búsqueda de empleo).',
    'Tu objetivo es rellenar formularios de postulación con los datos reales del perfil del usuario, adjuntar su CV cuando se pida y avanzar en la página.',
    'Reglas obligatorias:',
    '- Sigue en todo momento el PROMPT DEL USUARIO (sus instrucciones guardadas): define qué hacer, el tono de las respuestas abiertas y qué evitar. Solo lo ignoras si contradice estas reglas de seguridad.',
    '- Usa herramientas; no inventes que has hecho algo que no ejecutaste.',
    '- Rellena solo datos veraces del perfil. Nunca rellenes contraseñas, datos de pago, números de seguridad social ni declaraciones legales ambiguas.',
    '- No pulses "Enviar postulación", "Apply", "Submit" ni equivalentes si la confirmación está activada, salvo que el usuario lo haya pedido explícitamente.',
    '- Si un campo obligatorio no tiene dato en el perfil, déjalo y anótalo como pendiente.',
    '- Para adjuntar el CV usa attach_cv (PDF generado por la app).',
    '- Antes de terminar, llama a finish con un resumen breve en el idioma del usuario y la lista de pendientes.',
    `Confirmación antes de enviar postulación: ${confirmBeforeSubmit ? 'ACTIVADA (detente antes de enviar)' : 'desactivada'}.`,
    `Datos del perfil (JSON): ${JSON.stringify(profileValues).slice(0, 3500)}`,
    `CV disponibles: ${cvs.map((cv) => `${cv.id} = ${cv.label}`).join(' | ') || 'ninguno'}`,
  ].join('\n')
}

async function callLlm(
  messages: AgentMessage[],
  settings: AppSettings | null,
  signal: AbortSignal,
): Promise<{ message: AgentMessage; usage?: LlmResponse['usage'] }> {
  const baseUrl = (settings?.api?.baseUrl || 'http://localhost:11434/v1').replace(/\/+$/, '')
  const apiKey = settings?.api?.apiKey || ''
  const model = settings?.api?.model || 'llama3'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`

  const response = await postCompletion(`${baseUrl}/chat/completions`, headers, {
    model,
    messages,
    tools: TOOLS,
    tool_choice: 'auto',
    stream: false,
    temperature: 0.2,
  }, signal)
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`API ${response.status}: ${errorText}`)
  }
  const payload = (await response.json()) as LlmResponse
  const message = payload.choices?.[0]?.message
  return {
    message: {
      role: 'assistant',
      content: message?.content ?? '',
      tool_calls: Array.isArray(message?.tool_calls) ? message.tool_calls : undefined,
    },
    usage: payload.usage,
  }
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as Record<string, unknown>
  try {
    const parsed = JSON.parse(String(raw))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export interface BrowserAgentParams {
  webContentsId: number
  prompt: string
}

export async function runBrowserAgent(
  params: BrowserAgentParams,
  emit: (event: BrowserAgentEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const settings = await readJSON<AppSettings>(SETTINGS_FILE)
  const profile = await getActiveProfile()
  const state = await getBrowserState()
  const confirmBeforeSubmit = state.confirmBeforeSubmit !== false
  const cvs = await listCvs().catch(() => [])

  const prompt = String(params.prompt || state.agentPrompt || '').slice(0, 4000)
  let snapshot = await inspectPage(params.webContentsId)
  const messages: AgentMessage[] = [
    { role: 'system', content: buildSystemPrompt(profile, cvs, confirmBeforeSubmit) },
    {
      role: 'user',
      content: [
        `PROMPT DEL USUARIO (síguelo durante toda la tarea):
${prompt}`,
        `Página actual: ${snapshot.url}`,
        compactSnapshot(snapshot),
      ].join('\n\n'),
    },
  ]

  const emitTool = (step: number, name: string, result: string, ok: boolean, eventMessage?: string) => {
    emit({ type: 'tool', step, name, result: result.slice(0, 600), ok })
    if (eventMessage) emit({ type: 'step', step, message: eventMessage })
  }

  const refresh = async () => {
    snapshot = await inspectPage(params.webContentsId)
    return snapshot
  }

  try {
    emit({ type: 'status', status: 'running', message: 'El asistente está trabajando…' })

    for (let step = 1; step <= MAX_STEPS; step++) {
      if (signal.aborted) throw new Error('aborted')
      emit({ type: 'step', step, message: 'Pensando el siguiente paso…' })

      const { message, usage } = await callLlm(messages, settings, signal)

      if (usage) {
        const promptTokens = usage.prompt_tokens ?? 0
        const completionTokens = usage.completion_tokens ?? 0
        await addUsage({
          action: 'browser-agent',
          promptTokens,
          completionTokens,
          model: settings?.api?.model || 'llama3',
          estimatedCost: calculateCost(settings?.api?.model || 'llama3', promptTokens, completionTokens),
          timestamp: Date.now(),
        }).catch(() => undefined)
      }

      messages.push(message)

      const calls = (message.tool_calls || []).filter((call) => call.function?.name)
      if (calls.length === 0) {
        emit({ type: 'done', summary: message.content || 'Tarea finalizada.', pending: [] })
        return
      }

      for (const call of calls) {
        const name = call.function?.name || ''
        if (signal.aborted) throw new Error('aborted')
        const args = parseArgs(call.function?.arguments)
        let toolResult = ''
        let ok = true

        if (name === 'get_page') {
          const current = await refresh()
          toolResult = compactSnapshot(current)
          emitTool(step, name, `Página actualizada (${current.url}).`, true, 'Revisando la página…')
        } else if (name === 'fill_from_profile') {
          const data = buildProfileValues(profile)
          const domain = getDomain(snapshot.url)
          const plan = planAutofill(snapshot.fields, data, state.fieldOverrides[domain] || {}, {
            overwriteExisting: args.overwrite === true,
          })
          if (plan.entries.length === 0) {
            ok = false
            toolResult = 'No hay campos rellenables con datos del perfil.'
          } else {
            const result = await fillFields(params.webContentsId, plan.entries)
            ok = result.filled > 0
            toolResult = `Rellenados ${result.filled} campos. Omitidos ${result.skipped}.`
            await refresh()
          }
          emitTool(step, name, toolResult, ok, 'Rellenando con los datos del perfil…')
        } else if (name === 'fill_fields') {
          const rawFields = Array.isArray(args.fields) ? args.fields : []
          const entries = rawFields
            .map((item) => item as Record<string, unknown>)
            .filter(
              (item) =>
                typeof item.field_id === 'string' &&
                item.value !== undefined &&
                item.value !== null &&
                ['string', 'number', 'boolean'].includes(typeof item.value),
            )
            .map((item) => ({ id: String(item.field_id), value: String(item.value) }))
          if (entries.length === 0) {
            ok = false
            toolResult = 'No se recibieron campos válidos.'
          } else {
            const result = await fillFields(params.webContentsId, entries)
            ok = result.filled > 0
            toolResult = `Rellenados ${result.filled} de ${entries.length} campos.`
            await refresh()
          }
          emitTool(step, name, toolResult, ok, 'Rellenando campos…')
        } else if (name === 'click') {
          const id = typeof args.id === 'string' ? args.id : ''
          const text = typeof args.text === 'string' ? args.text : ''
          const known = snapshot.buttons.find((button) => button.id === id)
          if (id && !known && !text) {
            ok = false
            toolResult = 'El botón ya no existe en la página. Usa get_page para actualizar los identificadores.'
          } else {
            const buttonText = text || known?.text || ''
            const submitLike = buttonText ? looksLikeSubmit(buttonText) : false
            if (submitLike && confirmBeforeSubmit && !userAskedToSubmit(prompt)) {
              emit({
                type: 'done',
                summary: 'He completado el formulario hasta el botón de envío. No he enviado la postulación porque la confirmación está activada.',
                pending: [`Revisar el formulario y pulsar "${buttonText}" si todo está correcto.`],
              })
              return
            }
            const result = await clickElement(params.webContentsId, id ? { id } : { text })
            ok = result.ok
            toolResult = result.ok ? `Clic realizado en "${buttonText || id || text}".` : result.message || 'No se pudo hacer clic.'
            await sleep(1200)
            await refresh()
          }
          emitTool(step, name, toolResult, ok, 'Avanzando en la página…')
        } else if (name === 'navigate') {
          const url = typeof args.url === 'string' ? args.url : ''
          try {
            const targetHost = safeHostname(url)
            const currentHost = safeHostname(snapshot.url)
            const hostAllowed =
              !targetHost ||
              !currentHost ||
              targetHost === currentHost ||
              currentHost.endsWith(`.${targetHost}`) ||
              targetHost.endsWith(`.${currentHost}`) ||
              prompt.toLowerCase().includes(targetHost)
            if (!hostAllowed) {
              throw new Error('Por seguridad, no abro otro dominio salvo que lo indiques en la instrucción.')
            }
            await navigate(params.webContentsId, url)
            ok = true
            toolResult = `Navegado a ${url}.`
          } catch (error) {
            ok = false
            toolResult = error instanceof Error ? error.message : String(error)
          }
          await sleep(600)
          await refresh()
          emitTool(step, name, toolResult, ok, 'Abriendo la página…')
        } else if (name === 'attach_cv') {
          const cvId = typeof args.cv_id === 'string' ? args.cv_id : state.selectedCvId || undefined
          const fieldId =
            typeof args.field_id === 'string'
              ? args.field_id
              : snapshot.fields.find((field) => field.type === 'file')?.id
          if (!fieldId) {
            ok = false
            toolResult = 'No hay un campo de archivo para adjuntar el CV.'
          } else {
            const result = await attachCv(params.webContentsId, fieldId, cvId)
            ok = result.ok
            toolResult = result.ok ? `CV adjuntado: ${result.label}.` : result.message || 'No se pudo adjuntar el CV.'
            await refresh()
          }
          emitTool(step, name, toolResult, ok, 'Adjuntando el CV…')
        } else if (name === 'list_cvs') {
          const options = await listCvs()
          toolResult = options.map((cv) => `${cv.id} = ${cv.label}`).join('\n') || 'No hay CV disponibles.'
          emitTool(step, name, toolResult, true)
        } else if (name === 'wait') {
          const ms = Math.min(Math.max(Number(args.ms) || 800, 200), 5000)
          await sleep(ms)
          await refresh()
          toolResult = `Esperados ${ms} ms.`
          emitTool(step, name, toolResult, true)
        } else if (name === 'finish') {
          const summary = typeof args.summary === 'string' ? args.summary : 'Tarea finalizada.'
          const pending = Array.isArray(args.pending)
            ? args.pending.filter((item): item is string => typeof item === 'string')
            : []
          emit({ type: 'done', summary, pending })
          return
        } else {
          ok = false
          toolResult = `Herramienta desconocida: ${name}`
          emitTool(step, name, toolResult, ok)
        }

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: truncate(toolResult),
        })
      }
    }

    emit({
      type: 'done',
      summary: 'Se alcanzó el límite de pasos del asistente. Revisa el formulario y continúa manualmente si hace falta.',
      pending: ['Revisar la página y completar lo que falte.'],
    })
  } catch (error) {
    if (signal.aborted || (error instanceof Error && error.message === 'aborted')) {
      emit({ type: 'status', status: 'idle', message: 'Asistente detenido.' })
      return
    }
    emit({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
