import type { WhatsAppVacancy } from './types'

const EMPLOYMENT_KEYWORDS = [
  'vacante', 'vacancy', 'empleo', 'job', 'contratando', 'hiring', 'puesto',
  'position', 'posicion', 'requisitos', 'requirements', 'responsabilidades',
  'duties', 'funciones', 'sueldo', 'salary', 'salario', 'sueldo fijo',
  'remoto', 'remote', 'presencial', 'hibrido', 'híbrido', 'semi-remoto',
  'tiempo completo', 'full time', 'medio tiempo', 'part time', 'postulate',
  'postúlate', 'aplica', 'apply', 'cv', 'curriculum', 'resume', 'hoja de vida',
  'correo', 'email', 'enviar', 'send', 'envianos', 'envíenos', 'enviar cv',
  'solicitudes', 'trabajo', 'trabajar', 'trabajos', 'contrata', 'contratar',
  'recluta', 'reclutamiento', 'busco', 'buscamos', 'se busca', 'buscan',
  'se solicita', 'solicitamos', 'solicita', 'seleccionamos', 'selection',
  'seleccion', 'selección', 'oportunidad', 'oferta', 'oportunidades laborales',
  'experiencia', 'perfil', 'beneficios', 'prestaciones', 'beca', 'pasantia',
  'pasantía', 'practicante', 'pasante', 'internship', 'freelance', 'contactanos',
  'contáctanos', 'contactar', 'escribenos', 'escríbenos', 'entrevista',
  'postulate a', 'estamos en busca', 'sumate', 'súmate', 'team', 'equipo',
  'unete', 'únete', 'interesados', 'interesado', 'al privado', 'por interno',
  'pago', 'horario', 'turno', 'requerimos', 'necesitamos', 'estamos requiriendo',
  'requieren', 'se necesitan', 'precisamos', 'nos encontramos en la busqueda',
  'estamos reclutando', 'vacantes disponibles', 'estamos buscando', 'personal',
  'colaboradores', 'agente', 'operativa', 'disponibilidad inmediata',
]

const CONTACT_KEYWORDS = [
  'telefono', 'teléfono', 'celular', 'cel', 'telf', 'whatsapp', 'correo',
  'email', 'linkedin', 'contactanos', 'contáctanos', 'escribenos', 'escríbenos',
]

const PHONE_RE =
  /(?:\+?\d[\d\s\-().]{7,17}\d)|\b(?:tel|telf|teléfono|celular|cel|whatsapp|wp)\s*[.:@]?\s*\+?\d[\d\s\-().]{5,15}/i

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

