import type { Todo } from '../api/types'

interface TodoRowProps {
  todo: Todo
}

export default function TodoRow({ todo }: TodoRowProps) {
  return (
    <li className={todo.completed ? 'row done' : 'row'}>
      <input
        type="checkbox"
        checked={todo.completed}
        readOnly
        aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
      />
      <span className="label">{todo.description}</span>
      <button type="button" className="btn-icon" aria-label="Delete">
        ×
      </button>
    </li>
  )
}
