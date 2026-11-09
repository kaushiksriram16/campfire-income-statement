import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchIncomeStatement } from './api'
import type { IncomeStatement } from './types'
import { formatMoney } from './formatMoney'

const DEFAULT_START = '2026-01-01'
const DEFAULT_END = '2026-03-31'


function Statement({ report }: { report: IncomeStatement }) {
  return (
    <section className="statement" aria-label="Income statement details">
      <div className="statement-head">
        <div>
          <span className="eyebrow">FINANCIAL REPORT</span>
          <h2>Income Statement</h2>
          <p>{report.start} to {report.end} · {report.currency}</p>
        </div>
        <span className="period-tag">Actuals</span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th scope="col">Account / Description</th><th scope="col" className="amount">Amount ({report.currency})</th></tr>
          </thead>
          <tbody>
            {report.sections.map((section) => (
              <FragmentSection key={section.key} section={section} />
            ))}
          </tbody>
        </table>
      </div>
      {report.posted_entries === 0 && (
        <p className="empty-message" role="status">No posted transactions in this period. All amounts are zero.</p>
      )}
      <div className="statement-footer">Based on {report.posted_entries} posted journal {report.posted_entries === 1 ? 'entry' : 'entries'}.</div>
    </section>
  )
}

function FragmentSection({ section }: {
  section: IncomeStatement['sections'][number]
}) {
  const isFinal = section.key === 'net_income'
  const isCalculated = ['gross_profit', 'operating_income', 'net_income'].includes(section.key)
  if (isCalculated) {
    return (
      <tr className={isFinal ? 'final-total' : 'calculated-total'}>
        <th scope="row">{section.title}</th>
        <td className="amount">{formatMoney(section.total)}</td>
      </tr>
    )
  }
  return (
    <>
      <tr className="section-heading"><th colSpan={2} scope="rowgroup">{section.title}</th></tr>
      {section.lines.map((line) => (
        <tr key={line.number} className="account-row">
          <td><span className="account-number">{line.number}</span>{line.name}</td>
          <td className="amount">{formatMoney(line.amount)}</td>
        </tr>
      ))}
      <tr className="subtotal">
        <th scope="row">Total {section.title}</th>
        <td className="amount">{formatMoney(section.total)}</td>
      </tr>
    </>
  )
}

export default function App() {
  const [start, setStart] = useState(DEFAULT_START)
  const [end, setEnd] = useState(DEFAULT_END)
  const [report, setReport] = useState<IncomeStatement | null>(null)
  const [company, setCompany] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)
  const controller = useRef<AbortController | null>(null)

  const generate = useCallback(async (from: string, to: string) => {
    controller.current?.abort()
    const current = ++requestId.current
    setReport(null)
    setError('')
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      setError('Select valid start and end dates.')
      setLoading(false)
      return
    }
    if (from > to) {
      setError('End date must be on or after start date.')
      setLoading(false)
      return
    }
    const abort = new AbortController()
    controller.current = abort
    setLoading(true)
    try {
      const result = await fetchIncomeStatement(from, to, abort.signal)
      if (current === requestId.current) {
        setCompany(result.company)
        setCurrency(result.currency)
        setReport(result)
      }
    } catch (cause) {
      if (current === requestId.current && !abort.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'A network error occurred.')
      }
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void generate(DEFAULT_START, DEFAULT_END)
    return () => {
      controller.current?.abort()
      requestId.current += 1
    }
  }, [generate])

  const updateStart = (value: string) => {
    setStart(value)
    setReport(null)
    setError('')
    controller.current?.abort()
    requestId.current += 1
    setLoading(false)
  }
  const updateEnd = (value: string) => {
    setEnd(value)
    setReport(null)
    setError('')
    controller.current?.abort()
    requestId.current += 1
    setLoading(false)
  }
  const reset = () => {
    setStart(DEFAULT_START)
    setEnd(DEFAULT_END)
    void generate(DEFAULT_START, DEFAULT_END)
  }

  return (
    <main className="page">
      <header className="page-header">
        <div className="brand-mark">C</div>
        <div>
          <p className="eyebrow">FINANCIAL OVERVIEW</p>
          <h1>{company ?? (loading ? 'Loading company…' : 'Income Statement')}</h1>
          <p className="header-subtitle">Income Statement · {currency ?? 'Reporting currency from ledger'}</p>
        </div>
      </header>
      <section className="controls-panel" aria-labelledby="reporting-heading">
        <div className="controls-heading">
          <div>
            <h2 id="reporting-heading">Reporting period</h2>
            <p>Choose an inclusive date range to generate your statement.</p>
          </div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); void generate(start, end) }}>
          <div className="control-field">
            <label htmlFor="start-date">Start Date</label>
            <input id="start-date" type="date" required value={start}
              onChange={(event) => updateStart(event.target.value)} />
          </div>
          <div className="control-field">
            <label htmlFor="end-date">End Date</label>
            <input id="end-date" type="date" required value={end}
              onChange={(event) => updateEnd(event.target.value)} />
          </div>
          <div className="control-actions">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? 'Generating…' : 'Generate Statement'}
            </button>
            <button className="secondary" type="button" onClick={reset}>
              Reset to Q1 2026
            </button>
          </div>
        </form>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      {loading && <p className="loading" role="status">Generating income statement…</p>}
      {report && !loading && (
        <>
          <section className="metrics" aria-label="Financial summary">
            {([
              ['Revenue', report.summary.revenue],
              ['Gross Profit', report.summary.gross_profit],
              ['Net Income', report.summary.net_income],
            ] as const).map(([label, value]) => (
              <div className="metric" key={label}>
                <p>{label}</p>
                <strong>{formatMoney(value)}</strong>
                <small>{report.currency}</small>
              </div>
            ))}
          </section>
          <Statement report={report} />
        </>
      )}
    </main>
  )
}
