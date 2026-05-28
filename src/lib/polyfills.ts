// Clerk calls document.hasFocus() and document.dispatchEvent() internally.
if (typeof document === 'undefined') {
  ;(global as any).document = { hasFocus: () => true, dispatchEvent: () => false }
} else {
  const doc = document as any
  if (typeof doc.hasFocus !== 'function') doc.hasFocus = () => true
  if (typeof doc.dispatchEvent !== 'function') doc.dispatchEvent = () => false
}

// Clerk fires `new CustomEvent(...)` during sign-out — not available in React Native.
if (typeof CustomEvent === 'undefined') {
  ;(global as any).CustomEvent = class CustomEvent {
    type: string
    detail: any
    bubbles: boolean
    cancelable: boolean
    constructor(type: string, params: { detail?: any; bubbles?: boolean; cancelable?: boolean } = {}) {
      this.type = type
      this.detail = params.detail ?? null
      this.bubbles = params.bubbles ?? false
      this.cancelable = params.cancelable ?? false
    }
    stopPropagation() {}
    stopImmediatePropagation() {}
    preventDefault() {}
  }
}

