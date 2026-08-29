import { useState } from 'react'

import type { Todo } from '../api/types'

export interface UseTodos {
  active: Todo[]
  completed: Todo[]
  loading: boolean
  error: string | null
}

export function useTodos(): UseTodos {
  const [todos] = useState<Todo[]>([])
  const [loading] = useState(false)
  const [error] = useState<string | null>(null)

  return {
    active: todos.filter((todo) => !todo.completed),
    completed: todos.filter((todo) => todo.completed),
    loading,
    error,
  }
}
