"""Loading and validating the source-of-truth ledger on every request."""
import json
import re
from datetime import date
from decimal import Decimal, InvalidOperation, localcontext
from pathlib import Path

LEDGER_PATH = Path(__file__).resolve().parents[2] / "ledger.json"
MAX_LINE_AMOUNT = Decimal("9999999999999999.99")
VALID_TYPES = {"asset", "liability", "equity", "revenue", "expense"}
SUBTYPES = {
    "asset": {"balance_sheet"},
    "liability": {"balance_sheet"},
    "equity": {"balance_sheet"},
    "revenue": {"operating_revenue", "contra_revenue", "other_income"},
    "expense": {"cogs", "operating_expense"},
}


class LedgerError(ValueError):
    """The ledger is missing, inconsistent, or invalid."""


def parse_money(value):
    if not isinstance(value, str) or not re.fullmatch(r"(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?", value):
        raise LedgerError("Money must be a nonnegative plain decimal string with at most two decimals")
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise LedgerError("Invalid monetary value") from exc
    if not amount.is_finite() or amount.as_tuple().exponent < -2:
        raise LedgerError("Money must be finite with at most two decimal places")
    if abs(amount) > MAX_LINE_AMOUNT:
        raise LedgerError("Money exceeds maximum supported magnitude of 9999999999999999.99")
    return amount


def parse_date(value):
    if not isinstance(value, str):
        raise ValueError("Date must have format YYYY-MM-DD")
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError
        return parsed
    except ValueError as exc:
        raise ValueError("Date must be a valid YYYY-MM-DD date") from exc


def validate_ledger(data):
    """Fail with LedgerError for malformed or inconsistent JSON, not TypeError/KeyError."""
    if not isinstance(data, dict):
        raise LedgerError("Ledger must be an object")
    if not isinstance(data.get("company"), str) or not data["company"].strip():
        raise LedgerError("Company name is required")
    if not isinstance(data.get("currency"), str) or not data["currency"].strip():
        raise LedgerError("Currency is required")
    accounts = data.get("accounts")
    entries = data.get("journal_entries")
    if not isinstance(accounts, list) or not isinstance(entries, list):
        raise LedgerError("Accounts and journal_entries must be arrays")

    account_numbers = set()
    for account in accounts:
        if not isinstance(account, dict):
            raise LedgerError("Account must be an object")
        number = account.get("number")
        kind = account.get("type")
        subtype = account.get("subtype")
        if not isinstance(number, str) or not number.strip() or number in account_numbers:
            raise LedgerError("Account numbers must be unique nonempty strings")
        if not isinstance(account.get("name"), str) or not account["name"].strip():
            raise LedgerError("Account name is required")
        if not isinstance(kind, str) or kind not in VALID_TYPES:
            raise LedgerError(f"Invalid account type: {number}")
        if not isinstance(subtype, str) or subtype not in SUBTYPES[kind]:
            raise LedgerError(f"Invalid account subtype: {number}")
        if not isinstance(account.get("is_active"), bool):
            raise LedgerError("Account is_active must be boolean")
        account_numbers.add(number)

    seen_ids = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise LedgerError("Journal entry must be an object")
        entry_id = entry.get("id")
        if not isinstance(entry_id, str) or not entry_id.strip():
            raise LedgerError("Journal entry ID must be a nonempty string")
        if entry_id in seen_ids:
            raise LedgerError("Duplicate journal entry ID")
        seen_ids.add(entry_id)
        try:
            parse_date(entry.get("date"))
        except ValueError as exc:
            raise LedgerError(f"Invalid entry date: {entry_id}") from exc
        status = entry.get("status")
        if not isinstance(status, str) or status not in {"posted", "draft", "void"}:
            raise LedgerError(f"Invalid entry status: {entry_id}")
        if "memo" in entry and not isinstance(entry["memo"], str):
            raise LedgerError(f"Invalid journal memo: {entry_id}")
        lines = entry.get("lines")
        if not isinstance(lines, list) or len(lines) < 2:
            raise LedgerError("A journal entry needs at least two lines")

        # Maximum line size is 18 significant digits. Reserve enough precision
        # for summing every valid line without losing cents.
        with localcontext() as context:
            context.prec = max(context.prec, 20 + len(str(len(lines))))
            debits = Decimal("0.00")
            credits = Decimal("0.00")
            for line in lines:
                if not isinstance(line, dict):
                    raise LedgerError("Journal line must be an object")
                number = line.get("account")
                if not isinstance(number, str) or number not in account_numbers:
                    raise LedgerError("Journal line refers to an unknown account")
                debit = parse_money(line.get("debit"))
                credit = parse_money(line.get("credit"))
                if debit < 0 or credit < 0 or bool(debit) == bool(credit):
                    raise LedgerError("Exactly one of debit and credit must be positive")
                debits += debit
                credits += credit
            if debits != credits:
                raise LedgerError(f"Unbalanced journal entry: {entry_id}")
    return data


def load_ledger(path=None):
    try:
        with open(path or LEDGER_PATH, encoding="utf-8") as handle:
            return validate_ledger(json.load(handle))
    except (OSError, json.JSONDecodeError) as exc:
        raise LedgerError("Unable to load a valid ledger") from exc
