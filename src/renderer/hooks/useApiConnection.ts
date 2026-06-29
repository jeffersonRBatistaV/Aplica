import { useState, useEffect, useRef, useCallback } from 'react'
import { useSettings } from '../contexts/SettingsContext'

export function useApiConnection() {
  const { settings } = useSettings()
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()
  const prevUrlRef = useRef(settings.api.baseUrl)
  const prevKeyRef = useRef(settings.api.apiKey)

  const { baseUrl, apiKey } = settings.api

  const check = useCallback(async () => {
    if (!baseUrl || (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://'))) {
      setConnected(false)
      return
    }
    setChecking(true)
    try {
      const result = await window.api.listModels({ baseUrl, apiKey })
      setConnected(result.length > 0)
    } catch {
      setConnected(false)
    } finally {
      setChecking(false)
    }
  }, [baseUrl, apiKey])

  useEffect(() => {
    if (prevUrlRef.current !== baseUrl || prevKeyRef.current !== apiKey) {
      prevUrlRef.current = baseUrl
      prevKeyRef.current = apiKey
      check()
    }
  }, [baseUrl, apiKey, check])

  useEffect(() => {
    check()
    intervalRef.current = setInterval(check, 30000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [check])

  return { connected, checking }
}
