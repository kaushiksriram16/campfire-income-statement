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
  return response.json() as Promise<IncomeStatement>
}
