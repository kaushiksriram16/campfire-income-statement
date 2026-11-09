import type { IncomeStatement } from './types'

export async function fetchIncomeStatement(
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<IncomeStatement> {
  const params = new URLSearchParams({ start, end })
  const response = await fetch(`/income-statement?${params}`, { signal })
  if (!response.ok) {
    let message = `Unable to generate statement (HTTP ${response.status})`
    try {
      const error: { detail?: string | Array<{ msg: string }> } = await response.json()
      if (typeof error.detail === 'string') message = error.detail
      else if (Array.isArray(error.detail)) message = error.detail.map((e) => e.msg).join('; ')
    } catch {
      // Preserve the HTTP error if the response is not JSON.
    }
    throw new Error(message)
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('The server returned invalid JSON.')
  }
  return validateIncomeStatement(payload)
}

/** Validate the server JSON contract before React renders the statement. */
const SECTION_KEYS = [
  'revenue', 'cogs', 'gross_profit', 'operating_expenses',
  'operating_income', 'other_income', 'net_income',
] as const

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (year < 1 || month < 1 || month > 12) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day >= 1 && day <= days[month - 1]
}

function isMoney(value: unknown): value is string {
  return typeof value === 'string' && /^-?(?:0|[1-9]\d*)\.\d{2}$/.test(value)
}

function isAccountLine(value: unknown): boolean {
  return isObject(value) && isText(value.number) && isText(value.name) &&
    isText(value.subtype) && isMoney(value.amount)
}

function isSection(value: unknown): boolean {
  return isObject(value) && SECTION_KEYS.some(key => key === value.key) &&
    isText(value.title) && isMoney(value.total) &&
    Array.isArray(value.lines) && value.lines.every(isAccountLine)
}

export function validateIncomeStatement(value: unknown): IncomeStatement {
  const sections = isObject(value) && Array.isArray(value.sections)
    ? value.sections : null
  if (!isObject(value) || !isText(value.company) || !isText(value.currency) ||
      !isDate(value.start) || !isDate(value.end) ||
      !Number.isSafeInteger(value.posted_entries) ||
      (value.posted_entries as number) < 0 ||
      !sections || sections.length !== SECTION_KEYS.length ||
      !sections.every(isSection) ||
      !SECTION_KEYS.every(key => sections.some(
        (section: unknown) => isObject(section) && section.key === key
      )) ||
      !isObject(value.summary) ||
      !isMoney(value.summary.revenue) ||
      !isMoney(value.summary.gross_profit) ||
      !isMoney(value.summary.net_income)) {
    throw new Error('The server returned an invalid income statement response.')
  }
  return value as unknown as IncomeStatement
}
