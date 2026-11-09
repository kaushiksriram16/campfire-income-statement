"""FastAPI boundary: input validation, ledger reload, statement generation."""
from datetime import date
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .ledger import LedgerError, load_ledger
from .statement import build_statement

app = FastAPI(title="Campfire Income Statement", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/income-statement")
def income_statement(start: str = Query(...), end: str = Query(...)):
    try:
        # date.fromisoformat alone accepts formats beyond YYYY-MM-DD.
        from .ledger import parse_date
        start_date, end_date = parse_date(start), parse_date(end)
        if end_date < start_date:
            raise ValueError("End date must be on or after start date")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    try:
        return build_statement(load_ledger(), start_date, end_date)
    except LedgerError as exc:
        raise HTTPException(status_code=500, detail=f"Invalid ledger: {exc}") from exc
