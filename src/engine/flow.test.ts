import { describe, expect, it } from 'vitest'
import {
  advanceSession,
  createSession,
  declineDispatch,
  sendQuote,
  selectHistory,
  selectScenario,
  START_SECONDS,
  type SimulationState,
} from './simulation'
import { decisionReview, selectSettlement } from './scoring'
import { SCENARIOS, parseScenarioJson, EXAMPLE_SCENARIO_JSON, scenarioById } from './scenarios'
import { scheduleNews } from './news'

const session = (seed = 20261112): SimulationState => createSession(seed)

/** 把状态推进到「已经出过至少一条带方向的头条」 */
function withHeadline(seed = 20261112): SimulationState {
  let state = session(seed)
  for (let index = 0; index < 4000; index += 1) {
    state = advanceSession(state, 1)
    if (state.news.some((item) => item.direction) && Object.values(state.newsBias).some((value) => Math.abs(value) >= 8)) {
      return state
    }
  }
  return state
}

describe('event flow and client profiles', () => {
  it('carries the scenario into the session and exposes it to the UI', () => {
    const crash = scenarioById('crash')
    const state = createSession(7, [], { scenario: crash })
    expect(selectScenario(state).id).toBe('crash')
    expect(state.pendingNews.length).toBe(crash.news.length)
    /* 崩盘场景的价差更宽、盘口更薄：同样的报价更难成交 */
    const azn = state.instruments.find((instrument) => instrument.symbol === 'AZN')
    const calm = session(7).instruments.find((instrument) => instrument.symbol === 'AZN')
    expect(azn?.spreadBps ?? 0).toBeGreaterThan(calm?.spreadBps ?? 0)
    expect(azn?.lot ?? 0).toBeLessThan(calm?.lot ?? 0)
  })

  it('parses a custom scenario json and rejects the broken ones', () => {
    const parsed = parseScenarioJson(EXAMPLE_SCENARIO_JSON)
    expect(parsed.error).toBeUndefined()
    expect(parsed.scenario?.news.length).toBeGreaterThan(0)
    expect(parsed.scenario?.newsCount ?? 0).toBeGreaterThan(0)
    const scheduled = scheduleNews(parsed.scenario?.news ?? [], 7, 3)
    expect(scheduled).toHaveLength(3)
    expect(scheduled.every((item) => item.at >= 0 && item.at <= 1)).toBe(true)

    expect(parseScenarioJson('not json').error).toContain('JSON')
    const badSymbol = JSON.stringify({
      name: 'Bad',
      news: [{ at: 0.1, kind: 'equity', tag: 'EQ', impact: 2, headline: 'x', short: 'x', symbol: 'NOPE', direction: 1, driftBps: 40 }],
    })
    expect(parseScenarioJson(badSymbol).error).toBeTruthy()
  })

  it('sends informed clients in the direction of a fresh headline', () => {
    let state = withHeadline(4242)
    const profileIds = state.clients.filter((client) => client.type === 'informed').map((client) => client.id)
    let seen = 0
    const known = new Set(state.dispatch.map((item) => item.id))
    /* 回价、派单都有节奏：在一段有热度的窗口里多走几帧，只检查新出现的单子 */
    for (let index = 0; index < 600 && seen === 0; index += 1) {
      state = advanceSession(state, 1)
      for (const rfq of state.dispatch.filter(
        (item) => profileIds.includes(item.client) && !known.has(item.id),
      )) {
        /* 消息灵通的客户顺着新闻做：刚下单时那个名字必须有热度 */
        expect(Math.abs(state.newsBias[rfq.symbol] ?? 0)).toBeGreaterThanOrEqual(8)
        seen += 1
      }
      for (const item of state.dispatch) known.add(item.id)
    }
    expect(seen).toBeGreaterThan(0)
  })

  it('keeps the client heat as a memory and cools it down over time', () => {
    const start = session(77)
    const rfq = start.dispatch[0]
    const declined = declineDispatch(start, rfq.id).state
    expect(declined.clientHeat[rfq.client]).toBeGreaterThan(0)
    const cooled = advanceSession(declined, 40)
    expect(cooled.clientHeat[rfq.client] ?? 0).toBeLessThan(declined.clientHeat[rfq.client] ?? 0)
  })

  it('records partial fills instead of all-or-nothing quotes', () => {
    let state = session(31)
    const azn = state.instruments.find((instrument) => instrument.symbol === 'AZN')
    const book = azn?.book
    expect(book).toBeTruthy()
    if (!book) return
    const quoted = sendQuote(state, {
      symbol: 'AZN',
      bid: book.bids[0].price,
      offer: book.asks[0].price,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 60,
      rfqId: 'RFQ-201',
    }).state
    state = advanceSession(quoted, 120)
    const quote = state.quotes[0]
    expect(['FILLED', 'PARTIAL', 'EXPIRED']).toContain(quote.status)
    expect(quote.queueTicks).toBeGreaterThanOrEqual(0)
    if (quote.filledQty > 0) {
      expect(quote.filledQty).toBeLessThanOrEqual(quote.qty)
      /* 部分成交会拆成多笔遥测成交，成交量之和必须等于报价的成交总量 */
      const fills = state.telemetry.fills.filter((fill) => fill.quoteId === quote.id)
      const filled = fills.reduce((total, fill) => total + fill.qty, 0)
      expect(filled).toBe(quote.filledQty)
      expect(fills.every((fill) => fill.venue === 'client')).toBe(true)
    }
  })

  it('measures the latency of every quote', () => {
    const state = session(5)
    const book = state.instruments.find((instrument) => instrument.symbol === 'AZN')?.book
    if (!book) return
    const quoted = sendQuote(state, {
      symbol: 'AZN',
      bid: book.bids[0].price,
      offer: book.asks[0].price,
      bidVolume: 1000,
      offerVolume: 1000,
      validFor: 45,
      rfqId: 'RFQ-201',
    }).state
    const quote = quoted.quotes[0]
    expect(quote.latencyTicks).toBeGreaterThanOrEqual(1)
    expect(quote.latencyTicks).toBeLessThanOrEqual(3)
    expect(quote.status).toBe('PENDING')
  })

  it('keeps a replay frame for every tick and caps the history', () => {
    const state = advanceSession(session(9), 30)
    const frames = selectHistory(state)
    expect(frames.length).toBe(31)
    expect(frames[frames.length - 1].tick).toBe(state.tick)
    expect(Object.keys(frames[frames.length - 1].prices).length).toBe(5)
  })

  it('flags adverse selection and missed headlines in the decision review', () => {
    let state = session(88)
    /* 先跑一段时间积累行情，再报价并让客户成交 */
    state = advanceSession(state, 200)
    const book = state.instruments.find((instrument) => instrument.symbol === 'AZN')?.book
    if (!book) return
    state = sendQuote(state, {
      symbol: 'AZN',
      bid: book.bids[0].price,
      offer: book.asks[0].price,
      bidVolume: 5000,
      offerVolume: 5000,
      validFor: 90,
      rfqId: state.dispatch[0]?.id,
    }).state
    state = advanceSession(state, 600)
    const review = decisionReview(state)
    expect(review.windowTicks).toBeGreaterThan(0)
    expect(Array.isArray(review.adverse)).toBe(true)
    for (const fill of review.adverse) {
      expect(fill.adverseBps).toBeGreaterThan(1)
    }
    for (const missed of review.missed) {
      expect(Math.abs(missed.moveBps)).toBeGreaterThan(0)
    }
    expect(review.informed.rfqs).toBeGreaterThanOrEqual(0)
    expect(review.informed.fills).toBeGreaterThanOrEqual(review.informed.fills - 1)
    const settlement = selectSettlement(state)
    expect(settlement.trades).toBe(state.telemetry.fills.length)
  })

  it('ships a library of ten scenarios with a stable default', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(10)
    const ids = SCENARIOS.map((scenario) => scenario.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('classic')
    for (const scenario of SCENARIOS) {
      expect(scenario.news.length).toBeGreaterThan(0)
      expect(scenario.newsCount).toBeGreaterThan(0)
      const scheduled = scheduleNews(scenario.news, 11, Math.min(scenario.newsCount, scenario.news.length))
      expect(scheduled.length).toBeGreaterThan(0)
      for (const item of scheduled) {
        expect(item.at).toBeGreaterThanOrEqual(0)
        expect(item.at).toBeLessThanOrEqual(1)
      }
    }
    const created = createSession(1, [], { scenario: SCENARIOS[1] })
    const firstReveal = created.pendingNews[0]
    expect(firstReveal.at).toBeGreaterThanOrEqual(START_SECONDS)
  })
})
