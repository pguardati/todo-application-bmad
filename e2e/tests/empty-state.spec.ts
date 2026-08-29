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

test('an empty board keeps both labelled columns and no empty-state copy', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/')

  const todo = page.getByRole('list', { name: 'TODO' })
  const done = page.getByRole('list', { name: 'DONE' })

  await expect(page.getByRole('heading', { name: 'TODO' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'DONE' })).toBeVisible()
  await expect(todo.getByRole('listitem')).toHaveCount(0)
  await expect(done.getByRole('listitem')).toHaveCount(0)
  await expect(page.getByRole('main')).toHaveText(/^\s*\+\s*TODO\s*DONE\s*$/)
  await expect(page.getByRole('textbox', { name: 'New todo' })).toBeFocused()

  const columns = page.locator('.column')
  const wide = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect()).map(({ x, y, width, height }) => ({ x, y, width, height })),
  )
  expect(wide).toHaveLength(2)
  expect(wide.every(({ width, height }) => width > 0 && height > 0)).toBe(true)
  expect(wide[1]!.x).toBeGreaterThan(wide[0]!.x)
  expect(wide[1]!.y).toBe(wide[0]!.y)

  await page.setViewportSize({ width: 320, height: 800 })

  const narrow = await columns.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect()).map(({ x, y, width, height }) => ({ x, y, width, height })),
  )
  expect(narrow.every(({ width, height }) => width > 0 && height > 0)).toBe(true)
  expect(narrow[1]!.y).toBeGreaterThan(narrow[0]!.y)
  expect(narrow[1]!.x).toBe(narrow[0]!.x)

  await page.setViewportSize({ width: 1280, height: 800 })

  const input = page.getByRole('textbox', { name: 'New todo' })
  await input.fill('Water the plants')
  await input.press('Enter')

  await expect(todo.getByRole('listitem')).toHaveText(['Water the plants×'])
  await expect(done.getByRole('listitem')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'DONE' })).toBeVisible()
})
