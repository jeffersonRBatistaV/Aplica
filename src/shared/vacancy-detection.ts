import type { WhatsAppVacancy } from './types'

const EMPLOYMENT_KEYWORDS = [
  'vacante', 'vacancy', 'empleo', 'job', 'contratando', 'hiring', 'puesto',
  'position', 'posicion', 'requisitos', 'requirements', 'responsabilidades',
  'duties', 'funciones', 'sueldo', 'salary', 'salario', 'remoto', 'remote',
  'presencial', 'hibrido', 'híbrido', 'semi-remoto', 'tiempo completo',
  'full time', 'medio tiempo', 'part time', 'postulate', 'postúlate', 'aplica',
  'apply', 'cv', 'curriculum', 'resume', 'hoja de vida', 'correo', 'email',
  'enviar', 'send', 'envianos', 'envíenos', 'enviar cv', 'solicitudes',
  'trabajo', 'trabajar', 'trabajos', 'contrata', 'contratar', 'recluta',
  'reclutamiento', 'busco', 'buscamos', 'se busca', 'buscan', 'se solicita',
  'solicitamos', 'solicita', 'seleccionamos', 'selection', 'seleccion', 'selección',
  'oportunidad', 'oferta', 'oportunidades laborales', 'experiencia', 'perfil',
  'beneficios', 'prestaciones', 'beca', 'pasantia', 'pasantía', 'practicante',
  'pasante', 'internship', 'freelance', 'contactanos', 'contáctanos',
  'contactar', 'escribenos', 'escríbenos', 'entrevista', 'postulate a',
  'estamos en busca', 'sumate', 'súmate', 'team', 'equipo', 'unete', 'únete',
]

const CONTACT_KEYWORDS = [
  'telefono', 'teléfono', 'celular', 'cel', 'telf', 'whatsapp', 'correo',
  'email', 'linkedin', 'contactanos', 'contáctanos', 'escribenos', 'escríbenos',
]

