/**
 * profile-match.ts — ¿Esta vacante encaja con el perfil?
 *
 * El clasificador de áreas (vacancy-detection.ts) deja en 'General / Otra' lo que no
 * reconoce: motoristas, estilistas, niñeras, repartidores… En grupos de empleo generales
 * eso es la mayoría de los mensajes, así que esas vacantes solo deben entrar a la cola si
 * mencionan el puesto del perfil o habilidades técnicas suyas (no "trabajo en equipo",
 * Excel o idiomas, que aparecen en ofertas de cualquier área).
 */

import type { Profile } from './types'
import { classifyCategory, GENERAL_CATEGORY, isVacancyInArea, stripUrls, topCategories } from './vacancy-detection'

export type ProfileForMatch = Pick<Profile, 'area' | 'title' | 'skills'>

export interface ProfileMatcher {
  roles: RegExp[]
  /**
   * `distinctive`: nombre propio de herramienta/tecnología ("Shopify", "C#", "HTML5").
   * Una palabra común en minúsculas ("impresoras", "hosting") nunca basta por sí sola.
   */
  skills: { label: string; re: RegExp; distinctive: boolean }[]
}

export interface ProfileMatch {
  role: boolean
  skills: string[]
  /** Puesto = 2; habilidad distintiva en el título = 2; cualquier otra coincidencia = 1. */
  points: number
}

/** Puntos necesarios para aceptar una vacante de área desconocida. */
const MIN_AFFINITY_POINTS = 2

/** minúsculas, sin acentos, y "front-end"/"full-stack" → "frontend"/"fullstack". */
function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/([a-z])-(?=[a-z])/g, '$1')
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const L = '(?<![a-z0-9])'
const R = '(?![a-z0-9])'

// ── Puesto ──

const ROLE_STOPWORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'e', 'o', 'u', 'para', 'con', 'a',
  'of', 'and', 'the', 'for', 'sr', 'jr', 'senior', 'junior', 'semi', 'semisenior',
])
/** Respuestas del asistente que no son un puesto ("1-3 años", "Otro"). */
const NOT_A_ROLE = /(\d|\banos?\b|\byears?\b|\bexperiencia\b|^otr[oa]s?$|^other$)/
/** Entre palabras del puesto se admite un conector: "ejecutivo de ventas". */
const ROLE_JOINER = '(?:\\s+(?:de|del|la|el|en|y|para|of|and)\\s+|[\\s/]*)'

/** Variantes de género/número: "asistente administrativo" ↔ "administrativa", "contador" ↔ "contadora". */
function flex(word: string): string {
  const w = escapeRegExp(word)
  if (word.length >= 4 && /[oa]$/.test(word)) return `${w.slice(0, -1)}(?:o|a|os|as)`
  if (word.length >= 5 && /[a-z]$/.test(word) && !word.endsWith('s')) return `${w}(?:a|es|as|s)?`
  return w
}

