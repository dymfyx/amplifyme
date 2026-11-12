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
| Opening book | `src/screens/SessionSetup.tsx` | Start flat or carry a custom position per name |
| Terminal | `src/screens/Terminal.tsx` | The trading shell with all panels |

The terminal switches its central ticket by role:

- **Market Maker** → `QUOTE TICKET` (two-way bid/offer, size, validity)
- **Sales** → `CLIENT ORDER` (client, **desk side**, quantity, limit price) with a `RECENT FILLS` tape underneath. The side toggle is the *desk's* side: a client SELL defaults the toggle to BUY.

The scorecard is hidden while you trade. Press `SCORE` in the top bar (or the teaser under the event feed) to
reveal it in a drawer; `ESC` or a click on the backdrop closes it.

## Opening book

After picking a desk you decide what inventory you start with:

- **FLAT** (default) — no positions, zero P&L, the full $20M trading budget.
- **CUSTOM BOOK** — an opening quantity per name (negative = short) and an average price. The book is marked
  at that average, so P&L starts at zero, and it is financed separately from the $20M trading budget.

`RESTART` re-applies the same opening book against a fresh market seed; `EXIT DESK` goes back to the desk
picker. Deep links (`#sales`, `#market-maker`) skip the setup step and open flat.

## Simulation clock

The session compresses 15 trading days (09:30-16:00 each) into 30 minutes of real time.

| Control | Behaviour |
|---|---|
| `PAUSE` / `RESUME` | Freezes the clock, prices, quote countdowns and fills |
| `SPEED 1x / 2x / 4x` | Multiplies how many engine ticks run per 250 ms frame |
| `SPACE` | Pause / resume |
| `1` `2` `4` | Pick a speed |

Every engine tick moves the clock ~48.75 simulated seconds, counts quote validity down, and can fill a resting
quote against the client. Positions are marked to market and `P&L`, `NET EXPOSURE` and `COMMISSION` recompute on
every tick.

### Market data cadence

A 250 ms tick is not a price update. The tape refreshes on a slower cadence so the screen stays readable:

| Knob | Value | Meaning |
|---|---|---|
| `PRICE_UPDATE_TICKS` | 4 | Prices move **once per second**; the ticks in between only advance the clock |
| `BOOK_MIN_MOVE_BPS` | 8 | The five-level book is only rebuilt once the mid has moved 8 bps (0.08%); headlines and jumps force a rebuild |

Each price update appends one point to the chart series, so the `30M / 2H / 6H / 1D` ranges read as 195-second
bars. Order sizes are carried over with a ±30% jitter between rebuilds instead of being re-drawn from scratch.

Quotes and client orders in the ticket follow the live book until you edit a price field, so you never send a
stale price by accident.

### Seeds and restarts

`createSession(seed)` is a pure function, so a session is fully reproducible from its seed. New sessions pick a
random seed (`100000`-`999999`), shown as `SEED` in the status bar; `RESTART` in the top bar starts a fresh one.
Same seed → same path; new session → different market.

Every session — first load and every `RESTART` — opens **flat**: no positions, no orders, no trades, zero
commission and zero realised P&L, with the full $20M cash budget. Only the market path changes with the seed.

### Cash budget

The desk starts with **$20,000,000** of cash (`STARTING_CASH`, shown as `CASH` in the P&L strip and
`AVAILABLE CASH` in the ticket). Buys are settled in cash and charged 0.5% commission:

- a client order that costs more than the remaining cash is rejected (`ORDER REJECTED · insufficient cash …`),
- a bid the desk could not settle is rejected too (`QUOTE REJECTED · buying N would exceed the cash budget`),
- sells credit cash, so the desk can trade its way back out of a tight book.

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
    SessionSetup.tsx    opening book: flat or carry inventory
    Terminal.tsx        trading shell composition
  components/
    TopBar.tsx          brand, P&L strip, CASH, SCORE / RESTART / EXIT
    MarketWatch.tsx     instrument list, click to load
    BookPanel.tsx       depth ladder with spread
    DispatchPanel.tsx   system-dispatched RFQs -> ticket
    TradeTicket.tsx     role-aware quote / order ticket + quote tabs
    ChartPanel.tsx      SVG price chart with event markers and volume
    PositionsPanel.tsx  BOOK tabs: positions / orders / trades
    EventFeed.tsx       news feed with tag and impact
    ScoreDrawer.tsx     hidden scorecard drawer
    StatusBar.tsx       sim clock, day counter, seed, session state
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

**P1 complete** — live clock, paced tick stream, event shocks, quote/order fills, cash settlement and
mark-to-market P&L all run off the simulation engine. Scoring is still a placeholder card.

| Phase | Scope |
|---|---|
| P0 (done) | Static shell, role selection, all panels on mock data |
| P1 (done) | Clock control, tick stream, quotes/orders, fills, mark-to-market P&L |
| P2 | Live scoring off decision telemetry, settlement report, replay |
| P3 | Polish: sounds, resizable panels, session save/restore |

## Working rules

See `AGENTS.md`: every change ships with a matching git commit and updated tests, and the full suite must be
green before hand-off.
