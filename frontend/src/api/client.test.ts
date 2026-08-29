import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiRequestError, NETWORK_ERROR_MESSAGE, request } from './client'

function stubFetch(implementation: typeof fetch) {
  vi.stubGlobal('fetch', vi.fn(implementation))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('request', () => {
  it('prefixes the path with /api and parses the JSON body', async () => {
    stubFetch(async () => new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))

    await expect(request<{ status: string }>('/health')).resolves.toEqual({ status: 'ok' })
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({ headers: expect.anything() }))
  })

  it('returns undefined for a 204 response', async () => {
    stubFetch(async () => new Response(null, { status: 204 }))

    await expect(request<void>('/todos/1')).resolves.toBeUndefined()
  })

  it('raises the server message and code for an error envelope', async () => {
    stubFetch(
      async () =>
        new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'Todo not found' }), {
          status: 404,
        }),
    )

    await expect(request('/todos/missing')).rejects.toMatchObject({
      message: 'Todo not found',
      code: 'NOT_FOUND',
    })
  })

  it('raises the single local fallback message when there is no response', async () => {
    stubFetch(async () => {
      throw new TypeError('offline')
    })

    const error = await request('/health').catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect((error as ApiRequestError).message).toBe(NETWORK_ERROR_MESSAGE)
    expect((error as ApiRequestError).code).toBe('NETWORK_ERROR')
  })
})
