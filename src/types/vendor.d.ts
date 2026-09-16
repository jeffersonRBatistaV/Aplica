declare module 'turndown' {
  interface TurndownServiceOptions {
    headingStyle?: 'setext' | 'atx'
    hr?: string
    bulletListMarker?: string | '-'
    codeBlockStyle?: 'indented' | 'fenced'
    fence?: string
    emDelimiter?: string | '_'
    strongDelimiter?: string | '**'
    linkStyle?: 'inlined' | 'referenced'
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut'
    preformattedCode?: boolean
  }
  class TurndownService {
    constructor(options?: TurndownServiceOptions)
    turndown(html: string | HTMLElement): string
    addRule(key: string, rule: Record<string, unknown>): this
    keep(filter: string | string[] | ((node: HTMLElement) => boolean)): this
    remove(filter: string | string[] | ((node: HTMLElement) => boolean)): this
    use(plugin: ((service: TurndownService) => void) | Record<string, unknown>[]): this
  }
  export = TurndownService
}

declare module 'turndown-plugin-gfm' {
  export function gfm(service: unknown): void
  export function strikethrough(service: unknown): void
  export function tables(service: unknown): void
  export function taskListItems(service: unknown): void
}