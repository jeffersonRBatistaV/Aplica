export interface Attachment {
  id: string
  name: string
  type: string
  size: number
  data: string
  preview?: string
}

export function isImageType(mime: string): boolean {
  return ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'].includes(mime)
}

export function isTextType(mime: string, name: string): boolean {
  if (mime.startsWith('text/')) return true
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'csv' || ext === 'json' || ext === 'xml' || ext === 'yaml' || ext === 'yml'
}

export function isExcelType(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext === 'xlsx' || ext === 'xls'
}

export function parseCSV(text: string): string {
  const lines = text.split('\n').filter(Boolean)
  if (lines.length === 0) return ''
  return lines.map((line) => line.split(',').map((cell) => cell.trim()).join(' | ')).join('\n')
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
