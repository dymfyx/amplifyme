import { describe, expect, it } from 'vitest'
import {
  advanceSession,
  createSession,
  hitDealerQuote,
  requestDealerQuote,
  selectDealerQuotes,
  tradeOnExchange,
  venuePricePreview,
  DEALERS,
} from './simulation'
import { dealerGap, quoteAroundMid, venueGap, volatilityScore } from './venues'
import { scoreSession, selectSettlement } from './scoring'

const maker = (seed = 41) => createSession(seed, [], { role: 'market-maker' })
const sales = (seed = 41) => createSession(seed, [], { role: 'sales' })

describe('role pricing on the exchange', () => {
  it('quotes a much wider two-way price to sales than to the market maker', () => {
    const taker = venuePricePreview(sales(), 'AZN')
    const makerView = venuePricePreview(maker(), 'AZN')

    expect(taker.gapPoints).toBeGreaterThan(makerView.gapPoints * 2)
    expect(taker.buy).toBeGreaterThan(taker.mid)
    expect(taker.sell).toBeLessThan(taker.mid)

    /* 800 附近 Sales 的双边价差应该在 5–10 个点之间（随波动浮动） */
    const around = quoteAroundMid(800, venueGap('sales', 0.5))
    const points = around.buy - around.sell
    expect(points).toBeGreaterThanOrEqual(4.5)
    expect(points).toBeLessThanOrEqual(10.5)
  })

  it('moves the gap with volatility and keeps the dealer between the two desks', () => {
    const calm = venueGap('sales', 0)
    const wild = venueGap('sales', 1)
    expect(wild).toBeGreaterThan(calm)

    expect(dealerGap(0.5)).toBeLessThan(venueGap('sales', 0.5))
    expect(dealerGap(0.5)).toBeGreaterThan(venueGap('market-maker', 0.5))

    const series = [100, 101, 100, 102, 99, 103]
    expect(volatilityScore(series, 0)).toBeGreaterThan(0)
    expect(volatilityScore([100, 100, 100], 0)).toBeLessThan(0.05)
  })

  it('fills the exchange at the role price, not at the raw book', () => {
    const state = sales()
    const preview = venuePricePreview(state, 'AZN')
    const after = tradeOnExchange(state, { symbol: 'AZN', side: 'BUY', qty: 100 }).state
    expect(after.trades[0].price).toBeCloseTo(preview.buy, 2)
    expect(after.trades[0].venue).toBe('exchange')
  })
})

describe('dealer quotes', () => {
  it('lets a sales trader ask three dealers and rejects the market maker', () => {
    const state = sales()
    const asked = requestDealerQuote(state, { symbol: 'AZN', side: 'BUY', qty: 2000 })
    expect(asked.message).toContain('RFQ SENT')
    expect(asked.state.dealerQuotes).toHaveLength(DEALERS.length)
    expect(asked.state.dealerQuotes.map((quote) => quote.dealerName)).toEqual(
      DEALERS.map((dealer) => dealer.name),
    )
    expect(asked.state.dealerQuotes.every((quote) => quote.readyAt > state.tick)).toBe(true)

    const refused = requestDealerQuote(maker(), { symbol: 'AZN', side: 'BUY', qty: 2000 })
    expect(refused.message).toContain('REJECTED')
    expect(refused.state.dealerQuotes).toHaveLength(0)
  })

  it('returns a two-way price around the mid with a dealer-sized gap', () => {
    const state = sales()
    const asked = requestDealerQuote(state, { symbol: 'AZN', side: 'BUY', qty: 2000 }).state
    const ready = advanceSession(asked, 4)
    const quote = selectDealerQuotes(ready)[0]

    expect(quote.offer).toBeGreaterThan(quote.bid)
    const mid = (quote.offer + quote.bid) / 2
    expect(mid).toBeGreaterThan(700)
    expect(quote.size).toBeGreaterThan(0)
    expect(quote.expiresAt).toBeGreaterThan(quote.readyAt)
  })

  it('refuses to hit a quote before it is called back and after it expires', () => {
    const state = sales()
    const asked = requestDealerQuote(state, { symbol: 'TSLA', side: 'SELL', qty: 1000 }).state
    const early = hitDealerQuote(asked, { quoteId: asked.dealerQuotes[0].id, side: 'BUY' })
    expect(early.message).toContain('DEALER NOT ON THE LINE YET')

    const ready = advanceSession(asked, 6)
    const expired = advanceSession(ready, 40)
    expect(selectDealerQuotes(expired)).toHaveLength(0)
  })

  it('fills against a dealer quote and records the dealer venue', () => {
    const state = sales()
    const asked = requestDealerQuote(state, { symbol: 'AZN', side: 'BUY', qty: 1000 }).state
    const ready = advanceSession(asked, 6)
    const quote = selectDealerQuotes(ready)[0]

    const hit = hitDealerQuote(ready, { quoteId: quote.id, side: 'BUY', qty: 500 })
    expect(hit.message).toContain('DEALER FILLED · BUY 500 AZN')
    expect(hit.state.trades[0].venue).toBe('dealer')
    expect(hit.state.positions.find((position) => position.symbol === 'AZN')?.netQty).toBe(500)
    expect(hit.state.cash).toBeLessThan(ready.cash)
    expect(hit.state.dealerQuotes.find((candidate) => candidate.id === quote.id)).toBeUndefined()
  })

  it('marks the dealer leg in the settlement and scores sales on entry quality', () => {
    const base = sales()
    const asked = requestDealerQuote(base, { symbol: 'AZN', side: 'BUY', qty: 1000 }).state
    const ready = advanceSession(asked, 6)
    const quote = selectDealerQuotes(ready)[0]
    const filled = hitDealerQuote(ready, { quoteId: quote.id, side: 'BUY' }).state

    const stats = selectSettlement(filled)
    expect(stats.dealerFills).toBe(1)
    expect(stats.dealerNotional).toBeGreaterThan(0)
    expect(stats.entryEdgeBps).toBeLessThan(0)

    const score = scoreSession(filled)
    expect(score.dimensions.map((dimension) => dimension.key)).toEqual([
      'returns',
      'entry',
      'reaction',
      'resilience',
    ])
  })
})
