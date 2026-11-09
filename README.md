# Campfire Income Statement

An accountant-readable income statement application for any inclusive reporting period, backed by the original official Campfire `ledger.json`. Its seven sections and account-level totals are calculated server-side; the React page uses native date inputs and renders exact financial strings.

## Stack and supported environment

- **Backend:** Python 3.12+, FastAPI, Uvicorn, `Decimal`, pytest, FastAPI TestClient
- **Frontend:** Node.js 22+, npm, React 19, TypeScript 5.9, Vite 7, native dates, Fetch API, CSS
- **Testing:** Vitest, React Testing Library, Playwright Chromium, GitHub Actions
- No database, authentication, Docker, custom calendar, or unnecessary runtime dependencies.

GitHub Actions uses Python 3.12, Node.js 22 and the frontend's committed npm lockfile. Use the actual installed versions from `python --version`, `node --version`, and `npm --version` when comparing environments.

## One-time installation

Clone this repository, then open a terminal in its root.

### macOS / Linux

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
cd ../frontend
npm ci
cd ..
```

### Windows PowerShell

```powershell
cd backend
py -3 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
cd ..\frontend
npm ci
cd ..
```

## Run both servers

From the **repository root** on macOS, Linux or Windows:

```bash
npm run dev
```

This starts FastAPI at **http://127.0.0.1:8000** and Vite at **http://127.0.0.1:5173**. The development proxy forwards requests from React to FastAPI. Python reload and Vite hot reload remain enabled. Press **Ctrl+C** to stop both services.

Alternatively, start each service in separate terminals after installation:

```bash
# In backend/, with its virtual environment activated
python -m uvicorn app.main:app --reload

# In frontend/, in a second terminal
npm run dev
```

FastAPI documentation: **http://127.0.0.1:8000/docs**.

## Tests, build, and dependency security

```bash
# From backend/ with its virtual environment activated
python -m pytest -v

# From frontend/
npm test
npm run build
npm audit --json
npm audit --omit=dev --json
npx playwright install chromium    # one-time browser download
npm run test:e2e
```

Playwright starts a real backend and Vite server and tests the complete flow in Chromium. On a clean Ubuntu CI runner, use `npx playwright install --with-deps chromium` to install browser system dependencies.

The `frontend/package-lock.json` is committed and CI uses `npm ci` for reproducibility. GitHub Actions runs backend tests, frontend tests, audits, build, browser smoke, and root startup checks. The root script uses your local `backend/.venv`; it does not automatically install dependencies.

## API contract

`GET /income-statement?start=YYYY-MM-DD&end=YYYY-MM-DD`

```bash
curl "http://127.0.0.1:8000/income-statement?start=2026-01-01&end=2026-03-31"
```

Response fields: `company`, `currency`, `start`, `end`, `posted_entries`, `sections` (ordered section keys, titles, account lines and totals), and `summary`. Amounts are **signed, two-decimal strings**; negative values use parentheses only in the frontend.

The default report is Q1 2026, but any valid dates from year 0001 to 9999 are accepted; period bounds are inclusive. Invalid dates and reversed ranges return HTTP 422. Invalid source ledgers return a controlled HTTP 500 response. Empty periods return a statement with zero balances.

## Money and accounting rules

Ledger journal-line debits and credits must be finite, nonnegative decimal strings representing at most two fractional digits and at most **9,999,999,999,999,999.99** per line. Larger values are rejected as invalid input. The calculation uses a temporary Decimal precision sized to the number of journal lines, so valid repeated large amounts aggregate exactly without silent rounding. The React formatter never converts money strings to floating point.

Only posted transactions are counted. Revenue and other income increase with credits; expenses increase with debits. Contra-revenue debits lower revenue, and expense credits reduce expenses. The account subtype determines the statement section. Historical posted activity in inactive accounts remains included. Balance-sheet account balances do not enter the P&L.

## Implementation map

1. `frontend/src/App.tsx` manages dates, dynamic company metadata, loading, errors and reset; `formatMoney.ts` formats exact strings.
2. `frontend/src/api.ts` issues requests through the Vite proxy.
3. `backend/app/main.py` validates dates and handles API errors.
4. `backend/app/ledger.py` loads and validates the original JSON on each request.
5. `backend/app/statement.py` calculates seven sections and account subtotals with `Decimal`.
6. `backend/tests/` and `frontend/src/*.test.ts*` cover accounting, validation, precision and UI state; `frontend/e2e/` runs the real browser smoke test.
