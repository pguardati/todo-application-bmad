import TodoColumn from './components/TodoColumn'
import { useTodos } from './hooks/useTodos'

export default function App() {
  const { active, completed, loading, error } = useTodos()

  return (
    <main className="app">
      <div className="add-bar">
        <button type="button" className="btn-icon" aria-label="Add todo">
          +
        </button>
        <input
          id="new-todo"
          name="description"
          type="text"
          className="field-input"
          aria-label="New todo"
          autoFocus
        />
      </div>

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
          <TodoColumn id="todo-label" label="TODO" todos={active} />
          <TodoColumn id="done-label" label="DONE" todos={completed} />
        </div>
      )}
    </main>
  )
}
