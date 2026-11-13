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

The session compresses 15 trading days (09:30-16:00 each) into 5, 15 or 30 minutes of real time, picked on the
entry screen:

| Session | Simulated seconds per tick | Ticks in the session | Chart bar |
|---|---|---|---|
| `5 MIN` | 292.5 | 1,200 | ~4.9 simulated minutes |
| `15 MIN` | 97.5 | 3,600 | ~1.6 simulated minutes |
| `30 MIN` (default) | 48.75 | 7,200 | 48.75 simulated seconds |

The tick cadence never changes — only the simulated span each tick covers. A 5-minute session therefore keeps the
same dense tape and the same 20 headlines, so it reads as a compressed day rather than a flat, slow one.

| Control | Behaviour |
|---|---|
| `PAUSE` / `RESUME` | Freezes the clock, prices, quote countdowns and fills |
| `SPEED 1x / 2x / 4x` | Multiplies how many engine ticks run per 250 ms frame |
| `SPACE` | Pause / resume |
| `1` `2` `4` | Pick a speed |

Every engine tick moves the clock by the tier's simulated span (48.75 s at 30 minutes), counts quote validity
down, and can fill a resting quote against the client. Positions are marked to market and `P&L`, `NET EXPOSURE`
and `COMMISSION` recompute on every tick. The top bar shows the time left in real minutes and the tier (`TIME
LEFT 04:20 5 MIN`); when it hits zero the market closes and the settlement report opens by itself.

### Market data cadence

A 250 ms tick is not a price update. The tape refreshes on a slower cadence so the screen stays readable:

| Knob | Value | Meaning |
|---|---|---|
| `PRICE_UPDATE_TICKS` | 1 | Prices move on **every tick (4 times a second)** so the tape walks continuously instead of stepping |
| `BOOK_MIN_MOVE_BPS` | 8 | The five-level book is only rebuilt once the mid has moved 8 bps (0.08%) |
| `FORCED_REBOOK_BPS` | 12 | A headline worth at least 12 bps to that name rebuilds the book immediately |
| `DRIFT_RELEASE` / `DRIFT_TTL` | 0.25 / 24 | A headline releases a quarter of its remaining drift per update, over 24 updates (~12 s) |
| `FLOW_CHANCE` | 0.92 | Nearly every update carries an order-flow print (small clips most of the time, an occasional sweep); with no driver the price does not move |

Each price update appends one point to the chart series, so the `30M / 2H / 6H / 1D` ranges read as
48.75-second bars (480 bars per trading day). Order sizes are carried over with a ±30% jitter between
rebuilds instead of being re-drawn from scratch.

Quotes and client orders in the ticket follow the live book until you edit a price field, so you never send a
stale price by accident.

### Quote width and fill probability

A quote that is 1x the market spread is filled about **96%** of the time; widen it to 2x and the client accepts
it about **61%** of the time, 3x about **26%**, with a hard floor of 12%. The ticket shows the live number as
`EST. FILL`, and the same ratio feeds the `DISCIPLINE` score. Tight quotes win the flow and eat adverse
selection; wide quotes trade rarely but keep the edge. Anything past ~3.4x the market spread is basically a
pass, so the RFQ is better declined than quoted.

### What moves the tape

Prices are event driven: every update is the sum of **named drivers**, so no move is random noise.

| Driver | Where it comes from | Typical size |
|---|---|---|
| `headline` | a released news item with `direction` (+1/-1) and `driftBps` in `src/engine/scenario.ts`, scaled by the name's `sigma` (0.7x-1.8x) | up to ±110 bps, released over ~12 s |
| `flow` | one of twelve balanced microstructure events in `FLOW_EVENTS` (buy flow / sell flow, ETF bid / ETF offer, short cover / long unwind, retail bid / retail sell, index flow, block print, sweep bid / sweep offer), drawn by weight with equal bullish/bearish mass; occasional sweeps print 3x normal size | 3-11 bps per update |
| `fill` | your own executions: buying presses the price up, selling presses it down, sized off the traded notional (`fillImpactBps`) | 3-10 bps, 40% immediately and the rest decaying over ~12 updates |

