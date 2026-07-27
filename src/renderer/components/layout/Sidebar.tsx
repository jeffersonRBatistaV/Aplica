import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  MessageSquare,
  Settings,
  Trash2,
  Archive,
  Pencil,
  Briefcase,
  MessageCircle,
  User,
  BarChart3,
  GraduationCap,
  Map,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { ApiConnectionIndicator } from './ApiConnectionIndicator'
import { useChat, useNavigation } from '../../contexts/AppContext'
import { useTutorial } from './TutorialGuide'
import { groupConversations, formatTime } from '../../lib/time'
import { useTranslation } from 'react-i18next'

function AplicaIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" className={className}>
      <defs>
        <linearGradient id="sidebar-icon-bg" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3B82F6"/>
          <stop offset="100%" stopColor="#6366F1"/>
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="48" fill="url(#sidebar-icon-bg)"/>
      <g stroke="white" strokeWidth="8" strokeLinecap="round">
        <line x1="128" y1="48" x2="128" y2="208"/>
        <line x1="48" y1="128" x2="208" y2="128"/>
        <line x1="72" y1="72" x2="184" y2="184"/>
        <line x1="184" y1="72" x2="72" y2="184"/>
      </g>
      <circle cx="128" cy="128" r="18" fill="white"/>
    </svg>
  )
}

interface SidebarProps {
  onOpenSettings: () => void
  onOpenProfile: () => void
}

