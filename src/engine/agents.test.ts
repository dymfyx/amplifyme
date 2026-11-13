import { describe, expect, it } from 'vitest'
import {
  aggregateFlows,
  agentViews,
  createAgents,
  findCounterparty,
  stepAgents,
  type AgentFlow,
  type AgentState,
  type AgentView,
} from './agents'
import { advanceSession, createSession, selectAgents, selectPriceTape } from './simulation'

const viewOf = (session: ReturnType<typeof createSession>) => ({
  tick: session.tick,
  instruments: session.instruments.map((instrument) => ({
    symbol: instrument.symbol,
    last: instrument.last,
    openPrice: instrument.openPrice,
    series: instrument.series,
    lot: instrument.lot,
    spreadBps: instrument.spreadBps,
  })),
  newsBias: session.newsBias,
})

const flow = (overrides: Partial<AgentFlow> = {}): AgentFlow => ({
  symbol: 'AZN',
  side: 'BUY',
  qty: 200,
  agentId: 'AI-01',
  agentName: 'Sable',
  archetype: 'informed',
  price: 800,
  bps: 1.2,
  ...overrides,
})

describe('flow agents', () => {
  it('creates ten named agents, deterministically from the seed', () => {
    const [first, afterFirst] = createAgents(12345)
    const [again] = createAgents(12345)
    const [other] = createAgents(999)

    expect(first).toHaveLength(10)
    expect(first.map((agent) => agent.id)).toEqual([
      'AI-01',
      'AI-02',
      'AI-03',
      'AI-04',
      'AI-05',
      'AI-06',
      'AI-07',
      'AI-08',
      'AI-09',
      'AI-10',
    ])
    expect(first.map((agent) => agent.archetype)).toEqual([
      'informed',
      'informed',
      'momentum',
      'momentum',
      'value',
      'value',
      'maker',
      'maker',
      'noise',
      'noise',
    ])
    expect(again).toEqual(first)
    expect(afterFirst).toBeTypeOf('number')
    /* 不同种子应该给出不同的激进度/首次出手时间，而不是同一批机器人 */
    expect(other.map((agent) => `${agent.aggression}:${agent.nextActionAt}`)).not.toEqual(
      first.map((agent) => `${agent.aggression}:${agent.nextActionAt}`),
    )
  })

  it('aggregates one frame of flows into a single named driver per symbol', () => {
    const flows = [
      flow({ bps: 1.2, qty: 200 }),
      flow({ bps: 0.8, qty: 300, agentId: 'AI-03', agentName: 'Vector', archetype: 'momentum' }),
      flow({ symbol: 'TSCO', bps: -2.4, side: 'SELL', qty: 400, agentId: 'AI-05', agentName: 'Anchor', archetype: 'value' }),
    ]
    const aggregated = aggregateFlows(flows)
    expect(aggregated).toHaveLength(2)

    const azn = aggregated.find((entry) => entry.symbol === 'AZN')
    expect(azn?.bps).toBe(2)
    expect(azn?.direction).toBe(1)
    expect(azn?.label).toBe('informed buy')
    expect(azn?.hint).toContain('Sable')
    expect(azn?.hint).toContain('500 shares')

    const tsco = aggregated.find((entry) => entry.symbol === 'TSCO')
    expect(tsco?.bps).toBe(-2.4)
    expect(tsco?.direction).toBe(-1)
    expect(tsco?.label).toBe('value sell')
  })

  it('ignores flows whose net impact rounds away', () => {
    expect(aggregateFlows([flow({ bps: 0.02 })])).toEqual([])
  })

  it('picks the largest same-side flow as the counterparty', () => {
    const flows = [
      flow({ qty: 100, agentName: 'Fizz' }),
      flow({ qty: 900, agentName: 'Pylon' }),
      flow({ qty: 5000, side: 'SELL', agentName: 'Anchor' }),
    ]
    expect(findCounterparty(flows, 'AZN', 'BUY')).toBe('Pylon')
    expect(findCounterparty(flows, 'AZN', 'SELL')).toBe('Anchor')
    expect(findCounterparty(flows, 'NFLX', 'BUY')).toBeNull()
  })

  it('has agents actually trading once the session runs', () => {
    const session = advanceSession(createSession(2026), 240)
    const traded = session.agents.filter((agent) => agent.lastAction !== null)
    expect(traded.length).toBeGreaterThan(0)
    expect(traded.some((agent) => agent.lastActionTick > 0)).toBe(true)
    /* 每个 agent 的动作都必须是三个已知原因之一，方便 UI 解释 */
    for (const agent of traded) {
      expect(agent.lastAction).toMatch(/^(BUY|SELL) \d+ [A-Z]{4} · (news|momentum|value|make|flow)$/)
    }
  })

  it('lets agent flow show up on the price tape as its own source', () => {
    const session = advanceSession(createSession(4242), 400)
    const tape = selectPriceTape(session, 200, 0)
    const agentDrivers = tape.flatMap((change) => change.drivers).filter((driver) => driver.source === 'agent')
    expect(agentDrivers.length).toBeGreaterThan(0)
    expect(agentDrivers[0].label).toMatch(/(informed|momentum|value|market maker|noise) (buy|sell)/)
  })

  it('keeps every agent inside its cash and gross limits', () => {
    const session = advanceSession(createSession(777), 600)
    const views = selectAgents(session)
    expect(views).toHaveLength(10)
    for (const agent of views) {
      expect(Number.isFinite(agent.pnl)).toBe(true)
      expect(agent.gross).toBeLessThanOrEqual(2.5 * 1_000_000 + 1)
      expect(['-1', '0', '1']).toContain(String(agent.posture))
    }
  })

  it('computes agent pnl as cash plus market value minus the starting stake', () => {
    const market = createSession(1)
    const agents: AgentState[] = [
      {
        id: 'AI-99',
        name: 'Tester',
        archetype: 'value',
        aggression: 1,
        size: 100,
        cash: 900_000,
        startCash: 1_000_000,
        positions: [{ symbol: 'AZN', qty: 200, avgPrice: 790 }],
        lastAction: null,
        lastActionTick: 0,
        nextActionAt: 999,
        posture: 1,
      },
    ]
    const view = viewOf(market)
    const current = view.instruments.find((instrument) => instrument.symbol === 'AZN')!.last
    const [agent] = agentViews(agents, view)
    const expected = 900_000 + 200 * current - 1_000_000
    expect(agent.pnl).toBe(Math.round(expected * 100) / 100)
    expect(agent.holdings).toEqual([{ symbol: 'AZN', qty: 200 }])
  })

  it('is deterministic for the same seed and diverges for another seed', () => {
    const first = advanceSession(createSession(31337), 300)
    const second = advanceSession(createSession(31337), 300)
    expect(JSON.stringify(second.agents)).toBe(JSON.stringify(first.agents))
    expect(second.instruments.map((instrument) => instrument.last)).toEqual(
      first.instruments.map((instrument) => instrument.last),
    )

    const other = advanceSession(createSession(31338), 300)
    expect(JSON.stringify(other.agents)).not.toBe(JSON.stringify(first.agents))
  })

  it('advances agents through stepAgents without mutating the previous frame', () => {
    const session = createSession(11)
    const before = JSON.parse(JSON.stringify(session.agents))
    const result = stepAgents(session.agents, session.rng, viewOf(session))
    expect(session.agents).toEqual(before)
    expect(result.agents).toHaveLength(10)
    expect(result.flows.every((entry) => entry.qty > 0)).toBe(true)
    expect(result.rng).toBeTypeOf('number')
    const views: AgentView[] = agentViews(result.agents, viewOf(session))
    expect(views).toHaveLength(10)
  })
})
