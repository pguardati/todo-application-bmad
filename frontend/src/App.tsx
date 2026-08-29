import AddBar from './components/AddBar'
import TodoColumn from './components/TodoColumn'
import { useTodos } from './hooks/useTodos'

export default function App() {
  const { active, completed, loading, error, addTodo, toggleTodo, deleteTodo } = useTodos()

  return (
    <main className="app">
      <AddBar onAdd={addTodo} />

      {error && (
        <p className="state-line state-line-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="state-line" role="status">
          Loading…
        </p>
      ) : (
        <div className="columns">
          <TodoColumn
            id="todo-label"
            label="TODO"
            todos={active}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />
          <TodoColumn
            id="done-label"
            label="DONE"
            todos={completed}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
          />
        </div>
      )}
    </main>
  )
}
