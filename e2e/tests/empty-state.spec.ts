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
  await expect(page.locator('main img, main svg, main picture, main canvas')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'New todo' })).toBeFocused()

  for (const list of [todo, done]) {
    const children = await list
      .locator('xpath=ancestor::section[1]')
      .evaluate((section) => [...section.children].map((child) => child.tagName))
    expect(children).toEqual(['H2', 'UL'])
    await expect(list.locator('xpath=*')).toHaveCount(0)
  }

  const columnBox = async (list: typeof todo) => {
    const box = await list.locator('xpath=ancestor::section[1]').boundingBox()
    if (box === null) {
      throw new Error('column has no bounding box')
    }
    return box
  }
  const boxes = async () => [await columnBox(todo), await columnBox(done)] as const
  const layoutAt = async (width: number, stacked: boolean) => {
    await page.setViewportSize({ width, height: 800 })
    await expect
      .poll(async () => {
        const [a, b] = await boxes()
        return stacked ? b.y > a.y : b.x > a.x
      })
      .toBe(true)
    return boxes()
  }

  const [wideTodo, wideDone] = await layoutAt(1280, false)
  for (const box of [wideTodo, wideDone]) {
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  }
  expect(wideDone.x).toBeGreaterThan(wideTodo.x)
  expect(wideDone.y).toBeCloseTo(wideTodo.y, 1)

  const [narrowTodo, narrowDone] = await layoutAt(320, true)
  for (const box of [narrowTodo, narrowDone]) {
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  }
  expect(narrowDone.y).toBeGreaterThan(narrowTodo.y)
  expect(narrowDone.x).toBeCloseTo(narrowTodo.x, 1)

  await layoutAt(1280, false)

  const input = page.getByRole('textbox', { name: 'New todo' })
  await input.fill('Water the plants')
  await input.press('Enter')

  await expect(todo.getByRole('listitem')).toHaveText(['Water the plants\u00d7'])
  await expect(done.getByRole('listitem')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'DONE' })).toBeVisible()
})