Your own fills are part of the model too: a $1.6m clip leaves the full 10 bps behind, a $160k clip about 3.6 bps.
That is why working a big order in one go moves the book against you — split it and let the impact decay.

The `PRICE TAPE` panel lists every material update with its drivers, and the `DRIVER` column in
`MARKET WATCH` shows the latest cause per name (hover for the full remark). The event feed tags each
headline `▲ BULLISH` or `▼ BEARISH`; 20 scripted headlines play out across the 15 days.

### Seeds and restarts

`createSession(seed)` is a pure function, so a session is fully reproducible from its seed. New sessions pick a
random seed (`100000`-`999999`), shown as `SEED` in the status bar; `RESTART` in the top bar starts a fresh one.
Same seed → same path; new session → different market.

Every session — first load and every `RESTART` — opens with the book you chose in the setup screen (flat by
default): no orders, no trades, zero commission and zero realised P&L, with the full $20M cash budget. Only the
market path changes with the seed.

### Cash budget

The desk starts with **$20,000,000** of cash (`STARTING_CASH`, shown as `CASH` in the P&L strip and
`AVAILABLE CASH` in the ticket). Buys are settled in cash and charged 5 bps commission (`COMMISSION_RATE`,
0.05% per side):

- a client order that costs more than the remaining cash is rejected (`ORDER REJECTED · insufficient cash …`),
- a bid the desk could not settle is rejected too (`QUOTE REJECTED · buying N would exceed the cash budget`),
- sells credit cash, so the desk can trade its way back out of a tight book.

## Client flow vs the exchange

You can make a price two ways, and every fill is tagged with its venue in the blotter and the settlement report.

| Path | How you trade | What it costs you |
|---|---|---|
| `client` | a dispatched RFQ or client order is priced against your own quote and fills at *your* price | you earn the spread versus mid (edge > 0), but only if the client accepts |
| `exchange` | the `EXCHANGE` ticket takes liquidity from the visible book, sweeping levels | you pay the market spread plus your own impact (edge < 0 straight away) |

The exchange ticket prices the sweep for you: `Best price`, `Est. avg price` across the levels it would consume,
`BOOK SIZE` (shares available on that side of the visible book), `NOTIONAL` and `COMMISSION`. Clips bigger than
the book are rejected (`EXCHANGE REJECTED · only … on the book`), and buys are checked against the cash budget.

The two legs are the classic bid-offer loop: buy from a client below mid, sell on the exchange above it (or buy
on the exchange to cover a short), and keep the difference. `Spread capture` in the settlement report is exactly
that number in dollars — positive means the edge earned on client flow covered the cost of crossing the exchange.
The report also splits `Fills` into `Venue split` (client vs exchange), and `Hit ratio above mid` / `Avg edge…`
only count client flow, so crossing the exchange never flatters your quoting quality.

## Scoring and settlement

Nothing here is mock data any more. Every quote, fill, decline and headline writes a record into
`src/engine/telemetry.ts`, and `src/engine/scoring.ts` turns that trace into the scorecard and the end-of-session
report.

| Dimension | What it measures | How it is computed |
|---|---|---|
| `RETURNS` | Money made | `50 + 50·tanh(total P&L / $20k)` |
| `DISCIPLINE` | Quoting inside the market | Penalises quotes far from ~1.6× the market spread and RFQs declined; neutral (50) if you never quote |
| `REACTION` | Speed on dispatched RFQs | `100 − 2.5 × median response ticks`; neutral if you never answer |
| `RESILIENCE` | Drawdown control | `100 − 30 × (max drawdown / $20M)` while you carry risk |
| `TRADE MANAGEMENT` | Size of open risk | `100 − 400 × (average gross exposure / $20M)` |
| `ADAPTABILITY` | Reacting to headlines | `35 + 65 × (headlines traded into / headlines)` inside a 20-tick window |

`COMPOSITE` weights them 25 / 20 / 15 / 15 / 15 / 10 and maps it to a percentile. A never-traded session scores
50 everywhere — doing nothing is not a high score.

