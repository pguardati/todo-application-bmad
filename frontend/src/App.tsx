export default function App() {
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

      <div className="columns">
        <section className="column" aria-labelledby="todo-label">
          <h2 className="section-label" id="todo-label">
            TODO
          </h2>
          <ul className="list" aria-labelledby="todo-label" />
        </section>

        <section className="column" aria-labelledby="done-label">
          <h2 className="section-label" id="done-label">
            DONE
          </h2>
          <ul className="list" aria-labelledby="done-label" />
        </section>
      </div>
    </main>
  )
}
