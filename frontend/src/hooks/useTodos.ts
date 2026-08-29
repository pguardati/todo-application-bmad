import { useCallback, useEffect, useState } from 'react'

import { ApiRequestError, NETWORK_ERROR_MESSAGE, createTodo, listTodos } from '../api/client'
import { DESCRIPTION_MAX_LENGTH, type Todo } from '../api/types'

export type BoardTodo = Todo & { pending?: boolean }

export interface UseTodos {
  active: BoardTodo[]
  completed: BoardTodo[]
  loading: boolean
  error: string | null
  addTodo: (description: string) => Promise<boolean>
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
          setTodos(loaded)
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
    if (trimmed.length < 1 || trimmed.length > DESCRIPTION_MAX_LENGTH) {
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

  return {
    active: todos.filter((todo) => !todo.completed),
    completed: todos.filter((todo) => todo.completed),
    loading,
    error,
    addTodo,
  }
}