export function Sidebar({ onOpenSettings, onOpenProfile }: SidebarProps) {
  const { t } = useTranslation()
  const { currentView, setCurrentView } = useNavigation()
  const {
    conversations,
    activeConversationId,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    showArchived,
    setShowArchived,
  } = useChat()

  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [confirmDeleteConversation, setConfirmDeleteConversation] = useState<string | null>(null)
  const startTutorial = useTutorial()

  // Keyboard shortcut: Cmd+N / Ctrl+N
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        newConversation()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [newConversation])

  const visible = showArchived ? conversations : conversations.filter((c) => !c.archived)

  const filtered = search
    ? visible.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.messages.some((m) => m.content.toLowerCase().includes(search.toLowerCase())),
      )
    : visible

  const grouped = groupConversations(filtered)

  const handleRenameStart = (id: string, currentTitle: string) => {
    setEditingId(id)
    setEditTitle(currentTitle)
    setContextMenuId(null)
  }

  const handleRenameConfirm = async (id: string) => {
    if (editTitle.trim()) {
      await renameConversation(id, editTitle.trim())
    }
    setEditingId(null)
  }

  return (
    <aside className="w-72 border-r flex-shrink-0 flex flex-col bg-gray-50 dark:bg-gray-900 h-full">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AplicaIcon className="w-5 h-5" />
            <h1 className="text-lg font-bold tracking-tight">Aplica</h1>
          </div>
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-1 mb-3">
          <button
            id="nav-jobs"
            onClick={() => setCurrentView('jobs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors justify-center ${
              currentView === 'jobs'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            Jobs
          </button>
          <button
            id="nav-stats"
            onClick={() => setCurrentView('analytics')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors justify-center ${
              currentView === 'analytics'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Stats
          </button>
          <button
            id="nav-roadmap"
            onClick={() => setCurrentView('roadmap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors justify-center ${
              currentView === 'roadmap'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            Roadmap
          </button>
          <button
            id="nav-chat"
            onClick={() => setCurrentView('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors justify-center ${
              currentView === 'chat'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Chat
          </button>
        </div>

        {/* Chat search (only in chat view) */}
        {currentView === 'chat' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{t('sidebar.conversations')}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={newConversation}
                title={t('sidebar.newChat')}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('sidebar.searchConversations')}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-shadow"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`mt-2 w-full flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                showArchived
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? t('sidebar.showingArchived') : t('sidebar.viewArchived')}
            </button>
            {search && (
              <p className="text-xs text-gray-400 mt-1.5 px-1">
                {t('sidebar.resultCount', { count: filtered.length })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Conversation list */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-1">
        {currentView === 'chat' && (
        grouped.size === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <MessageSquare className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-xs text-gray-400">
              {search ? t('sidebar.noSearchResults') : t('sidebar.noConversationsYet')}
            </p>
            {!search && (
              <Button
                variant="ghost"
                size="sm"
                onClick={newConversation}
                className="mt-3 text-blue-500"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('sidebar.createFirstConversation')}
              </Button>
            )}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([groupName, items]) => (
            <div key={groupName}>
              {/* Group header */}
              <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 border-b border-gray-200/50 dark:border-gray-800/50">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                  {groupName}
                </span>
              </div>

              {items.map((conv) => (
                <div key={conv.id} className="relative group px-1 py-0.5">
                  {editingId === conv.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={() => handleRenameConfirm(conv.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameConfirm(conv.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="w-full px-3 py-1.5 text-sm rounded-lg border-2 bg-white dark:bg-gray-800 border-blue-500 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      onClick={() => selectConversation(conv.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-start gap-2.5 ${
                        conv.id === activeConversationId
                          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm'
                          : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <MessageSquare className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">
                          {conv.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-gray-400">
                            {formatTime(conv.updatedAt)}
                          </span>
                          {conv.messages.length > 0 && (
                            <span className="text-[10px] text-gray-400">
                              · {conv.messages.length} msj
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Context menu trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setContextMenuId(
                            contextMenuId === conv.id ? null : conv.id,
                          )
                        }}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-700 transition-opacity flex-shrink-0 mt-0.5"
                        aria-label={t('sidebar.options')}
                      >
                        <span className="text-xs font-bold tracking-wider">···</span>
                      </button>
                    </button>
                  )}

                  {/* Context menu */}
                  {contextMenuId === conv.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setContextMenuId(null)}
                      />
                      <div className="absolute right-2 top-full mt-0.5 z-20 w-44 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        <button
                          onClick={() =>
                            handleRenameStart(conv.id, conv.title)
                          }
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {t('sidebar.rename')}
                        </button>
                        <button
                          onClick={async () => {
                            await archiveConversation(conv.id)
                            setContextMenuId(null)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          {t('sidebar.archive')}
                        </button>
                        <hr className="border-gray-200 dark:border-gray-700 my-1" />
                        <button
                          onClick={() => {
                            setConfirmDeleteConversation(conv.id)
                            setContextMenuId(null)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {t('sidebar.delete')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ))
        )
        )}
      </nav>

      {/* Footer */}
      <div id="sidebar-footer" className="p-2 border-t space-y-1">
          <Button id="btn-profile" variant="ghost" size="md" className="w-full justify-start" onClick={onOpenProfile}>
          <User className="w-4 h-4" />
          {t('sidebar.myProfile')}
        </Button>
        <Button id="btn-tutorial" variant="ghost" size="md" className="w-full justify-start" onClick={startTutorial}>
          <GraduationCap className="w-4 h-4" />
          {t('sidebar.tutorial')}
        </Button>
        <Button id="btn-settings" variant="ghost" size="md" className="w-full justify-start" onClick={onOpenSettings}>
          <Settings className="w-4 h-4" />
          {t('sidebar.settings')}
        </Button>
        <ApiConnectionIndicator />
      </div>

      <ConfirmDialog
        open={confirmDeleteConversation !== null}
        title={t('sidebar.deleteConversation')}
        message={t('sidebar.deleteConversationMessage')}
        confirmLabel={t('sidebar.confirmDelete')}
        onConfirm={async () => {
          if (confirmDeleteConversation) {
            await deleteConversation(confirmDeleteConversation)
            setConfirmDeleteConversation(null)
          }
        }}
        onCancel={() => setConfirmDeleteConversation(null)}
      />
    </aside>
  )
}
