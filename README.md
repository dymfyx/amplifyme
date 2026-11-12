# Market Simulation — Practice Terminal

A single-page practice terminal for the **Market** simulation: pick a desk (Sales or Market Maker), then work
client flow across five equities in a compressed 15-day session while a live event feed and a hidden scorecard
track your behaviour.

The layout follows the AmplifyME Market Simulation sample: market data on the left, pricing and booking in the
middle, news and scoring on the right.

## Stack

- **React 19 + TypeScript**, bundled with **Vite**
- **Plain CSS custom properties** — no UI framework; dark terminal theme, monospace everywhere
- **Pure-function simulation engine** (`src/engine/`) — seeded, deterministic, no side effects outside `step()`
- **Vitest + Testing Library** (jsdom) — engine tests plus a thin UI integration layer
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
- **Sales** → CLIENT ORDER (client, side, quantity, limit price) with a RECENT FILLS tape underneath

The scorecard is hidden while you trade. Press `SCORE` in the top bar (or the teaser under the event feed) to
reveal it in a drawer; `ESC` or a click on the backdrop closes it.

## Simulation clock

The session compresses 15 trading days (09:30-16:00 each) into 30 minutes of real time.

| Control | Behaviour |
|---|---|
| `PAUSE` / `RESUME` | Freezes the clock, prices, quote countdowns and fills |
| `SPEED 1x / 2x / 4x` | Multiplies how many engine ticks run per 250 ms frame |
| `SPACE` | Pause / resume |
| `1` `2` `4` | Pick a speed |

Every engine tick moves the clock ~48.75 simulated seconds, random-walks each name, rebuilds its five-level book,
reveals due headlines (with a price shock), counts quote validity down, and can fill a resting quote against the
client. Positions are marked to market and `P&L`, `NET EXPOSURE` and `COMMISSION` recompute on every tick.

Quotes and client orders in the ticket follow the live book until you edit a price field, so you never send a
stale price by accident.

## Desktop shortcut

Run `npm run shortcut` once and a **Market Simulation** shortcut appears on your desktop (dark-blue terminal icon).
Double-clicking it:

1. starts the local preview server in a hidden window (running `vite build` first if `dist/` is missing),
2. waits until `http://127.0.0.1:4173` answers,
3. opens the terminal in your default browser.

Clicking it again while the server is up just opens the browser — no duplicate servers.

| Script | Purpose |
|---|---|
| `launcher/start-sim.ps1` | Launcher behind the shortcut; `-NoBrowser` skips opening the browser, `-Port` overrides 4173 |
| `launcher/stop-sim.ps1` | Stops whatever process is listening on the simulation port |
| `launcher/install-shortcut.ps1` | (Re)creates the desktop shortcut, using `public/icon.ico` |
| `public/icon.ico` | Shortcut icon, also served as the browser favicon |

## Deep links

Append `#sales` or `#market-maker` to the URL to open a desk directly (handy for screenshots and for sharing a
broken layout): `http://localhost:5173/#market-maker`.

## Project layout

```text
src/
  App.tsx               role state: entry screen -> terminal
  types.ts              shared domain types
  engine/
    rng.ts              seeded PRNG helpers (state-in / state-out)
    scenario.ts         universe, headline templates, client roster
    simulation.ts       session state machine: clock, walk, book, quotes, fills, P&L
  hooks/
    useSimulation.ts    drives the engine on a 250 ms interval, exposes actions
  data/mock.ts          seed positions/orders/trades, news copy, scorecard copy
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
    launcher.test.ts    desktop launcher / icon assertions
launcher/
  start-sim.ps1         start preview + open browser (desktop shortcut target)
  stop-sim.ps1          stop the preview server
  install-shortcut.ps1  create the desktop shortcut
public/icon.ico         shortcut icon + favicon
docs/ui-proposal.md     layout proposal, decisions and roadmap
```

## Status

**P1 complete** — live clock, tick-driven prices, event shocks, quote/order fills and mark-to-market P&L all run
off the simulation engine. Scoring is still a placeholder card.

| Phase | Scope |
|---|---|
| P0 (done) | Static shell, role selection, all panels on mock data |
| P1 (done) | Clock control, tick stream, quotes/orders, fills, mark-to-market P&L |
| P2 | Live scoring off decision telemetry, settlement report, replay |
| P3 | Polish: sounds, resizable panels, session save/restore |

## Working rules

See `AGENTS.md`: every change ships with a matching git commit and updated tests, and the full suite must be
green before hand-off.
