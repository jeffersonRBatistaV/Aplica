import { Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ComponentProps } from 'react'
import { CodeBlock } from './CodeBlock'

type CodeProps = ComponentProps<'code'> & { className?: string; inline?: boolean }

interface StreamingMessageProps {
  content: string
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  const hasContent = content.length > 0

  return (
    <div className="flex gap-3 group">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
        <Bot className="w-4 h-4 text-gray-600 dark:text-gray-300" />
      </div>

      <div className="max-w-[75%] min-w-0 flex flex-col items-start">
        <div className="rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md border border-gray-200 dark:border-gray-700">
          {hasContent ? (
            <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:p-0">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }: CodeProps) {
                    const match = /language-(\w+)/.exec(className || '')
                    const codeStr = String(children).replace(/\n$/, '')
                    if (match) {
                      return (
                        <CodeBlock
                          code={codeStr}
                          language={match[1]}
                        />
                      )
                    }
                    return (
                      <code
                        className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          )}
        </div>

        {hasContent && (
          <span className="inline-block w-2 h-4 ml-1 mt-1 bg-blue-500 dark:bg-blue-400 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  )
}
