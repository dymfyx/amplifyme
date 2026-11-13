import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIER_ID,
  DIFFICULTY_TIERS,
  MAKER_TIERS,
  SALES_TIERS,
  clampTierId,
  tierById,
  tiersFor,
  verdictBand,
} from './difficulty'
import { createSession, tradeOnExchange } from './simulation'

describe('difficulty tiers', () => {
  it('ships four tiers per desk, ordered from easiest to hardest', () => {
    expect(SALES_TIERS.map((tier) => tier.id)).toEqual([1, 2, 3, 4])
    expect(MAKER_TIERS.map((tier) => tier.id)).toEqual([1, 2, 3, 4])
    expect(DIFFICULTY_TIERS.sales).toBe(SALES_TIERS)
    expect(DIFFICULTY_TIERS['market-maker']).toBe(MAKER_TIERS)
    expect(tiersFor('sales')).toHaveLength(4)
    expect(tiersFor('market-maker')).toHaveLength(4)
  })

  it('makes every knob harder as the tier rises', () => {
    for (const tiers of [SALES_TIERS, MAKER_TIERS]) {
      for (let index = 1; index < tiers.length; index += 1) {
        const easier = tiers[index - 1]
        const harder = tiers[index]
        expect(harder.commissionRate).toBeGreaterThan(easier.commissionRate)
        expect(harder.newsVolMult).toBeGreaterThan(easier.newsVolMult)
        expect(harder.headlineCount).toBeGreaterThanOrEqual(easier.headlineCount)
        expect(harder.agentSkill).toBeGreaterThan(easier.agentSkill)
        expect(harder.informedShare).toBeGreaterThan(easier.informedShare)
        expect(harder.snipeChance).toBeGreaterThanOrEqual(easier.snipeChance)
        expect(harder.perNameLimit).toBeGreaterThan(easier.perNameLimit)
        expect(harder.grossLimit).toBeGreaterThan(easier.grossLimit)
      }
    }
  })

  it('keeps the second tier as the reference book', () => {
    expect(DEFAULT_TIER_ID).toBe(2)
    const base = tierById('market-maker', 2)
    expect(base.id).toBe(2)
    expect(base.commissionRate).toBeCloseTo(0.0005, 6)
    expect(base.newsVolMult).toBe(1)
    expect(base.agentSkill).toBe(1)
    expect(base.informedShare).toBeCloseTo(0.55, 6)
    expect(base.exchangeMode).toBe('full')
    expect(base.dealerCount).toBe(3)
    expect(tierById('sales', 2).commissionRate).toBeCloseTo(base.commissionRate, 6)
  })

  it('tightens the mandates on the hard tiers', () => {
    expect(tierById('sales', 1).allowShort).toBe(false)
    expect(tierById('sales', 4).liquidityDrain).toBe(true)
    expect(tierById('market-maker', 4).exchangeMode).toBe('reduce-only')
    expect(tierById('market-maker', 4).declineQuota).toBe(1)
    expect(tierById('market-maker', 4).maxExchangeBookShare).toBeLessThan(1)
    expect(tierById('market-maker', 1).exchangeMode).toBe('full')
  })

  it('clamps a garbage tier id to a valid tier', () => {
    expect(clampTierId('4')).toBe(4)
    expect(clampTierId(0)).toBe(1)
    expect(clampTierId(99)).toBe(4)
    expect(clampTierId('nonsense')).toBe(DEFAULT_TIER_ID)
    expect(tierById('sales', 99).id).toBe(4)
  })

  it('bands the composite score, with snark starting below 60', () => {
    expect(verdictBand(90)).toBe('elite')
    expect(verdictBand(85)).toBe('elite')
    expect(verdictBand(84)).toBe('strong')
    expect(verdictBand(70)).toBe('strong')
    expect(verdictBand(69)).toBe('solid')
    expect(verdictBand(60)).toBe('solid')
    expect(verdictBand(59)).toBe('snark')
    expect(verdictBand(45)).toBe('snark')
    expect(verdictBand(44)).toBe('brutal')
  })

  it('names every tier for both the English and Chinese UI', () => {
    for (const desk of ['sales', 'market-maker'] as const) {
      for (const tier of tiersFor(desk)) {
        expect(tier.name.length).toBeGreaterThan(3)
        expect(tier.blurb.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('difficulty mandates on the exchange', () => {
  it('lets a no-shorting desk sell holdings but not short past them', () => {
    const session = createSession(11, [{ symbol: 'AZN', netQty: 300, avgPrice: 800 }], {
      role: 'sales',
      tier: tierById('sales', 1),
    })
    const sold = tradeOnExchange(session, { symbol: 'AZN', side: 'SELL', qty: 300 })
    expect(sold.state.positions.find((position) => position.symbol === 'AZN')?.netQty).toBe(0)

    const long = createSession(12, [{ symbol: 'AZN', netQty: 100, avgPrice: 800 }], {
      role: 'sales',
      tier: tierById('sales', 1),
    })
    const blocked = tradeOnExchange(long, { symbol: 'AZN', side: 'SELL', qty: 400 })
    expect(blocked.message).toMatch(/NO SHORTING/)
    expect(blocked.state).toBe(long)
  })

  it('only lets a reduce-only desk cut risk on the exchange', () => {
    const flat = createSession(13, [], { role: 'market-maker', tier: tierById('market-maker', 4) })
    const blockedBuy = tradeOnExchange(flat, { symbol: 'AZN', side: 'BUY', qty: 100 })
    expect(blockedBuy.message).toMatch(/only lets the desk reduce risk/)

    const long = createSession(14, [{ symbol: 'AZN', netQty: 400, avgPrice: 800 }], {
      role: 'market-maker',
      tier: tierById('market-maker', 4),
    })
    const reduced = tradeOnExchange(long, { symbol: 'AZN', side: 'SELL', qty: 400 })
    expect(reduced.state.positions.find((position) => position.symbol === 'AZN')?.netQty ?? 0).toBe(0)
    const blockedAdd = tradeOnExchange(long, { symbol: 'AZN', side: 'BUY', qty: 100 })
    expect(blockedAdd.message).toMatch(/only lets the desk reduce risk/)
  })

  it('enforces the per-order caps of the tier', () => {
    const session = createSession(15, [], { role: 'sales', tier: tierById('sales', 1) })
    const tooBig = tradeOnExchange(session, { symbol: 'AZN', side: 'BUY', qty: 1_500 })
    expect(tooBig.message).toMatch(/caps a single order at 1,000 shares/)
  })
})