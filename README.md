# Campfire Income Statement

An accountant-readable income statement application for any inclusive reporting period, backed by the original official Campfire `ledger.json`. Its seven sections and account-level totals are calculated server-side; the React page uses native date inputs and renders exact financial strings.

## Supported and verified versions

- **Minimum supported:** Python 3.12+, Node.js >=22.12.0, a compatible npm 10+; React 19, Vite 7, TypeScript 5.9. Use `backend/requirements*.txt` and `frontend/package-lock.json` for exact dependency versions.
- **Verified in Linux GitHub Actions:** Python **3.12.16**, Node.js **22.23.4**, npm **10.9.9**; FastAPI **0.162.2**, Uvicorn **0.54.0**, pytest **9.2.0**, HTTPX **0.28.1**; React **19.3.1**, Vite **7.3.7**, TypeScript **5.9.3**, Vitest **4.1.12**, Playwright **1.65.0**, and **@rollup/wasm-node 4.68.1**.
- **Local Windows development machine:** Python **3.14.2**, Node.js **24.18.0**, npm **10.2.3**. Check your installed versions with `python --version`, `node --version`, `npm --version`.
- No database, authentication, Docker, custom calendar or deployment dependencies.

GitHub Actions also verifies clean installation, unit tests and builds on hosted Windows and macOS. Hosted Windows runs a real Chromium browser-to-API smoke test. These checks cannot reproduce the candidate's restricted device policy.

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
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
cd ..\frontend
npm ci
cd ..
```

These Windows commands use the virtual environment's Python directly, so PowerShell script activation is not required. If `python` is unavailable but the Python launcher is installed, use `py -3` for the environment creation command.

## Run both servers

From the **repository root** on macOS, Linux or Windows:

```bash
npm run dev
```

This starts FastAPI at **http://127.0.0.1:8000** and Vite at **http://127.0.0.1:5173**. The development proxy forwards requests from React to FastAPI. Python reload and Vite hot reload remain enabled. Press **Ctrl+C** to stop both services. The root launcher is `scripts/dev.mjs` and does not contain Rollup-loader patches or any `ROLLUP_WASM_PATH` dependency.

The root launcher invokes the installed Vite CLI directly through Node, matching the current frontend `dev` command without requiring a Windows command shell. Keep its Vite arguments aligned if you change `frontend/package.json`'s `dev` script; npm lifecycle hooks are not run by this direct invocation.

Alternatively, start each service in separate terminals after installation:

On Windows, the setup above does not activate the environment. From `backend/`, use `.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload` for the backend, and `.\.venv\Scripts\python.exe -m pytest -v` for the backend tests below. Activation is optional.

```bash
# In backend/, with its virtual environment activated
python -m uvicorn app.main:app --reload

# In frontend/, in a second terminal
npm run dev
```

FastAPI documentation: **http://127.0.0.1:8000/docs**.

## Rollup WASM on restricted Windows machines

Vite 7 uses Rollup 4. This project installs the official **@rollup/wasm-node@4.68.1** as `rollup`, through a direct npm alias and an npm override. A clean `npm ci` uses the committed npm-generated lockfile. No file under `node_modules` needs to be edited.

The exact `frontend/package.json` configuration is:

```json
{
  "devDependencies": {
    "rollup": "npm:@rollup/wasm-node@4.68.1"
  },
  "overrides": {
    "rollup": "$rollup"
  }
}
```

The excerpt shows only the Rollup-specific keys, not the entire manifest. Confirm the installation inside `frontend/` with:

```bash
npm ci
npm ls rollup @rollup/wasm-node vite vitest
node -e "const p=require('rollup/package.json'); console.log(p.name,p.version)"
```

The last command must output `@rollup/wasm-node 4.68.1`. Linux CI checks this directly; normal hosted Windows CI cannot reproduce a company-managed Windows App Control policy. For a restricted machine, **run a fresh installation without editing third-party files** and obtain organizational approval if its policy blocks any remaining executable or WASM content. Never disable security controls.

## Tests, build, and dependency security

```bash
# From backend/ with its virtual environment activated
python -m pytest -v

# From frontend/
npm test
npm run build
npm ls rollup @rollup/wasm-node vite vitest
npm audit --json
npm audit --omit=dev --json
npx playwright install chromium    # one-time browser download
npm run test:e2e
```

Playwright starts a real backend and Vite server and tests the complete flow in Chromium. If your Linux environment is missing Chromium system libraries, install them using approved system package procedures. CI uses `npx playwright install chromium` on hosted runners to avoid unrelated third-party apt repository failures.

The `frontend/package-lock.json` is committed and CI uses `npm ci` for reproducibility. GitHub Actions runs backend tests, frontend tests, audits, build, browser smoke, and root startup checks. The root script uses your local `backend/.venv`; it does not automatically install dependencies.

## API contract

`GET /income-statement?start=YYYY-MM-DD&end=YYYY-MM-DD`

```bash
curl "http://127.0.0.1:8000/income-statement?start=2026-01-01&end=2026-03-31"
```

Response fields: `company`, `currency`, `start`, `end`, `posted_entries`, `sections` (ordered section keys, titles, account lines and totals), and `summary`. Amounts are **signed, two-decimal strings**; negative values use parentheses only in the frontend.

The initial date fields are preselected for Q1 2026, but the page displays instructions until **Generate Statement** is clicked. **Reset to Q1 2026** restores those dates without automatically generating a report. Any valid dates from years 0001 through 9999 are accepted; period bounds are inclusive. Invalid dates and reversed ranges return HTTP 422. Invalid source ledgers return a controlled HTTP 500 response. Empty periods return a statement with zero balances.

## Money and accounting rules

Ledger journal-line debits and credits must be finite, nonnegative plain decimal strings (no exponent notation or separators) with at most two fractional digits and at most **9,999,999,999,999,999.99** per line. Larger values are rejected as invalid input. The calculation uses a temporary Decimal precision sized to the number of journal lines, so valid repeated large amounts aggregate exactly without silent rounding. The React formatter never converts money strings to floating point.

Only posted transactions are counted. Revenue and other income increase with credits; expenses increase with debits. Contra-revenue debits lower revenue, and expense credits reduce expenses. The account subtype determines the statement section. Historical posted activity in inactive accounts remains included. Balance-sheet account balances do not enter the P&L.

## Implementation map

1. `frontend/src/App.tsx` manages dates, dynamic company metadata, loading, errors and reset; `formatMoney.ts` formats exact strings.
2. `frontend/src/api.ts` issues requests through the Vite proxy.
3. `backend/app/main.py` validates dates and handles API errors.
4. `backend/app/ledger.py` loads and validates the original JSON on each request.
5. `backend/app/statement.py` calculates seven sections and account subtotals with `Decimal`.
6. `backend/tests/` and `frontend/src/*.test.ts*` cover accounting, validation, precision and UI state; `frontend/e2e/` runs the real browser smoke test.
