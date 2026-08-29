import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { ApiRequestError, listTodos } from './api/client'
import type { Todo } from './api/types'
import TodoColumn from './components/TodoColumn'

vi.mock('./api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/client')>()),
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

describe('App', () => {
  it('shows a loading indicator before the fetch resolves, never a blank page', async () => {
    let resolve: (todos: Todo[]) => void = () => {}
    vi.mocked(listTodos).mockReturnValue(
      new Promise<Todo[]>((settle) => {
        resolve = settle
      }),
    )

    render(<App />)

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Loading')
    expect(screen.getByRole('button', { name: 'Add todo' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'New todo' })).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)

    resolve(rows)

    await waitFor(() => expect(screen.getByRole('heading', { name: 'TODO' })).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'DONE' })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('renders a completed row with strikethrough styling and the checked accessible state', async () => {
    vi.mocked(listTodos).mockResolvedValue(rows)

    render(<App />)

    const done = await screen.findByRole('list', { name: 'DONE' })
    const row = within(done).getByRole('listitem')
    const checkbox = within(row).getByRole('checkbox', { name: 'Mark incomplete' })

    expect(row).toHaveClass('row', 'done')
    expect(checkbox).toBeChecked()
    expect(within(row).getByText('Morning standup')).toHaveClass('label')

    const todo = screen.getByRole('list', { name: 'TODO' })
    expect(within(todo).getAllByRole('listitem')).toHaveLength(2)
    expect(within(todo).getAllByRole('checkbox', { name: 'Mark complete' })).toHaveLength(2)
  })

  it('surfaces a failed load as an alert without blanking the board', async () => {
    vi.mocked(listTodos).mockRejectedValue(new ApiRequestError('Internal server error', 'INTERNAL_ERROR'))

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Internal server error')
    expect(screen.getByRole('heading', { name: 'TODO' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'DONE' })).toBeInTheDocument()
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})

describe('TodoColumn', () => {
  it('renders exactly the todos it is given, in order, without re-filtering or re-sorting', () => {
    render(<TodoColumn id="mixed-label" label="MIXED" todos={rows} />)

    const items = screen.getAllByRole('listitem')

    expect(items.map((item) => item.textContent)).toEqual([
      'Fix the auth bug×',
      'Morning standup×',
      'Buy groceries×',
    ])
    expect(listTodos).not.toHaveBeenCalled()
  })
})
