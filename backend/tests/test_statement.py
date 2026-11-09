"""Independent accounting regression assertions against known ledger transactions."""
from copy import deepcopy
from decimal import Decimal

from app.ledger import LedgerError, load_ledger, validate_ledger
from app.statement import build_statement
import pytest


@pytest.fixture
def ledger():
    return load_ledger()


def account_amount(report, number):
    return next(Decimal(line["amount"]) for section in report["sections"]
                for line in section["lines"] if line["number"] == number)


def section_total(report, key):
    return Decimal(next(section["total"] for section in report["sections"]
                        if section["key"] == key))


def test_q1_accounts_and_seven_sections(ledger):
    report = build_statement(ledger, "2026-01-01", "2026-03-31")
    assert len(ledger["accounts"]) == 15
    assert len(ledger["journal_entries"]) == 25
    assert report["posted_entries"] == 20
    assert [section["key"] for section in report["sections"]] == [
        "revenue", "cogs", "gross_profit", "operating_expenses",
        "operating_income", "other_income", "net_income",
    ]
    expected_accounts = {
        "4000": "35650.75", "4100": "3000.00", "4900": "-800.25",
        "5000": "14272.75", "6000": "55500.00", "6100": "9000.00",
        "6200": "1099.97", "6300": "2500.10", "7000": "42.18",
    }
    for number, expected in expected_accounts.items():
        assert account_amount(report, number) == Decimal(expected)
    expected_totals = {
        "revenue": "37850.50", "cogs": "14272.75",
        "gross_profit": "23577.75", "operating_expenses": "68100.07",
        "operating_income": "-44522.32", "other_income": "42.18",
        "net_income": "-44480.14",
    }
    for key, expected in expected_totals.items():
        assert section_total(report, key) == Decimal(expected)


@pytest.mark.parametrize(("start", "end", "posted", "net"), [
    ("2025-12-01", "2025-12-31", 1, "5000.00"),
    ("2026-01-01", "2026-01-31", 7, "-21529.65"),
    ("2026-02-01", "2026-02-28", 6, "-13230.25"),
    ("2026-03-01", "2026-03-31", 7, "-9720.24"),
    ("2026-04-01", "2026-04-30", 1, "9100.00"),
    ("2027-01-01", "2027-12-31", 0, "0.00"),
    ("2026-01-05", "2026-01-05", 2, "7470.45"),
    ("2025-01-01", "2027-12-31", 22, "-30380.14"),
])
def test_periods(ledger, start, end, posted, net):
    report = build_statement(ledger, start, end)
    assert report["posted_entries"] == posted
    assert report["summary"]["net_income"] == net


def test_discount_and_vendor_credit_reduce_results(ledger):
    q1 = build_statement(ledger, "2026-01-01", "2026-03-31")
    assert account_amount(q1, "4900") == Decimal("-800.25")
    assert account_amount(q1, "6200") == Decimal("1099.97")


def test_decimal_small_transaction_is_exact(ledger):
    modified = deepcopy(ledger)
    modified["journal_entries"].append({
        "id": "TEST-DECIMAL", "date": "2026-02-01", "status": "posted",
        "memo": "Precision", "lines": [
            {"account": "1000", "debit": "0.10", "credit": "0.00"},
            {"account": "4000", "debit": "0.00", "credit": "0.10"},
        ]})
    validate_ledger(modified)
    result = build_statement(modified, "2026-01-01", "2026-03-31")
    assert account_amount(result, "4000") == Decimal("35650.85")
    assert result["summary"]["net_income"] == "-44480.04"


def test_reversal_and_status(ledger):
    modified = deepcopy(ledger)
    modified["journal_entries"] += [
        {"id": "TEST-REV", "date": "2026-03-31", "status": "posted",
         "lines": [{"account": "4000", "debit": "1.25", "credit": "0.00"},
                   {"account": "1100", "debit": "0.00", "credit": "1.25"}]},
        {"id": "TEST-DRAFT", "date": "2026-03-31", "status": "draft",
         "lines": [{"account": "4000", "debit": "0.00", "credit": "900.00"},
                   {"account": "1100", "debit": "900.00", "credit": "0.00"}]},
    ]
    validate_ledger(modified)
    report = build_statement(modified, "2026-01-01", "2026-03-31")
    assert report["summary"]["net_income"] == "-44481.39"


