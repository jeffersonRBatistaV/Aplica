import type {
  BrowserAutofillKey,
  BrowserFormField,
  BrowserMapping,
  BrowserState,
  Profile,
} from './types'

export const AUTOFILL_KEYS: BrowserAutofillKey[] = [
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'location',
  'city',
  'country',
  'linkedin',
  'github',
  'portfolio',
  'title',
  'company',
  'yearsExperience',
  'summary',
  'skills',
  'languages',
  'educationInstitution',
  'educationDegree',
  'educationField',
]

export const AUTOFILL_KEY_LABELS: Record<BrowserAutofillKey, { es: string; en: string }> = {
  fullName: { es: 'Nombre completo', en: 'Full name' },
  firstName: { es: 'Nombre', en: 'First name' },
  lastName: { es: 'Apellido', en: 'Last name' },
  email: { es: 'Correo', en: 'Email' },
  phone: { es: 'Teléfono', en: 'Phone' },
  location: { es: 'Ubicación', en: 'Location' },
  city: { es: 'Ciudad', en: 'City' },
  country: { es: 'País', en: 'Country' },
  linkedin: { es: 'LinkedIn', en: 'LinkedIn' },
  github: { es: 'GitHub', en: 'GitHub' },
  portfolio: { es: 'Portafolio / web', en: 'Portfolio / website' },
  title: { es: 'Puesto / rol', en: 'Title / role' },
  company: { es: 'Empresa actual', en: 'Current company' },
  yearsExperience: { es: 'Años de experiencia', en: 'Years of experience' },
  summary: { es: 'Resumen / presentación', en: 'Summary / about' },
  skills: { es: 'Habilidades', en: 'Skills' },
  languages: { es: 'Idiomas', en: 'Languages' },
  educationInstitution: { es: 'Institución educativa', en: 'School / university' },
  educationDegree: { es: 'Título / grado', en: 'Degree' },
  educationField: { es: 'Área de estudio', en: 'Field of study' },
}

export interface ProfileAutofillData {
  values: Partial<Record<BrowserAutofillKey, string>>
  countryAliases: string[]
}