const PHONE_RE =
  /(?:\+?\d[\d\s\-().]{7,17}\d)|\b(?:tel|telf|teléfono|celular|cel|whatsapp|wp)\s*[.:@]?\s*\+?\d[\d\s\-().]{5,15}/i

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Tecnología / IT': [
    'software', 'desarrollador', 'desarrolladora', 'developer', 'frontend',
    'backend', 'full stack', 'devops', 'data', 'machine learning', 'it', 'ti',
    'sistemas', 'cloud', 'programador', 'programadora', 'ux', 'ui',
    'informática', 'informatica', 'ofimática', 'ofimatica', 'hardware',
    'soporte técnico', 'soporte tecnico', 'código', 'codigo', 'programación',
    'programacion', 'analista de sistemas', 'ciberseguridad', 'base de datos',
  ],
  'Salud / Medicina': [
    'médico', 'medico', 'doctor', 'doctora', 'enfermero', 'enfermera', 'salud',
    'clínica', 'clinica', 'hospital', 'medicina', 'farmacia', 'laboratorio',
    'farmacéutico', 'farmaceutico', 'paciente', 'paramédico', 'paramedico',
    'psicólogo', 'psicologo', 'enfermería', 'enfermeria',
  ],
  'Finanzas / Contabilidad': [
    'finanzas', 'contador', 'contadora', 'contabilidad', 'auditor', 'auditoría',
    'auditoria', 'banca', 'inversiones', 'tesorería', 'tesoreria', 'controller',
    'contable', 'fiscal', 'dgi', 'estados financieros', 'cuentas por pagar',
  ],
  'Educación / Docencia': [
    'profesor', 'profesora', 'docente', 'educación', 'educacion', 'enseñanza',
    'ensenanza', 'maestro', 'maestra', 'pedagogo', 'académico', 'academico',
    'escuela', 'universidad', 'universitario', 'tutor',
  ],
  'Ventas / Marketing': [
    'ventas', 'marketing', 'comercial', 'social media', 'seo', 'publicidad',
    'brand', 'e-commerce', 'business development', 'vendedor', 'vendedora',
    'asesor comercial', 'agente de ventas', 'community manager',
    'creador de contenido', 'copywriter', 'redes sociales', 'atención al cliente',
    'atencion al cliente', 'marketing digital', 'trade marketing',
  ],
  'Ingeniería': [
    'ingeniero', 'ingeniera', 'ingeniería', 'ingenieria', 'civil', 'mecánica',
    'mecanica', 'eléctrica', 'electrica', 'industrial', 'química', 'quimica',
    'proyectos', 'construcción', 'construccion', 'manufactura', 'mantenimiento',
    'técnico de mantenimiento', 'tecnico de mantenimiento', 'eléctricos',
    'electricos', 'plomería', 'plomeria', 'arquitecto', 'obras', 'topografía',
    'topografia',
  ],
  'Legal / Jurídico': [
    'abogado', 'abogada', 'legal', 'jurídico', 'juridico', 'derecho',
    'corporativo', 'litigio', 'compliance', 'notario', 'consultor legal',
    'servicios legales',
  ],
  'Administrativo / Oficina': [
    'asistente', 'administrativo', 'secretario', 'secretaria', 'recepcionista',
    'recursos humanos', 'rrhh', 'office', 'coordinador', 'servicio al cliente',
    'cobros', 'cobrador', 'cobranzas', 'call center', 'mesero', 'mesera',
    'camarero', 'chofer', 'conductor', 'almacén', 'almacen', 'logística',
    'logistica', 'facturación', 'facturacion', 'cajero', 'cajera', 'limpieza',
    'doméstica', 'domestica', 'portero', 'mensajero', 'gestor de cobros',
    'empleada', 'encargado de almacen', 'operario', 'operador', 'supervisor de turno',
    'agente de call center', 'vendedor de piso', 'promotor', 'mercaderista',
  ],
  'Arte / Diseño': [
    'diseñador', 'disenador', 'diseñadora', 'diseño', 'diseno', 'ilustrador',
    'animador', 'artista', 'creativo', 'gráfico', 'grafico', 'figma',
    'photoshop', 'coreldraw', 'diseño gráfico', 'diseno grafico', 'edición de video',
    'edicion de video',
  ],
}

const COMPANY_PATTERNS = [
  /^(?:Company|Empresa|Compañía|Organization|Organización|About)\s*[:]\s*(.+)/i,
]

const AREA_ID_TO_CATEGORY: Record<string, string> = {
  tecnologia: 'Tecnología / IT',
  salud: 'Salud / Medicina',
  finanzas: 'Finanzas / Contabilidad',
  educacion: 'Educación / Docencia',
  ventas: 'Ventas / Marketing',
  ingenieria: 'Ingeniería',
  legal: 'Legal / Jurídico',
  admin: 'Administrativo / Oficina',
  arte: 'Arte / Diseño',
}

const AREA_NAME_ALIASES: Record<string, string> = {
  'ingeniería (no it)': 'Ingeniería',
}

function normalizeArea(area: string | undefined | null): string | null {
  if (!area) return null
  const trimmed = area.trim()
  if (!trimmed) return null
  const byId = AREA_ID_TO_CATEGORY[trimmed.toLowerCase()]
  if (byId) return byId
  const lowered = trimmed.toLowerCase()
  if (AREA_NAME_ALIASES[lowered]) return AREA_NAME_ALIASES[lowered]
  if (Object.values(AREA_ID_TO_CATEGORY).some((name) => name.toLowerCase() === lowered)) return trimmed
  return trimmed
}

export function isVacancyInArea(
  vacancyCategory: string | undefined,
  profileArea: string | undefined | null,
  strict = false,
): boolean {
  const areaName = normalizeArea(profileArea)
  if (!areaName) return true
  if (!vacancyCategory || vacancyCategory === 'General / Otra') return !strict
  return vacancyCategory.toLowerCase() === areaName.toLowerCase()
}

