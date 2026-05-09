// Clerk calls document.hasFocus() internally — not available in React Native.
if (typeof document === 'undefined') {
  ;(global as unknown as Record<string, unknown>).document = { hasFocus: () => true }
} else if (typeof (document as unknown as Record<string, unknown>).hasFocus !== 'function') {
  ;(document as unknown as Record<string, unknown>).hasFocus = () => true
}
