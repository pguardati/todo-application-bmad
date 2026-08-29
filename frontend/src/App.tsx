import AddBar from './components/AddBar'
import TodoColumn from './components/TodoColumn'
import { useTodos } from './hooks/useTodos'

export default function App() {
  const { active, completed, loading, error, addTodo, toggleTodo, deleteTodo, retry } =
    useTodos()

  return (
    <main className="app">
      <AddBar onAdd={addTodo} />

      {error && (
        <div className="state-line state-line-error" role="alert">
          {error}
          <button type="button" onClick={() => void retry()} disabled={loading}>
            Retry
          </button>
        </div>
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
