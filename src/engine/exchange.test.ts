import { describe, expect, it } from 'vitest'
import {
  COMMISSION_RATE,
  STARTING_CASH,
  createSession,
  exchangeLiquidity,
  fillClientOrder,
  tradeOnExchange,
  venuePricePreview,
  walkBook,
  type SimulationState,
} from './simulation'

const session = (seed = 21) => createSession(seed)

const bookOf = (state: SimulationState, symbol = 'AZN') => {
  const instrument = state.instruments.find((item) => item.symbol === symbol)
  if (!instrument) throw new Error(`missing ${symbol}`)
  return instrument.book
}

describe('walkBook', () => {
  it('prices a sweep across several levels', () => {
    const walked = walkBook(
      [
        { price: 100, size: 100 },
        { price: 101, size: 100 },
      ],
      150,
    )
    expect(walked).not.toBeNull()
    expect(walked?.levels).toBe(2)
    expect(walked?.avgPrice).toBeCloseTo(100.33, 2)
  })

  it('returns null when the book cannot absorb the size', () => {
    expect(walkBook([{ price: 100, size: 50 }], 60)).toBeNull()
    expect(exchangeLiquidity([{ price: 100, size: 50 }])).toBe(50)
  })
})

describe('exchange trading', () => {
  it('buys at your buy price and sells at your sell price', () => {
    let state = session()
    const asks = bookOf(state).asks
    const expectedBuy = venuePricePreview(state, 'AZN')
    const qty = Math.min(100, asks[0].size)

    state = tradeOnExchange(state, { symbol: 'AZN', side: 'BUY', qty }).state
    const buy = state.trades[0]
    expect(buy.venue).toBe('exchange')
    expect(buy.side).toBe('BUY')
    expect(buy.price).toBeCloseTo(expectedBuy.buy, 2)
    expect(state.positions.find((position) => position.symbol === 'AZN')?.netQty).toBe(qty)

    const cashAfterBuy = state.cash
    expect(cashAfterBuy).toBeLessThan(STARTING_CASH)

    const expectedSell = venuePricePreview(state, 'AZN')
    state = tradeOnExchange(state, { symbol: 'AZN', side: 'SELL', qty }).state
    const sell = state.trades[0]
    expect(sell.venue).toBe('exchange')
    expect(sell.side).toBe('SELL')
    expect(sell.price).toBeCloseTo(expectedSell.sell, 2)
    expect(state.positions.find((position) => position.symbol === 'AZN')?.netQty).toBe(0)
    expect(state.cash).toBeGreaterThan(cashAfterBuy)
  })

  it('charges commission and records a fill with a negative edge', () => {
    const state = tradeOnExchange(session(), { symbol: 'AZN', side: 'BUY', qty: 200 }).state
    const trade = state.trades[0]
    const gross = trade.qty * trade.price
    expect(trade.fee).toBeCloseTo(Math.round(gross * COMMISSION_RATE * 100) / 100, 2)
    expect(state.commission).toBeCloseTo(trade.fee, 2)

    const fill = state.telemetry.fills[0]
    expect(fill.venue).toBe('exchange')
    // 主动买在卖价上，相对中间价的 edge 必为负
    expect(fill.edge).toBeLessThan(0)
  })

  it('pushes the tape with its own impact', () => {
    const before = session()
    const priceBefore = before.instruments.find((item) => item.symbol === 'AZN')?.last ?? 0
    const after = tradeOnExchange(before, { symbol: 'AZN', side: 'BUY', qty: 200 }).state
    const azn = after.instruments.find((item) => item.symbol === 'AZN')
    expect(azn?.last).toBeGreaterThan(priceBefore)
    expect(azn?.impulses.some((impulse) => impulse.source === 'fill')).toBe(true)
  })

  it('rejects a size bigger than the visible book', () => {
    const state = session()
    const available = exchangeLiquidity(bookOf(state).asks)
    const rejected = tradeOnExchange(state, { symbol: 'AZN', side: 'BUY', qty: available + 1 })
    expect(rejected.state).toBe(state)
    expect(rejected.message).toContain('only')
  })

  it('rejects a buy that does not fit the cash budget', () => {
    const broke: SimulationState = { ...session(), cash: 100 }
    const rejected = tradeOnExchange(broke, { symbol: 'AZN', side: 'BUY', qty: 200 })
    expect(rejected.message).toContain('insufficient cash')
    expect(rejected.state).toBe(broke)
  })

  it('rejects non-positive sizes', () => {
    const state = session()
    expect(tradeOnExchange(state, { symbol: 'AZN', side: 'BUY', qty: 0 }).message).toContain('quantity')
    expect(tradeOnExchange(state, { symbol: 'NOPE', side: 'SELL', qty: 10 }).message).toContain('unknown')
  })

  it('keeps client fills tagged as client flow', () => {
    const state = fillClientOrder(session(), {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 500,
      price: 800,
    }).state
    expect(state.trades[0].venue).toBe('client')
    expect(state.telemetry.fills[0].venue).toBe('client')
  })
})
