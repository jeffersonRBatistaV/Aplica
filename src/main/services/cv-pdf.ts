import { BrowserWindow } from 'electron'
import type { Profile } from '../../shared/types'
import { getActiveProfile } from './profile-scope'

const PHOTO_TOKEN = '{{FOTO-PERFIL}}'

/** Sustituye el token de foto por la foto real del perfil (o quita la imagen si no hay). */
async function resolvePhotoToken(bodyHtml: string): Promise<string> {
  if (!bodyHtml.includes(PHOTO_TOKEN)) return bodyHtml
  const profile = await getActiveProfile().catch(() => null)
  const photo = profile?.photo && profile.photo.startsWith('data:image/') ? profile.photo : ''
  if (photo) return bodyHtml.split(PHOTO_TOKEN).join(photo)
  return bodyHtml.replace(/<img\b[^>]*\{\{FOTO-PERFIL\}\}[^>]*>/gi, '')
}

/** Renderiza un CV (HTML) a un buffer PDF de una página A4 usando una ventana oculta. */
export async function renderCvPdf(bodyHtml: string, styleName: string): Promise<Buffer> {
  const html = buildCvHtml(await resolvePhotoToken(bodyHtml), styleName)
  const pdfWindow = new BrowserWindow({ show: false, width: 800, height: 1056, webPreferences: { sandbox: false } })
  try {
    await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return await pdfWindow.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      pageSize: 'A4',
    })
  } finally {
    pdfWindow.close()
  }
}

export function buildCvHtml(bodyHtml: string, styleName: string): string {
  const labels: Record<string, string> = { ats: 'ATS-Friendly', moderno: 'Moderno', tradicional: 'Tradicional', entrevista: 'Preguntas de Entrevista' }
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CV - ${labels[styleName] || styleName}</title>
<style>
  @page { margin: 0; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; max-width: 100%; }
  html, body {
    width: 210mm;
    min-height: 297mm;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
    background: #fff;
  }
  @media print {
    html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    p, h1, h2, h3, h4, h5, h6 { orphans: 3; widows: 3; }
    h1, h2, h3, h4 { page-break-after: avoid; }
    table { page-break-inside: avoid; }
  }
  img { max-width: 100%; height: auto; }
  a { color: inherit; text-decoration: none; }
  ul, ol { padding-left: 1.5em; }
  .cv-content { padding: 9.5mm 10mm; }
  p, li { orphans: 3; widows: 3; overflow-wrap: break-word; word-wrap: break-word; }
  .cv-ats, .cv-moderno, .cv-tradicional, [class^="cv-"] { min-height: auto !important; max-width: 100% !important; }
  img, table, pre { max-width: 100% !important; height: auto; }
  table { width: 100% !important; table-layout: fixed; }
  p, li, div, span, h1, h2, h3, h4, td, th { overflow-wrap: anywhere; }
</style>
</head>
<body><div class="cv-content" style="padding: 9.5mm 10mm;">${bodyHtml}</div></body>
</html>`
}

function escapeHtml(value: string | undefined | null): string {
  return (value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function dateRange(start: string, end: string | null | undefined): string {
  const from = (start || '').trim()
  const to = end && end.trim() ? end.trim() : 'Actualidad'
  if (!from) return to
  return `${from} – ${to}`
}

/**
 * CV básico y determinista generado a partir del perfil (sin LLM).
 * Se usa como opción de CV para adjuntar en formularios cuando aún no se ha
 * generado un CV específico para una vacante.
 */
export function buildProfileCvHtml(profile: Profile): string {
  const contact = [profile.email, profile.phone, profile.location, profile.linkedin, profile.github, profile.portfolio]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => escapeHtml(v))
    .join(' · ')

  const sections: string[] = []

  sections.push(
    `<h1 style="font-size:16pt;line-height:1.15;margin:0 0 2px;">${escapeHtml(profile.name) || 'Curriculum Vitae'}</h1>`,
  )
  if (profile.title) {
    sections.push(`<p style="font-size:10.5pt;font-weight:600;margin:0 0 2px;">${escapeHtml(profile.title)}</p>`)
  }
  if (contact) {
    sections.push(`<p style="font-size:8.5pt;color:#444;margin:0 0 10px;">${contact}</p>`)
  }

  if (profile.summary) {
    sections.push('<h2 style="font-size:11pt;margin:10px 0 3px;border-bottom:1px solid #999;padding-bottom:2px;">Perfil profesional</h2>')
    sections.push(`<p style="font-size:9.5pt;margin:0 0 6px;">${escapeHtml(profile.summary)}</p>`)
  }

  if (profile.experience?.length) {
    sections.push('<h2 style="font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #999;padding-bottom:2px;">Experiencia</h2>')
    for (const exp of profile.experience) {
      const heading = [exp.position, exp.company].filter(Boolean).join(' — ')
      sections.push(`<div style="margin:0 0 7px;">`)
      sections.push(`<p style="font-size:10pt;font-weight:600;margin:0;">${escapeHtml(heading)}</p>`)
      sections.push(`<p style="font-size:8.5pt;color:#555;margin:0 0 2px;">${escapeHtml(dateRange(exp.startDate, exp.endDate))}</p>`)
      if (exp.description) sections.push(`<p style="font-size:9.5pt;margin:0;">${escapeHtml(exp.description)}</p>`)
      if (exp.highlights?.length) {
        sections.push(`<ul style="font-size:9.5pt;margin:2px 0 0;">${exp.highlights.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`)
      }
      sections.push('</div>')
    }
  }

  if (profile.education?.length) {
    sections.push('<h2 style="font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #999;padding-bottom:2px;">Educación</h2>')
    for (const edu of profile.education) {
      const title = [edu.degree, edu.field].filter(Boolean).join(' — ')
      sections.push(`<div style="margin:0 0 5px;">`)
      sections.push(`<p style="font-size:10pt;font-weight:600;margin:0;">${escapeHtml(title || edu.institution)}</p>`)
      sections.push(`<p style="font-size:8.5pt;color:#555;margin:0;">${escapeHtml(edu.institution)} · ${escapeHtml(dateRange(edu.startDate, edu.endDate))}</p>`)
      sections.push('</div>')
    }
  }

  if (profile.skills?.length) {
    sections.push('<h2 style="font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #999;padding-bottom:2px;">Habilidades</h2>')
    sections.push(`<p style="font-size:9.5pt;margin:0;">${profile.skills.map((s) => escapeHtml(s)).join(' · ')}</p>`)
  }

  if (profile.languages?.length) {
    sections.push('<h2 style="font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #999;padding-bottom:2px;">Idiomas</h2>')
    sections.push(`<p style="font-size:9.5pt;margin:0;">${profile.languages.map((l) => escapeHtml(l)).join(' · ')}</p>`)
  }

  if (profile.certifications?.length) {
    sections.push('<h2 style="font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #999;padding-bottom:2px;">Certificaciones</h2>')
    sections.push(`<ul style="font-size:9.5pt;margin:0;">${profile.certifications.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`)
  }

  if (profile.projects?.length) {
    sections.push('<h2 style="font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #999;padding-bottom:2px;">Proyectos</h2>')
    for (const project of profile.projects) {
      sections.push(`<p style="font-size:9.5pt;margin:0 0 2px;"><strong>${escapeHtml(project.name)}</strong>${project.description ? ` — ${escapeHtml(project.description)}` : ''}</p>`)
    }
  }

  return sections.join('\n')
}