/**
 * Palabras FUERTES por categoría (peso 3). Deben identificar el área por sí solas.
 * Las palabras ambiguas ("técnico", "soporte", "analista"…) van en WEAK_CATEGORY_KEYWORDS
 * (peso 1): un técnico de refrigeración o un analista de compras NO son IT.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Tecnología / IT': [
    'software', 'desarrollador', 'desarrolladora', 'desarrolladores', 'developer',
    'developers', 'frontend', 'front-end', 'backend', 'back-end', 'full stack',
    'fullstack', 'full-stack', 'devops', 'machine learning', 'cloud',
    'programador', 'programadora', 'programadores', 'soporte técnico',
    'soporte tecnico', 'soporte ti', 'soporte it', 'técnico de soporte',
    'tecnico de soporte', 'help desk', 'helpdesk', 'mesa de ayuda',
    'programación', 'programacion', 'analista de sistemas',
    'analista de datos', 'ciencia de datos', 'ciberseguridad',
    'ingeniero de software', 'ingeniería de software',
    'ingeniero en sistemas', 'ingeniería en sistemas', 'ingenieria en sistemas',
    'licenciado en sistemas', 'infraestructura tecnológica', 'infraestructura ti',
    'redes y servidores', 'sql', 'javascript', 'typescript',
    'python', 'java', 'react', 'node.js', 'angular', '.net', 'php', 'kotlin',
    'aws', 'azure', 'api', 'apis', 'noc', 'tic',
    'páginas web', 'paginas web', 'sitios web', 'desarrollo web', 'desarrollo de software',
    'equipo de desarrollo', 'field engineer', 'ingeniero de soporte', 'soporte de campo',
    'html', 'html5', 'css', 'css3', 'wordpress', 'linux', 'docker', 'kubernetes',
    'active directory',
    // QA de software. "QA" a secas también es control de calidad en manufactura (zonas francas).
    'tester', 'testing', 'qa tester', 'qa engineer', 'qa analyst', 'qa automation',
    'analista qa', 'analista de qa', 'ingeniero qa', 'ingeniero de qa', 'pruebas de software',
    'automatización de pruebas', 'automatizacion de pruebas',
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
    'financiero', 'financiera', 'analista de crédito', 'analista de credito', 'impuestos',
  ],
  'Educación / Docencia': [
    'profesor', 'profesora', 'docente', 'educación', 'educacion', 'enseñanza',
    'ensenanza', 'maestro', 'maestra', 'pedagogo', 'académico', 'academico',
    'escuela', 'universidad', 'universitario', 'tutor',
  ],
  'Ventas / Marketing': [
    'ventas', 'marketing', 'comercial', 'social media', 'seo', 'publicidad',
    'brand', 'e-commerce', 'business development', 'vendedor', 'vendedora',
    'soporte comercial', 'cobros de deudas', 'comisiones',
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
    'topografia', 'refrigeración', 'refrigeracion', 'aire acondicionado',
    'aires acondicionados', 'electromecánica', 'electromecanica', 'electricista',
    'técnico eléctrico', 'tecnico electrico', 'mecánico', 'mecanico', 'soldador',
    'control de calidad', 'técnico de calidad', 'tecnico de calidad',
    'inspector de calidad', 'supervisor de calidad', 'dispositivos médicos', 'dispositivos medicos',
    'buenas prácticas de manufactura', 'buenas practicas de manufactura',
    'técnico en electrónica', 'tecnico en electronica', 'ingeniería electrónica', 'ingenieria electronica',
    'reparación de celulares', 'reparacion de celulares', 'técnico de celulares', 'tecnico de celulares',
  ],
  'Legal / Jurídico': [
    'abogado', 'abogada', 'abogados', 'legal', 'jurídico', 'juridico', 'derecho',
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
    'recepcion', 'auxiliar', 'dactilógrafo', 'digitador', 'asistente administrativo',
    'administración', 'administracion', 'secretariado', 'atención al público',
    'atencion al publico', 'vigilante', 'guardia', 'turnero', 'compras',
    'importaciones', 'sourcing', 'encargada administrativa', 'administrativa',
    'cuentas por cobrar', 'hotel', 'hotelería', 'hoteleria', 'housekeeping',
    'mozo', 'cocinero', 'cocinera', 'ayudante de cocina', 'chef', 'barista',
    'repositor', 'despacho', 'inventario', 'bodega', 'empaque', 'producción',
    'produccion', 'planta', 'fábrica', 'fabrica', 'operario de', 'lider de equipo',
    'encargado de tienda', 'dependiente', 'vendedor de tienda', 'retail', 'tienda',
    // "Data entry" es trabajo de digitación, no de datos/IT.
    'data entry', 'digitación', 'digitacion', 'digitadora', 'captura de datos', 'entrada de datos',
    'promotora', 'promotoras', 'promotores',
  ],
  'Arte / Diseño': [
    'diseñador', 'disenador', 'diseñadora', 'diseño', 'diseno', 'ilustrador',
    'animador', 'artista', 'creativo', 'gráfico', 'grafico', 'figma',
    'photoshop', 'coreldraw', 'diseño gráfico', 'diseno grafico', 'edición de video',
    'edicion de video',
  ],
}

/** Palabras ambiguas (peso 1): solo suman, nunca deciden el área por sí solas. */
const WEAK_CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Tecnología / IT': [
    'sistemas', 'data', 'datos', 'tech', 'tecnología', 'tecnologia', 'digital',
    'analista', 'soporte', 'técnico', 'tecnico', 'informática', 'informatica',
    'hardware', 'redes', 'ux', 'ui', 'web', 'apps', 'aplicaciones',
    // Ambiguas fuera de IT: "base de datos de clientes", "servidores públicos",
    // "código de vestimenta", "QA" de manufactura, "reparación de celulares Android".
    'base de datos', 'bases de datos', 'servidores', 'código', 'codigo', 'qa', 'android', 'ios',
  ],
  'Ingeniería': ['proyectos', 'calidad', 'técnica', 'tecnica'],
  'Administrativo / Oficina': ['seguridad', 'producción', 'produccion', 'office', 'personal'],
}

