import type { Book, BookLevel, Side } from '../../types'
import { nextRandom } from '../rng'
import { FLOW_EVENTS } from '../scenario'
import { DEFAULT_TIER_ID, tierById } from '../difficulty'
import type { DifficultyTier } from '../difficulty'
import { quoteAroundMid, venueGap, volatilityScore } from '../venues'
import { COMMISSION_RATE, FILL_IMPACT_FULL_NOTIONAL, FILL_IMPACT_MAX_BPS, FILL_IMPACT_MIN_BPS, FILL_IMPACT_SHARE, FILL_IMPACT_TTL } from './constants'
import type { EnginePosition, InstrumentState, PriceImpulse, SimulationState, VenuePricePreview } from './types'
import { round2 } from './util'

/* ------------------------------------------------------------------ */
/* 盘口                                                                */
/* ------------------------------------------------------------------ */
export function makeBook(
  rng: number,
  last: number,
  spreadBps: number,
  levelSize: number,
  previous?: Book,
): [Book, number] {
  let state = rng
  const halfSpread = Math.max(0.01, round2((last * spreadBps) / 10000))
  const step = Math.max(0.01, round2(halfSpread / 2))
  /* 每档按 100 股取整，第一档就在 levelSize 上下浮动，后面的档位逐渐加厚 */
  const unit = Math.max(100, Math.round(levelSize / 100) * 100)
  const bids: BookLevel[] = []
  const asks: BookLevel[] = []
  for (let level = 0; level < 5; level += 1) {
    const [bidRoll, afterBid] = nextRandom(state)
    state = afterBid
    const [askRoll, afterAsk] = nextRandom(state)
    state = afterAsk
    const depth = 1 + level * 0.35
    /*
     * 每次重挂都向下一个"目标档位"回归一部分：既保留上一簿的连续性（看起来像在原地排队），
     * 又不会让挂单量一路随机游走漂到几万股。
     */
    const bidTarget = unit * (0.85 + bidRoll * 0.3) * depth
    const askTarget = unit * (0.85 + askRoll * 0.3) * depth
    const bidBase = previous ? previous.bids[level].size * 0.6 + bidTarget * 0.4 : bidTarget
    const askBase = previous ? previous.asks[level].size * 0.6 + askTarget * 0.4 : askTarget
    const bidSize = Math.round((bidBase * (previous ? 0.95 + bidRoll * 0.1 : 1)) / 100) * 100
    const askSize = Math.round((askBase * (previous ? 0.95 + askRoll * 0.1 : 1)) / 100) * 100
    bids.push({
      price: round2(last - halfSpread - level * step),
      size: Math.max(100, bidSize),
    })
    asks.push({
      price: round2(last + halfSpread + level * step),
      size: Math.max(100, askSize),
    })
  }
  return [{ bids, asks }, state]
}

/** 盘口中间价，用来衡量成交是否占到了点差 */
export function bookMid(book: Book): number {
  const bid = book.bids[0]?.price ?? 0
  const ask = book.asks[0]?.price ?? bid
  return round2((bid + ask) / 2)
}

/** 当前标的的波动因子（0 平静 → 1 剧烈）：交易所价差和 dealer 报价都按它放大 */
export function instrumentVolatility(state: SimulationState, symbol: string): number {
  const instrument = state.instruments.find((item) => item.symbol === symbol)
  if (!instrument) return 0.4
  return volatilityScore(instrument.series, state.newsBias[symbol] ?? 0)
}

/**
 * 面板 5 上「我这个角色」的实时买卖价：引擎成交和界面展示共用这一个函数，
 * 保证看到的价就是点下去成交的价。MM 的价差更紧，Sales 更宽（见 venues.ts）。
 */