The `SCORE` button opens a live drawer with the same numbers during the session. When the clock runs out the
market stops at `16:00:00`, and a **settlement report** opens: total P&L breakdown, flow stats (fills, hit ratio,
average edge vs the mid, quotes sent, quote width vs market), risk stats (peak P&L, max drawdown, average gross
exposure, median RFQ response, headlines traded) and the scorecard with a one-line coaching note. `RUN ANOTHER
SESSION` restarts with a fresh seed; `REVIEW THE DESK` closes the report to inspect the tape.

### Benchmark

The report also shows the passive alternative: **`BENCHMARK · BUY & HOLD`** splits the $20M cash budget equally
across the five names at their opening prices and holds them to the close. The desk sees the benchmark P&L, its
return, `ALPHA VS BENCHMARK` (your total minus the benchmark) and either `YOU BEAT THE BENCHMARK` or `BEHIND THE
BENCHMARK` — so a flat book is not a free pass, and a profitable session can still lag the market.

## Language

The entry screen toggles between English (default) and 中文. The choice covers the entry screen, the setup screen,
every panel, the score drawer and the settlement report; headlines, tickers and per-name driver remarks stay in
English on purpose (they are the market content). Translations live in `src/i18n/zh-chrome.ts` (chrome),
`src/i18n/zh-panels.ts` (the eight tape panels) and `src/i18n/zh-data.ts` (engine strings such as flow drivers and
dispatch notes); anything not translated falls back to the English source text.

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
broken layout): `http://localhost:5173/#market-maker`. Query parameters pin the group exercise:

| Parameter | Values | Effect |
|---|---|---|
| `seed` | integer | Pins the scenario; everyone opening the link sees the same prices, headlines and path |
| `lang` | `en` / `zh` | Entry language (default `en`) |
| `minutes` | `5` / `15` / `30` | Session length (default `30`) |

`#market-maker?seed=20261112&lang=zh&minutes=5` is therefore a complete assignment: same desk, same market, Chinese
UI, five-minute round. Ignored or invalid values fall back to the defaults.

## Project layout

```text
src/
  App.tsx               role state: entry screen -> terminal
  types.ts              shared domain types
  engine/
    rng.ts              seeded PRNG helpers (state-in / state-out)
    scenario.ts         universe, headline templates, client roster
    simulation.ts       session state machine: clock, walk, book, quotes, fills, P&L
    telemetry.ts        decision trace: quotes, fills, declines, exposure, drawdown, headline responses
    scoring.ts          six-dimension scorecard + settlement stats + coaching line
  hooks/
    useSimulation.ts    drives the engine on a 250 ms interval, exposes actions

  screens/
    RoleSelect.tsx      desk selection screen
    SessionSetup.tsx    opening book: flat or carry inventory
    Terminal.tsx        trading shell composition
  components/
    TopBar.tsx          brand, P&L strip, CASH, SCORE / RESTART / EXIT
    MarketWatch.tsx     instrument list with the live DRIVER column, click to load
    BookPanel.tsx       depth ladder with spread
    DispatchPanel.tsx   system-dispatched RFQs -> ticket
    TradeTicket.tsx     role-aware quote / order ticket + quote tabs
    ExchangeTicket.tsx  take liquidity from the book: sweep pricing, book size, commission
    ChartPanel.tsx      SVG price chart with event markers and volume
    PositionsPanel.tsx  BOOK tabs: positions / orders / trades
    PriceTape.tsx       why each price moved: drivers per update, click to load
    EventFeed.tsx       news feed with tag, bias arrow and impact
    ScoreDrawer.tsx     hidden live scorecard drawer
    SettlementReport.tsx end-of-session report: P&L, flow, risk, score, coaching
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
docs/beginner-guide.pdf  Chinese beginner guide (screenshots, playbook, FAQ)
```

## Status