/** Términos de categoría que se mueven a la lista débil (si quedaron en la fuerte). */
const DEMOTED: Record<string, string[]> = {
  'Ingeniería': ['proyectos'],
  'Administrativo / Oficina': ['seguridad', 'producción', 'produccion', 'office'],
}

const KW_BOUNDARY = (kw: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(kw)}(?![\\p{L}\\p{N}_])`, 'giu')

interface CompiledCategory {
  name: string
  strong: RegExp[]
  weak: RegExp[]
}

let compiledCategories: CompiledCategory[] | null = null

function getCompiledCategories(): CompiledCategory[] {
  if (compiledCategories) return compiledCategories
  compiledCategories = Object.entries(CATEGORY_KEYWORDS).map(([name, kws]) => {
    const demoted = new Set(DEMOTED[name] ?? [])
    return {
      name,
      strong: kws.filter((k) => !demoted.has(k)).map(KW_BOUNDARY),
      weak: (WEAK_CATEGORY_KEYWORDS[name] ?? []).map(KW_BOUNDARY),
    }
  })
  return compiledCategories
}

// "TI"/"IT" solo cuentan en MAYÚSCULAS ("para ti", "it's" no son tecnología).
const IT_ACRONYM_RE = /(?<![\p{L}\p{N}_])(?:TI|IT)(?![\p{L}\p{N}_])/gu

function countMatches(re: RegExp, text: string): number {
  re.lastIndex = 0
  let n = 0
  while (re.exec(text) !== null) n++
  return n
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

/** Área que devuelve el clasificador cuando no reconoce ninguna (o hay empate). */
export const GENERAL_CATEGORY = 'General / Otra'

export function isVacancyInArea(
  vacancyCategory: string | undefined,
  profileArea: string | undefined | null,
  strict = false,
): boolean {
  const areaName = normalizeArea(profileArea)
  if (!areaName) return true
  if (!vacancyCategory || vacancyCategory === GENERAL_CATEGORY) return !strict
  return vacancyCategory.toLowerCase() === areaName.toLowerCase()
}

const POSITION_PATTERNS = [
  /^[^\p{L}\n]*(?:Position|Posici[oó]n|Puesto|Vacante|Role|Rol|Title|T[ií]tulo|Cargo)[\s*_~]*:[\s*_~]*(.+)$/imu,
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

const STRONG_WEIGHT = 3
const WEAK_WEIGHT = 1
/** Las coincidencias en el título/puesto pesan más que en el cuerpo. */
const TITLE_MULTIPLIER = 3
/** Puntuación mínima para asignar un área (≈ una palabra fuerte). */
const MIN_CATEGORY_SCORE = 3

/**
 * Quita enlaces antes de puntuar: en "https://empleosryp.blogspot.com/…/heladeria.html" el
 * ".html" contaba como palabra fuerte de IT y cualquier oferta con enlace salía como Tecnología.
 */
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|org|do|ly|gl|site|info|biz)(?:\.[a-z]{2})?(?:\/\S*)?/gi

export function stripUrls(text: string): string {
  return text.replace(URL_RE, ' ')
}

function scoreText(raw: string, cat: CompiledCategory): number {
  const text = stripUrls(raw)
  let score = 0
  for (const re of cat.strong) score += countMatches(re, text) * STRONG_WEIGHT
  for (const re of cat.weak) score += countMatches(re, text) * WEAK_WEIGHT
  if (cat.name === 'Tecnología / IT') score += countMatches(IT_ACRONYM_RE, text) * WEAK_WEIGHT
  return score
}

/**
 * Áreas con la puntuación más alta (varias si empatan). Vacío si ninguna llega al mínimo.
 * El título pesa x3.
 */
export function topCategories(text: string, title?: string): string[] {
  const scores = getCompiledCategories().map((cat) => ({
    name: cat.name,
    score: scoreText(text, cat) + (title ? scoreText(title, cat) * (TITLE_MULTIPLIER - 1) : 0),
  }))
  const max = Math.max(...scores.map((s) => s.score))
  if (max < MIN_CATEGORY_SCORE) return []
  return scores.filter((s) => s.score === max).map((s) => s.name)
}

/**
 * Clasifica el área de una vacante. Si ninguna categoría supera el mínimo o hay empate
 * en cabeza → 'General / Otra' (antes el empate lo ganaba siempre Tecnología por ser la
 * primera de la lista).
 */
export function classifyCategory(text: string, title?: string): string {
  const top = topCategories(text, title)
  return top.length === 1 ? top[0] : GENERAL_CATEGORY
}

// ── ¿Es realmente una oferta de empleo? ──

/** Señales claras de contratación: al menos una es obligatoria. */
const HIRING_SIGNALS = [
  'vacante', 'vacantes', 'vacancy', 'contratando', 'contratamos', 'hiring',
  'puesto', 'posición', 'posicion', 'posiciones', 'position', 'requisitos',
  'requirements', 'cv', 'c.v', 'curriculum', 'currículum', 'hoja de vida',
  'resume', 'buscamos', 'se busca', 'busco', 'estamos buscando', 'en búsqueda',
  'en busqueda', 'en busca de', 'buscando', 'busca', 'se solicita', 'solicitamos', 'está solicitando',
  'esta solicitando', 'reclutamiento', 'recluta', 'reclutando', 'oportunidad laboral',
  'oferta laboral', 'oferta de empleo', 'empleo', 'pasantía', 'pasantia', 'pasante',
  'únete a nuestro equipo', 'unete a nuestro equipo', 'join our team',
  'looking for', 'salario', 'sueldo', 'postúlate', 'postulate', 'postula', 'aplicar',
  'convocatoria', 'job', 'jobs',
  // Formas muy habituales en grupos LATAM que antes no contaban como señal
  'se necesita', 'se necesitan', 'necesitamos', 'necesito', 'se requiere', 'se requieren',
  'requerimos', 'requiere', 'contratación', 'contratacion', 'contratar', 'plaza', 'plazas',
  'oportunidad de empleo', 'oportunidad de trabajo', 'oferta de trabajo', 'trabajo',
  'empleos', 'reclutamos', 'seleccionamos', 'incorporar', 'incorporamos', 'incorporación',
  'incorporacion', 'personal para', 'se solicitan', 'solicito', 'aplica ya', 'aplicar ya',
  "we're hiring", 'we are hiring', 'now hiring', 'open position', 'open role',
  'enviar cv', 'envía tu cv', 'envia tu cv', 'enviar hoja de vida', 'interesados enviar',
  'interesadas enviar', 'disponibilidad inmediata', 'medio tiempo', 'tiempo completo',
  'full time', 'part time', 'remoto', 'remote',
].map(KW_BOUNDARY)

/** Señales de que NO es una vacante (cursos, ventas, alquileres, sorteos…). */
// "taller", "precio" o "promoción" se quitaron: aparecen en vacantes reales
// ("taller mecánico", "oportunidad de promoción") y tumbaban ofertas válidas.
const NON_VACANCY_SIGNALS = [
  'curso', 'cursos', 'diplomado', 'webinar', 'masterclass', 'inscripciones',
  'inscríbete', 'inscribete', 'matrícula', 'matricula', 'se vende', 'vendo',
  'alquilo', 'alquiler', 'se alquila', 'descuento', 'oferta especial', 'rifa',
  'sorteo', 'cupos limitados', 'certificación incluida',
].map(KW_BOUNDARY)

/** Frases que indican que el contacto es el propio autor del mensaje ("escríbeme al privado"). */
const DM_CONTACT_RE =
  /\b(al privado|por privado|al interno|por interno|al dm|por dm|inbox|al pv|por pv|escr[ií]beme|escr[ií]banme|me escriben|interesad[oa]s?|comenta(?:r)?|comuníquese|comuniquese|contáctame|contactame|al wsp|al whats?app|por whats?app)\b/i

/**
 * Versión del detector. Al cambiarla, los mensajes ya revisados y descartados se vuelven
 * a evaluar una vez (antes quedaban marcados para siempre aunque el detector mejorase).
 * v4: whatsapp-web.js 1.34.7 no podía descargar imágenes desde la actualización de WhatsApp
 * Web (id._serialized → id.$1) y los flyers quedaban marcados como revisados sin OCR.
 */
export const DETECTOR_VERSION = 4

/** Mensaje "dudoso": tiene pinta de oferta pero la heurística no basta para confirmarla. */
export function isVacancyCandidate(text: string): boolean {
  if (!text || text.trim().length < 40) return false
  if (countSignals(HIRING_SIGNALS, text) > 0) return true
  const lower = text.toLowerCase()
  let hits = 0
  for (const kw of EMPLOYMENT_KEYWORDS) if (lower.includes(kw)) hits++
  return hits >= 3
}

/** Áreas válidas que puede devolver el clasificador (para la IA). */
export const VACANCY_CATEGORIES = [...Object.keys(CATEGORY_KEYWORDS), GENERAL_CATEGORY]

/**
 * Extrae un teléfono de contacto del texto de una vacante (para enviar el CV por WhatsApp).
 * Exige 8–15 dígitos para no confundir fechas, salarios o rangos.
 */
export function extractVacancyPhone(text: string | undefined): string | undefined {
  if (!text) return undefined
  const re = new RegExp(PHONE_RE.source, 'gi')
  for (const m of text.matchAll(re)) {
    let raw = m[0].replace(/^[^+\d(]+/, '').trim()
    if (raw.includes(')') && !raw.includes('(')) raw = `(${raw}`
    const digits = raw.replace(/\D/g, '')
    if (digits.length < 8 || digits.length > 15) continue
    if (/^(19|20)\d{2}\D+(19|20)\d{2}$/.test(raw)) continue
    return raw
  }
  return undefined
}

/** "50588887777@c.us" → "+50588887777". Los ids @lid no son teléfonos. */
export function phoneFromAuthor(author: string | undefined): string | undefined {
  const m = author?.match(/^(\d{8,15})@c\.us$/)
  return m ? `+${m[1]}` : undefined
}

function countSignals(res: RegExp[], text: string): number {
  return res.reduce((n, re) => n + (countMatches(re, text) > 0 ? 1 : 0), 0)
}

/** true si el texto parece una oferta de empleo (no un curso, anuncio o venta). */
export function looksLikeVacancy(text: string): boolean {
  const hiring = countSignals(HIRING_SIGNALS, text)
  if (hiring === 0) return false
  const nonVacancy = countSignals(NON_VACANCY_SIGNALS, text)
  // Un anuncio de curso suele decir "requisitos" o "postúlate"; exigir más evidencia.
  if (nonVacancy > 0 && hiring < nonVacancy + 2) return false
  return true
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
    const value = m?.[1].replace(/[*_~]+/g, '').trim()
    if (value && !isBoilerplate(value)) return value
  }
  const lines = text.split('\n')
  for (const line of lines) {
    const t = line.replace(/[*_~]+/g, '').trim()
    if (t.length >= 10 && t.length <= 60 && !isBoilerplate(t)) return t
  }
  // Mensajes de una sola línea larga: "Se necesita mesero con experiencia, horario…" →
  // el puesto suele ir justo tras el verbo de contratación.
  const m = text.match(
    /(?:se necesita[n]?|necesitamos|requerimos|se requiere[n]?|buscamos|se busca[n]?|busco|solicitamos|se solicita[n]?|contratamos|vacante(?: de)?|plaza(?: de)?)\s*:?\s+(?:un[ao]?s?\s+|el\s+|la\s+)?([^.,;:!?\n]{3,50})/i,
  )
  const guess = m?.[1].replace(/[*_~]+/g, '').trim()
  if (guess && !isBoilerplate(guess)) return guess.charAt(0).toUpperCase() + guess.slice(1)
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

  const urlMatch = combined.match(/https?:\/\/[^\s)<>]+/i)
  const hasUrl = !!urlMatch
  const phoneMatch = combined.match(PHONE_RE)
  const hasPhone = !!phoneMatch
  if (hasPhone) score += 6
  if (hasUrl) score += 4

  const contactWords = CONTACT_KEYWORDS.filter((c) => lower.includes(c)).length
  if (contactWords >= 2) score += 6

  // WhatsApp: se necesita algún medio de contacto. Si el texto no trae correo, teléfono
  // ni enlace, el autor del mensaje es el contacto (en un grupo siempre se le puede
  // escribir), sobre todo cuando dice "al privado", "interesados", etc.
  const authorPhone = phoneFromAuthor(author)
  const dmHint = DM_CONTACT_RE.test(combined)
  if (!hasEmail && !hasPhone && !hasUrl) {
    if (!authorPhone) return null
    if (dmHint) score += 6
  }

  if (score < 8) return null
  if (!looksLikeVacancy(combined)) return null

  const company = extractCompany(combined) || groupName
  const position = extractPosition(combined) || 'Vacante detectada'
  const category = classifyCategory(combined, position)
  const email = emailMatch?.[0]
  const phone = hasPhone ? phoneMatch![0].trim() : (!hasEmail && !hasUrl ? authorPhone : undefined)
  const sourceUrl = hasUrl ? urlMatch![0] : undefined

  return {
    id: buildVacancyId(groupId, { email, phone, sourceUrl, title: position, company, category }),
    // Huella de contenido GLOBAL (sin groupId): misma oferta publicada en distintos
    // grupos/mensajes produce la misma huella → dedupe entre grupos en addToQueue.
    fingerprint: contentFingerprint({ email, phone, sourceUrl, title: position, company, category, groupName }),
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
    phone,
    sourceUrl,
  }
}

// ── id y huella deterministas (translúcido al usuario: mismo anuncio → mismo id) ──

/** Normaliza un token único (email/phone/url/título) para comparar huellas sin ruido. */
function normalizeToken(value: string | undefined): string {
  if (!value) return ''
  return value
    .toLowerCase()
    .replace(/[\s\-–—_().,+;:/\\@[\]]/g, '')
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
}

/** FNV-1a de 32 bits, estable entre procesos y plataformas. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h.toString(36)
}

interface VacancyKey {
  email?: string
  phone?: string
  sourceUrl?: string
  title: string
  company?: string
  category?: string
}

/** id determinista por grupo + clave de contacto normalizada. */
export function buildVacancyId(groupId: string, key: VacancyKey): string {
  const parts = [
    groupId,
    normalizeToken(key.email),
    normalizeToken(key.phone),
    normalizeToken(key.sourceUrl),
    normalizeToken(key.title),
    normalizeToken(key.company),
    normalizeToken(key.category),
  ]
  return `wa-${fnv1a(parts.join('|'))}`
}

/** Huella GLOBAL de la oferta (sin grupo): misma vacante en 2 grupos → misma huella. */
export function contentFingerprint(key: VacancyKey & { groupName?: string }): string {
  const parts = [
    normalizeToken(key.email),
    normalizeToken(key.phone),
    normalizeToken(key.sourceUrl),
    normalizeToken(key.title),
    normalizeToken(key.company),
    normalizeToken(key.category),
  ]
  return fnv1a(parts.join('|'))
}
