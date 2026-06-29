// src/lib/passwordStrength.ts
//
// Shared password scoring + the signup minimum. Used by the SignupScreen meter
// and the anonymous AuthModal so the bar (and the gate) are identical on both
// signup paths. Clerk is the server-side authority (breach checks, its own
// policy); this is the client gate so a weak password can't be submitted.

export type StrengthScore = 0 | 1 | 2 | 3

export function scorePassword(p: string): StrengthScore {
  if (p.length === 0) return 0
  const hasLower = /[a-z]/.test(p)
  const hasUpper = /[A-Z]/.test(p)
  const hasNumber = /\d/.test(p)
  const hasSymbol = /[^a-zA-Z0-9]/.test(p)
  const classes = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  if (p.length < 8 || classes <= 1) return 1
  if (p.length >= 12 && classes >= 3) return 3
  return 2
}

// Minimum acceptable signup password: 8+ characters with at least two character
// types (score >= 2). Below this, signup is blocked client-side — so e.g.
// "11111111" (8 chars, one type) is rejected.
export function passwordMeetsMinimum(p: string): boolean {
  return scorePassword(p) >= 2
}
