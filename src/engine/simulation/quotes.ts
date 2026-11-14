import type { Book, OrderRow, Side, TradeRow } from '../../types'
import { nextRandom } from '../rng'
import { dealerGap } from '../venues'
import { recordFill } from '../telemetry'
import { MAX_FILL_PROBABILITY, MIN_FILL_PROBABILITY, WIDTH_FILL_PENALTY } from './constants'
import { applyFillImpact, applyPositionFill, bookMid, commissionOf, instrumentVolatility, riskLimitBreach, tierOf } from './market'
import type { ActionResult, DealerDefinition, DealerHitInput, DealerQuote, DealerRequestInput, SimulationState } from './types'
import { formatShortTime, round2 } from './util'

/**
 * 盘口里排在我们前面的股数：客户卖出（我们接货）时看买盘里同价或更好的挂单，
 * 客户买入（我们卖出）时看卖盘里同价或更好的挂单。
 */
export function queueAheadAt(book: Book, clientSide: Side, price: number): number {
  const levels = clientSide === 'SELL' ? book.bids : book.asks
  return levels
    .filter((level) => (clientSide === 'SELL' ? level.price >= price : level.price <= price))
    .reduce((total, level) => total + level.size, 0)
}

/** 我们的报价相对盘口第一档有多有竞争力：1 = 排在最前，越小越靠后 */
export function priceCompetitiveness(book: Book, clientSide: Side, price: number): number {
  const best = clientSide === 'SELL' ? book.bids[0]?.price : book.asks[0]?.price
  if (!best) return 0
  const distanceBps =
    clientSide === 'SELL' ? ((best - price) / best) * 10000 : ((price - best) / best) * 10000
  if (distanceBps <= 0) return 1
  return Math.max(0.05, 0.8 - distanceBps / 8)
}

/**
 * 报价宽度 → 被成交的概率（逆向选择）：
 * 和市场一样宽约 96%，比市场宽 2 倍约 61%，宽到 3.4 倍以上就只能碰运气了（下限 12%）。
 * 报得紧更容易成交，但成交时往往正被逆向选择，这就是做市的真实取舍。
 */
export function fillProbability(spreadRatio: number): number {
  const ratio = Number.isFinite(spreadRatio) && spreadRatio > 0 ? spreadRatio : 1
  const raw = MAX_FILL_PROBABILITY - WIDTH_FILL_PENALTY * (ratio - 1)
  return round2(Math.min(MAX_FILL_PROBABILITY, Math.max(MIN_FILL_PROBABILITY, raw)))
}

export const DEALERS: DealerDefinition[] = [
  { id: 'DLR-01', name: 'Halcyon Securities', width: 0.8, latency: 1 },
  { id: 'DLR-02', name: 'Meridian Bank', width: 1.0, latency: 2 },
  { id: 'DLR-03', name: 'Kestrel Capital', width: 1.3, latency: 3 },
]

/**
 * Sales 向三家 dealer 同时要价：价格围绕中间价、按各自宽度和 skew 报出，
 * 有延迟（1–4 tick）、有有效期，能承接的数量也可能小于我们要的。
 */
export function requestDealerQuote(state: SimulationState, input: DealerRequestInput): ActionResult {
  if (state.role !== 'sales') {
    return { state, message: 'RFQ REJECTED · the market making desk quotes prices, it does not ask for them' }
  }
  const qty = Math.trunc(input.qty)
  if (!(qty > 0)) return { state, message: 'RFQ REJECTED · quantity must be positive' }
  const instrument = state.instruments.find((item) => item.symbol === input.symbol)
  if (!instrument) return { state, message: 'RFQ REJECTED · unknown instrument' }
  const mid = bookMid(instrument.book)
  if (!(mid > 0)) return { state, message: 'RFQ REJECTED · no market right now' }

  const volatility = instrumentVolatility(state, input.symbol)
  const tier = tierOf(state)
  const base = dealerGap(volatility) * tier.dealerGapMult
  let rng = state.rng
  let seq = state.counters.dealerQuote
  const created: DealerQuote[] = []
  /* 高档位：dealer 更少、会掉线、回价更慢也更短命 */
  const roster = DEALERS.slice(0, Math.max(1, Math.min(DEALERS.length, tier.dealerCount)))
  for (const dealer of roster) {
    const [latencyRoll, afterLatency] = nextRandom(rng)
    const [widthRoll, afterWidth] = nextRandom(afterLatency)
    const [skewRoll, afterSkew] = nextRandom(afterWidth)
    const [sizeRoll, afterSize] = nextRandom(afterSkew)
    const [ttlRoll, afterTtl] = nextRandom(afterSize)
    const [dropRoll, afterDrop] = nextRandom(afterTtl)
    rng = afterDrop
    const latency = dealer.latency + tier.dealerLatencyBonus + (latencyRoll > 0.6 ? 1 : 0)
    const gap = base * dealer.width * (0.85 + widthRoll * 0.3)
    /* 每家 dealer 会把自己的双边价整体抬一点或压一点，模拟不同库存/看法 */
    const skew = (skewRoll - 0.5) * gap * 0.3
    const bid = round2(mid * (1 - gap / 2) + skew)
    const offer = round2(Math.max(bid + 0.01, mid * (1 + gap / 2) + skew))
    /* dealer 掉线：这一家不回价（高档位会出现） */
    if (tier.dealerDowntime > 0 && dropRoll < tier.dealerDowntime / Math.max(1, tier.dealerDowntime + 1)) {
      continue
    }
    seq += 1
    const sizeUnit = Math.max(100, Math.round(instrument.bookSize / 10 / 100) * 100)
    const size = Math.max(
      sizeUnit,
      Math.round((qty * (0.4 + sizeRoll * 0.9)) / sizeUnit) * sizeUnit,
    )
    created.push({
      id: `DQ-${seq}`,
      requestId: `RQ-${seq}`,
      dealerId: dealer.id,
      dealerName: dealer.name,
      symbol: input.symbol,
      side: input.side,
      qty,
      bid,
      offer,
      size,
      readyAt: state.tick + latency,
      expiresAt: state.tick + latency + Math.round((24 + ttlRoll * 16) * tier.dealerValidityMult),
    })
  }

  return {
    state: {
      ...state,
      rng,
      counters: { ...state.counters, dealerQuote: seq },
      dealerQuotes: [...state.dealerQuotes, ...created].slice(-18),
    },
    message: `RFQ SENT · ${input.side} ${qty.toLocaleString('en-US')} ${input.symbol} · ${created.length} dealers calling back`,
  }
}

