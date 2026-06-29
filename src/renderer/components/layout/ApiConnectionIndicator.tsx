import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useApiConnection } from '../../hooks/useApiConnection'

export function ApiConnectionIndicator() {
  const { connected, checking } = useApiConnection()

  if (checking) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1" title="Verificando conexión...">
        <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
        <span className="text-[10px] text-gray-400">Verificando...</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2 py-1"
      title={connected ? 'API conectada' : 'API desconectada'}
    >
      {connected ? (
        <>
          <Wifi className="w-3 h-3 text-green-500" />
          <span className="text-[10px] text-green-600 dark:text-green-400">Conectado</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3 h-3 text-red-500" />
          <span className="text-[10px] text-red-500">Desconectado</span>
        </>
      )}
    </div>
  )
}
