import { useEffect, useState } from 'react'

import { ApiRequestError, NETWORK_ERROR_MESSAGE, listTodos } from '../api/client'
import type { Todo } from '../api/types'

export interface UseTodos {
  active: Todo[]
  completed: Todo[]
  loading: boolean
  error: string | null
}

export function useTodos(): UseTodos {
  const [todos, setTodos] = useState<Todo[]>([])
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
          setError(caught instanceof ApiRequestError ? caught.message : NETWORK_ERROR_MESSAGE)
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

  return {
    active: todos.filter((todo) => !todo.completed),
    completed: todos.filter((todo) => todo.completed),
    loading,
    error,
  }
}
