# Market Simulation — Practice Terminal

A single-page practice terminal for the **Market** simulation: pick a desk (Sales or Market Maker), then work
client flow across five equities in a compressed 15-day session while a live event feed and a hidden scorecard
track your behaviour.

The layout follows the AmplifyME Market Simulation sample: market data on the left, pricing and booking in the
middle, news and scoring on the right.

## Stack

- **React 19 + TypeScript**, bundled with **Vite**
- **Plain CSS custom properties** — no UI framework; dark terminal theme, monospace everywhere
- **Vitest + Testing Library** (jsdom) for component tests
- Runtime dependencies: `react`, `react-dom` only

## Scripts

```bash
npm install      # install dependencies
npm run dev      # dev server on http://localhost:5173
npm test         # run the test suite once
npm run build    # type-check (tsc --noEmit) then production build
npm run preview  # serve the production build
```

## Screens

| Route (state) | File | What it does |
|---|---|---|
| Entry | `src/screens/RoleSelect.tsx` | Two separate desk entrances: Sales and Market Maker |
| Terminal | `src/screens/Terminal.tsx` | The trading shell with all panels |

The terminal switches its central ticket by role:

- **Market Maker** → `QUOTE TICKET` (two-way bid/offer, size, validity)
- **Sales** → `CLIENT ORDER` (client, side, quantity, limit price)

The scorecard is hidden while you trade. Press `SCORE` in the top bar (or the teaser under the event feed) to
reveal it in a drawer; `ESC` or a click on the backdrop closes it.

## Deep links

Append `#sales` or `#market-maker` to the URL to open a desk directly (handy for screenshots and for sharing a
broken layout): `http://localhost:5173/#market-maker`.

## Project layout

```text
src/
  App.tsx               role state: entry screen -> terminal
  types.ts              shared domain types
  data/mock.ts          mock instruments, book, news, RFQs, quotes, scorecard
  screens/
    RoleSelect.tsx      desk selection screen
    Terminal.tsx        trading shell composition
  components/
    TopBar.tsx          brand, P&L strip, SCORE / EXIT
    MarketWatch.tsx     instrument list, click to load
    BookPanel.tsx       depth ladder with spread
    DispatchPanel.tsx   system-dispatched RFQs -> ticket
    TradeTicket.tsx     role-aware quote / order ticket + quote tabs
    ChartPanel.tsx      SVG price chart with event markers and volume
    PositionsPanel.tsx  BOOK tabs: positions / orders / trades
    EventFeed.tsx       news feed with tag and impact
    ScoreDrawer.tsx     hidden scorecard drawer
    StatusBar.tsx       sim clock, day counter, session state
    PanelHeader.tsx     shared numbered panel header
  styles.css            design tokens + terminal layout
  test/
    setup.ts            jest-dom matchers
    app.test.tsx        component tests
docs/ui-proposal.md     layout proposal, decisions and roadmap
```

## Status

**P0 skeleton complete** — full layout, two desks, mock data, local interactions. No simulation engine yet.

| Phase | Scope |
|---|---|
| P0 (done) | Static shell, role selection, all panels on mock data |
| P1 | Engine wiring: clock control, tick stream, quotes/orders, fills, P&L |
| P2 | Event stream, live scoring, settlement report |
| P3 | Polish: hotkeys, sounds, resizable panels |

## Working rules

See `AGENTS.md`: every change ships with a matching git commit and updated tests, and the full suite must be
green before hand-off.
