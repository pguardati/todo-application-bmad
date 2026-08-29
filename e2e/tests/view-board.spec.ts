import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const py = (code: string) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'python', '-c', code], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  })

const SEED = `
from datetime import datetime
from sqlmodel import Session
from app.db import engine, init_db
from app.models import Todo

init_db()
with Session(engine) as session:
    session.add(Todo(id="e2e-1", description="Buy groceries", created_at=datetime(2026, 8, 27, 9, 0)))
    session.add(Todo(id="e2e-2", description="Morning standup", completed=True, created_at=datetime(2026, 8, 28, 9, 0)))
    session.add(Todo(id="e2e-3", description="Fix the auth bug", created_at=datetime(2026, 8, 29, 9, 0)))
    session.commit()
`

const CLEAR = `
from sqlmodel import Session, select
from app.db import engine
from app.models import Todo

with Session(engine) as session:
    for todo in session.exec(select(Todo)).all():
        session.delete(todo)
    session.commit()
`

test.beforeAll(() => {
  py(CLEAR)
  py(SEED)
})

test.afterAll(() => {
  py(CLEAR)
})

test('the board shows seeded todos split into TODO and DONE, newest first', async ({ page }) => {
  await page.goto('/')

  const todo = page.getByRole('list', { name: 'TODO' })
  const done = page.getByRole('list', { name: 'DONE' })

  await expect(todo.getByRole('listitem')).toHaveCount(2)
  await expect(done.getByRole('listitem')).toHaveCount(1)

  await expect(todo.getByRole('listitem')).toHaveText(['Fix the auth bug×', 'Buy groceries×'])
  await expect(done.getByRole('listitem')).toHaveText(['Morning standup×'])

  const completedLabel = done.getByRole('listitem').first().locator('.label')
  await expect(completedLabel).toHaveCSS('text-decoration-line', 'line-through')
  await expect(done.getByRole('checkbox', { name: 'Mark incomplete' })).toBeChecked()
  await expect(todo.getByRole('checkbox', { name: 'Mark complete' })).toHaveCount(2)
})
