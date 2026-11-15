/**
 * Scripts que se ejecutan DENTRO de la pagina web (no tienen acceso a Node ni a
 * los imports de la app). Se serializan con Function.prototype.toString y por
 * eso no deben referenciar nada fuera de su propio cuerpo.
 */

function inspectPageInFrame(frameIndex: number): any {
  const MAX_FIELDS = 200
  const MAX_BUTTONS = 80
  const fields: any[] = []
  const buttons: any[] = []
  const seenFields = new Set<Element>()
  const seenButtons = new Set<Element>()
  let fieldCounter = 0
  let buttonCounter = 0

  function norm(value: string | null | undefined): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_\-[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300)
  }

  function textOf(el: Element | null): string {
    if (!el) return ''
    const text = (el as HTMLElement).innerText || el.textContent || ''
    return text.trim().replace(/\s+/g, ' ').slice(0, 300)
  }

  function isVisible(el: Element): boolean {
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (style.opacity === '0') return false
    const rect = (el as HTMLElement).getBoundingClientRect()
    return rect.width > 1 && rect.height > 1
  }

  function labelFor(el: Element, root: Document | ShadowRoot): string {
    const parts: string[] = []
    const id = el.getAttribute('id')
    if (id) {
      try {
        const label = root.querySelector('label[for="' + CSS.escape(id) + '"]')
        if (label) parts.push(textOf(label))
      } catch {
        // selector invalido: se ignora
      }
    }
    const closest = el.closest('label')
    if (closest) parts.push(textOf(closest))

    const ariaLabel = el.getAttribute('aria-label')
    if (ariaLabel) parts.push(ariaLabel)
    const labelledBy = el.getAttribute('aria-labelledby')
    if (labelledBy) {
      for (const ref of labelledBy.split(/\s+/)) {
        const node = (root as any).getElementById ? (root as any).getElementById(ref) : document.getElementById(ref)
        if (node) parts.push(textOf(node))
      }
    }
    const placeholder = el.getAttribute('placeholder')
    if (placeholder) parts.push(placeholder)
    const name = el.getAttribute('name')
    if (name) parts.push(name.replace(/[_\-[\]]+/g, ' '))

    return Array.from(new Set(parts.filter(Boolean))).join(' | ').slice(0, 300)
  }

  function kindOf(el: Element): string {
    const tag = el.tagName.toLowerCase()
    if (tag === 'textarea') return 'textarea'
    if (tag === 'select') return 'select'
    if (tag === 'input') return 'input'
    if ((el as HTMLElement).isContentEditable) return 'contenteditable'
    return 'other'
  }

  function signatureOf(el: Element, kind: string): string {
    const name = norm(el.getAttribute('name'))
    const id = norm(el.getAttribute('id'))
    const auto = norm(el.getAttribute('autocomplete'))
    const label = norm(labelFor(el, document))
    const base = name || id || auto || label || 'unnamed'
    return (kind + ':' + (el.getAttribute('type') || '') + ':' + base).slice(0, 300)
  }

  const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'password'])

  function walk(root: Document | ShadowRoot): void {
    if (fields.length >= MAX_FIELDS) return
    const candidates = root.querySelectorAll(
      'input, textarea, select, [contenteditable="true"], [contenteditable=""]',
    )
    for (const el of Array.from(candidates)) {
      if (fields.length >= MAX_FIELDS) break
      if (seenFields.has(el)) continue
      seenFields.add(el)

      const tag = el.tagName.toLowerCase()
      const type = (el.getAttribute('type') || (tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : 'text')).toLowerCase()
      if (tag === 'input' && SKIP_INPUT_TYPES.has(type)) continue

      const id = 'f' + frameIndex + '-' + fieldCounter++
      el.setAttribute('data-aplica-field', id)
      const options = tag === 'select'
        ? Array.from((el as HTMLSelectElement).options).slice(0, 200).map((o) => ({
            value: o.value,
            label: (o.textContent || '').trim().slice(0, 200),
          }))
        : []

      fields.push({
        id,
        frameIndex,
        kind: kindOf(el),
        type,
        name: el.getAttribute('name') || '',
        idAttr: el.getAttribute('id') || '',
        label: labelFor(el, root),
        placeholder: el.getAttribute('placeholder') || '',
        autocomplete: el.getAttribute('autocomplete') || '',
        required: el.hasAttribute('required') || el.getAttribute('aria-required') === 'true',
        disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
        readonly: el.hasAttribute('readonly') || (el as any).readOnly === true,
        value: tag === 'select' ? String((el as any).value || '') : String((el as any).value || ''),
        checked: (el as any).checked === true,
        visible: isVisible(el),
        options,
        accept: el.getAttribute('accept') || '',
        multiple: el.hasAttribute('multiple'),
        signature: signatureOf(el, kindOf(el)),
      })

      const shadow = (el as HTMLElement).shadowRoot
      if (shadow) walk(shadow)
    }

    if (buttons.length < MAX_BUTTONS) {
      const buttonCandidates = root.querySelectorAll(
        'button, input[type="submit"], input[type="button"], a[role="button"], [role="button"], a[href]',
      )
      for (const el of Array.from(buttonCandidates)) {
        if (buttons.length >= MAX_BUTTONS) break
        if (seenButtons.has(el)) continue
        seenButtons.add(el)
        const text = (el.getAttribute('aria-label') || (el as any).value || textOf(el)).trim()
        if (!text) continue
        const id = 'b' + frameIndex + '-' + buttonCounter++
        el.setAttribute('data-aplica-button', id)
        buttons.push({
          id,
          text: text.slice(0, 200),
          type: (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase(),
          disabled: el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true',
          visible: isVisible(el),
        })
      }
    }

    const allHosts = root.querySelectorAll('*')
    for (const host of Array.from(allHosts)) {
      const shadow = (host as HTMLElement).shadowRoot
      if (shadow) walk(shadow)
    }
  }

  walk(document)

  let pageText = ''
  if (frameIndex === 0 && document.body) {
    pageText = String((document.body as HTMLElement).innerText || '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 20000)
  }

  return {
    url: location.href,
    title: document.title || '',
    text: pageText,
    fields,
    buttons,
    frames: frameIndex === 0 ? 1 : 0,
  }
}

function fillPageInFrame(frameIndex: number, entries: any[], highlight: boolean): any[] {
  function deepFind(id: string): Element | null {
    function search(root: Document | ShadowRoot): Element | null {
      const found = root.querySelector('[data-aplica-field="' + CSS.escape(id) + '"]')
      if (found) return found
      const all = root.querySelectorAll('*')
      for (const el of Array.from(all)) {
        const shadow = (el as HTMLElement).shadowRoot
        if (!shadow) continue
        const nested = search(shadow)
        if (nested) return nested
      }
      return null
    }
    return search(document)
  }

  function setNativeValue(el: Element, value: string): void {
    const tag = el.tagName.toLowerCase()
    const prototype = tag === 'textarea'
      ? HTMLTextAreaElement.prototype
      : tag === 'select'
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value)
    } else {
      ;(el as any).value = value
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }

  const results: any[] = []
  const untypedWindow = window as any
  if (!untypedWindow.__aplicaUndo) untypedWindow.__aplicaUndo = {}

  for (const entry of entries || []) {
    const id = String(entry.id || '')
    if (!id.startsWith('f' + frameIndex + '-')) continue
    const el = deepFind(id)
    if (!el) {
      results.push({ id, status: 'error', message: 'not-found' })
      continue
    }

    const tag = el.tagName.toLowerCase()
    const type = (el.getAttribute('type') || '').toLowerCase()
    if ((el as any).disabled || ((el as any).readOnly && tag !== 'select')) {
      results.push({ id, status: 'skipped', message: 'disabled' })
      continue
    }

    const previous = tag === 'select' || tag === 'input' || tag === 'textarea'
      ? String((el as any).value ?? '')
      : String((el as HTMLElement).textContent ?? '')
    untypedWindow.__aplicaUndo[id] = { value: previous, checked: (el as any).checked === true }

    try {
      if ((el as HTMLElement).isContentEditable) {
        ;(el as HTMLElement).textContent = String(entry.value ?? '')
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
        el.dispatchEvent(new Event('blur', { bubbles: true }))
      } else if (type === 'checkbox' || type === 'radio') {
        ;(el as any).checked = /^(true|1|yes|si|sí|on)$/i.test(String(entry.value ?? ''))
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        setNativeValue(el, String(entry.value ?? ''))
      }

      if (highlight) {
        const styled = el as HTMLElement
        const previousOutline = styled.style.outline
        const previousOffset = styled.style.outlineOffset
        styled.style.outline = '2px solid #22c55e'
        styled.style.outlineOffset = '1px'
        setTimeout(() => {
          styled.style.outline = previousOutline
          styled.style.outlineOffset = previousOffset
        }, 2600)
      }

      results.push({ id, status: 'filled' })
    } catch (error) {
      results.push({ id, status: 'error', message: String(error) })
    }
  }

  return results
}

