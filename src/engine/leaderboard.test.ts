import { describe, expect, it } from 'vitest'
import { createAgents, AGENT_START_CASH, agentViews, type AgentView } from './agents'
import { historyLeaderboard, sessionLeaderboard } from './leaderboard'
import { STARTING_CASH } from './simulation'
import type { ArchivedSession } from '../storage/archive'

const view = (tick = 120) => ({
  tick,
  instruments: [
    { symbol: 'AZN', last: 800, openPrice: 790, series: [790, 800], lot: 100, spreadBps: 6 },
  ],
  newsBias: {},
})

const makeAgents = (): AgentView[] => agentViews(createAgents(42)[0], view())

const archived = (over: Partial<ArchivedSession>): ArchivedSession => ({
  id: 'A',
  savedAt: '2026-11-13T10:00:00.000Z',
  desk: 'sales',
  scenarioId: 'classic',
  scenarioName: 'Classic',
  minutes: 5,
  tier: 2,
  seed: 7,
  total: 0,
  realised: 0,
  unrealised: 0,
  commission: 0,
  cash: STARTING_CASH,
  benchmarkPnl: 0,
  alpha: 0,
  composite: 50,
  percentile: 50,
  trades: 0,
  quotes: 0,
  informedFills: 0,
  informedRfqs: 0,
  adverse: 0,
  missed: 0,
  worstDrawdown: 0,
  ...over,
})

describe('session leaderboard', () => {
  it('puts every machine and the player on one board', () => {
    const board = sessionLeaderboard(makeAgents(), 0)
    expect(board.entries).toHaveLength(31)
    expect(board.you.total).toBe(31)
    expect(board.you.rank).toBeGreaterThanOrEqual(1)
    expect(board.you.rank).toBeLessThanOrEqual(31)
  })

  it('ranks on return on capital, not raw dollars', () => {
    /* 人机本金 $1m：赚 $10k = +1%；玩家本金 $20m：赚 $10k = +0.05% */
    const agents: AgentView[] = [
      {
        ...makeAgents()[0],
        pnl: 10_000,
      },
    ]
    const board = sessionLeaderboard(agents, 10_000)
    expect(board.entries[0].isYou).toBe(false)
    expect(board.entries[0].returnPct).toBeCloseTo(1, 5)
    expect(board.entries[1].isYou).toBe(true)
    expect(board.entries[1].returnPct).toBeCloseTo(0.05, 5)
    expect(AGENT_START_CASH).toBe(1_000_000)
  })

  it('places the player where the return ranks', () => {
    const board = sessionLeaderboard([], STARTING_CASH * 0.1)
    expect(board.you.rank).toBe(1)
    expect(board.you.total).toBe(1)
    expect(board.you.returnPct).toBeCloseTo(10, 5)
  })
})

describe('history leaderboard', () => {
  it('sorts the archive by composite score', () => {
    const board = historyLeaderboard(
      [archived({ id: 'A', composite: 40 }), archived({ id: 'B', composite: 70, alpha: 10 })],
      null,
    )
    expect(board.entries.map((entry) => entry.id)).toEqual(['B', 'A'])
    expect(board.you).toBeNull()
  })

  it('keeps this run on the board and ranks it among the archive', () => {
    const board = historyLeaderboard(
      [archived({ id: 'A', composite: 80 }), archived({ id: 'B', composite: 40 })],
      archived({ id: 'C', composite: 60 }),
      8,
    )
    expect(board.entries.map((entry) => entry.id)).toEqual(['A', 'C', 'B'])
    expect(board.entries.find((entry) => entry.isCurrent)?.id).toBe('C')
    expect(board.you).toEqual({ rank: 2, total: 3 })
  })

  it('does not lose a run that falls outside the visible top', () => {
    const old = Array.from({ length: 10 }, (_, index) =>
      archived({ id: `old-${index}`, composite: 90 - index }),
    )
    const board = historyLeaderboard(old, archived({ id: 'me', composite: 10 }), 5)
    expect(board.you?.rank).toBe(11)
    expect(board.entries.length).toBeGreaterThanOrEqual(11)
    expect(board.entries[board.entries.length - 1].id).toBe('me')
  })

  it('does not duplicate an already saved run', () => {
    const saved = archived({ id: 'me', composite: 60 })
    const board = historyLeaderboard([saved], saved)
    expect(board.entries).toHaveLength(1)
    expect(board.entries[0].isCurrent).toBe(true)
  })
})
