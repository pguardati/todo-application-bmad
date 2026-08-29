import type { BoardTodo } from '../hooks/useTodos'

interface TodoRowProps {
  todo: BoardTodo
}

export default function TodoRow({ todo }: TodoRowProps) {
  return (
    <li className={todo.completed ? 'row done' : 'row'}>
      <input
        type="checkbox"
        checked={todo.completed}
        readOnly
        disabled={todo.pending}
        aria-label={todo.completed ? 'Mark incomplete' : 'Mark complete'}
      />
      <span className="label">{todo.description}</span>
      <button type="button" className="btn-icon" aria-label="Delete" disabled={todo.pending}>
        ×
      </button>
    </li>
  )
}
