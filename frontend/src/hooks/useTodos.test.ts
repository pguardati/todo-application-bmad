import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTodos } from './useTodos'

describe('useTodos', () => {
  it('starts with both partitions empty and no error', () => {
    const { result } = renderHook(() => useTodos())

    expect(result.current.active).toEqual([])
    expect(result.current.completed).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})
