import { useEffect, useRef } from 'react'
import { useChat } from '../../contexts/ChatContext'
import { MessageBubble } from './MessageBubble'
import { StreamingMessage } from './StreamingMessage'
import { ChatInput } from '../input/ChatInput'
import { useTranslation } from 'react-i18next'
import { Trans } from 'react-i18next'

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

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages, streamingContent])

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
      />
    </div>
  )
}
