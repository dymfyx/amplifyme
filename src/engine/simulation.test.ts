import { describe, expect, it } from 'vitest'
import {
  DAY_SECONDS,
  PRICE_UPDATE_TICKS,
  SESSION_SECONDS,
  STARTING_CASH,
  START_SECONDS,
  applyPositionFill,
  createSession,
  cycleSpeed,
  declineDispatch,
  fillClientOrder,
  formatClock,
  selectChartMarkers,
  selectPnl,
  selectPositions,
  sendQuote,
  setSpeed,
  stepSession,
  togglePause,
  advanceSession,
  type SimulationState,
} from './simulation'

const session = (seed = 7) => createSession(seed)

const atEndOfSession = (state: SimulationState): SimulationState => ({
  ...state,
  simSeconds: START_SECONDS + SESSION_SECONDS - 10,
})

describe('simulation clock', () => {
  it('opens at 09:30 on day 1 with five tradable names', () => {
    const state = session()
    expect(formatClock(state.simSeconds)).toBe('09:30:00')
    expect(state.instruments).toHaveLength(5)
    expect(state.status).toBe('RUNNING')
    expect(selectPositions(state)).toEqual([])
  })

  it('advances the clock by roughly one simulated minute per tick', () => {
    const state = stepSession(session())
    expect(state.tick).toBe(1)
    expect(formatClock(state.simSeconds)).toBe('09:30:48')
  })

  it('rolls the day counter as the session plays out', () => {
    const state = { ...session(), simSeconds: START_SECONDS + DAY_SECONDS - 10 }
    const next = stepSession(state)
    expect(formatClock(next.simSeconds)).toBe('09:30:38')
    expect(Math.floor((next.simSeconds - START_SECONDS) / DAY_SECONDS) + 1).toBe(2)
  })

  it('closes after fifteen trading days and stops ticking', () => {
    let state = atEndOfSession(session())
    state = stepSession(state)
    expect(state.status).toBe('CLOSED')
    const frozen = stepSession(state)
    expect(frozen).toBe(state)
  })

  it('does not advance while paused', () => {
    const paused = togglePause(session())
    expect(paused.status).toBe('PAUSED')
    expect(stepSession(paused)).toBe(paused)
    expect(togglePause(paused).status).toBe('RUNNING')
  })

  it('cycles speed through 1x, 2x and 4x', () => {
    let state = session()
    state = cycleSpeed(state)
    expect(state.speed).toBe(2)
    state = cycleSpeed(state)
    expect(state.speed).toBe(4)
    state = cycleSpeed(state)
    expect(state.speed).toBe(1)
    expect(setSpeed(state, 4).speed).toBe(4)
    expect(setSpeed(state, 9).speed).toBe(1)
  })
})

describe('market data', () => {
  it('keeps prices positive and books uncrossed', () => {
    const state = advanceSession(session(), 200)
    for (const instrument of state.instruments) {
      expect(instrument.last).toBeGreaterThan(0)
      expect(instrument.book.bids[0].price).toBeLessThan(instrument.book.asks[0].price)
      expect(instrument.book.bids).toHaveLength(5)
      expect(instrument.book.asks).toHaveLength(5)
    }
  })

  it('only refreshes the tape every few frames so the screen stays readable', () => {
    const quiet = advanceSession(session(), PRICE_UPDATE_TICKS - 1)
    const azn = quiet.instruments.find((instrument) => instrument.symbol === 'AZN')
    const fresh = session().instruments.find((instrument) => instrument.symbol === 'AZN')
    expect(azn?.last).toBe(fresh?.last)
    expect(azn?.series).toHaveLength(fresh?.series.length ?? 0)
    expect(azn?.book).toEqual(fresh?.book)

    const moved = advanceSession(session(), PRICE_UPDATE_TICKS)
    const after = moved.instruments.find((instrument) => instrument.symbol === 'AZN')
    expect(after?.lastMove).not.toBe(0)
    expect(after?.series).toHaveLength((fresh?.series.length ?? 0) + 1)
  })

  it('keeps the same seed reproducible and labels the session with it', () => {
    expect(session(1234).seed).toBe(1234)
    const first = advanceSession(session(1234), 40)
    const second = advanceSession(session(1234), 40)
    expect(first.instruments.map((instrument) => instrument.last)).toEqual(
      second.instruments.map((instrument) => instrument.last),
    )
  })

  it('is deterministic for a given seed', () => {
    const first = advanceSession(session(42), 25)
    const second = advanceSession(session(42), 25)
    expect(first.instruments.map((instrument) => instrument.last)).toEqual(
      second.instruments.map((instrument) => instrument.last),
    )
    expect(first.instruments[0].book).toEqual(second.instruments[0].book)
  })

  it('reveals headlines as the clock passes them', () => {
    const state = advanceSession(session(), 110)
    expect(state.news.length).toBeGreaterThanOrEqual(1)
    expect(state.pendingNews.length).toBeLessThan(12)
    expect(state.chartEvents.length).toBeGreaterThanOrEqual(1)
    expect(selectChartMarkers(state, 'AZN').length).toBeGreaterThanOrEqual(1)
  })

  it('routes fresh system dispatches over time', () => {
    const start = session()
    const state = advanceSession(start, 30)
    expect(state.dispatch.length).toBeGreaterThanOrEqual(1)
    expect(state.dispatch.some((rfq) => rfq.id !== 'RFQ-201')).toBe(true)
  })
})

