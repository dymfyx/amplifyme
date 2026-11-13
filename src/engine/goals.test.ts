import { describe, expect, it } from 'vitest'
import { goalsForSession, evaluateGoals, formatGoalValue } from './goals'
import { tierById } from './difficulty'
import { advanceSession, createSession } from './simulation'

const tier = tierById('sales', 2)
const makerTier = tierById('market-maker', 2)

const salesSession = () => createSession(42, [], { role: 'sales', tier })
const makerSession = () => createSession(42, [], { role: 'market-maker', tier: makerTier })

describe('session goals', () => {
  it('gives the sales desk four buying-side goals', () => {
    const goals = goalsForSession({ desk: 'sales', minutes: 30, tier })
    expect(goals).toHaveLength(4)
    expect(goals.map((goal) => goal.id)).toEqual([
      'dealer-fills',
      'entry-vs-mid',
      'alpha',
      'max-drawdown',
    ])
    expect(goals[0]).toMatchObject({ label: 'Dealer fills', target: 2, compare: 'gte' })
  })

  it('gives the market making desk four quoting goals', () => {
    const goals = goalsForSession({ desk: 'market-maker', minutes: 30, tier: makerTier })
    expect(goals.map((goal) => goal.id)).toEqual(['quotes', 'tight-quotes', 'net-exposure', 'max-drawdown'])
  })

  it('loosens the money goals as the mandate gets bigger', () => {
    const soft = goalsForSession({ desk: 'sales', minutes: 30, tier: tierById('sales', 1) }).find(
      (goal) => goal.id === 'max-drawdown',
    )
    const hard = goalsForSession({ desk: 'sales', minutes: 30, tier: tierById('sales', 4) }).find(
      (goal) => goal.id === 'max-drawdown',
    )
    expect(soft && hard).toBeTruthy()
    expect((hard?.target ?? 0) > (soft?.target ?? 0)).toBe(true)
  })

  it('marks a fresh session as a miss until the desk earns it', () => {
    const goals = goalsForSession({ desk: 'sales', minutes: 30, tier })
    const status = evaluateGoals(goals, salesSession())
    expect(status).toHaveLength(4)
    expect(status.find((goal) => goal.id === 'dealer-fills')?.ok).toBe(false)
    /* 平盘开局：进场与中间价打平（0 bps）算达标，但没成过交就谈不上 alpha */
    expect(status.find((goal) => goal.id === 'entry-vs-mid')?.ok).toBe(true)
  })

  it('marks the quoting goal once enough quotes are on the wire', () => {
    const goals = goalsForSession({ desk: 'market-maker', minutes: 30, tier: makerTier })
    const status = evaluateGoals(goals, advanceSession(makerSession(), 40))
    const quotes = status.find((goal) => goal.id === 'quotes')
    expect(quotes).toBeTruthy()
    expect(typeof quotes?.current).toBe('number')
    expect(quotes?.ok).toBe(Boolean(quotes && quotes.current >= quotes.target))
  })

  it('formats each goal unit', () => {
    expect(formatGoalValue(2, 'count')).toBe('2')
    expect(formatGoalValue(0.9, 'percent')).toBe('90%')
    expect(formatGoalValue(150000, 'dollars')).toBe('$150,000')
    expect(formatGoalValue(-2.5, 'bps')).toBe('-2.5 bps')
  })
})
