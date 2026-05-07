export function clerkError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'errors' in err) {
    const { errors } = err as { errors?: Array<{ longMessage?: string; message?: string }> }
    if (errors?.[0]) return errors[0].longMessage ?? errors[0].message ?? fallback
  }
  return err instanceof Error ? err.message : fallback
}