/** 打掉某家 dealer 的报价：BUY 打 offer，SELL 砸 bid */
export function hitDealerQuote(state: SimulationState, input: DealerHitInput): ActionResult {
  const quote = state.dealerQuotes.find((item) => item.id === input.quoteId)
  if (!quote) return { state, message: 'DEALER QUOTE GONE · it expired or was already used' }
  if (state.tick < quote.readyAt) return { state, message: 'DEALER NOT ON THE LINE YET · wait for the callback' }
  if (state.tick > quote.expiresAt) return { state, message: 'DEALER QUOTE EXPIRED · send a new RFQ' }
  const instrument = state.instruments.find((item) => item.symbol === quote.symbol)
  if (!instrument) return { state, message: 'DEALER QUOTE EXPIRED · unknown instrument' }

  const qty = Math.min(quote.size, Math.trunc(input.qty ?? quote.size))
  if (!(qty > 0)) return { state, message: 'DEALER REJECTED · quantity must be positive' }
  const tier = tierOf(state)
  const heldQty = state.positions.find((position) => position.symbol === quote.symbol)?.netQty ?? 0
  if (state.role === 'sales' && !tier.allowShort && input.side === 'SELL' && heldQty < qty) {
    return { state, message: 'NO SHORTING · retail accounts can only sell what they already hold' }
  }
  const price = input.side === 'BUY' ? quote.offer : quote.bid
  const gross = qty * price
  const fee = round2(gross * commissionOf(state))
  if (input.side === 'BUY' && gross + fee > state.cash) {
    const need = Math.ceil(gross + fee).toLocaleString('en-US')
    const have = Math.floor(state.cash).toLocaleString('en-US')
    return { state, message: `DEALER REJECTED · insufficient cash (need $${need}, have $${have})` }
  }
  const riskBreach = riskLimitBreach(state, quote.symbol, input.side, qty, price)
  if (riskBreach) return { state, message: riskBreach }

  const mid = bookMid(instrument.book)
  const positions = applyPositionFill(state.positions, quote.symbol, input.side, qty, price)
  /* 打 dealer 的价不直接挂在盘口上，对市场的冲击只有交易所的一半 */
  const instruments = applyFillImpact(state.instruments, quote.symbol, input.side, gross * 0.5, state.tick)
  const counters = { ...state.counters, trade: state.counters.trade + 1, order: state.counters.order + 1 }
  const order: OrderRow = {
    id: `ORD-${counters.order}`,
    time: formatShortTime(state.simSeconds),
    symbol: quote.symbol,
    side: input.side,
    qty,
    price,
    status: 'FILLED',
    venue: 'dealer',
  }
  const trade: TradeRow = {
    id: `TRD-${counters.trade}`,
    time: formatShortTime(state.simSeconds),
    symbol: quote.symbol,
    side: input.side,
    qty,
    price,
    fee,
    venue: 'dealer',
  }
  const telemetry = recordFill(state.telemetry, {
    id: trade.id,
    symbol: quote.symbol,
    side: input.side,
    qty,
    price,
    mid,
    edge: round2(input.side === 'BUY' ? mid - price : price - mid),
    notional: round2(gross),
    fee,
    tick: state.tick,
    venue: 'dealer',
  })

  return {
    state: {
      ...state,
      positions,
      instruments,
      telemetry,
      commission: round2(state.commission + fee),
      orders: [order, ...state.orders].slice(0, 20),
      trades: [trade, ...state.trades].slice(0, 20),
      cash: round2(state.cash + (input.side === 'BUY' ? -(gross + fee) : gross - fee)),
      counters,
      dealerQuotes: state.dealerQuotes.filter((item) => item.id !== quote.id),
    },
    message: `DEALER FILLED · ${quote.side} ${qty.toLocaleString('en-US')} ${quote.symbol} @ ${price.toFixed(
      2,
    )} · ${quote.dealerName}`,
  }
}