const POSITION_PATTERNS = [
  /^(?:Position|Puesto|Role|Rol|Title|Título|Cargo)\s*[:]\s*(.+)/i,
]

function isBoilerplate(text: string): boolean {
  const t = text.toLowerCase().trim()
  const boilerplate = [
    'estamos contratando', 'we are hiring', 'se busca', 'buscamos',
    'aplica ya', 'apply now', 'postulate', 'postúlate', 'oferta de empleo',
    'vacante disponible', 'trabaja con nosotros', 'work with us',
    'envianos tu cv', 'compartir', 'denunciar', 'empresa verificada',
  ]
  return boilerplate.some(b => t.includes(b))
}

function looksLikeCompany(text: string): boolean {
  const t = text.trim()
  if (!t || t.length < 3 || t.length > 50) return false
  if (/^(http|www\.)/i.test(t)) return false
  if (/[:|]/.test(t)) return false
  if (t.split(/\s+/).length > 4) return false
  if (isBoilerplate(t)) return false
  if (/^(somos|we are|our|buscamos|se busca|ofrecemos|requisit|responsab)/i.test(t)) return false
  return true
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countKeywordMatches(text: string, kw: string): number {
  const re = new RegExp(`\\b${escapeRegExp(kw)}\\b`, 'gi')
  let count = 0
  while (re.exec(text) !== null) count++
  return count
}

function classifyCategory(text: string): string {
  const lower = text.toLowerCase()
  let best = 'General / Otra'
  let bestScore = 0
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      score += countKeywordMatches(lower, kw)
    }
    if (score > bestScore) {
      bestScore = score
      best = cat
    }
  }
  return best
}

function extractCompany(text: string): string | undefined {
  for (const pattern of COMPANY_PATTERNS) {
    const m = text.match(pattern)
    if (m && !isBoilerplate(m[1])) return m[1].trim()
  }
  const lines = text.split('\n')
  for (const line of lines) {
    if (looksLikeCompany(line.trim())) return line.trim()
  }
  return undefined
}

function extractPosition(text: string): string {
  for (const pattern of POSITION_PATTERNS) {
    const m = text.match(pattern)
    if (m && !isBoilerplate(m[1])) return m[1].trim()
  }
  const lines = text.split('\n')
  for (const line of lines) {
    const t = line.trim()
    if (t.length >= 10 && t.length <= 60 && !isBoilerplate(t)) return t
  }
  return ''
}

export function detectVacancy(
  body: string,
  ocrText: string,
  author: string,
  groupName: string,
  groupId: string,
  messageTime: number,
): WhatsAppVacancy | null {
  const combined = [body, ocrText].filter(Boolean).join('\n')
  if (combined.length < 10) return null

  const lower = combined.toLowerCase()
  let score = 0
  for (const kw of EMPLOYMENT_KEYWORDS) {
    if (lower.includes(kw)) score += 3
  }

  const emailMatch = combined.match(EMAIL_RE)
  const hasEmail = !!emailMatch
  if (hasEmail) score += 10

  // WhatsApp: solo nos interesan vacantes que aporten correo de contacto.
  // Las ofertas que solo traen un enlace (o ningún correo) se descartan.
  if (!hasEmail) return null

  const contactWords = CONTACT_KEYWORDS.filter((c) => lower.includes(c)).length
  if (contactWords >= 2) score += 6

  if (PHONE_RE.test(combined)) score += 6

  if (score < 4) return null

  const company = extractCompany(combined) || groupName
  const position = extractPosition(combined) || 'Vacante detectada'
  const category = classifyCategory(combined)
  const email = emailMatch?.[0]

  return {
    id: `wa-${groupId}-${messageTime}-${Math.random().toString(36).slice(2, 8)}`,
    title: position,
    company,
    category,
    snippet: combined.slice(0, 200),
    vacancyText: combined,
    groupId,
    groupName,
    messageTime,
    author,
    hasImage: !!ocrText,
    ocrText: ocrText || undefined,
    email,
  }
}
