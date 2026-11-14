import { describe, expect, it } from 'vitest'
import { copyText, scheduleNews } from './news'
import { NEWS_POOLS, NEWS_SHORT_ZH } from './news/index'
import { SCENARIOS } from './scenarios'
import { tierById } from './difficulty'

const ALLOWED_SOURCES = [
  'WIRE',
  'DESK',
  'EXCHANGE',
  'BROKER',
  'NEWSPAPER',
  'FILING',
  'ANALYST',
]

describe('news scheduling', () => {
  it('picks the same headlines and slots for the same seed', () => {
    const a = scheduleNews(NEWS_POOLS[0], 42, 6)
    const b = scheduleNews(NEWS_POOLS[0], 42, 6)
    expect(a).toEqual(b)
    expect(scheduleNews(NEWS_POOLS[0], 43, 6)).not.toEqual(a)
  })

  it('returns the requested count, never repeats a template, and stays inside the session', () => {
    const scheduled = scheduleNews(NEWS_POOLS[0], 7, 9)
    expect(scheduled).toHaveLength(9)
    expect(new Set(scheduled.map((item) => item.template.id)).size).toBe(9)
    for (const item of scheduled) {
      expect(item.at).toBeGreaterThan(0)
      expect(item.at).toBeLessThan(1)
    }
  })

  it('lays the slots out in ascending order and starts early', () => {
    const scheduled = scheduleNews(NEWS_POOLS[2], 11, 8)
    const slots = scheduled.map((item) => item.at)
    expect(slots[0]).toBeLessThanOrEqual(0.02)
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i]).toBeGreaterThan(slots[i - 1])
    }
  })

  it('never returns more headlines than the pool holds', () => {
    const scheduled = scheduleNews(NEWS_POOLS[0], 5, 99)
    expect(scheduled).toHaveLength(NEWS_POOLS[0].length)
  })
})

describe('news pools', () => {
  it('ships ten scenarios, each backed by at least a twelve-strong pool', () => {
    expect(SCENARIOS).toHaveLength(10)
    expect(NEWS_POOLS).toHaveLength(10)
    for (const pool of NEWS_POOLS) {
      expect(pool.length).toBeGreaterThanOrEqual(12)
    }
  })

  it('keeps ids unique and every template bilingual', () => {
    const ids = NEWS_POOLS.flat().map((template) => template.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const template of NEWS_POOLS.flat()) {
      expect(template.id).toBeTruthy()
      expect(template.headline.en.length).toBeGreaterThan(0)
      expect(template.headline.zh.length).toBeGreaterThan(0)
      expect(template.detail.en.length).toBeGreaterThan(40)
      expect(template.detail.zh.length).toBeGreaterThan(10)
      expect(copyText(template.headline, 'zh')).toBe(template.headline.zh)
      expect(copyText(template.headline, 'en')).toBe(template.headline.en)
    }
  })

  it('keeps notes directionless and equity headlines tied to their symbol', () => {
    for (const template of NEWS_POOLS.flat()) {
      if (template.kind === 'note') {
        expect(template.symbol).toBeUndefined()
        expect(template.direction).toBeUndefined()
        expect(template.driftBps).toBeUndefined()
      } else if (template.kind === 'equity') {
        expect(template.tag).toBe(template.symbol)
        expect(template.symbol).toBeTruthy()
      } else {
        expect(template.tag).toBe('MACRO')
      }
      if (template.direction) {
        expect(template.driftBps).toBeGreaterThan(0)
      }
    }
  })

  it('always cites a source', () => {
    const allowed = new Set(ALLOWED_SOURCES)
    const extra = new Set<string>()
    for (const template of NEWS_POOLS.flat()) {
      expect(template.source.trim().length).toBeGreaterThan(0)
      if (!allowed.has(template.source.toUpperCase())) extra.add(template.source.toUpperCase())
    }
    // 允许各池使用自己的媒体名，但必须是短标签（详情页会原样显示）
    for (const source of extra) expect(source.length).toBeLessThan(24)
  })

  it('keeps the price-tape short labels unambiguous', () => {
    // 同一池内不能重名（价格带会把相邻两笔同名驱动看成一件事）
    for (const pool of NEWS_POOLS) {
      const shorts = pool.map((template) => template.short.en)
      expect(new Set(shorts).size).toBe(shorts.length)
    }
    // 跨池重名的英文短标签，中文必须一致，否则字典里谁后写谁赢
    const byShort = new Map<string, string>()
    for (const template of NEWS_POOLS.flat()) {
      if (template.short.zh === template.short.en) continue
      const seen = byShort.get(template.short.en)
      if (seen) expect(seen).toBe(template.short.zh)
      byShort.set(template.short.en, template.short.zh)
    }
    expect(Object.keys(NEWS_SHORT_ZH).length).toBeGreaterThan(40)
  })
})

describe('news direction by difficulty', () => {
  it('hides the bullish/bearish badges only on the two hardest tiers', () => {
    expect(tierById('market-maker', 1).hideNewsDirection).toBe(false)
    expect(tierById('market-maker', 2).hideNewsDirection).toBe(false)
    expect(tierById('market-maker', 3).hideNewsDirection).toBe(true)
    expect(tierById('market-maker', 4).hideNewsDirection).toBe(true)
    expect(tierById('sales', 1).hideNewsDirection).toBe(false)
    expect(tierById('sales', 2).hideNewsDirection).toBe(false)
    expect(tierById('sales', 3).hideNewsDirection).toBe(true)
    expect(tierById('sales', 4).hideNewsDirection).toBe(true)
  })
})
