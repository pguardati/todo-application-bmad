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

test('a seeded todo can be completed, uncompleted and deleted for good', async ({
  page,
  request,
}) => {
  const seeded = await request.post('/api/todos', { data: { description: 'Water the plants' } })
  expect(seeded.status()).toBe(201)

  await page.goto('/')

  const todo = page.getByRole('list', { name: 'TODO' })
  const done = page.getByRole('list', { name: 'DONE' })
  await expect(todo.getByRole('listitem')).toHaveText(['Water the plants×'])

  await todo.getByRole('checkbox', { name: 'Mark complete' }).click()

  await expect(done.getByRole('listitem')).toHaveText(['Water the plants×'])
  await expect(todo.getByRole('listitem')).toHaveCount(0)

  await done.getByRole('checkbox', { name: 'Mark incomplete' }).click()

  await expect(todo.getByRole('listitem')).toHaveText(['Water the plants×'])
  await expect(done.getByRole('listitem')).toHaveCount(0)

  await todo.getByRole('checkbox', { name: 'Mark complete' }).click()
  await expect(done.getByRole('listitem')).toHaveText(['Water the plants×'])

  await done.getByRole('button', { name: 'Delete' }).click()

  await expect(done.getByRole('listitem')).toHaveCount(0)

  await page.reload()

  await expect(page.getByRole('list', { name: 'TODO' }).getByRole('listitem')).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'DONE' }).getByRole('listitem')).toHaveCount(0)
})
