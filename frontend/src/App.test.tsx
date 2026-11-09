// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

function report(start: string, end: string) {
  return {
    company: 'Dynamic Test Company',
    currency: 'USD',
    start, end, posted_entries: 0,
    sections: [
      { key: 'revenue', title: 'Revenue', total: '0.00', lines: [] },
      { key: 'cogs', title: 'Cost of Goods Sold', total: '0.00', lines: [] },
      { key: 'gross_profit', title: 'Gross Profit', total: '0.00', lines: [] },
      { key: 'operating_expenses', title: 'Operating Expenses', total: '0.00', lines: [] },
      { key: 'operating_income', title: 'Operating Income', total: '0.00', lines: [] },
      { key: 'other_income', title: 'Other Income', total: '0.00', lines: [] },
      { key: 'net_income', title: 'Net Income', total: '0.00', lines: [] },
    ],
    summary: { revenue: '0.00', gross_profit: '0.00', net_income: '0.00' },
  }
}

describe('report controls', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      return { ok: true, json: async () => report(
        url.searchParams.get('start')!, url.searchParams.get('end')!,
      ) } as Response
    })
  })
  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('loads the default report with a dynamic company heading', async () => {
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Dynamic Test Company' })).toBeTruthy()
    expect((screen.getByLabelText('Start Date') as HTMLInputElement).value).toBe('2026-01-01')
    expect((screen.getByLabelText('End Date') as HTMLInputElement).value).toBe('2026-03-31')
    expect(screen.getByText('No posted transactions in this period. All amounts are zero.')).toBeTruthy()
  })

  it('generates for selected dates and resets the report to Q1', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: 'Dynamic Test Company' })
    const start = screen.getByLabelText('Start Date') as HTMLInputElement
    const end = screen.getByLabelText('End Date') as HTMLInputElement
    // The native date fields dispatch input/change with ISO dates.
    await user.clear(start)
    await user.type(start, '2025-12-01')
    await user.clear(end)
    await user.type(end, '2025-12-31')
    expect(screen.queryByText('2026-01-01 to 2026-03-31 · USD')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Generate Statement' }))
    await waitFor(() => expect(screen.getByText('2025-12-01 to 2025-12-31 · USD')).toBeTruthy())
    await user.click(screen.getByRole('button', { name: 'Reset to Q1 2026' }))
    await waitFor(() => expect(screen.getByText('2026-01-01 to 2026-03-31 · USD')).toBeTruthy())
    expect(start.value).toBe('2026-01-01')
    expect(end.value).toBe('2026-03-31')
  })
})
