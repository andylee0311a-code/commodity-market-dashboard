#!/usr/bin/env python3
"""Fetch commodity futures prices and write a compact JSON file for the dashboard."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

ASSETS = {
    "gold": {"name": "Gold", "symbol": "GC=F", "unit": "USD/oz"},
    "silver": {"name": "Silver", "symbol": "SI=F", "unit": "USD/oz"},
    "brent": {"name": "Brent Crude Oil", "symbol": "BZ=F", "unit": "USD/bbl"},
}

OUTPUT = Path(os.environ.get("OUTPUT_PATH", "data/commodities.json"))


def fetch_symbol(symbol: str) -> list[dict[str, object]]:
    frame = yf.download(
        symbol,
        period="max",
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False,
        timeout=30,
    )
    if frame.empty:
        raise RuntimeError(f"No data returned for {symbol}")

    # yfinance may return a MultiIndex even for one symbol.
    if isinstance(frame.columns, pd.MultiIndex):
        frame.columns = frame.columns.get_level_values(0)
    close = frame["Close"].dropna()

    prices: list[dict[str, object]] = []
    for idx, value in close.items():
        date = idx.date().isoformat() if hasattr(idx, "date") else str(idx)[:10]
        prices.append({"date": date, "close": round(float(value), 4)})
    if not prices:
        raise RuntimeError(f"No closing prices returned for {symbol}")
    return prices


def main() -> int:
    assets: dict[str, object] = {}
    errors: list[str] = []

    for key, meta in ASSETS.items():
        try:
            prices = fetch_symbol(meta["symbol"])
            assets[key] = {**meta, "prices": prices}
            print(f"Fetched {len(prices):,} rows for {meta['symbol']}")
        except Exception as exc:  # keep other assets available if one endpoint fails
            errors.append(f"{meta['symbol']}: {exc}")
            print(errors[-1], file=sys.stderr)

    if len(assets) < len(ASSETS):
        raise RuntimeError("Too few assets were fetched successfully: " + "; ".join(errors))

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "source": "Yahoo Finance via yfinance",
        "is_demo": False,
        "errors": errors,
        "assets": assets,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUT.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(OUTPUT)
    print(f"Wrote {OUTPUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
