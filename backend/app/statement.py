"""Pure financial calculation, independent of FastAPI and filesystem."""
from decimal import Decimal, localcontext

from .ledger import parse_date

ZERO = Decimal("0.00")
SECTION_NAMES = (
    ("revenue", "Revenue"),
    ("cogs", "Cost of Goods Sold"),
    ("gross_profit", "Gross Profit"),
    ("operating_expenses", "Operating Expenses"),
    ("operating_income", "Operating Income"),
    ("other_income", "Other Income"),
    ("net_income", "Net Income"),
)
SUBTYPE_SECTION = {
    "operating_revenue": "revenue",
    "contra_revenue": "revenue",
    "cogs": "cogs",
    "operating_expense": "operating_expenses",
    "other_income": "other_income",
}


def amount_string(amount):
    return format(amount.quantize(Decimal("0.01")), ".2f")


def build_statement(ledger, start, end):
    """Calculate exactly within a precision context sized for this ledger."""
    total_lines = sum(len(entry["lines"]) for entry in ledger["journal_entries"])
    with localcontext() as context:
        context.prec = max(context.prec, 20 + len(str(total_lines)))
        return _calculate_statement(ledger, start, end)


def _calculate_statement(ledger, start, end):
    """Summarize posted lines inclusively. Revenue credits and expense debits increase results."""
    start_date = parse_date(start) if isinstance(start, str) else start
    end_date = parse_date(end) if isinstance(end, str) else end
    if end_date < start_date:
        raise ValueError("End date must be on or after start date")

    accounts = {account["number"]: account for account in ledger["accounts"]}
    balances = {number: ZERO for number in accounts}
    posted_count = 0
    for entry in ledger["journal_entries"]:
        if entry["status"] != "posted" or not start_date <= parse_date(entry["date"]) <= end_date:
            continue
        posted_count += 1
        for line in entry["lines"]:
            account = accounts[line["account"]]
            if account["type"] not in {"revenue", "expense"}:
                continue
            debit, credit = Decimal(line["debit"]), Decimal(line["credit"])
            balances[account["number"]] += (
                credit - debit if account["type"] == "revenue" else debit - credit
            )

    section_lines = {key: [] for key in ("revenue", "cogs", "operating_expenses", "other_income")}
    section_totals = {key: ZERO for key in section_lines}
    for account in ledger["accounts"]:
        key = SUBTYPE_SECTION.get(account["subtype"])
        if key is None:
            continue
        value = balances[account["number"]]
        section_lines[key].append({
            "number": account["number"],
            "name": account["name"],
            "subtype": account["subtype"],
            "amount": amount_string(value),
        })
        section_totals[key] += value

    revenue = section_totals["revenue"]
    cogs = section_totals["cogs"]
    gross_profit = revenue - cogs
    expenses = section_totals["operating_expenses"]
    operating_income = gross_profit - expenses
    other_income = section_totals["other_income"]
    net_income = operating_income + other_income
    totals = {
        "revenue": revenue,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "operating_expenses": expenses,
        "operating_income": operating_income,
        "other_income": other_income,
        "net_income": net_income,
    }
    sections = [
        {"key": key, "title": title, "lines": section_lines.get(key, []),
         "total": amount_string(totals[key])}
        for key, title in SECTION_NAMES
    ]
    return {
        "company": ledger["company"],
        "currency": ledger["currency"],
        "start": start_date.isoformat(),
        "end": end_date.isoformat(),
        "posted_entries": posted_count,
        "sections": sections,
        "summary": {
            "revenue": amount_string(revenue),
            "gross_profit": amount_string(gross_profit),
            "net_income": amount_string(net_income),
        },
    }