**P2.9 complete** — live clock, event-driven tape, client and exchange fills, cash settlement and mark-to-market P&L all
run off the simulation engine, and the scorecard plus end-of-session report are computed from the decision
telemetry (no placeholder numbers left in the app). The site builds to plain static files: GitHub Pages,
Netlify, or a single self-contained HTML file (see [Publish a link](#publish-a-link)).

| Phase | Scope |
|---|---|
| P0 (done) | Static shell, role selection, all panels on mock data |
| P1 (done) | Clock control, tick stream, quotes/orders, fills, mark-to-market P&L |
| P2 (done) | Decision telemetry -> live scorecard + settlement report, 5 bps commission, 0.25 s tape |
| P2.5 (done) | Event-driven prices with named drivers, PRICE TAPE panel, static hosting / single-file build |
| P2.6 (done) | Pinned-seed share links (?seed=), GitHub Pages deployment |
| P2.7 (done) | EN/中文 UI, 5/15/30-minute tiers with a live countdown and auto-settlement, buy-and-hold benchmark |
| P2.8 (done) | Fill impact on the tape, quote width -> fill probability (EST. FILL), Chinese beginner guide PDF |
| P2.9 (done) | Two venues: client flow vs exchange take-liquidity, VENUE tags, spread capture in the report |
| P3 | Polish: replay, sounds, resizable panels, session save/restore |

## Working rules

See `AGENTS.md`: every change ships with a matching git commit and updated tests, and the full suite must be
green before hand-off.

## Publish a link

Everything — market data, simulation engine, scoring — runs in the browser, so there is no backend, database or
secret to deploy. Any static file host will do.

### GitHub Pages (permanent URL)

1. Push the repo to GitHub. The workflow in `.github/workflows/deploy.yml` deploys on every push to `main`; adjust
   the branch filter there if your default branch is named differently.
2. In the repository: **Settings → Pages → Source: GitHub Actions**.
3. The workflow builds the app and publishes `dist/`; the terminal lives at
   `https://<user>.github.io/<repo>/`.

The app is hash-routed (`#sales`, `#market-maker`), so no SPA rewrite rule is needed and deep links keep working.

The Chinese beginner guide ships with the site: `docs/beginner-guide.pdf` is the source, copied to
`public/beginner-guide.pdf` so it is served at `/beginner-guide.pdf`; the entry screen links to it.

### Netlify Drop (instant URL, no CI)

Run `npm run build`, then drag the `dist/` folder onto [app.netlify.com/drop](https://app.netlify.com/drop) — you
get a public URL straight away. The committed `netlify.toml` already pins `npm run build` and `dist/` if you connect
the repo to Netlify instead.

### Single file (chat / email / USB stick)

```bash
npm run build:single
```

This builds the app and writes `dist-single/index.html`: one self-contained file (~330 KB) with the CSS, the JS
bundle and the favicon inlined as data URIs. Send it to a teammate over chat or email — they double-click it and
play offline in any modern browser. No server, no install, no asset folder to keep together.

### Any other static host

Because every part of the app is client-side, anything that serves static files works: Cloudflare Pages, Vercel,
S3 + CloudFront, an internal nginx box, `npx serve dist` — serve the contents of `dist/` at any subpath and the
relative asset URLs take care of the rest.

## Send it to the group

The desk is a hash-routed static app (`#sales` / `#market-maker`), so any static host works.

- **Hosted link:** https://dymfyx.github.io/amplifyme/ — every teammate opens it in a browser, picks a desk, sets an opening book and plays a 30-minute session. Each visit draws a fresh random seed, so scores are not comparable run to run but the scenario itself is the same.
- **One file:** run `npm run build:single` and send `dist-single/index.html` (~330 KB). It opens from a double-click, offline, no server. Deep links `#sales` / `#market-maker` still work.
- **Any static host:** drag the `dist/` folder onto https://app.netlify.com/drop for an instant throwaway URL.

### Shared sessions (same scenario for the group)

Append `?seed=<digits>` to a deep link to pin the scenario:

- `https://dymfyx.github.io/amplifyme/#sales?seed=20261112`
- `https://dymfyx.github.io/amplifyme/#market-maker?seed=20261112`

Everyone who opens the same URL gets the same headline script, the same opening prices and the same price path
(only the decisions differ), so scores are comparable. A `SHARED SEED` chip appears in the top bar, and
`RESTART` replays the same session from 09:30 instead of drawing a new seed. Without `?seed=`, every visit
picks a fresh random seed, shown in the status bar as `SEED nnnnnn`.
