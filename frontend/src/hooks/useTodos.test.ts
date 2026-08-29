import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiRequestError, listTodos } from '../api/client'
import type { Todo } from '../api/types'
import { useTodos } from './useTodos'

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  listTodos: vi.fn(),
}))

const rows: Todo[] = [
  { id: 'c', description: 'Fix the auth bug', completed: false, createdAt: '2026-08-29T09:00:00Z' },
  { id: 'b', description: 'Morning standup', completed: true, createdAt: '2026-08-28T09:00:00Z' },
  { id: 'a', description: 'Buy groceries', completed: false, createdAt: '2026-08-27T09:00:00Z' },
]

beforeEach(() => {
  vi.mocked(listTodos).mockReset()
})

describe('useTodos', () => {
  it('reports loading, then exposes the list already partitioned in server order', async () => {
    vi.mocked(listTodos).mockResolvedValue(rows)

    const { result } = renderHook(() => useTodos())

    expect(result.current.loading).toBe(true)
    expect(result.current.active).toEqual([])
    expect(result.current.completed).toEqual([])

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.active.map((todo) => todo.id)).toEqual(['c', 'a'])
    expect(result.current.completed.map((todo) => todo.id)).toEqual(['b'])
    expect(result.current.error).toBeNull()
  })

  it('surfaces the server message and stops loading when the fetch fails', async () => {
    vi.mocked(listTodos).mockRejectedValue(new ApiRequestError('Internal server error', 'INTERNAL_ERROR'))

    const { result } = renderHook(() => useTodos())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('Internal server error')
    expect(result.current.active).toEqual([])
    expect(result.current.completed).toEqual([])
  })
})
