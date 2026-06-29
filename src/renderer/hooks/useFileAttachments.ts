import { useState, useCallback } from 'react'
import type { Attachment } from '../types/attachments'
import { isImageType, isTextType, isExcelType } from '../types/attachments'

export function useFileAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const readFile = useCallback(async (file: File): Promise<Attachment> => {
    const id = crypto.randomUUID()

    if (isImageType(file.type)) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          resolve({
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            data: reader.result as string,
            preview: reader.result as string,
          })
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    }

    if (isTextType(file.type, file.name)) {
      const text = await file.text()
      return {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        data: text,
      }
    }

    if (isExcelType(file.name)) {
      const buffer = await file.arrayBuffer()
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheets = workbook.SheetNames.map((name) => {
        const sheet = workbook.Sheets[name]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        return `=== ${name} ===\n${csv}`
      })
      return {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        data: sheets.join('\n\n'),
      }
    }

    // Fallback: read as text
    const text = await file.text()
    return {
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      data: text,
    }
  }, [])

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      const results = await Promise.all(
        fileArray.map((file) => readFile(file)),
      )
      setAttachments((prev) => [...prev, ...results])
    },
    [readFile],
  )

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const file = prev.find((a) => a.id === id)
      if (file?.preview) URL.revokeObjectURL(file.preview)
      return prev.filter((a) => a.id !== id)
    })
  }, [])

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => {
        if (a.preview) URL.revokeObjectURL(a.preview)
      })
      return []
    })
  }, [])

  return {
    attachments,
    isDragging,
    setIsDragging,
    addFiles,
    removeAttachment,
    clearAttachments,
  }
}
