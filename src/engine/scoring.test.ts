import { describe, expect, it } from 'vitest'
import {
  STARTING_CASH,
  advanceSession,
  createSession,
  declineDispatch,
  fillClientOrder,
  sendQuote,
  type SimulationState,
} from './simulation'
import { scoreSession, selectSettlement } from './scoring'

const session = (seed = 11) => createSession(seed)

const deskWithPosition = (state: SimulationState): SimulationState =>
  fillClientOrder(state, {
    symbol: 'AZN',
    clientSide: 'SELL',
    client: 'AM-18',
    qty: 2000,
    price: 800,
  }).state

describe('telemetry', () => {
  it('records a quote with the market spread and the rfq response time', () => {
    const quoted = sendQuote(session(), {
      symbol: 'AZN',
      bid: 800,
      offer: 802,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 45,
      rfqId: 'RFQ-201',
    }).state

    expect(quoted.telemetry.quotes).toHaveLength(1)
    const quote = quoted.telemetry.quotes[0]
    expect(quote.symbol).toBe('AZN')
    expect(quote.rfqId).toBe('RFQ-201')
    expect(quote.ourSpread).toBe(2)
    expect(quote.marketSpread).toBeGreaterThan(0)
    expect(quote.responseTicks).toBe(0)
  })

  it('leaves responseTicks null for a manual quote', () => {
    const quoted = sendQuote(session(), {
      symbol: 'AZN',
      bid: 800,
      offer: 802,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 45,
    }).state
    expect(quoted.telemetry.quotes[0].responseTicks).toBeNull()
  })

  it('records a fill with an edge measured against the mid', () => {
    const state = deskWithPosition(session())
    const fill = state.telemetry.fills[0]
    const book = state.instruments.find((instrument) => instrument.symbol === 'AZN')?.book
    const mid = ((book?.bids[0].price ?? 0) + (book?.asks[0].price ?? 0)) / 2

    expect(fill.side).toBe('BUY')
    expect(fill.qty).toBe(2000)
    expect(fill.mid).toBeCloseTo(mid, 2)
    // 800 远低于当时的中间价，所以买入的 edge 应该是正的（赚了点差）
    expect(fill.edge).toBeGreaterThan(0)
  })

  it('counts declined dispatches', () => {
    const state = declineDispatch(session(), 'RFQ-201').state
    expect(state.telemetry.declines).toBe(1)
  })

  it('samples exposure and tracks peak pnl and drawdown', () => {
    const state = advanceSession(deskWithPosition(session()), 60)
    expect(state.telemetry.exposure.length).toBeGreaterThan(0)
    expect(state.telemetry.maxDrawdown).toBeGreaterThanOrEqual(0)
    const sample = state.telemetry.exposure[state.telemetry.exposure.length - 1]
    expect(Math.abs(sample.gross)).toBeGreaterThan(0)
  })
})

describe('settlement stats', () => {
  it('reports flow, risk and response numbers', () => {
    let state = session()
    state = deskWithPosition(state)
    state = sendQuote(state, {
      symbol: 'AZN',
      bid: 800,
      offer: 802,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 45,
      rfqId: 'RFQ-201',
    }).state
    state = advanceSession(state, 80)

    const stats = selectSettlement(state)
    // 初始仓位本身也算一笔成交；客户报价可能成交，所以只断言成交数与账目自洽
    expect(stats.trades).toBe(state.telemetry.fills.length)
    expect(stats.trades).toBeGreaterThanOrEqual(1)
    expect(stats.buys + stats.sells).toBe(stats.trades)
    expect(stats.quotes).toBe(1)
    expect(stats.avgSpreadRatio).not.toBeNull()
    expect(stats.medianResponseTicks).toBe(0)
    expect(stats.cash).toBeLessThan(STARTING_CASH)
    expect(stats.total).toBeCloseTo(stats.realised + stats.unrealised - stats.commission, 2)
  })

  it('starts empty and neutral for a fresh session', () => {
    const stats = selectSettlement(session())
    expect(stats.trades).toBe(0)
    expect(stats.quotes).toBe(0)
    expect(stats.avgSpreadRatio).toBeNull()
    expect(stats.medianResponseTicks).toBeNull()
    expect(stats.total).toBe(0)
  })
})

describe('scorecard', () => {
  it('returns six dimensions inside 0-100 and a composite in the same range', () => {
    const score = scoreSession(advanceSession(deskWithPosition(session()), 40))
    expect(score.dimensions).toHaveLength(6)
    expect(score.dimensions.map((dimension) => dimension.key)).toEqual([
      'returns',
      'discipline',
      'reaction',
      'resilience',
      'management',
      'adaptability',
    ])
    for (const dimension of score.dimensions) {
      expect(dimension.value).toBeGreaterThanOrEqual(0)
      expect(dimension.value).toBeLessThanOrEqual(100)
    }
    expect(score.composite).toBeGreaterThanOrEqual(0)
    expect(score.composite).toBeLessThanOrEqual(100)
    expect(score.percentile).toBeGreaterThanOrEqual(1)
    expect(score.percentile).toBeLessThanOrEqual(99)
  })

  it('scores a winning book higher on returns than a losing one', () => {
    const winner = session()
    // 800 买入后，用远高于成本的价格再卖一次锁定利润
    let booked = fillClientOrder(winner, {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 2000,
      price: 800,
    }).state
    booked = fillClientOrder(booked, {
      symbol: 'AZN',
      clientSide: 'BUY',
      client: 'AM-21',
      qty: 2000,
      price: 812,
    }).state

    const loser = fillClientOrder(session(), {
      symbol: 'AZN',
      clientSide: 'SELL',
      client: 'AM-18',
      qty: 2000,
      price: 812,
    }).state
    const dumped = fillClientOrder(loser, {
      symbol: 'AZN',
      clientSide: 'BUY',
      client: 'AM-21',
      qty: 2000,
      price: 800,
    }).state

    const returnsOf = (state: SimulationState) =>
      scoreSession(state).dimensions.find((dimension) => dimension.key === 'returns')?.value ?? 0

    expect(returnsOf(booked)).toBeGreaterThan(50)
    expect(returnsOf(dumped)).toBeLessThan(50)
  })

  it('stays near neutral before any decision is made', () => {
    const score = scoreSession(session())
    const returns = score.dimensions.find((dimension) => dimension.key === 'returns')?.value ?? 0
    expect(returns).toBeCloseTo(50, 5)
    expect(score.composite).toBeGreaterThan(40)
    expect(score.composite).toBeLessThan(65)
  })
})
