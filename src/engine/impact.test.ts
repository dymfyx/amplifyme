import { describe, expect, it } from 'vitest'
import {
  FILL_IMPACT_MAX_BPS,
  FILL_IMPACT_MIN_BPS,
  createSession,
  fillClientOrder,
  fillImpactBps,
  fillProbability,
  selectPriceTape,
  sendQuote,
  stepSession,
} from './simulation'

const aznOf = (state: ReturnType<typeof createSession>) => {
  const instrument = state.instruments.find((item) => item.symbol === 'AZN')
  if (!instrument) throw new Error('AZN missing from the session')
  return instrument
}

describe('fill impact', () => {
  it('scales the price impact between 3 and 10 bps by traded notional', () => {
    expect(fillImpactBps(0)).toBe(FILL_IMPACT_MIN_BPS)
    expect(fillImpactBps(-50_000)).toBe(FILL_IMPACT_MIN_BPS)
    expect(fillImpactBps(400_000)).toBe(4.75)
    expect(fillImpactBps(1_600_000)).toBe(FILL_IMPACT_MAX_BPS)
    expect(fillImpactBps(25_000_000)).toBe(FILL_IMPACT_MAX_BPS)
  })

  it('leaves a bigger impulse behind for a bigger fill', () => {
    const small = fillImpactBps(500 * 800)
    const large = fillImpactBps(2000 * 800)
    expect(large).toBeGreaterThan(small)
  })

  it('pushes the tape up when the desk buys and down when it sells', () => {
    const seed = 20261112
    const base = createSession(seed, [], { minutes: 30 })
    const bought = fillClientOrder(base, {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 2000,
      price: 800,
    }).state

    const impulse = aznOf(bought).impulses.find((item) => item.label === 'your fill')
    expect(impulse).toBeDefined()
    expect(impulse?.direction).toBe(1)
    expect(impulse?.source).toBe('fill')
    expect(impulse?.bps).toBeCloseTo(fillImpactBps(2000 * 800) * 0.6, 2)

    /* 四成冲击立刻打进价格：同一颗种子、同一帧，成交那局价格更高 */
    expect(aznOf(bought).last).toBeGreaterThan(aznOf(base).last)
    const jumpBps = ((aznOf(bought).last - aznOf(base).last) / aznOf(base).last) * 10000
    expect(jumpBps).toBeCloseTo(fillImpactBps(2000 * 800) * 0.4, 0)

    /* 剩下的六成逐帧衰减：先变小，最后消失 */
    let state = bought
    const before = aznOf(state).impulses.find((item) => item.label === 'your fill')?.bps ?? 0
    state = stepSession(state)
    const after = aznOf(state).impulses.find((item) => item.label === 'your fill')?.bps
    expect(after).toBeDefined()
    expect(after!).toBeLessThan(before)
    for (let index = 0; index < 16; index += 1) state = stepSession(state)
    expect(aznOf(state).impulses.some((item) => item.label === 'your fill')).toBe(false)
  })

  it('shows the desk\'s own fill in the price tape', () => {
    const base = createSession(777123, [], { minutes: 30 })
    const after = fillClientOrder(base, {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 2000,
      price: 800,
    }).state
    let state = after
    for (let index = 0; index < 6; index += 1) state = stepSession(state)
    const fillRows = selectPriceTape(state, 40, 4).filter((row) =>
      row.drivers.some((driver) => driver.label === 'your fill'),
    )
    expect(fillRows.length).toBeGreaterThan(0)
    expect(fillRows[0].drivers.find((driver) => driver.label === 'your fill')?.source).toBe('fill')
  })

  it('presses the price the other way when the desk sells', () => {
    const base = createSession(424242, [], { minutes: 30 })
    const sold = fillClientOrder(base, {
      symbol: 'TSLA',
      clientSide: 'BUY',
      client: 'AM-11',
      qty: 2000,
      price: 197,
    }).state
    const tsla = (state: ReturnType<typeof createSession>) =>
      state.instruments.find((item) => item.symbol === 'TSLA')!
    expect(tsla(sold).impulses.find((item) => item.label === 'your fill')?.direction).toBe(-1)

    expect(tsla(sold).last).toBeLessThan(tsla(base).last)
    expect(tsla(sold).impulses.find((item) => item.label === 'your fill')?.direction).toBe(-1)
  })
})

describe('quote width versus fill probability', () => {
  it('pays a wider quote with a lower chance of being accepted', () => {
    expect(fillProbability(1)).toBeCloseTo(0.96, 2)
    expect(fillProbability(2)).toBeCloseTo(0.61, 2)
    expect(fillProbability(3)).toBeCloseTo(0.26, 2)
    expect(fillProbability(9)).toBe(0.12)
    expect(fillProbability(0.4)).toBeCloseTo(0.96, 2)
    expect(fillProbability(Number.NaN)).toBeCloseTo(0.96, 2)
    expect(fillProbability(0.8)).toBeGreaterThan(fillProbability(2.5))
  })

  it('records the ratio and the fill chance on every quote it sends', () => {
    const state = createSession(20261112, [], { minutes: 30 })
    const book = aznOf(state).book
    const bid = book.bids[0].price
    const offer = book.asks[0].price
    const tight = sendQuote(state, {
      symbol: 'AZN',
      bid,
      offer,
      bidVolume: 1000,
      offerVolume: 1000,
      validFor: 30,
      rfqId: 'RFQ-201',
    }).state
    const wide = sendQuote(state, {
      symbol: 'AZN',
      bid: bid - 2,
      offer: offer + 2,
      bidVolume: 1000,
      offerVolume: 1000,
      validFor: 30,
      rfqId: 'RFQ-201',
    }).state

    const tightQuote = tight.quotes[tight.quotes.length - 1]
    const wideQuote = wide.quotes[wide.quotes.length - 1]
    expect(tightQuote.spreadRatio).toBeCloseTo(1, 1)
    expect(wideQuote.spreadRatio).toBeGreaterThan(tightQuote.spreadRatio)
    expect(wideQuote.fillProbability).toBeLessThan(tightQuote.fillProbability)
    expect(tightQuote.fillProbability).toBeLessThanOrEqual(0.96)
  })
})
