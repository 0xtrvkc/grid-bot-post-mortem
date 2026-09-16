# BTC/USDT Spot Grid — Quant Post-Trade Report

A single-file, self-contained HTML report that dissects a canceled BTC/USDT spot grid bot's performance — and then asks "what if it hadn't been canceled?" using live BTC price data.

No build step, no backend, no dependencies. Open the HTML file in a browser and it does the rest, including fetching live price data on every load.

## Live demo

Open [`index.html`](./index.html) or https://0xtrvkc.github.io/grid-bot-post-mortem/

## What it does

The report has four tabs:

**Closed (Actual)**
The trade as it actually happened — grid mechanics, position ledger, cash flow bridge (investment → grid profit → floating loss → ending balance), grid range position, cash-flow breakeven runway, and a return-attribution breakdown separating the grid's own trading edge from directional BTC exposure.

**Ongoing (What-If)**
Simulates the same position had it never been canceled. On every page load it fetches an hourly BTC price feed, marks the held inventory to the current price, and extends the realized grid profit forward at its historical pace. Nothing here is a re-opened position — it's a projection to answer one question: did canceling lock in a worse outcome than letting the cash flow run?

**Risk Lab**
Stress-tests the cancellation decision with explicit controls for horizon, BTC price move, grid activity, equity stop, and out-of-grid buffer. The model separates inventory P&L from grid cash flow and reports whether an equity guard, range guard, both, or neither would trigger. It is a terminal sensitivity test, not a path-by-path backtest.

**Compare & Stats**
Closed vs. Ongoing side by side, plus real quant statistics computed from the live-fetched hourly series: max drawdown, annualized volatility, downside volatility, historical VaR/CVaR, worst hour, skewness, excess kurtosis, a buy-and-hold benchmark for the same window, and the grid's alpha over it. Visualized with a dumbbell comparison chart, a real price-path sparkline, and a return-distribution histogram with a fitted normal curve overlaid.

## Data sources

- **Closed-tab figures** are taken directly from the exchange's own PnL / History / Details screens and are hardcoded — they're historical fact and don't change.
- **Ongoing and Compare tabs** fetch hourly BTC price data at runtime from:
  `https://raw.githubusercontent.com/0xtrvkc/dynamic-btc-analytics-dashboard/main/btc_1h_price.json`
  This is an independent price index, not the exchange's own tick feed, so ongoing/compare figures are analytical estimates, not exchange-confirmed numbers. If the fetch fails (offline, CORS, feed down), the report falls back to a cached snapshot and says so.

## Design

- Apple-style quant report aesthetic: quiet, monospace tabular numbers, light theme by default with a day/night toggle.
- Dollar amounts are hidden by default and shown as percentages of capital instead — the underlying figures stay in the page source but aren't rendered, so the page is safe to screenshot or share without exposing account size.
- All charts (range map, cash flow bridge, dumbbell comparison, price sparkline, return histogram) are hand-built with CSS/SVG — no charting library, so nothing depends on a CDN being reachable.
- Responsive two-column mobile summaries, keyboard-accessible tabs, saved theme preference, reduced-motion support, and explicit live-feed freshness reporting.

## QuantDinger-inspired risk model

The upgrade borrows a grid-specific risk distinction from [QuantDinger](https://github.com/OpenByteInc/QuantDinger):

- Equity stops evaluate the whole strategy account (realized grid cash flow plus open inventory), not price versus a moving average entry.
- Out-of-grid protection is a separate structural guard with a configurable buffer around the grid boundaries.

The implementation is original, browser-only, and uses no QuantDinger backend code or branding.

## Tech stack

Plain HTML, CSS, and vanilla JavaScript. No frameworks, no build tools, no npm install. Just open the file.

## Disclaimer

This is a personal post-trade analysis tool, not financial advice. The "Ongoing" tab is a simulation for reflection purposes only, built on an independent price index that may not exactly match any specific exchange's execution prices.

## License

MIT (or your preference — update this section before publishing).
