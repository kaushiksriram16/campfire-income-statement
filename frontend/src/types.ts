export interface AccountLine {
  number: string
  name: string
  subtype: string
  amount: string
}

export interface StatementSection {
  key: 'revenue' | 'cogs' | 'gross_profit' | 'operating_expenses' |
    'operating_income' | 'other_income' | 'net_income'
  title: string
  lines: AccountLine[]
  total: string
}

export interface IncomeStatement {
  company: string
  currency: string
  start: string
  end: string
  posted_entries: number
  sections: StatementSection[]
  summary: {
    revenue: string
    gross_profit: string
    net_income: string
  }
}
