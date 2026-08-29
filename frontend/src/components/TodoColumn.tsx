import type { BoardTodo } from '../hooks/useTodos'
import TodoRow from './TodoRow'

interface TodoColumnProps {
  id: string
  label: string
  todos: BoardTodo[]
}

export default function TodoColumn({ id, label, todos }: TodoColumnProps) {
  return (
    <section className="column" aria-labelledby={id}>
      <h2 className="section-label" id={id}>
        {label}
      </h2>
      <ul className="list" aria-labelledby={id}>
        {todos.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </ul>
    </section>
  )
}
