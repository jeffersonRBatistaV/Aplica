import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import type { Conversation, Message } from '../../shared/types'
import { useSettings } from './SettingsContext'
import { useStreaming } from '../hooks/useStreaming'

const MAX_TITLE_WORDS = 4

function generateTitle(content: string): string {
  const words = content.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'Nueva conversación'
  return (
    words.slice(0, MAX_TITLE_WORDS).join(' ') +
    (words.length > MAX_TITLE_WORDS ? '...' : '')
  )
}

function createConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: 'Nueva conversación',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    archived: false,
    messages: [],
  }
}

function createUserMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    timestamp: Date.now(),
  }
}

function createAssistantMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    timestamp: Date.now(),
  }
}

interface ChatContextValue {
  conversations: Conversation[]
  activeConversationId: string | null
  activeConversation: Conversation | null
  isStreaming: boolean
  streamingContent: string
  error: string | null
  showArchived: boolean
  setShowArchived: (v: boolean) => void
  newConversation: () => void
  selectConversation: (id: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  abortStream: () => void
  deleteConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  archiveConversation: (id: string) => Promise<void>
  regenerateLastMessage: () => Promise<void>
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  const { subscribe } = useStreaming()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const streamContentRef = useRef('')
  const activeIdRef = useRef<string | null>(null)

  // Sync ref
  useEffect(() => {
    activeIdRef.current = activeConversationId
  }, [activeConversationId])

  // Load conversations on mount
  useEffect(() => {
    if (window.api) {
      window.api.getConversations().then((chats) => {
        setConversations(chats)
      })
    }
  }, [])

  // Re-fetch conversations after data import
  useEffect(() => {
    const handler = () => {
      if (window.api) {
        window.api.getConversations().then((chats) => {
          setConversations(chats)
        })
      }
    }
    window.addEventListener('data:imported', handler)
    return () => window.removeEventListener('data:imported', handler)
  }, [])

  const findConversation = useCallback(
    (id: string) => conversations.find((c) => c.id === id) ?? null,
    [conversations],
  )

  const activeConversation = activeConversationId
    ? findConversation(activeConversationId)
    : null

  // ── Helpers ──
  const persistConversation = useCallback(
    async (conversation: Conversation) => {
      if (!window.api) return
      if (!settings.privacy.storeHistory) return
      await window.api.saveConversation(conversation)
    },
    [settings.privacy.storeHistory],
  )

  const updateConversationInState = useCallback(
    (conversation: Conversation) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversation.id ? conversation : c)),
      )
    },
    [],
  )

  // ── Actions ──
  const newConversation = useCallback(() => {
    const conv = createConversation()
    setConversations((prev) => [conv, ...prev])
    setActiveConversationId(conv.id)
    setError(null)
  }, [])

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id)
    setError(null)
  }, [])

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return

      let conv = findConversation(activeConversationId)
      if (!conv) return

      const userMsg = createUserMessage(content.trim())
      const isFirstMessage = conv.messages.length === 0

      conv = {
        ...conv,
        title: isFirstMessage ? generateTitle(content) : conv.title,
        messages: [...conv.messages, userMsg],
        updatedAt: Date.now(),
      }

      updateConversationInState(conv)
      await persistConversation(conv)
      setError(null)
      setIsStreaming(true)
      streamContentRef.current = ''

      // Subscribe to streaming events
      subscribe({
        onToken: (token) => {
          streamContentRef.current += token
          setStreamingContent(streamContentRef.current)
        },
        onDone: async () => {
          const fullContent = streamContentRef.current
          if (fullContent) {
            const assistantMsg = createAssistantMessage(fullContent)
            const updatedConv = {
              ...conv,
              messages: [...conv.messages, assistantMsg],
              updatedAt: Date.now(),
            }
            updateConversationInState(updatedConv)
            await persistConversation(updatedConv)
          }
          setIsStreaming(false)
          setStreamingContent('')
          streamContentRef.current = ''
        },
        onError: (err) => {
          setError(err)
          setIsStreaming(false)
          setStreamingContent('')
          streamContentRef.current = ''
        },
      })

      // Build stream params
      const profile = window.api ? await window.api.getProfile() : null

      await window.api.sendChatMessage({
        conversationId: conv.id,
        messages: conv.messages,
        systemPrompt: settings.systemPrompt || undefined,
        profile,
      })
    },
    [
      activeConversationId,
      findConversation,
      isStreaming,
      updateConversationInState,
      persistConversation,
      subscribe,
      settings.systemPrompt,
    ],
  )

  const abortStream = useCallback(() => {
    if (window.api) {
      window.api.abortChat()
    }
    setIsStreaming(false)
    setStreamingContent('')
    streamContentRef.current = ''
  }, [])

  const deleteConversation = useCallback(
    async (id: string) => {
      if (window.api) await window.api.deleteConversation(id)
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeConversationId === id) {
        setActiveConversationId(null)
      }
    },
    [activeConversationId],
  )

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      if (window.api) await window.api.renameConversation(id, title)
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c)),
      )
    },
    [],
  )

  const archiveConversation = useCallback(
    async (id: string) => {
      if (window.api) await window.api.archiveConversation(id)
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, archived: true } : c)),
      )
      if (activeConversationId === id) {
        setActiveConversationId(null)
      }
    },
    [activeConversationId],
  )

  const regenerateLastMessage = useCallback(async () => {
    const conv = findConversation(activeConversationId)
    if (!conv || conv.messages.length < 2) return

    const msgs = conv.messages.slice(0, -1)
    const updatedConv = { ...conv, messages: msgs, updatedAt: Date.now() }
    updateConversationInState(updatedConv)
    await persistConversation(updatedConv)

    setError(null)
    setIsStreaming(true)
    streamContentRef.current = ''

    subscribe({
      onToken: (token) => {
        streamContentRef.current += token
        setStreamingContent(streamContentRef.current)
      },
      onDone: async () => {
        const fullContent = streamContentRef.current
        if (fullContent) {
          const assistantMsg = createAssistantMessage(fullContent)
          const finalConv = {
            ...updatedConv,
            messages: [...updatedConv.messages, assistantMsg],
            updatedAt: Date.now(),
          }
          updateConversationInState(finalConv)
          await persistConversation(finalConv)
        }
        setIsStreaming(false)
        setStreamingContent('')
        streamContentRef.current = ''
      },
      onError: (err) => {
        setError(err)
        setIsStreaming(false)
        setStreamingContent('')
        streamContentRef.current = ''
      },
    })

    const profile = window.api ? await window.api.getProfile() : null

    await window.api.sendChatMessage({
      conversationId: conv.id,
      messages: updatedConv.messages,
      systemPrompt: settings.systemPrompt || undefined,
      profile,
    })
  }, [
    activeConversationId,
    findConversation,
    updateConversationInState,
    persistConversation,
    subscribe,
    settings.systemPrompt,
  ])

  return (
      <ChatContext.Provider
        value={{
          conversations,
          activeConversationId,
          activeConversation,
          isStreaming,
          streamingContent,
          error,
          showArchived,
          setShowArchived,
          newConversation,
          selectConversation,
          sendMessage,
          abortStream,
          deleteConversation,
          renameConversation,
          archiveConversation,
          regenerateLastMessage,
        }}
      >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}