function undoPageInFrame(): number {
  function deepFind(id: string): Element | null {
    function search(root: Document | ShadowRoot): Element | null {
      const found = root.querySelector('[data-aplica-field="' + CSS.escape(id) + '"]')
      if (found) return found
      const all = root.querySelectorAll('*')
      for (const el of Array.from(all)) {
        const shadow = (el as HTMLElement).shadowRoot
        if (!shadow) continue
        const nested = search(shadow)
        if (nested) return nested
      }
      return null
    }
    return search(document)
  }

  function setNativeValue(el: Element, value: string): void {
    const tag = el.tagName.toLowerCase()
    const prototype = tag === 'textarea'
      ? HTMLTextAreaElement.prototype
      : tag === 'select'
        ? HTMLSelectElement.prototype
        : HTMLInputElement.prototype
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value)
    } else {
      ;(el as any).value = value
    }
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    el.dispatchEvent(new Event('blur', { bubbles: true }))
  }

  const untypedWindow = window as any
  const undo = untypedWindow.__aplicaUndo
  if (!undo || typeof undo !== 'object') return 0
  let restored = 0
  for (const id of Object.keys(undo)) {
    const el = deepFind(id)
    const previous = undo[id]
    if (!el || !previous) continue
    try {
      const tag = el.tagName.toLowerCase()
      if (tag === 'select' || tag === 'input' || tag === 'textarea') {
        setNativeValue(el, String(previous.value ?? ''))
        if ((el as any).type === 'checkbox' || (el as any).type === 'radio') {
          ;(el as any).checked = previous.checked === true
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      } else if ((el as HTMLElement).isContentEditable) {
        ;(el as HTMLElement).textContent = String(previous.value ?? '')
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      restored++
    } catch {
      // se continua con el resto
    }
  }
  untypedWindow.__aplicaUndo = {}
  return restored
}

function clickPageInFrame(frameIndex: number, target: any): any {
  function deepFind(fieldId: string): Element | null {
    function search(root: Document | ShadowRoot): Element | null {
      const found = root.querySelector('[data-aplica-field="' + CSS.escape(fieldId) + '"]')
      if (found) return found
      const all = root.querySelectorAll('*')
      for (const el of Array.from(all)) {
        const shadow = (el as HTMLElement).shadowRoot
        if (!shadow) continue
        const nested = search(shadow)
        if (nested) return nested
      }
      return null
    }
    return search(document)
  }

  const id = typeof target?.id === 'string' ? target.id : ''
  const text = typeof target?.text === 'string' ? target.text : ''

  function norm(value: string): string {
    return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
  }

  function click(el: Element): any {
    if ((el as any).disabled) return { ok: false, message: 'disabled' }
    ;(el as HTMLElement).scrollIntoView({ block: 'center', inline: 'center' })
    ;(el as HTMLElement).click()
    return { ok: true, text: ((el as HTMLElement).innerText || (el as any).value || '').trim().slice(0, 200) }
  }

  if (id) {
    if (!id.startsWith('f' + frameIndex + '-') && !id.startsWith('b' + frameIndex + '-')) return null
    const el = deepFind(id) || document.querySelector('[data-aplica-button="' + CSS.escape(id) + '"]')
    if (!el) return { ok: false, message: 'not-found' }
    return click(el)
  }

  if (text) {
    const wanted = norm(text)
    const candidates = document.querySelectorAll(
      'button, input[type="submit"], input[type="button"], a[role="button"], [role="button"], a[href]',
    )
    let partial: Element | null = null
    for (const el of Array.from(candidates)) {
      const label = norm((el as any).value || (el as HTMLElement).innerText || el.textContent || '')
      if (!label) continue
      if (label === wanted) return click(el)
      if (!partial && (label.includes(wanted) || wanted.includes(label)) && label.length < 160) partial = el
    }
    if (partial) return click(partial)
    return { ok: false, message: 'not-found' }
  }

  return { ok: false, message: 'no-target' }
}

export function buildInspectScript(frameIndex: number): string {
  return `(${inspectPageInFrame.toString()})(${frameIndex})`
}

export function buildFillScript(frameIndex: number, entries: { id: string; value: string }[], highlight = true): string {
  return `(${fillPageInFrame.toString()})(${frameIndex}, ${JSON.stringify(entries)}, ${highlight ? 'true' : 'false'})`
}

export function buildUndoScript(): string {
  return `(${undoPageInFrame.toString()})()`
}

export function buildClickScript(frameIndex: number, target: { id?: string; text?: string }): string {
  return `(${clickPageInFrame.toString()})(${frameIndex}, ${JSON.stringify(target)})`
}
