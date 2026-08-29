import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from './App'
import { ApiRequestError, createTodo, listTodos } from './api/client'
import { DESCRIPTION_MAX_LENGTH, type Todo } from './api/types'
import TodoColumn from './components/TodoColumn'

vi.mock('./api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/client')>()),
  listTodos: vi.fn(),
  createTodo: vi.fn(),
}))

const rows: Todo[] = [
  { id: 'c', description: 'Fix the auth bug', completed: false, createdAt: '2026-08-29T09:00:00Z' },
  { id: 'b', description: 'Morning standup', completed: true, createdAt: '2026-08-28T09:00:00Z' },
  { id: 'a', description: 'Buy groceries', completed: false, createdAt: '2026-08-27T09:00:00Z' },
]

beforeEach(() => {
  vi.mocked(listTodos).mockReset()
  vi.mocked(createTodo).mockReset()
})

const saved = (description: string): Todo => ({
  id: `server-${description}`,
  description,
  completed: false,
  createdAt: '2026-08-30T09:00:00Z',
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

describe('adding a todo', () => {
  it('submits on Enter and on the + button, sending only the trimmed description', async () => {
    const user = userEvent.setup()
    vi.mocked(listTodos).mockResolvedValue(rows)
    vi.mocked(createTodo).mockImplementation((description) => Promise.resolve(saved(description)))

    render(<App />)
    await screen.findByRole('list', { name: 'TODO' })
    const input = screen.getByRole('textbox', { name: 'New todo' })

    await user.type(input, '  Water the plants  {Enter}')
    await waitFor(() => expect(input).toHaveValue(''))

    await user.type(input, 'Call the bank')
    await user.click(screen.getByRole('button', { name: 'Add todo' }))
    await waitFor(() => expect(input).toHaveValue(''))

    const atTheLimit = 'x'.repeat(DESCRIPTION_MAX_LENGTH)
    await user.click(input)
    await user.paste(atTheLimit)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(input).toHaveValue(''))

    expect(vi.mocked(createTodo).mock.calls).toEqual([
      ['Water the plants'],
      ['Call the bank'],
      [atTheLimit],
    ])
  })

  it('shows the row at the top of TODO with its controls disabled before confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(listTodos).mockResolvedValue(rows)
    vi.mocked(createTodo).mockReturnValue(new Promise<Todo>(() => {}))

    render(<App />)
    await screen.findByRole('list', { name: 'TODO' })

    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Water the plants{Enter}')

    const todo = screen.getByRole('list', { name: 'TODO' })
    const items = within(todo).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Water the plants')
    const [pendingRow, confirmedRow] = items as [HTMLElement, HTMLElement, HTMLElement]
    expect(within(pendingRow).getByRole('checkbox')).toBeDisabled()
    expect(within(pendingRow).getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(within(confirmedRow).getByRole('checkbox')).toBeEnabled()
  })

  it('replaces the optimistic row with the server row instead of duplicating it', async () => {
    const user = userEvent.setup()
    vi.mocked(listTodos).mockResolvedValue(rows)
    vi.mocked(createTodo).mockResolvedValue(saved('Water the plants'))

    render(<App />)
    await screen.findByRole('list', { name: 'TODO' })

    await user.type(screen.getByRole('textbox', { name: 'New todo' }), 'Water the plants{Enter}')

    await waitFor(() =>
      expect(
        within(screen.getByRole('list', { name: 'TODO' })).getAllByRole('checkbox', {
          name: 'Mark complete',
        })[0],
      ).toBeEnabled(),
    )
    const items = within(screen.getByRole('list', { name: 'TODO' })).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Water the plants')
    expect(screen.getAllByText('Water the plants')).toHaveLength(1)
  })

  it('rejects empty and over-long input in the client without calling the API', async () => {
    const user = userEvent.setup()
    vi.mocked(listTodos).mockResolvedValue(rows)

    render(<App />)
    await screen.findByRole('list', { name: 'TODO' })
    const input = screen.getByRole('textbox', { name: 'New todo' })

    await user.type(input, '   {Enter}')
    await user.click(screen.getByRole('button', { name: 'Add todo' }))

    const tooLong = 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1)
    await user.clear(input)
    await user.type(input, `${tooLong}{Enter}`)

    expect(createTodo).not.toHaveBeenCalled()
    expect(input).toHaveValue(tooLong)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(screen.getByRole('list', { name: 'TODO' })).getAllByRole('listitem')).toHaveLength(
      2,
    )
  })

  it('rolls back only the failed row, keeps the typed text and surfaces the message', async () => {
    const user = userEvent.setup()
    vi.mocked(listTodos).mockResolvedValue(rows)
    vi.mocked(createTodo).mockRejectedValue(new ApiRequestError('Invalid request.', 'VALIDATION_ERROR'))

    render(<App />)
    await screen.findByRole('list', { name: 'TODO' })
    const input = screen.getByRole('textbox', { name: 'New todo' })

    await user.type(input, 'Water the plants{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid request.')
    const items = within(screen.getByRole('list', { name: 'TODO' })).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual(['Fix the auth bug×', 'Buy groceries×'])
    expect(within(screen.getByRole('list', { name: 'DONE' })).getAllByRole('listitem')).toHaveLength(
      1,
    )
    expect(input).toHaveValue('Water the plants')

    vi.mocked(createTodo).mockResolvedValue(saved('Water the plants'))
    await user.type(input, '{Enter}')

    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(input).toHaveValue('')
  })
})
