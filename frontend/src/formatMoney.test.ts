import { describe, expect, it } from 'vitest'
import { formatMoney } from './formatMoney'

describe('exact money formatting', () => {
  it.each([
    ['35650.75', '35,650.75'],
    ['-800.25', '(800.25)'],
    ['0.00', '0.00'],
    ['-0.00', '0.00'],
    ['90071992547409.93', '90,071,992,547,409.93'],
    ['9007199254740993.01', '9,007,199,254,740,993.01'],
    ['999999999999999.99', '999,999,999,999,999.99'],
  ])('formats %s exactly', (input, expected) => {
    expect(formatMoney(input)).toBe(expected)
  })
  it('rejects malformed currency strings', () => {
    expect(() => formatMoney('1.999')).toThrow()
  })
})
