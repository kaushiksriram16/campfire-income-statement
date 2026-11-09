import { test, expect } from '@playwright/test'

test('real React, Vite proxy, and FastAPI income statement flow', async ({ page }) => {
  const requests: string[] = []
  const failures: string[] = []
  const pageErrors: string[] = []
  page.on('request', request => {
    if (request.url().includes('/income-statement?')) requests.push(request.url())
  })
  page.on('response', response => {
    if (response.url().includes('/income-statement?') && !response.ok())
      failures.push(`${response.status()}: ${response.url()}`)
  })
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText
    // React StrictMode cancels its first development-only request intentionally.
    if (request.url().includes('/income-statement?') && reason !== 'net::ERR_ABORTED')
      failures.push(reason || 'Request failed')
  })
  page.on('pageerror', error => pageErrors.push(error.message))

  const netIncome = page.locator('.metric').filter({ hasText: 'Net Income' }).locator('strong')

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Select a date range to view your income statement' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Financial summary' })).toHaveCount(0)
  expect(requests).toHaveLength(0)

  const start = page.getByLabel('Start Date')
  const end = page.getByLabel('End Date')
  await expect(start).toHaveValue('2026-01-01')
  await expect(end).toHaveValue('2026-03-31')
  await page.getByRole('button', { name: 'Generate Statement' }).click()
  await expect(page.getByRole('heading', { name: 'Northwind Coffee Roasters' })).toBeVisible()
  await expect(netIncome).toHaveText('(44,480.14)')
  await expect(page.getByText('2026-01-01 to 2026-03-31 · USD')).toBeVisible()
  async function generate(from: string, to: string) {
    await start.fill(from)
    await end.fill(to)
    await expect(page.getByRole('heading', { name: 'Northwind Coffee Roasters' })).toBeVisible()
    await page.getByRole('button', { name: 'Generate Statement' }).click()
    await expect(page.getByText(`${from} to ${to} · USD`)).toBeVisible()
  }

  await generate('2025-12-01', '2025-12-31')
  await expect(netIncome).toHaveText('5,000.00')

  await generate('2026-02-01', '2026-02-28')
  await expect(netIncome).toHaveText('(13,230.25)')

  await generate('2030-01-01', '2030-12-31')
  await expect(page.getByText('No posted transactions in this period. All amounts are zero.')).toBeVisible()

  await start.fill('2026-04-01')
  await end.fill('2026-03-01')
  await page.getByRole('button', { name: 'Generate Statement' }).click()
  await expect(page.getByRole('alert').getByText('End date must be on or after start date.')).toBeVisible()

  await page.getByRole('button', { name: 'Reset to Q1 2026' }).click()
  await expect(start).toHaveValue('2026-01-01')
  await expect(end).toHaveValue('2026-03-31')
  await expect(page.getByRole('heading', { name: 'Select a date range to view your income statement' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Financial summary' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Generate Statement' }).click()
  await expect(netIncome).toHaveText('(44,480.14)')
  expect(requests.length).toBeGreaterThanOrEqual(5)
  expect(requests.every(url => url.startsWith('http://127.0.0.1:5173/income-statement?'))).toBe(true)
  expect(failures).toEqual([])
  expect(pageErrors).toEqual([])
})