def test_invalid_ledger_rejected(ledger):
    bad = deepcopy(ledger)
    bad["journal_entries"][1]["lines"][0]["debit"] = "1.00"
    with pytest.raises(LedgerError, match="Unbalanced"):
        validate_ledger(bad)
    bad = deepcopy(ledger)
    bad["journal_entries"][0]["lines"][0]["account"] = "missing"
    with pytest.raises(LedgerError, match="unknown account"):
        validate_ledger(bad)

@pytest.mark.parametrize(("field", "value"), [
    ("number", []), ("number", {}), ("number", None), ("number", 4000),
    ("name", []), ("name", None), ("type", []), ("type", {}),
    ("type", None), ("type", False), ("subtype", []),
    ("subtype", {}), ("subtype", None), ("subtype", "balance_sheet"),
    ("is_active", "yes"), ("is_active", None),
])
def test_invalid_account_fields_are_controlled(ledger, field, value):
    modified = deepcopy(ledger)
    modified["accounts"][6][field] = value
    with pytest.raises(LedgerError):
        validate_ledger(modified)


@pytest.mark.parametrize(("field", "value"), [
    ("id", []), ("id", None), ("id", 123), ("date", []),
    ("date", None), ("status", []), ("status", {}), ("status", 7),
    ("status", "approved"), ("lines", {}), ("lines", []),
])
def test_invalid_entry_fields_are_controlled(ledger, field, value):
    modified = deepcopy(ledger)
    modified["journal_entries"][1][field] = value
    with pytest.raises(LedgerError):
        validate_ledger(modified)


@pytest.mark.parametrize(("field", "value"), [
    ("account", []), ("account", {}), ("account", None),
    ("account", "unknown"), ("debit", []), ("debit", {}),
    ("debit", True), ("debit", None), ("debit", "NaN"),
    ("debit", "Infinity"), ("debit", "3.141"), ("debit", "-2.00"),
    ("debit", "10000000000000000.00"),
])
def test_invalid_line_fields_are_controlled(ledger, field, value):
    modified = deepcopy(ledger)
    modified["journal_entries"][1]["lines"][0][field] = value
    with pytest.raises(LedgerError):
        validate_ledger(modified)


def test_missing_fields_duplicate_ids_and_zero_lines(ledger):
    bad = deepcopy(ledger)
    del bad["accounts"][0]["type"]
    with pytest.raises(LedgerError):
        validate_ledger(bad)
    bad = deepcopy(ledger)
    bad["accounts"][1]["number"] = bad["accounts"][0]["number"]
    with pytest.raises(LedgerError):
        validate_ledger(bad)
    bad = deepcopy(ledger)
    bad["journal_entries"][1]["id"] = bad["journal_entries"][0]["id"]
    with pytest.raises(LedgerError):
        validate_ledger(bad)
    bad = deepcopy(ledger)
    bad["journal_entries"][1]["lines"][0]["debit"] = "0.00"
    with pytest.raises(LedgerError):
        validate_ledger(bad)


@pytest.mark.parametrize(("payload"), [[], None, "text", 7, {}, {"accounts": {}, "journal_entries": []}])
def test_invalid_ledger_root( payload):
    with pytest.raises(LedgerError):
        validate_ledger(payload)


def test_large_values_supported_and_repeated_exactly(ledger):
    modified = deepcopy(ledger)
    for index in range(150):
        modified["journal_entries"].append({
            "id": f"TEST-HUGE-{index}", "date": "2027-01-01", "status": "posted",
            "lines": [
                {"account": "1000", "debit": "9999999999999999.99", "credit": "0.00"},
                {"account": "4000", "debit": "0.00", "credit": "9999999999999999.99"},
            ],
        })
    validate_ledger(modified)
    result = build_statement(modified, "2027-01-01", "2027-01-01")
    assert result["summary"]["net_income"] == "1499999999999999998.50"


def test_beyond_max_magnitude_is_rejected(ledger):
    modified = deepcopy(ledger)
    modified["journal_entries"][1]["lines"][0]["debit"] = "99999999999999999.99"
    with pytest.raises(LedgerError, match="maximum supported"):
        validate_ledger(modified)