export function venuePricePreview(state: SimulationState, symbol: string): VenuePricePreview {
  const instrument = state.instruments.find((item) => item.symbol === symbol)
  const mid = instrument ? bookMid(instrument.book) : 0
  const volatility = instrumentVolatility(state, symbol)
  const tier = tierOf(state)
  const baseGap = venueGap(state.role, volatility)
  const gapMultiplier = state.role === 'sales' ? tier.exchangeGapMult : tier.makerGapMult
  const { buy, sell, gapPoints } = quoteAroundMid(mid, baseGap * gapMultiplier)
  return { mid, buy, sell, gapPoints, gapBps: round2(baseGap * gapMultiplier * 10000), volatility }
}

/** 旧状态/测试夹具可能没有难度档位，统一回落到该角色的基准档 */
export const tierOf = (state: SimulationState): DifficultyTier =>
  state.tier ?? tierById(state.role ?? 'market-maker', DEFAULT_TIER_ID)

/** 本局每边佣金（比例），档位决定 */
export const commissionOf = (state: SimulationState): number =>
  Number.isFinite(state.commissionRate) ? state.commissionRate : COMMISSION_RATE

/**
 * 风险限额检查：这笔主动成交会不会突破单名净敞口或总毛敞口上限。
 * 返回拒单原因（null = 通过）。限额本身不改变评分公式，只限制能不能做。
 */
export function riskLimitBreach(
  state: SimulationState,
  symbol: string,
  ourSide: Side,
  qty: number,
  price: number,
): string | null {
  const tier = tierOf(state)
  const signed = ourSide === 'BUY' ? qty : -qty
  const symbols = new Set([...state.positions.map((position) => position.symbol), symbol])
  let gross = 0
  let nameValue = 0
  for (const name of symbols) {
    const position = state.positions.find((candidate) => candidate.symbol === name)
    const instrument = state.instruments.find((candidate) => candidate.symbol === name)
    const instrumentPrice = name === symbol ? price : (instrument?.last ?? position?.avgPrice ?? 0)
    const quantity = (position?.netQty ?? 0) + (name === symbol ? signed : 0)
    const value = quantity * instrumentPrice
    gross += Math.abs(value)
    if (name === symbol) nameValue = value
  }
  const money = (value: number) => `$${Math.round(value).toLocaleString('en-US')}`
  if (Math.abs(nameValue) > tier.perNameLimit) {
    return `RISK LIMIT · ${symbol} net exposure would exceed ${money(tier.perNameLimit)}`
  }
  if (gross > tier.grossLimit) {
    return `RISK LIMIT · gross exposure would exceed ${money(tier.grossLimit)}`
  }
  return null
}

/** 盘口某一侧的总挂单量 —— 也就是「交易所现在最多能成交多少股」 */
export function exchangeLiquidity(levels: BookLevel[]): number {
  return levels.reduce((total, level) => total + level.size, 0)
}

/**
 * 沿盘口逐档吃掉 qty 股：返回加权成交均价和消耗的档数。
 * 流动性不足时返回 null（调用方决定是拒单还是部分成交）。
 */
export function walkBook(levels: BookLevel[], qty: number): { avgPrice: number; levels: number } | null {
  if (!(qty > 0)) return null
  let left = qty
  let notional = 0
  let used = 0
  for (const level of levels) {
    if (left <= 0) break
    const take = Math.min(left, level.size)
    notional += take * level.price
    left -= take
    used += 1
  }
  if (left > 0) return null
  return { avgPrice: round2(notional / qty), levels: used }
}

/** 波动率缩放：同一句话对不同名字的影响不同（高波动名字反应更大） */
export const volScale = (sigma: number) => Math.min(1.8, Math.max(0.7, sigma / 0.0018))

export const clampUnit = (value: number) => Math.min(1, Math.max(0, value))

/**
 * 我们自己的成交推动价格的幅度（3–10bps）：成交金额越大，冲击越大；
 * 撞上新闻时两者叠加，所以大单在消息行情里更危险。
 */
export function fillImpactBps(notional: number): number {
  const size = clampUnit(notional / FILL_IMPACT_FULL_NOTIONAL)
  return round2(FILL_IMPACT_MIN_BPS + (FILL_IMPACT_MAX_BPS - FILL_IMPACT_MIN_BPS) * size)
}

