import { describe, expect, it } from 'vitest'
import { advanceSession, cancelLimitOrder, createSession, placeLimitOrder, selectRestingOrders } from './simulation'
import { tierById } from './difficulty'

const fresh = (options: Parameters<typeof createSession>[2] = {}) => createSession(90210, [], options)

const quote = (state: ReturnType<typeof fresh>) => state.instruments.find((item) => item.symbol === 'AZN')!

describe('exchange limit orders', () => {
  it('rests a working order you can see in the blotter', () => {
    const state = fresh()
    const last = quote(state).last
    const result = placeLimitOrder(state, { symbol: 'AZN', side: 'BUY', qty: 400, limit: last * 0.95 })

    expect(result.message).toContain('ORDER WORKING')
    expect(result.state.restingOrders).toHaveLength(1)
    expect(result.state.restingOrders[0].status).toBe('WORKING')
    expect(result.state.restingOrders[0].remaining).toBe(400)
    expect(result.state.orders[0].status).toBe('WORKING')
    expect(result.state.orders[0].venue).toBe('exchange')
    expect(selectRestingOrders(result.state)).toHaveLength(1)
  })

  it('fills once the price trades through the limit', () => {
    const state = fresh()
    const last = quote(state).last
    /* 买价挂在市场价之上 = 立刻可以成交（相当于市价买，但按限价结算） */
    const placed = placeLimitOrder(state, { symbol: 'AZN', side: 'BUY', qty: 300, limit: last * 1.01 })
    const after = advanceSession(placed.state, 4)

    const position = after.positions.find((item) => item.symbol === 'AZN')
    expect(position?.netQty).toBeGreaterThan(0)
    expect(after.trades.some((trade) => trade.venue === 'exchange')).toBe(true)
    const order = after.orders.find((row) => row.id === placed.state.restingOrders[0].orderId)
    expect(['WORKING', 'FILLED']).toContain(order?.status)
    expect(after.telemetry.fills.some((fill) => fill.venue === 'exchange')).toBe(true)
  })

  it('keeps an order that is away from the market and lets you cancel it', () => {
    const state = fresh()
    const last = quote(state).last
    const placed = placeLimitOrder(state, { symbol: 'AZN', side: 'BUY', qty: 300, limit: last * 0.9 })
    const idle = advanceSession(placed.state, 6)
    expect(idle.positions.find((item) => item.symbol === 'AZN')).toBeUndefined()
    expect(selectRestingOrders(idle)).toHaveLength(1)

    const cancelled = cancelLimitOrder(idle, idle.restingOrders[0].id)
    expect(cancelled.message).toContain('ORDER CANCELLED')
    expect(cancelled.state.restingOrders[0].status).toBe('CANCELLED')
    expect(cancelled.state.orders[0].status).toBe('CANCELLED')
    expect(selectRestingOrders(cancelled.state)).toHaveLength(0)
  })

  it('rejects bad sizes, wild limits and shorting on a retail mandate', () => {
    const state = fresh()
    const last = quote(state).last
    expect(placeLimitOrder(state, { symbol: 'AZN', side: 'BUY', qty: 0, limit: last }).message).toContain(
      'quantity must be positive',
    )
    expect(placeLimitOrder(state, { symbol: 'AZN', side: 'BUY', qty: 100, limit: last * 1.5 }).message).toContain(
      'within 20%',
    )

    const retail = fresh({ role: 'sales', tier: tierById('sales', 1) })
    const short = placeLimitOrder(retail, {
      symbol: 'AZN',
      side: 'SELL',
      qty: 100,
      limit: quote(retail).last * 1.01,
    })
    expect(short.message).toContain('NO SHORTING')
    expect(short.state.restingOrders).toHaveLength(0)
  })

  it('blocks risk-increasing orders on a reduce-only mandate', () => {
    const state = fresh({ role: 'market-maker', tier: tierById('market-maker', 4) })
    const last = quote(state).last
    const result = placeLimitOrder(state, { symbol: 'AZN', side: 'BUY', qty: 100, limit: last })
    expect(result.message).toContain('reduce risk')
    expect(result.state.restingOrders).toHaveLength(0)
  })
})
