import nodemailer from 'nodemailer'
import type { EmailConfig, EmailPayload, EmailPreset, EmailResult } from '../../shared/types'

export const SMTP_PRESETS: Record<string, EmailPreset> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
  yahoo: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
  icloud: { host: 'smtp.mail.me.com', port: 587, secure: false },
  zoho: { host: 'smtp.zoho.com', port: 465, secure: true },
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout: no se pudo conectar con el servidor en 10s')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

function buildConfig(config: EmailConfig) {
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  }
}

function describeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  if (
    lower.includes('invalid login') ||
    lower.includes('authentication failed') ||
    lower.includes('credentials') ||
    lower.includes('535') ||
    lower.includes('username and password not accepted')
  ) {
    return 'Credenciales inválidas. Verifica usuario y contraseña (en Gmail/Outlook usa una contraseña de aplicación, no tu clave normal).'
  }
  if (lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('getaddrinfo') || lower.includes('enotfound')) {
    return 'No se pudo conectar al servidor SMTP. Revisa host/puerto y tu conexión a internet.'
  }
  if (lower.includes('certificate') || lower.includes('self signed')) {
    return 'Error de certificado TLS en el servidor SMTP.'
  }
  return `Fallo al conectar: ${message}`
}

export async function testEmailConnection(config: EmailConfig): Promise<EmailResult> {
  if (!config.host || !config.user || !config.pass) {
    return { ok: false, error: 'Faltan datos de configuración (host, usuario o contraseña).' }
  }
  const transporter = nodemailer.createTransport(buildConfig(config))
  try {
    await withTimeout(transporter.verify(), 10000)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}

export async function sendEmail(config: EmailConfig, payload: EmailPayload): Promise<EmailResult> {
  if (!config.host || !config.user || !config.pass) {
    return { ok: false, error: 'Faltan datos de configuración (host, usuario o contraseña).' }
  }
  const transporter = nodemailer.createTransport(buildConfig(config))
  try {
    const attachments = (payload.attachments ?? []).map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.contentBase64, 'base64'),
    }))
    await withTimeout(
      transporter.sendMail({
        from: { name: config.fromName || config.user, address: config.user },
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        attachments,
      }),
      30000,
    )
    return { ok: true }
  } catch (err) {
    return { ok: false, error: describeError(err) }
  }
}
