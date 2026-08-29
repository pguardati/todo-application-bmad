export const DESCRIPTION_MAX_LENGTH = 200

export interface Todo {
  id: string
  description: string
  completed: boolean
  createdAt: string
}

export interface ApiError {
  error: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'INTERNAL_ERROR'
  message: string
}
