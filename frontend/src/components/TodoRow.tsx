import type { MouseEvent } from 'react'

import type { BoardTodo } from '../hooks/useTodos'

interface TodoRowProps {
  todo: BoardTodo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

// The row unmounts on click, so focus is handed to a neighbour before it leaves the DOM.
function moveFocusOut(button: HTMLButtonElement): void {
  const row = button.closest('li')
  const neighbour = row?.nextElementSibling ?? row?.previousElementSibling
  const next =
    neighbour?.querySelector<HTMLElement>('.btn-icon') ??
    document.querySelector<HTMLElement>('.add-bar input')
  next?.focus()
}

export default function TodoRow({ todo, onToggle, onDelete }: TodoRowProps) {
  const handleDelete = (event: MouseEvent<HTMLButtonElement>) => {
    moveFocusOut(event.currentTarget)
    onDelete(todo.id)
  }

  return (
    <li className={todo.completed ? 'row done' : 'row'}>
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        disabled={todo.pending}
        aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
      />
      <span className="label">{todo.description}</span>
      <button
        type="button"
        className="btn-icon"
        aria-label="Delete"
        disabled={todo.pending}
        onClick={handleDelete}
      >
        ×
      </button>
    </li>
  )
}
