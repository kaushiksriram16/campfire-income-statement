"""Loading and validating the source-of-truth ledger on every request."""
import json
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path

LEDGER_PATH = Path(__file__).resolve().parents[2] / "ledger.json"
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
    if not isinstance(value, str):
        raise LedgerError("Money must be a decimal string")
    try:
        amount = Decimal(value)
    except InvalidOperation as exc:
        raise LedgerError("Invalid monetary value") from exc
    if not amount.is_finite() or amount.as_tuple().exponent < -2:
        raise LedgerError("Money must be finite with at most two decimal places")
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
        if not isinstance(number, str) or not number or number in account_numbers:
            raise LedgerError("Account numbers must be unique nonempty strings")
        if not isinstance(account.get("name"), str) or not account["name"].strip():
            raise LedgerError("Account name is required")
        if kind not in VALID_TYPES or account.get("subtype") not in SUBTYPES[kind]:
            raise LedgerError(f"Invalid account classification: {number}")
        if not isinstance(account.get("is_active"), bool):
            raise LedgerError("Account is_active must be boolean")
        account_numbers.add(number)

    seen_ids = set()
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            raise LedgerError("Invalid journal entry")
        if entry["id"] in seen_ids:
            raise LedgerError("Duplicate journal entry ID")
        seen_ids.add(entry["id"])
        try:
            parse_date(entry.get("date"))
        except ValueError as exc:
            raise LedgerError(f"Invalid entry date: {entry['id']}") from exc
        if entry.get("status") not in {"posted", "draft", "void"}:
            raise LedgerError("Invalid entry status")
        lines = entry.get("lines")
        if not isinstance(lines, list) or len(lines) < 2:
            raise LedgerError("A journal entry needs at least two lines")
        debits = Decimal("0")
        credits = Decimal("0")
        for line in lines:
            if not isinstance(line, dict) or line.get("account") not in account_numbers:
                raise LedgerError("Journal line refers to an unknown account")
            debit = parse_money(line.get("debit"))
            credit = parse_money(line.get("credit"))
            if debit < 0 or credit < 0 or (debit and credit):
                raise LedgerError("Journal line must have nonnegative debit or credit")
            debits += debit
            credits += credit
        if debits != credits:
            raise LedgerError(f"Unbalanced journal entry: {entry['id']}")
    return data


def load_ledger(path=None):
    try:
        with open(path or LEDGER_PATH, encoding="utf-8") as handle:
            return validate_ledger(json.load(handle))
    except (OSError, json.JSONDecodeError) as exc:
        raise LedgerError("Unable to load a valid ledger") from exc