export function createDefaultBrowserState(): BrowserState {
  return {
    lastUrl: '',
    history: [],
    fieldOverrides: {},
    zoom: 1,
    selectedCvId: null,
    confirmBeforeSubmit: true,
    overwriteExisting: false,
    agentPrompt: '',
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function normalizeBrowserState(raw: unknown): BrowserState {
  const base = createDefaultBrowserState()
  if (!isRecord(raw)) return base

  const history = Array.isArray(raw.history)
    ? raw.history
        .filter((h): h is Record<string, unknown> => isRecord(h) && typeof h.url === 'string' && isHttpUrl(h.url))
        .map((h) => ({
          url: String(h.url),
          title: typeof h.title === 'string' ? h.title : '',
          visitedAt: typeof h.visitedAt === 'number' ? h.visitedAt : Date.now(),
        }))
        .slice(0, 200)
    : []

  const fieldOverrides: Record<string, Record<string, BrowserMapping>> = {}
  if (isRecord(raw.fieldOverrides)) {
    for (const [domain, mappings] of Object.entries(raw.fieldOverrides)) {
      if (!isRecord(mappings)) continue
      const clean: Record<string, BrowserMapping> = {}
      for (const [signature, mapping] of Object.entries(mappings)) {
        if (!isRecord(mapping) || typeof mapping.key !== 'string') continue
        if (mapping.key === 'custom') {
          clean[signature] = { key: 'custom', custom: typeof mapping.custom === 'string' ? mapping.custom : '' }
        } else if (mapping.key === 'skip') {
          clean[signature] = { key: 'skip' }
        } else if ((AUTOFILL_KEYS as string[]).includes(mapping.key)) {
          clean[signature] = { key: mapping.key as BrowserAutofillKey }
        }
      }
      fieldOverrides[domain] = clean
    }
  }

  const lastUrl =
    typeof raw.lastUrl === 'string' && (raw.lastUrl === 'about:blank' || isHttpUrl(raw.lastUrl))
      ? raw.lastUrl
      : base.lastUrl

  return {
    lastUrl,
    history,
    fieldOverrides,
    zoom: typeof raw.zoom === 'number' && raw.zoom >= 0.5 && raw.zoom <= 2 ? raw.zoom : base.zoom,
    selectedCvId: typeof raw.selectedCvId === 'string' ? raw.selectedCvId : null,
    confirmBeforeSubmit: typeof raw.confirmBeforeSubmit === 'boolean' ? raw.confirmBeforeSubmit : base.confirmBeforeSubmit,
    overwriteExisting: typeof raw.overwriteExisting === 'boolean' ? raw.overwriteExisting : base.overwriteExisting,
    agentPrompt: typeof raw.agentPrompt === 'string' ? raw.agentPrompt.slice(0, 4000) : base.agentPrompt,
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

function normalizeText(value: string | undefined | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function parseYear(value: string | undefined | null): number | null {
  if (!value) return null
  const match = String(value).match(/(19|20)\d{2}/)
  return match ? Number(match[0]) : null
}

function countryNames(code: string): string[] {
  if (!code) return []
  const upper = code.trim().toUpperCase()
  const names = new Set<string>([upper])
  for (const locale of ['es', 'en']) {
    try {
      const display = new Intl.DisplayNames([locale], { type: 'region' }).of(upper)
      if (display) names.add(display)
    } catch {
      // Intl.DisplayNames no disponible: se usa solo el codigo.
    }
  }
  return Array.from(names)
}

export function buildProfileValues(profile: Profile | null | undefined): ProfileAutofillData {
  if (!profile) return { values: {}, countryAliases: [] }

  const { firstName, lastName } = splitName(profile.name || '')
  const experiences = [...(profile.experience || [])].sort((a, b) => {
    const ay = parseYear(a.startDate) || 0
    const by = parseYear(b.startDate) || 0
    return by - ay
  })
  const current = experiences.find((e) => e.company || e.position) || null

  const startYears = experiences
    .map((e) => parseYear(e.startDate))
    .filter((y): y is number => y !== null)
  const yearsExperience = startYears.length
    ? Math.max(0, new Date().getFullYear() - Math.min(...startYears))
    : null

  const education = [...(profile.education || [])].sort((a, b) => {
    const ay = parseYear(a.endDate) || parseYear(a.startDate) || 0
    const by = parseYear(b.endDate) || parseYear(b.startDate) || 0
    return by - ay
  })
  const latestEducation = education.find((e) => e.institution || e.degree || e.field) || null

  const city = (profile.location || '').split(',')[0]?.trim() || ''
  const country = profile.country ? countryNames(profile.country)[1] || profile.country : ''

  const values: Partial<Record<BrowserAutofillKey, string>> = {
    fullName: profile.name || '',
    firstName,
    lastName,
    email: profile.email || '',
    phone: profile.phone || '',
    location: profile.location || '',
    city,
    country,
    linkedin: profile.linkedin || '',
    github: profile.github || '',
    portfolio: profile.portfolio || '',
    title: profile.title || '',
    company: current?.company || '',
    yearsExperience: yearsExperience === null ? '' : String(yearsExperience),
    summary: profile.summary || '',
    skills: (profile.skills || []).join(', '),
    languages: (profile.languages || []).join(', '),
    educationInstitution: latestEducation?.institution || '',
    educationDegree: latestEducation?.degree || '',
    educationField: latestEducation?.field || '',
  }

  return {
    values,
    countryAliases: countryNames(profile.country || ''),
  }
}

interface Rule {
  key: BrowserAutofillKey
  patterns: RegExp[]
}

const RULES: Rule[] = [
  { key: 'email', patterns: [/\be ?mail\b/, /\bcorreo\b/, /email address/] },
  { key: 'phone', patterns: [/\bphone\b/, /telefono/, /\bmobile\b/, /\bcelular\b/, /whatsapp/, /contact number/, /numero de contacto/] },
  { key: 'linkedin', patterns: [/linkedin/] },
  { key: 'github', patterns: [/github/] },
  { key: 'firstName', patterns: [/first ?name/, /given ?name/, /\bnombres?\b/, /primer nombre/] },
  { key: 'lastName', patterns: [/last ?name/, /\bsurname\b/, /family ?name/, /\bapellidos?\b/] },
  { key: 'fullName', patterns: [/full ?name/, /nombre completo/, /your name/, /legal name/, /nombre y apellido/] },
  { key: 'city', patterns: [/\bcity\b/, /\bciudad\b/, /\bmunicipio\b/, /localidad/, /address level 2/] },
  { key: 'country', patterns: [/\bcountry\b/, /\bpais\b/, /country of residence/, /pais de residencia/] },
  { key: 'location', patterns: [/\blocation\b/, /ubicacion/, /\baddress\b/, /direccion/, /residencia/, /\bregion\b/, /\bprovince\b/, /\bestado\b/] },
  { key: 'company', patterns: [/company/, /empresa/, /organizacion/, /organization/, /employer/, /current employer/] },
  { key: 'title', patterns: [/job ?title/, /\bposition\b/, /\bpuesto\b/, /\bcargo\b/, /\brole\b/, /profesion/, /ocupacion/, /headline/] },
  { key: 'yearsExperience', patterns: [/years? .*experience/, /anos? .*experiencia/, /experience .*years/, /experiencia laboral/] },
  { key: 'educationInstitution', patterns: [/university/, /universidad/, /institution/, /institucion/, /\bschool\b/, /colegio/, /centro educativo/] },
  { key: 'educationDegree', patterns: [/\bdegree\b/, /\btitulo\b/, /education level/, /nivel academico/, /formacion academica/] },
  { key: 'educationField', patterns: [/field of study/, /area of study/, /area de estudio/, /\bcareer\b/, /\bcarrera\b/, /\bmajor\b/] },
  { key: 'skills', patterns: [/\bskills\b/, /habilidades/, /competencias/, /tecnologias/] },
  { key: 'languages', patterns: [/\blanguages\b/, /\bidiomas\b/] },
  { key: 'portfolio', patterns: [/portfolio/, /portafolio/, /website/, /web site/, /sitio web/, /pagina web/, /personal site/, /behance/, /dribbble/] },
  { key: 'summary', patterns: [/cover letter/, /carta de presentacion/, /about you/, /sobre ti/, /professional summary/, /resumen profesional/, /\bbiography\b/, /\bbio\b/, /\bmessage\b/, /\bmensaje\b/, /additional information/, /informacion adicional/] },
]

function matchRule(text: string): BrowserAutofillKey | null {
  if (!text) return null
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) return rule.key
  }
  return null
}

const AUTOCOMPLETE_MAP: Record<string, BrowserAutofillKey> = {
  name: 'fullName',
  'given-name': 'firstName',
  'family-name': 'lastName',
  email: 'email',
  tel: 'phone',
  'tel-national': 'phone',
  'address-level2': 'city',
  country: 'country',
  'country-name': 'country',
  organization: 'company',
  'organization-title': 'title',
  url: 'portfolio',
  'street-address': 'location',
  'address-line1': 'location',
}

const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password', 'color', 'range', 'date', 'time', 'week', 'month'])

export interface FieldSuggestion {
  key: BrowserAutofillKey | null
  value: string
  confidence: number
  source: 'auto' | 'override' | 'custom' | 'skip'
  reason?: string
}

export function classifyField(
  field: Pick<BrowserFormField, 'type' | 'kind' | 'name' | 'idAttr' | 'label' | 'placeholder' | 'autocomplete'>,
  data: ProfileAutofillData,
): FieldSuggestion {
  const type = (field.type || '').toLowerCase()
  if (SKIP_TYPES.has(type)) {
    return { key: null, value: '', confidence: 0, source: 'skip', reason: 'sensitive' }
  }
  if (type === 'file') {
    return { key: null, value: '', confidence: 0, source: 'skip', reason: 'file' }
  }

  const auto = normalizeText(field.autocomplete)
  if (auto && AUTOCOMPLETE_MAP[auto]) {
    const key = AUTOCOMPLETE_MAP[auto]
    return { key, value: data.values[key] || '', confidence: 1, source: 'auto' }
  }

  const label = normalizeText(field.label)
  const name = normalizeText(`${field.name || ''} ${field.idAttr || ''}`)
  const placeholder = normalizeText(field.placeholder)

  const fromLabel = matchRule(label)
  const fromName = fromLabel ? null : matchRule(name)
  const fromPlaceholder = fromLabel || fromName ? null : matchRule(placeholder)
  const key = fromLabel || fromName || fromPlaceholder

  if (!key) return { key: null, value: '', confidence: 0, source: 'auto' }

  const confidence = fromLabel ? 0.9 : fromName ? 0.75 : 0.55
  return { key, value: data.values[key] || '', confidence, source: 'auto' }
}

function isEffectivelyEmpty(field: BrowserFormField): boolean {
  if (field.type === 'file') return true
  const value = (field.value || '').trim()
  if (!value) return true
  if (field.kind === 'select') {
    const option = (field.options || []).find((o) => o.value === value)
    const text = normalizeText(option?.label || value)
    return /^(select|choose|selecciona|seleccione|elige|choose one|--|none|ninguno)$/.test(text)
  }
  return false
}

function matchSelectOption(field: BrowserFormField, key: BrowserAutofillKey | null, value: string, data: ProfileAutofillData): string | null {
  if (field.kind !== 'select' || !value) return null
  const normalized = normalizeText(value)
  const candidates = new Set<string>([normalized])
  if (key === 'country') {
    for (const alias of data.countryAliases) candidates.add(normalizeText(alias))
  }

  const options = field.options || []
  for (const candidate of candidates) {
    const exact = options.find(
      (o) => normalizeText(o.value) === candidate || normalizeText(o.label) === candidate,
    )
    if (exact) return exact.value
  }
  for (const candidate of candidates) {
    if (candidate.length < 3) continue
    const partial = options.find((o) => {
      const text = normalizeText(`${o.label} ${o.value}`)
      return text.includes(candidate) || candidate.includes(text)
    })
    if (partial) return partial.value
  }
  return null
}

export interface AutofillPlanItem {
  field: BrowserFormField
  key: BrowserAutofillKey | null
  value: string
  confidence: number
  source: 'auto' | 'override' | 'custom' | 'skip'
  reason?: string
}

export interface AutofillPlan {
  entries: { id: string; value: string }[]
  items: AutofillPlanItem[]
}

export interface AutofillPlanOptions {
  overwriteExisting?: boolean
}

export function planAutofill(
  fields: BrowserFormField[],
  data: ProfileAutofillData,
  overrides: Record<string, BrowserMapping> = {},
  options: AutofillPlanOptions = {},
): AutofillPlan {
  const entries: { id: string; value: string }[] = []
  const items: AutofillPlanItem[] = []

  for (const field of fields) {
    const mapping: BrowserMapping | undefined = overrides[field.signature]

    if (!field.visible) {
      items.push({ field, key: null, value: '', confidence: 0, source: 'skip', reason: 'hidden' })
      continue
    }
    if (field.disabled || field.readonly) {
      items.push({ field, key: null, value: '', confidence: 0, source: 'skip', reason: 'disabled' })
      continue
    }

    let key: BrowserAutofillKey | null = null
    let value = ''
    let confidence = 0
    let source: AutofillPlanItem['source'] = 'auto'
    let reason: string | undefined

    if (mapping) {
      if (mapping.key === 'skip') {
        items.push({ field, key: null, value: '', confidence: 0, source: 'skip', reason: 'mapped-skip' })
        continue
      }
      if (mapping.key === 'custom') {
        key = null
        value = mapping.custom
        confidence = 1
        source = 'custom'
      } else {
        key = mapping.key
        value = data.values[key] || ''
        confidence = 1
        source = 'override'
      }
    } else {
      const suggestion = classifyField(field, data)
      key = suggestion.key
      value = suggestion.value
      confidence = suggestion.confidence
      source = suggestion.source
      reason = suggestion.reason
    }

    if (field.type === 'file') {
      items.push({ field, key, value: '', confidence, source: 'skip', reason: 'file' })
      continue
    }
    if (source === 'skip') {
      items.push({ field, key, value: '', confidence, source: 'skip', reason })
      continue
    }
    if (!value) {
      items.push({ field, key, value: '', confidence, source: 'skip', reason: 'no-profile-value' })
      continue
    }

    if ((field.type === 'checkbox' || field.type === 'radio') && source === 'auto') {
      items.push({ field, key, value: '', confidence, source: 'skip', reason: 'choice-requires-manual' })
      continue
    }

    if (field.kind === 'select') {
      const optionValue = matchSelectOption(field, key, value, data)
      if (optionValue === null) {
        items.push({ field, key, value, confidence, source: 'skip', reason: 'no-matching-option' })
        continue
      }
      value = optionValue
    }

    if (!options.overwriteExisting && !isEffectivelyEmpty(field)) {
      items.push({ field, key, value, confidence, source: 'skip', reason: 'already-filled' })
      continue
    }

    let entryValue = value
    if (field.type === 'checkbox' || field.type === 'radio') {
      entryValue = /^(true|1|yes|si|sí|on)$/i.test(value) ? 'true' : 'false'
    }

    entries.push({ id: field.id, value: entryValue })
    items.push({ field, key, value: entryValue, confidence, source })
  }

  return { entries, items }
}
