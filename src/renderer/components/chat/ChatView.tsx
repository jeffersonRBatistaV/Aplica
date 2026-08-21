import { useEffect, useRef, useState } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { MessageBubble } from './MessageBubble'
import { StreamingMessage } from './StreamingMessage'
import { ChatInput } from '../input/ChatInput'
import { useTranslation } from 'react-i18next'
import { Trans } from 'react-i18next'
import { Globe, Loader2, X, ExternalLink } from 'lucide-react'
import type { InvestigateResult } from '../../../shared/types'

export function ChatView() {
  const { t } = useTranslation()
  const {
    activeConversation,
    isStreaming,
    streamingContent,
    error,
    sendMessage,
    abortStream,
    regenerateLastMessage,
  } = useChat()

  const bottomRef = useRef<HTMLDivElement>(null)

  const [investigating, setInvestigating] = useState(false)
  const [investResult, setInvestResult] = useState<InvestigateResult | null>(null)
  const [investError, setInvestError] = useState<string | null>(null)

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages, streamingContent])

  const handleInvestigate = async (query: string) => {
    if (!window.api || investigating || isStreaming) return
    setInvestigating(true)
    setInvestError(null)
    setInvestResult(null)
    try {
      const profile = await window.api.getProfile()
      const country = profile?.country || 'DO'
      const lang = t('locale') === 'es' ? 'es' : 'en'
      const result = await window.api.investigate(query, country, lang)
      setInvestResult(result)
    } catch (e) {
      setInvestError(e instanceof Error ? e.message : String(e))
    } finally {
      setInvestigating(false)
    }
  }

  if (!activeConversation) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
        <div className="text-center">
          <p className="text-sm font-medium">{t('chatView.selectOrStart')}</p>
          <p className="text-xs mt-1">
            <Trans i18nKey="chatView.usePlusButton" components={{ bold: <span className="font-semibold" /> }} />
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {activeConversation.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onCopy={() => {
                if (window.api) {
                  window.api.copyToClipboard(msg.content)
                }
              }}
              onRegenerate={regenerateLastMessage}
            />
          ))}

          {investigating && (
            <div className="flex items-center gap-2 text-sm text-blue-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('chatView.investigating')}
            </div>
          )}

          {investError && (
            <div className="flex justify-center">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-2">
                {investError}
              </div>
            </div>
          )}

          {investResult && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-100 dark:border-blue-900">
                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t('chatView.investigation')}
                </h3>
                <button onClick={() => setInvestResult(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-4">
                <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{investResult.answer}</div>
                {investResult.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-blue-100 dark:border-blue-900">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      {t('chatView.sources')} ({investResult.sources.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {investResult.sources.slice(0, 5).map((s, i) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-600 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors max-w-[220px]"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{s.title || s.url.replace('https://', '').slice(0, 30)}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {isStreaming && (
            <StreamingMessage content={streamingContent} />
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-2">
                {error}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <ChatInput
        onSend={(content, attachmentsContext) => {
          const message = attachmentsContext
            ? `${attachmentsContext}\n\n${content}`
            : content
          sendMessage(message)
        }}
        onAbort={abortStream}
        isStreaming={isStreaming}
        onInvestigate={handleInvestigate}
        investigating={investigating}
      />
    </div>
  )
}
