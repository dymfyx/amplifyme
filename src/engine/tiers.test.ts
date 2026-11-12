import { describe, expect, it } from 'vitest'
import { selectSettlement } from './scoring'
import {
  advanceSession,
  createSession,
  selectSessionMeta,
  simSecondsPerTick,
  STARTING_CASH,
  TICK_MS,
} from './simulation'

const ticksFor = (minutes: number) => (minutes * 60 * 1000) / TICK_MS

describe('session length tiers', () => {
  it('compresses the timeline instead of slowing the tape', () => {
    expect(simSecondsPerTick(30)).toBe(48.75)
    expect(simSecondsPerTick(15)).toBe(97.5)
    expect(simSecondsPerTick(5)).toBe(292.5)
    expect(ticksFor(30)).toBe(7200)
    expect(ticksFor(15)).toBe(3600)
    expect(ticksFor(5)).toBe(1200)
  })

  it('counts down and closes exactly at the end of a five-minute session', () => {
    const state = createSession(11, [], { minutes: 5 })
    expect(state.minutes).toBe(5)
    expect(state.simSecondsPerTick).toBe(292.5)
    expect(selectSessionMeta(state, 1).timeLeftMs).toBe(300_000)

    const almost = advanceSession(state, 1199)
    expect(almost.status).toBe('RUNNING')
    expect(selectSessionMeta(almost, 1).timeLeftMs).toBe(TICK_MS)

    const closed = advanceSession(almost, 1)
    expect(closed.status).toBe('CLOSED')
    const meta = selectSessionMeta(closed, 1)
    expect(meta.timeLeftMs).toBe(0)
    expect(meta.clock).toBe('16:00:00')
  })

  it('counts a thirty-minute session from three million milliseconds', () => {
    const state = createSession(11, [], { minutes: 30 })
    expect(selectSessionMeta(state, 1).timeLeftMs).toBe(1_800_000)
  })
})

describe('benchmark', () => {
  it('marks an equal-weight buy and hold of the five names from their opening prices', () => {
    const state = createSession(21, [], { minutes: 5 })
    const moved = advanceSession(state, 300)
    const stats = selectSettlement(moved)
    const notional = STARTING_CASH / moved.instruments.length
    const manual = moved.instruments.reduce(
      (total, instrument) =>
        total + notional * ((instrument.last - instrument.openPrice) / instrument.openPrice),
      0,
    )

    expect(stats.benchmarkPnl).toBeCloseTo(Math.round(manual * 100) / 100, 2)
    expect(stats.benchmarkReturnPct).toBeCloseTo((stats.benchmarkPnl / STARTING_CASH) * 100, 2)
    expect(stats.alpha).toBeCloseTo(stats.total - stats.benchmarkPnl, 2)
    expect(stats.beatsBenchmark).toBe(stats.alpha > 0)
  })

  it('beats a flat desk when the benchmark loses money', () => {
    const state = advanceSession(createSession(21, [], { minutes: 5 }), 300)
    const worseOpen = {
      ...state,
      instruments: state.instruments.map((instrument) => ({
        ...instrument,
        openPrice: Math.round(instrument.last * 1.2 * 100) / 100,
      })),
    }
    const stats = selectSettlement(worseOpen)

    expect(stats.total).toBe(0)
    expect(stats.benchmarkPnl).toBeLessThan(0)
    expect(stats.beatsBenchmark).toBe(true)
    expect(stats.alpha).toBeGreaterThan(0)
  })
})
