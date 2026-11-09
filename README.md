# Campfire Income Statement

A small, accountant-readable income statement application powered by the **original Campfire ledger**. The backend computes a profit-and-loss report for any valid inclusive reporting period; the frontend displays the results with native date inputs.

## Stack

- Python 3.12+; FastAPI; Uvicorn; Python `Decimal`; pytest and FastAPI `TestClient`
- React 19; TypeScript 5.9; Vite 7; Fetch API; CSS
- No database, authentication, or Docker

Development environment used to prepare this repository: Python **3.13.5**, Node.js **22.16.0**, npm **10.9.2**. See `backend/requirements*.txt` and `frontend/package.json` for compatible dependency ranges. These are runtime/tool versions, not a claim that CI or browser execution has passed.

## Run locally

Use two terminal windows from the repository root. Run the backend first.

### macOS / Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

### Windows PowerShell

```powershell
cd backend
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload
```

In another PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. The Vite development server forwards `/income-statement` to **http://127.0.0.1:8000**. FastAPI documentation is at **http://127.0.0.1:8000/docs**.

## Tests and frontend build

From the repository root:

```bash
cd backend
python -m pytest -v
```

Then, in another terminal:

```bash
cd frontend
npm install
npm run build
```

These are the project verification commands; consult actual command output or GitHub Actions before asserting a successful run.

## API

`GET /income-statement?start=YYYY-MM-DD&end=YYYY-MM-DD`

Example:

```bash
curl "http://127.0.0.1:8000/income-statement?start=2026-01-01&end=2026-03-31"
```

Returns a JSON document with `company`, `currency`, `start`, `end`, `posted_entries`, an ordered `sections` array and a `summary`. Each section carries its key, title, account lines and subtotal. Money is serialized as exact two-decimal **strings**; signed negative numbers remain negative in JSON and the UI formats them with parentheses. Invalid/reversed dates return HTTP 422; invalid source ledgers return HTTP 500.

The default dates are 2026-01-01 to 2026-03-31, but the report supports other valid years, single-day periods, and zero-activity periods.

## Code path and architecture

1. `frontend/src/App.tsx` manages date inputs, loading, errors, reset, and the report.
2. `frontend/src/api.ts` requests the backend through the Vite proxy.
3. `backend/app/main.py` validates query dates and defines the REST endpoint.
4. `backend/app/ledger.py` reloads `ledger.json` each request, validates accounts, statuses, dates, journal lines and balanced debits/credits.
5. `backend/app/statement.py` groups posted ledger activity into seven statement sections using exact Decimal arithmetic.
6. `backend/tests/` covers expected accounting figures, periods, reversals, precision, invalid inputs, endpoint behavior, and per-request source reload.

The original `ledger.json` is kept at repository root. No P&L values, company names, or account numbers are hardcoded in the application presentation or accounting rules. Account subtype determines classification, and inactive accounts are included in their historical reporting periods.
