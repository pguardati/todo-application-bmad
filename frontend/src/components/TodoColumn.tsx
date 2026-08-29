import type { BoardTodo } from '../hooks/useTodos'
import TodoRow from './TodoRow'

interface TodoColumnProps {
  id: string
  label: string
  todos: BoardTodo[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

export default function TodoColumn({ id, label, todos, onToggle, onDelete }: TodoColumnProps) {
  return (
    <section className="column" aria-labelledby={id}>
      <h2 className="section-label" id={id}>
        {label}
      </h2>
      <ul className="list" aria-labelledby={id}>
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  )
}
