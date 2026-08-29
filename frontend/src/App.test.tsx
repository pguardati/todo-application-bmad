import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from './App'

describe('App shell', () => {
  it('renders the add bar and both column labels', () => {
    render(<App />)

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add todo' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'New todo' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'TODO' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'DONE' })).toBeInTheDocument()
  })

  it('renders no todo rows yet', () => {
    render(<App />)

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