describe('positions and pnl', () => {
  it('marks open positions to the live price', () => {
    const opened = fillClientOrder(session(), {
      symbol: 'TSLA',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 1200,
      price: 196.8,
    }).state
    const state = advanceSession(opened, 12)
    const positions = selectPositions(state)
    const tsla = positions.find((position) => position.symbol === 'TSLA')
    const last = state.instruments.find((instrument) => instrument.symbol === 'TSLA')?.last ?? 0
    expect(tsla?.unrealised).toBeCloseTo(1200 * (last - 196.8), 2)
    expect(tsla?.value).toBeCloseTo(1200 * last, 2)
  })

  it('computes the desk pnl strip from positions and commission', () => {
    const opened = fillClientOrder(session(), {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 1000,
      price: 800,
    }).state
    const state = advanceSession(opened, 5)
    const pnl = selectPnl(state)
    const positions = selectPositions(state)
    expect(pnl.commission).toBeGreaterThan(0)
    expect(pnl.realised).toBeCloseTo(positions.reduce((total, position) => total + position.realised, 0), 2)
    expect(pnl.total).toBeCloseTo(pnl.realised + pnl.unrealised - pnl.commission, 2)
  })

  it('realises pnl when a long is closed out', () => {
    const after = applyPositionFill([{ symbol: 'TSLA', netQty: 1000, avgPrice: 100, realised: 0 }], 'TSLA', 'SELL', 1000, 110)
    expect(after[0].netQty).toBe(0)
    expect(after[0].avgPrice).toBe(0)
    expect(after[0].realised).toBe(10000)
  })

  it('flips the average price when a position changes sign', () => {
    const after = applyPositionFill([{ symbol: 'TSLA', netQty: 1000, avgPrice: 100, realised: 0 }], 'TSLA', 'SELL', 1500, 105)
    expect(after[0].netQty).toBe(-500)
    expect(after[0].avgPrice).toBe(105)
    expect(after[0].realised).toBe(5000)
  })
})

describe('player actions', () => {
  it('fills a client order into the book and charges commission', () => {
    const before = session()
    const result = fillClientOrder(before, {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 1000,
      price: 800,
      rfqId: 'RFQ-201',
    })
    const azn = selectPositions(result.state).find((position) => position.symbol === 'AZN')
    expect(result.message).toContain('FILLED · BUY 1,000 AZN')
    expect(azn?.netQty).toBe(1000)
    expect(azn?.avgPrice).toBe(800)
    expect(result.state.commission).toBeCloseTo(1000 * 800 * 0.005, 2)
    expect(result.state.trades[0].symbol).toBe('AZN')
    expect(result.state.dispatch.some((rfq) => rfq.id === 'RFQ-201')).toBe(false)
  })

  it('rejects an order with a non-positive quantity', () => {
    const state = session()
    const result = fillClientOrder(state, { symbol: 'AZN', clientSide: 'BUY', client: 'AM-11', qty: 0, price: 100 })
    expect(result.message).toContain('ORDER REJECTED')
    expect(result.state).toBe(state)
  })

  it('sends a quote that the client either lifts or lets expire', () => {
    let state = session()
    const result = sendQuote(state, {
      symbol: 'AZN',
      bid: 800,
      offer: 802,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 45,
      rfqId: 'RFQ-201',
    })
    expect(result.message).toContain('QUOTE SENT · AZN 800.00 / 802.00')
    expect(result.state.quotes[0].status).toBe('LIVE')
    state = advanceSession(result.state, 40)
    expect(state.quotes.every((quote) => quote.status !== 'LIVE')).toBe(true)
    expect(state.quotes[0].status === 'FILLED' || state.quotes[0].status === 'EXPIRED').toBe(true)
  })

  it('rejects a crossed quote', () => {
    const state = session()
    const result = sendQuote(state, {
      symbol: 'AZN',
      bid: 805,
      offer: 800,
      bidVolume: 1000,
      offerVolume: 1000,
      validFor: 45,
    })
    expect(result.message).toContain('QUOTE REJECTED')
    expect(result.state).toBe(state)
  })

  it('declines a dispatched rfq', () => {
    const result = declineDispatch(session(), 'RFQ-201')
    expect(result.state.dispatch).toHaveLength(0)
    expect(result.message).toContain('DISPATCH DECLINED')
  })
})

