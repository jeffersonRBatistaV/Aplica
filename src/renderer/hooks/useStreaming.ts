import { useRef, useEffect, useCallback } from 'react'

interface StreamCallbacks {
  onToken: (token: string) => void
  onDone: () => void
  onError: (error: string) => void
}

export function useStreaming() {
  const cleanupRef = useRef<(() => void)[]>([])

  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((fn) => fn())
    }
  }, [])

  const subscribe = useCallback((callbacks: StreamCallbacks) => {
    cleanupRef.current.forEach((fn) => fn())
    cleanupRef.current = []
    cleanupRef.current.push(window.api.onToken(callbacks.onToken))
    cleanupRef.current.push(window.api.onDone(callbacks.onDone))
    cleanupRef.current.push(window.api.onError(callbacks.onError))
  }, [])

  return { subscribe }
}
