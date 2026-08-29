import { useCallback, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

import {
  ApiRequestError,
  NETWORK_ERROR_MESSAGE,
  createTodo,
  deleteTodo as requestDelete,
  listTodos,
  updateTodo,
} from '../api/client'
import { DESCRIPTION_MAX_LENGTH, type Todo } from '../api/types'

export type BoardTodo = Todo & { pending?: boolean }

export interface UseTodos {
  active: BoardTodo[]
  completed: BoardTodo[]
  loading: boolean
  error: string | null
  addTodo: (description: string) => Promise<boolean>
  toggleTodo: (id: string) => Promise<void>
  deleteTodo: (id: string) => Promise<void>
}

let tempCounter = 0

function nextTempId(): string {
  tempCounter += 1
  return `pending-${tempCounter}`
}

function messageOf(caught: unknown): string {
  return caught instanceof ApiRequestError ? caught.message : NETWORK_ERROR_MESSAGE
}

export function useTodos(): UseTodos {
  const [todos, setTodos] = useState<BoardTodo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    listTodos()
      .then((loaded) => {
        if (active) {
          setTodos((current) => [...current.filter((row) => row.pending), ...loaded])
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(messageOf(caught))
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [])

  const addTodo = useCallback(async (description: string): Promise<boolean> => {
    const trimmed = description.trim()
    // The server counts code points, so the client must not count UTF-16 code units.
    const length = [...trimmed].length
    if (length < 1 || length > DESCRIPTION_MAX_LENGTH) {
      return false
    }

    const tempId = nextTempId()
    setTodos((current) => [
      {
        id: tempId,
        description: trimmed,
        completed: false,
        createdAt: new Date().toISOString(),
        pending: true,
      },
      ...current,
    ])

    try {
      const saved = await createTodo(trimmed)
      setTodos((current) => current.map((row) => (row.id === tempId ? saved : row)))
      setError(null)
      return true
    } catch (caught: unknown) {
      setTodos((current) => current.filter((row) => row.id !== tempId))
      setError(messageOf(caught))
      return false
    }
  }, [])

  const toggleTodo = useCallback(async (id: string): Promise<void> => {
    let before: boolean | undefined
    // flushSync so the row is read from the live list inside the updater, never from a snapshot.
    flushSync(() => {
      setTodos((current) =>
        current.map((row) => {
          if (row.id !== id || row.pending) {
            return row
          }
          before = row.completed
          return { ...row, completed: !row.completed }
        }),
      )
    })

    if (before === undefined) {
      return
    }

    const previous = before
    try {
      await updateTodo(id, !previous)
      setError(null)
    } catch (caught: unknown) {
      setTodos((current) =>
        current.map((row) => (row.id === id ? { ...row, completed: previous } : row)),
      )
      setError(messageOf(caught))
    }
  }, [])

  const deleteTodo = useCallback(async (id: string): Promise<void> => {
    let index = -1
    let removed: BoardTodo | undefined
    // flushSync so the row is read from the live list inside the updater, never from a snapshot.
    flushSync(() => {
      setTodos((current) => {
        const found = current.findIndex((row) => row.id === id)
        if (found === -1 || current[found]?.pending) {
          return current
        }
        index = found
        removed = current[found]
        return [...current.slice(0, found), ...current.slice(found + 1)]
      })
    })

    if (removed === undefined) {
      return
    }

    const restored = removed
    const at = index
    try {
      await requestDelete(id)
      setError(null)
    } catch (caught: unknown) {
      setTodos((current) => [...current.slice(0, at), restored, ...current.slice(at)])
      setError(messageOf(caught))
    }
  }, [])

  return {
    active: todos.filter((todo) => !todo.completed),
    completed: todos.filter((todo) => todo.completed),
    loading,
    error,
    addTodo,
    toggleTodo,
    deleteTodo,
  }
}