function roleRegex(alternative: string): RegExp | null {
  const n = norm(alternative).trim()
  if (!n || NOT_A_ROLE.test(n)) return null
  const words = n.split(/[^a-z0-9#+.]+/).filter((w) => w && !ROLE_STOPWORDS.has(w))
  if (words.length === 0) return null
  // Una sola palabra corta solo vale como sigla: "QA", "SRE" (no "ui" suelto).
  if (words.length === 1 && words[0].length < 3 && !/^[A-Z0-9]{2,}$/.test(alternative.trim())) return null
  return new RegExp(`${L}${words.map(flex).join(ROLE_JOINER)}${R}`)
}

// ── Habilidades ──

/** Habilidades blandas o genéricas: aparecen en ofertas de cualquier área. */
const GENERIC_SKILLS = new Set([
  'trabajo en equipo', 'comunicacion', 'comunicacion efectiva', 'comunicacion asertiva', 'liderazgo',
  'responsabilidad', 'puntualidad', 'proactividad', 'proactivo', 'proactiva', 'organizacion',
  'adaptabilidad', 'creatividad', 'empatia', 'resolucion de problemas', 'pensamiento critico',
  'gestion del tiempo', 'orientacion al servicio', 'orientacion a resultados', 'atencion al detalle',
  'trabajo bajo presion', 'aprendizaje continuo', 'autodidacta', 'honestidad', 'disciplina',
  'analisis de informacion', 'procesos de negocio', 'toma de decisiones', 'negociacion',
  // Nombres de tecnologías que también son palabras comunes ("Expo Feria", "servicio express").
  'contenedores', 'expo', 'express', 'go', 'rust', 'ruby', 'swift', 'spring', 'next',
])
/** Ofimática: es una habilidad del área solo en perfiles administrativos o contables. */
const OFFICE_SKILL = /^((ms|microsoft)\s+)?(office|excel|word|powerpoint|outlook|access|teams|365)\b|^office\s*365|^google\s+(workspace|drive|docs|sheets)|^windows\b|^internet\b|^correo/
const LANGUAGE_SKILL = /^(ingles|espanol|frances|portugues|italiano|aleman|english|spanish|bilingue)\b/
const CV_PHRASE = /(experiencia|estudiante|egresad|licenciad|bachiller|titulad|\banos\b|\byears?\b)/

function splitSkill(raw: string): string[] {
  return raw
    .replace(/\([^)]*\)/g, ' ') // "SQL Server (avanzado)" → "SQL Server"
    .split(/\s*[/,;|]\s*/) // "Node.js / Express", "JavaScript/TypeScript"
    .map((s) => s.trim())
    .filter(Boolean)
}

function skillRegex(label: string, n: string): RegExp | null {
  if (n.length < 2 || /^\d+$/.test(n)) return null
  // Siglas de 2 letras solo en mayúsculas ("UX", "BI"); "C#" pasa por el símbolo.
  if (n.length === 2 && !/^[A-Z]{2}$/.test(label) && !/[#+]/.test(n)) return null
  const words = n.split(/\s+/).map(escapeRegExp)
  return new RegExp(`${L}${words.join('\\s+')}${R}`)
}

let cache: { key: string; matcher: ProfileMatcher } | null = null

/** Compila (y memoriza) los patrones de puesto y habilidades técnicas del perfil. */
export function buildProfileMatcher(profile: ProfileForMatch): ProfileMatcher {
  const key = JSON.stringify([profile.area, profile.title, profile.skills])
  if (cache?.key === key) return cache.matcher

  const roles = (profile.title || '')
    .split(/[/|,]/)
    .map((alt) => roleRegex(alt))
    .filter((re): re is RegExp => !!re)

  const officeIsArea = /^(admin|finanzas)$/.test(profile.area || '')
  const seen = new Set<string>()
  const skills: ProfileMatcher['skills'] = []
  for (const raw of profile.skills || []) {
    for (const label of splitSkill(raw)) {
      const n = norm(label).replace(/\s+/g, ' ')
      if (seen.has(n)) continue
      seen.add(n)
      if (GENERIC_SKILLS.has(n) || LANGUAGE_SKILL.test(n) || CV_PHRASE.test(n)) continue
      if (!officeIsArea && OFFICE_SKILL.test(n)) continue
      // "SEO" o "mantenimiento de equipos" son de otra área: no prueban afinidad con la tuya.
      const category = classifyCategory(label, label)
      if (category !== GENERAL_CATEGORY && !isVacancyInArea(category, profile.area, true)) continue
      const re = skillRegex(label, n)
      if (re) skills.push({ label, re, distinctive: /[A-Z0-9#+.]/.test(label) })
    }
  }

  const matcher = { roles, skills }
  cache = { key, matcher }
  return matcher
}

/** Coincidencias del puesto y las habilidades técnicas del perfil en una vacante. */
export function matchProfile(matcher: ProfileMatcher, title: string, text: string): ProfileMatch {
  const t = norm(stripUrls(title || ''))
  const body = norm(stripUrls(text || ''))
  const role = matcher.roles.some((re) => re.test(t) || re.test(body))
  let points = role ? 2 : 0
  const skills: string[] = []
  for (const s of matcher.skills) {
    if (s.re.test(t)) points += s.distinctive ? 2 : 1
    else if (s.re.test(body)) points += 1
    else continue
    skills.push(s.label)
  }
  return { role, skills, points }
}

/**
 * Decide si una vacante detectada entra a la cola del perfil:
 * - de tu área → sí; de otra área conocida → no;
 * - de área desconocida ('General / Otra') → con filtro estricto no; si no, solo si tu
 *   área empata en cabeza ("vendedor para tienda": Ventas = Administrativo) o si menciona
 *   tu puesto o habilidades técnicas tuyas.
 */
export function isVacancyForProfile(
  vacancy: { category?: string; title?: string; vacancyText?: string; snippet?: string },
  profile: ProfileForMatch | null | undefined,
  strict = false,
): boolean {
  if (!profile?.area) return true
  const category = vacancy.category
  if (category && category !== GENERAL_CATEGORY) return isVacancyInArea(category, profile.area, true)
  if (strict) return false
  const title = vacancy.title === 'Vacante detectada' ? '' : vacancy.title || ''
  const text = vacancy.vacancyText || vacancy.snippet || ''
  const tied = topCategories(text, title)
  if (tied.length > 1 && tied.some((c) => isVacancyInArea(c, profile.area, true))) return true
  const matcher = buildProfileMatcher(profile)
  // Perfil sin puesto ni habilidades útiles: no hay con qué comparar (comportamiento anterior).
  if (matcher.roles.length === 0 && matcher.skills.length === 0) return true
  return matchProfile(matcher, title, text).points >= MIN_AFFINITY_POINTS
}
