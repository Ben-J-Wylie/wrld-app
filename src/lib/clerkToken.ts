type TokenGetter = (options?: { template?: string }) => Promise<string | null>

let _getToken: TokenGetter | null = null

export function setClerkTokenGetter(fn: TokenGetter) {
  _getToken = fn
}

export function getClerkToken(): Promise<string | null> {
  return _getToken ? _getToken() : Promise.resolve(null)
}