describe('cash budget', () => {
  it('starts every session with the full budget', () => {
    expect(session().cash).toBe(STARTING_CASH)
  })

  it('pays for buys and credits sells', () => {
    const bought = fillClientOrder(session(), {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 1000,
      price: 800,
    })
    const fee = 1000 * 800 * 0.005
    expect(bought.state.cash).toBeCloseTo(STARTING_CASH - 1000 * 800 - fee, 2)

    const sold = fillClientOrder(session(), {
      symbol: 'AZN',
      clientSide: 'BUY',
      client: 'AM-18',
      qty: 1000,
      price: 800,
    })
    expect(sold.state.cash).toBeCloseTo(STARTING_CASH + 1000 * 800 - fee, 2)
  })

  it('refuses a buy the desk cannot fund', () => {
    const state = session()
    const result = fillClientOrder(state, {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 40000,
      price: 800,
    })
    expect(result.message).toContain('insufficient cash')
    expect(result.state).toBe(state)
    expect(result.state.cash).toBe(STARTING_CASH)
  })

  it('refuses to quote a bid it could not settle', () => {
    const state = session()
    const result = sendQuote(state, {
      symbol: 'AZN',
      bid: 800,
      offer: 802,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 45,
      rfqId: 'RFQ-201',
    })
    expect(result.message).toContain('QUOTE SENT')

    const tooBig = sendQuote({ ...state, cash: 1000 }, {
      symbol: 'AZN',
      bid: 800,
      offer: 802,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 45,
      rfqId: 'RFQ-201',
    })
    expect(tooBig.message).toContain('cash budget')
  })
})
describe('opening book', () => {
  it('seeds the book from the configured positions and nothing else', () => {
    const state = createSession(7, [{ symbol: 'TSLA', netQty: 1200, avgPrice: 196.8 }])
    const positions = selectPositions(state)
    expect(positions).toHaveLength(1)
    expect(positions[0].symbol).toBe('TSLA')
    expect(positions[0].netQty).toBe(1200)
    expect(positions[0].avgPrice).toBe(196.8)
    expect(positions[0].realised).toBe(0)
    expect(state.orders).toEqual([])
    expect(state.trades).toEqual([])
    expect(state.cash).toBe(STARTING_CASH)

    const next = createSession(7)
    expect(selectPositions(next)).toEqual([])
  })

  it('ignores zero, unknown and non-positive prices', () => {
    const state = createSession(7, [
      { symbol: 'AZN', netQty: 0, avgPrice: 800 },
      { symbol: 'NOPE', netQty: 100, avgPrice: 10 },
      { symbol: 'DUOL', netQty: -50, avgPrice: 0 },
    ])
    expect(selectPositions(state)).toEqual([])
  })

  it('marks a carried position against the live price', () => {
    const state = advanceSession(createSession(7, [{ symbol: 'AZN', netQty: 1000, avgPrice: 800 }]), 8)
    const azn = selectPositions(state)[0]
    const last = state.instruments.find((instrument) => instrument.symbol === 'AZN')?.last ?? 0
    expect(azn.unrealised).toBeCloseTo(1000 * (last - 800), 2)
  })
})