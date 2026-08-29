import { expect, test } from '@playwright/test'

const ROWS = [
  {
    id: 'e2e-error-1',
    description: 'Fix the auth bug',
    completed: false,
    createdAt: '2026-08-29T09:00:00Z',
  },
  {
    id: 'e2e-error-2',
    description: 'Morning standup',
    completed: true,
    createdAt: '2026-08-28T09:00:00Z',
  },
]

test('a failed load surfaces a message and a retry that recovers the board', async ({ page }) => {
  let attempts = 0

  await page.route('**/api/todos', async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'INTERNAL_ERROR', message: 'Internal server error' }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ROWS),
    })
  })

  await page.goto('/')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Internal server error')
  await expect(alert).not.toContainText('Traceback')

  const retry = alert.getByRole('button', { name: 'Retry' })
  await expect(retry).toBeVisible()

  const todo = page.getByRole('list', { name: 'TODO' })
  const done = page.getByRole('list', { name: 'DONE' })
  await expect(page.getByRole('heading', { name: 'TODO' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'DONE' })).toBeVisible()
  await expect(todo).toHaveCount(1)
  await expect(done).toHaveCount(1)
  await expect(todo.getByRole('listitem')).toHaveCount(0)
  await expect(done.getByRole('listitem')).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(0)

  await retry.focus()
  await page.keyboard.press('Enter')

  await expect(todo.getByRole('listitem')).toHaveText(['Fix the auth bug×'])
  await expect(done.getByRole('listitem')).toHaveText(['Morning standup×'])
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(attempts).toBe(2)
})
