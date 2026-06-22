// A dedup key for money-moving requests (tips). Uniqueness — not
// unguessability — is what matters: the server uses it only to collapse a
// retried/duplicated request into the original charge (see Tip.idempotencyKey).
// Avoids a crypto dependency that isn't guaranteed under Hermes.
export function newIdempotencyKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}
