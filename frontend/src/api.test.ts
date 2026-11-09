import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchIncomeStatement } from './api'

function validReport() {
  return {
    company: 'Northwind Coffee Roasters',
    currency: 'USD',
    start: '2026-01-01',
    end: '2026-03-31',
    posted_entries: 20,
    sections: [
      { key: 'revenue', title: 'Revenue', total: '37850.50', lines: [
        { number: '4000', name: 'Product Revenue', subtype: 'operating_revenue', amount: '35650.75' },
      ] },
      { key: 'cogs', title: 'Cost of Goods Sold', total: '14272.75', lines: [] },
      { key: 'gross_profit', title: 'Gross Profit', total: '23577.75', lines: [] },
      { key: 'operating_expenses', title: 'Operating Expenses', total: '68100.07', lines: [] },
      { key: 'operating_income', title: 'Operating Income', total: '-44522.32', lines: [] },
      { key: 'other_income', title: 'Other Income', total: '42.18', lines: [] },
      { key: 'net_income', title: 'Net Income', total: '-44480.14', lines: [] },
    ],
    summary: { revenue: '37850.50', gross_profit: '23577.75', net_income: '-44480.14' },
  }
}

describe('successful API response validation', () => {
  afterEach(() => vi.unstubAllGlobals())

  function mockPayload(payload: unknown) {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => payload,
    })))
  }

  it('accepts a well-formed Q1 response with exact money strings', async () => {
    mockPayload(validReport())
    const result = await fetchIncomeStatement('2026-01-01', '2026-03-31')
    expect(result.summary.net_income).toBe('-44480.14')
    expect(result.sections[0].lines[0].amount).toBe('35650.75')
  })

  it.each([
    ['null sections', (value: any) => { value.sections = null }],
    ['missing summary', (value: any) => { delete value.summary }],
    ['invalid account line', (value: any) => { value.sections[0].lines[0].number = [] }],
    ['invalid amount', (value: any) => { value.summary.net_income = '-44,480.14' }],
    ['missing section', (value: any) => { value.sections.pop() }],
    ['duplicate section', (value: any) => { value.sections[6].key = 'revenue' }],
    ['negative entry count', (value: any) => { value.posted_entries = -1 }],
    ['invalid calendar date', (value: any) => { value.start = '2026-02-30' }],
    ['invalid month', (value: any) => { value.end = '2026-13-01' }],
    ['unsupported year zero', (value: any) => { value.start = '0000-01-01' }],
  ])('rejects %s in HTTP 200 JSON', async (_name, mutate) => {
    const value = validReport()
    mutate(value)
    mockPayload(value)
    await expect(fetchIncomeStatement('2026-01-01', '2026-03-31'))
      .rejects.toThrow('invalid income statement response')
  })

  it('reports non-JSON HTTP 200 responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => { throw new SyntaxError('Unexpected token') },
    })))
    await expect(fetchIncomeStatement('2026-01-01', '2026-03-31'))
      .rejects.toThrow('The server returned invalid JSON.')
  })
})
