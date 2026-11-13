import { describe, expect, it } from 'vitest'
import { advanceSession, createSession, fillClientOrder, tradeOnExchange } from './simulation'
import { drillById, drillMetrics, drillProgress, formatMetric, scenarioForDrill } from '../train/drills'
import { emptyDrillRecords, readDrillRecords, recordDrillAttempt } from '../train/records'

/** 简单可控的 storage，用来测记录读写 */
const fakeStorage = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    raw: data,
  }
}

const drill = (id: string) => {
  const found = drillById(id)
  if (!found) throw new Error(`missing drill ${id}`)
  return found
}

describe('training drills', () => {
  it('formats every metric unit the way the picker and HUD show it', () => {
    expect(formatMetric(0.906, 'percent')).toBe('91%')
    expect(formatMetric(1500, 'shares')).toBe('1500')
    expect(formatMetric(12, 'count')).toBe('12')
    expect(formatMetric(1450, 'dollars')).toBe('$1,450')
    expect(formatMetric(-275978, 'dollars')).toBe('-$275,978')
    expect(formatMetric(1.8, 'ratio')).toBe('1.80x')
  })

  it('resolves a drill by id and knows which scenario it replays', () => {
    expect(drill('quote-discipline').role).toBe('market-maker')
    expect(drill('two-venues').role).toBe('sales')
    expect(scenarioForDrill(drill('news-reaction')).id).toBe('fomc')
    expect(scenarioForDrill(drill('adverse-selection')).id).toBe('crash')
    expect(scenarioForDrill(drill('quote-discipline')).id).toBe('classic')
    expect(drillById('no-such-drill')).toBeNull()
  })

  it('starts quote discipline with an empty book and a failed progress', () => {
    const session = createSession(drill('quote-discipline').seed, [], { minutes: 5 })
    const progress = drillProgress(drill('quote-discipline'), session)

    expect(progress.drillId).toBe('quote-discipline')
    expect(progress.passed).toBe(false)
    expect(progress.metrics.map((metric) => metric.id)).toEqual(['quotes', 'tight'])
    expect(progress.metrics[0].value).toBe(0)
    expect(progress.metrics[0].ok).toBe(false)
  })

  it('fails inventory control while the opening book is too big', () => {
    expect(drillProgress(drill('inventory-control'), createSession(3307, [], { minutes: 5 })).metrics[0].value).toBe(0)
    const heavy = createSession(3307, [{ symbol: 'TSLA', netQty: 1500, avgPrice: 196.8 }], { minutes: 5 })
    const progress = drillProgress(drill('inventory-control'), heavy)
    expect(progress.metrics[0].value).toBe(1500)
    expect(progress.metrics[0].ok).toBe(false)
    expect(progress.passed).toBe(false)
  })

  it('passes inventory control when the book is small', () => {
    const light = createSession(3307, [{ symbol: 'TSLA', netQty: 200, avgPrice: 196.8 }], { minutes: 5 })
    const progress = drillProgress(drill('inventory-control'), light)
    expect(progress.metrics[0].value).toBe(200)
    expect(progress.metrics[0].ok).toBe(true)
    expect(progress.passed).toBe(true)
  })

  it('counts the headlines traded and the share answered', () => {
    let session = createSession(drill('news-reaction').seed, [], { minutes: 5 })
    session = advanceSession(session, 240)
    const progress = drillProgress(drill('news-reaction'), session)
    const traded = session.telemetry.news.filter((reaction) => reaction.traded).length
    const headlines = session.telemetry.news.length

    expect(headlines).toBeGreaterThan(0)
    expect(progress.metrics[0].value).toBe(traded)
    expect(progress.metrics[1].value).toBeCloseTo(traded / headlines, 6)
  })

  it('measures the client-to-exchange hedge for the two-venue drill', () => {
    const base = createSession(drill('two-venues').seed, [], { minutes: 5 })
    const noHedge = drillMetrics(drill('two-venues'), base)
    expect(noHedge[0].id).toBe('hedge')
    expect(noHedge[0].value).toBe(0)

    const rfq = base.dispatch[0]
    const client = fillClientOrder(base, {
      symbol: rfq.symbol,
      clientSide: rfq.side,
      client: rfq.client,
      qty: Math.min(500, rfq.qty),
      price: rfq.symbol === 'AZN' ? 802 : 100,
      rfqId: rfq.id,
    })
    const hedged = tradeOnExchange(client.state, { symbol: rfq.symbol, side: 'SELL', qty: 500 })
    const metrics = drillMetrics(drill('two-venues'), hedged.state)
    const hedge = metrics.find((metric) => metric.id === 'hedge')
    const capture = metrics.find((metric) => metric.id === 'capture')

    expect(hedge?.value).toBeGreaterThan(0)
    expect(typeof capture?.value).toBe('number')
  })

  it('records attempts and passes per drill in storage', () => {
    const storage = fakeStorage()
    expect(readDrillRecords(storage)).toEqual({})

    const first = recordDrillAttempt('quote-discipline', false, 44.2, storage)
    expect(first['quote-discipline']).toMatchObject({ attempts: 1, passes: 0, bestComposite: 44.2 })

    const second = recordDrillAttempt('quote-discipline', true, 61.5, storage)
    expect(second['quote-discipline']).toMatchObject({ attempts: 2, passes: 1, bestComposite: 61.5 })
    expect(readDrillRecords(storage)['quote-discipline'].passes).toBe(1)

    storage.setItem('market-sim.drills.v1', '{not json')
    expect(readDrillRecords(storage)).toEqual(emptyDrillRecords())
  })
})
