"""HTTP contract, validation, and source ledger reload tests."""
import json
from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from app import ledger as ledger_module
from app.main import app

client = TestClient(app)


def test_q1_endpoint():
    response = client.get("/income-statement", params={
        "start": "2026-01-01", "end": "2026-03-31"})
    assert response.status_code == 200
    data = response.json()
    assert data["company"] == "Northwind Coffee Roasters"
    assert data["currency"] == "USD"
    assert data["summary"]["net_income"] == "-44480.14"


@pytest.mark.parametrize(("start", "end"), [
    ("invalid", "2026-03-31"), ("2026-02-30", "2026-03-31"),
    ("2026-1-1", "2026-03-31"), ("2026-04-01", "2026-03-31"),
    ("2026-01-01", "not-a-date"),
])
def test_bad_ranges_return_422(start, end):
    result = client.get("/income-statement", params={"start": start, "end": end})
    assert result.status_code == 422
    assert result.json()["detail"]


def test_missing_query_params_return_422():
    assert client.get("/income-statement").status_code == 422


def test_zero_activity():
    result = client.get("/income-statement", params={
        "start": "2030-01-01", "end": "2030-12-31"})
    assert result.status_code == 200
    assert result.json()["posted_entries"] == 0
    assert result.json()["summary"]["net_income"] == "0.00"


def test_reload_ledger_on_every_request(tmp_path, monkeypatch):
    original = ledger_module.load_ledger()
    modified = deepcopy(original)
    path = tmp_path / "ledger.json"
    path.write_text(json.dumps(modified), encoding="utf-8")
    monkeypatch.setattr(ledger_module, "LEDGER_PATH", path)

    # The endpoint imported load_ledger; it references ledger_module.LEDGER_PATH at call time.
    params = {"start": "2026-01-01", "end": "2026-03-31"}
    assert client.get("/income-statement", params=params).json()["company"] == original["company"]
    modified["company"] = "Renamed Company"
    modified["journal_entries"].append({
        "id": "TEST-NEW", "date": "2026-03-31", "status": "posted",
        "lines": [{"account": "1000", "debit": "25.00", "credit": "0.00"},
                  {"account": "4000", "debit": "0.00", "credit": "25.00"}]})
    path.write_text(json.dumps(modified), encoding="utf-8")
    report = client.get("/income-statement", params=params).json()
    assert report["company"] == "Renamed Company"
    assert report["summary"]["net_income"] == "-44455.14"


def test_bad_source_returns_500(tmp_path, monkeypatch):
    path = tmp_path / "bad.json"
    path.write_text('{"invalid": true}', encoding="utf-8")
    monkeypatch.setattr(ledger_module, "LEDGER_PATH", path)
    response = client.get("/income-statement", params={
        "start": "2026-01-01", "end": "2026-03-31"})
    assert response.status_code == 500
    assert "Invalid ledger" in response.json()["detail"]

@pytest.mark.parametrize(("path", "value"), [
    (("accounts", 0, "type"), []),
    (("accounts", 0, "subtype"), {}),
    (("journal_entries", 0, "status"), []),
    (("journal_entries", 0, "lines", 0, "account"), {}),
    (("journal_entries", 0, "lines", 0, "debit"), "NaN"),
    (("journal_entries", 0, "lines", 0, "debit"), "1e2"),
])
def test_malformed_json_is_controlled_http_500(tmp_path, monkeypatch, path, value):
    modified = deepcopy(ledger_module.load_ledger())
    current = modified
    for key in path[:-1]:
        current = current[key]
    current[path[-1]] = value
    location = tmp_path / "invalid.json"
    location.write_text(json.dumps(modified), encoding="utf-8")
    monkeypatch.setattr(ledger_module, "LEDGER_PATH", location)
    result = client.get("/income-statement", params={
        "start": "2026-01-01", "end": "2026-03-31"})
    assert result.status_code == 500
    assert result.json()["detail"].startswith("Invalid ledger:")

def test_invalid_utf8_ledger_returns_controlled_error(tmp_path, monkeypatch):
    path = tmp_path / "ledger.json"
    path.write_bytes(b"\\xff\\xfe\\x80")
    monkeypatch.setattr(ledger_module, "LEDGER_PATH", path)
    with pytest.raises(ledger_module.LedgerError, match="Unable to load a valid ledger"):
        ledger_module.load_ledger()
    response = client.get("/income-statement", params={
        "start": "2026-01-01", "end": "2026-03-31"})
    assert response.status_code == 500
    assert response.json()["detail"].startswith("Invalid ledger:")
