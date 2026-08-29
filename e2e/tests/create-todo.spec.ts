import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const py = (code: string) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'python', '-c', code], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
  })

const CLEAR = `
from sqlmodel import Session, select
from app.db import engine, init_db
from app.models import Todo

init_db()
with Session(engine) as session:
    for todo in session.exec(select(Todo)).all():
        session.delete(todo)
    session.commit()
`

test.beforeAll(() => {
  py(CLEAR)
})

test.afterAll(() => {
  py(CLEAR)
})

test('a typed description becomes the top TODO row and survives a reload', async ({ page }) => {
  await page.goto('/')

  const todo = page.getByRole('list', { name: 'TODO' })
  await expect(todo.getByRole('listitem')).toHaveCount(0)

  const input = page.getByRole('textbox', { name: 'New todo' })
  await input.fill('Water the plants')
  await input.press('Enter')

  await expect(todo.getByRole('listitem')).toHaveText(['Water the plants×'])
  await expect(input).toHaveValue('')

  await input.fill('Call the bank')
  await input.press('Enter')

  await expect(todo.getByRole('listitem')).toHaveText(['Call the bank×', 'Water the plants×'])

  await page.reload()

  await expect(page.getByRole('list', { name: 'TODO' }).getByRole('listitem')).toHaveText([
    'Call the bank×',
    'Water the plants×',
  ])
  await expect(page.getByRole('list', { name: 'DONE' }).getByRole('listitem')).toHaveCount(0)
})
