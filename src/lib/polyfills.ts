// Clerk calls document.hasFocus() internally — not available in React Native.
if (typeof document === 'undefined') {
  ;(global as unknown as Record<string, unknown>).document = { hasFocus: () => true }
} else if (typeof (document as unknown as Record<string, unknown>).hasFocus !== 'function') {
  ;(document as unknown as Record<string, unknown>).hasFocus = () => true
}

// Clerk uses CustomEvent internally — not available in React Native.
if (typeof CustomEvent === 'undefined') {
  ;(global as unknown as Record<string, unknown>).CustomEvent = class CustomEvent {
    type: string
    detail: unknown
    constructor(type: string, options?: { detail?: unknown }) {
      this.type = type
      this.detail = options?.detail ?? null
    }
  }
}
