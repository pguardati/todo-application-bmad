import { type FormEvent, useState } from 'react'

interface AddBarProps {
  onAdd: (description: string) => Promise<boolean>
}

export default function AddBar({ onAdd }: AddBarProps) {
  const [description, setDescription] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (await onAdd(description)) {
      setDescription('')
    }
  }

  return (
    <form className="add-bar" onSubmit={submit}>
      <button type="submit" className="btn-icon" aria-label="Add todo">
        +
      </button>
      <input
        id="new-todo"
        name="description"
        type="text"
        className="field-input"
        aria-label="New todo"
        autoFocus
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
    </form>
  )
}
