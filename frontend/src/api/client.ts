import type { ApiError } from './types'

export const NETWORK_ERROR_MESSAGE = 'Could not reach the server. Please try again.'

export class ApiRequestError extends Error {
  readonly code: ApiError['error'] | 'NETWORK_ERROR'

  constructor(message: string, code: ApiError['error'] | 'NETWORK_ERROR') {
    super(message)
    this.name = 'ApiRequestError'
    this.code = code
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiRequestError(NETWORK_ERROR_MESSAGE, 'NETWORK_ERROR')
  }

  if (!response.ok) {
    const body = (await response.json()) as ApiError
    throw new ApiRequestError(body.message, body.error)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
