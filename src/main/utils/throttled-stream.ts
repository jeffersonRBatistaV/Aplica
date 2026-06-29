import { BrowserWindow } from 'electron'

export class ThrottledStream {
  private buffer: string[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private readonly interval: number
  private readonly window: BrowserWindow

  constructor(window: BrowserWindow, intervalMs = 40) {
    this.window = window
    this.interval = intervalMs
  }

  push(token: string): void {
    this.buffer.push(token)
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.interval)
    }
  }

  private flush(): void {
    if (this.buffer.length > 0) {
      const chunk = this.buffer.join('')
      this.buffer = []
      this.window.webContents.send('llm:token', chunk)
    }
    this.timer = null
  }

  done(): void {
    this.flush()
    this.window.webContents.send('llm:done')
  }

  error(message: string): void {
    this.flush()
    this.window.webContents.send('llm:error', message)
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.buffer = []
  }
}
