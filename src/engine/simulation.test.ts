import { describe, expect, it } from 'vitest'
import {
  DAY_SECONDS,
  SESSION_SECONDS,
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
    expect(selectPositions(state).map((position) => position.symbol)).toEqual(['AZN', 'TSLA', 'DUOL'])
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

  it('records every tick in the rolling price window', () => {
    const state = advanceSession(session(), 30)
    const azn = state.instruments.find((instrument) => instrument.symbol === 'AZN')
    expect(azn?.series).toHaveLength(90)
    expect(azn?.lastMove).not.toBe(0)
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
    const state = advanceSession(session(), 10)
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
    const state = advanceSession(session(), 12)
    const positions = selectPositions(state)
    const tsla = positions.find((position) => position.symbol === 'TSLA')
    const last = state.instruments.find((instrument) => instrument.symbol === 'TSLA')?.last ?? 0
    expect(tsla?.unrealised).toBeCloseTo(1200 * (last - 196.8), 2)
    expect(tsla?.value).toBeCloseTo(1200 * last, 2)
  })

  it('computes the desk pnl strip from positions and commission', () => {
    const state = advanceSession(session(), 5)
    const pnl = selectPnl(state)
    const positions = selectPositions(state)
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
    expect(result.state.commission).toBeCloseTo(4015 + 1000 * 800 * 0.005, 2)
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
