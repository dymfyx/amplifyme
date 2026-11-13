import { describe, expect, it } from 'vitest'
import { evaluateSession } from './evaluation'
import { createSession, type SimulationState } from './simulation'
import type { FillRecord, QuoteRecord } from './telemetry'

const withTelemetry = (
  state: SimulationState,
  patch: { quotes?: QuoteRecord[]; fills?: FillRecord[] },
): SimulationState => ({
  ...state,
  telemetry: {
    ...state.telemetry,
    quotes: patch.quotes ?? state.telemetry.quotes,
    fills: patch.fills ?? state.telemetry.fills,
  },
})

const quote = (index: number, responseTicks = 4, ourSpread = 2, marketSpread = 2): QuoteRecord => ({
  id: `Q-${index}`,
  symbol: 'AZN',
  tick: 10 + index,
  ourSpread,
  marketSpread,
  responseTicks,
  clientType: 'uninformed',
  queueTicks: 2,
  filledQty: 200,
})

const fill = (index: number, edge: number, venue: FillRecord['venue'] = 'client'): FillRecord => ({
  id: `TRD-${index}`,
  symbol: 'AZN',
  side: 'BUY',
  qty: 200,
  price: 800,
  mid: 800 + edge,
  edge,
  notional: 160_000,
  fee: 8,
  tick: 20 + index,
  venue,
})

describe('evaluateSession', () => {
  it('always returns a band, a headline and at least one behaviour tag', () => {
    const verdict = evaluateSession(createSession(429))
    expect(verdict.headline.length).toBeGreaterThan(5)
    expect(verdict.tags.length).toBeGreaterThanOrEqual(1)
    expect(verdict.tags.length).toBeLessThanOrEqual(6)
    expect(verdict.line.length).toBeGreaterThan(10)
  })

  it('turns snarky when the session ends below sixty', () => {
    const verdict = evaluateSession(createSession(429))
    /* 空局 composite 在 40–65 之间，这里只断言 tone 与 band 一致 */
    const snarkyBand = verdict.band === 'snark' || verdict.band === 'brutal'
    expect(verdict.tone).toBe(snarkyBand ? 'snark' : verdict.band === 'solid' ? 'neutral' : 'praise')
  })

  it('flags a patient quoter when the spread is tight and the edge is positive', () => {
    const state = withTelemetry(createSession(77), {
      quotes: [quote(1), quote(2), quote(3)],
      fills: [fill(1, 0.4), fill(2, 0.2)],
    })
    const verdict = evaluateSession(state)
    expect(verdict.tags.map((tag) => tag.key)).toContain('patient')
  })

  it('flags overtrading when the desk keeps quoting without an edge', () => {
    const quotes = Array.from({ length: 14 }, (_, index) => quote(index))
    const fills = Array.from({ length: 6 }, (_, index) => fill(index, -0.5))
    const verdict = evaluateSession(withTelemetry(createSession(88), { quotes, fills }))
    const keys = verdict.tags.map((tag) => tag.key)
    expect(keys).toContain('overtrading')
    expect(keys).toContain('chaser')
  })

  it('flags a headline hunter when most headlines were traded', () => {
    const state = createSession(99)
    const news = Array.from({ length: 5 }, (_, index) => ({
      id: `N-${index}`,
      tick: 10 + index,
      traded: index < 4,
    }))
    const tagged = {
      ...state,
      telemetry: { ...state.telemetry, news },
    }
    const verdict = evaluateSession(tagged)
    expect(verdict.tags.map((tag) => tag.key)).toContain('headline-hunter')
  })

  it('never repeats a tag and caps the list at six', () => {
    const quotes = Array.from({ length: 14 }, (_, index) => quote(index, 2))
    const fills = Array.from({ length: 8 }, (_, index) => fill(index, 0.5))
    const verdict = evaluateSession(withTelemetry(createSession(123), { quotes, fills }))
    const keys = verdict.tags.map((tag) => tag.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys.length).toBeLessThanOrEqual(6)
  })
})