/** 把一笔我们自己的成交变成该标的的冲量：买上推、卖下压，随后逐帧衰减 */
export function applyFillImpact(
  instruments: InstrumentState[],
  symbol: string,
  ourSide: Side,
  notional: number,
  tick: number,
): InstrumentState[] {
  const bps = fillImpactBps(notional)
  const direction: 1 | -1 = ourSide === 'BUY' ? 1 : -1
  /* 四成立刻打进价格，立刻能在图上看到；剩下六成逐帧衰减 */
  const immediate = round2(bps * FILL_IMPACT_SHARE)
  const remaining = round2(bps - immediate)
  const impulse: PriceImpulse = {
    id: `FILL-${tick}-${symbol}`,
    label: 'your fill',
    direction,
    bps: remaining,
    ttl: FILL_IMPACT_TTL,
    hint: 'Your own size pressed the tape — the bigger the fill, the longer the drift it leaves behind.',
    source: 'fill',
  }
  return instruments.map((instrument) =>
    instrument.symbol === symbol
      ? {
          ...instrument,
          last: round2(Math.max(0.01, instrument.last * (1 + (direction * immediate) / 10000))),
          impulses: [...instrument.impulses, impulse],
        }
      : instrument,
  )
}

/** 按权重抽一个微观流动来源（每次行情刷新都会抽一个，保证价格变动有解释） */
export function pickFlowEvent(roll: number) {
  const total = FLOW_EVENTS.reduce((sum, event) => sum + event.weight, 0)
  let target = roll * total
  for (const event of FLOW_EVENTS) {
    target -= event.weight
    if (target <= 0) return event
  }
  return FLOW_EVENTS[FLOW_EVENTS.length - 1]
}

/** 头条热度的半衰期约 34 帧（≈28 个模拟分钟），让 informed 客户跟着同一条消息来做方向 */
export const NEWS_BIAS_DECAY = 0.98

export function decayNewsBias(bias: Record<string, number>): Record<string, number> {
  const next: Record<string, number> = {}
  for (const [symbol, value] of Object.entries(bias)) {
    const decayed = round2(value * NEWS_BIAS_DECAY)
    if (Math.abs(decayed) >= 0.5) next[symbol] = decayed
  }
  return next
}

/* ------------------------------------------------------------------ */
/* 持仓与成交                                                          */
/* ------------------------------------------------------------------ */
export function applyPositionFill(
  positions: EnginePosition[],
  symbol: string,
  ourSide: Side,
  qty: number,
  price: number,
): EnginePosition[] {
  const index = positions.findIndex((position) => position.symbol === symbol)
  const base: EnginePosition =
    index === -1 ? { symbol, netQty: 0, avgPrice: 0, realised: 0 } : positions[index]
  const signed = ourSide === 'BUY' ? qty : -qty
  let netQty = base.netQty
  let avgPrice = base.avgPrice
  let realised = base.realised

  if (netQty === 0 || Math.sign(netQty) === Math.sign(signed)) {
    const nextQty = netQty + signed
    avgPrice = (avgPrice * Math.abs(netQty) + price * qty) / Math.abs(nextQty)
    netQty = nextQty
  } else {
    const closingQty = Math.min(Math.abs(netQty), qty)
    realised += (price - avgPrice) * closingQty * Math.sign(netQty)
    const nextQty = netQty + signed
    if (nextQty === 0) {
      avgPrice = 0
    } else if (Math.sign(nextQty) !== Math.sign(netQty)) {
      avgPrice = price
    }
    netQty = nextQty
  }

  const updated: EnginePosition = {
    ...base,
    netQty,
    avgPrice: round2(avgPrice),
    realised: round2(realised),
  }
  if (index === -1) return [...positions, updated]
  return positions.map((position, positionIndex) => (positionIndex === index ? updated : position))
}
