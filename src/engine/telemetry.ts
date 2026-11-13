import type { Side, Venue } from '../types'
import type { ClientType } from './scenarios'

/**
 * 决策遥测：把玩家在台面上做过的事情记成事件流，供评分和结算报告使用。
 *
 * 只记录「能反映决策质量」的信号，不做 IO、不依赖时间：
 * - 每次报价的宽度 vs 当时市场价差、对 RFQ 的反应 tick 数
 * - 每次成交相对当时中间价的 edge（是否买在中间价之下 / 卖在之上）
 * - 拒绝过多少张派单
 * - 每个行情帧的毛敞口与 P&L（用来算最大回撤、平均杠杆）
 * - 每条头条之后 20 个 tick 内是否动过手（适应性）
 */

export interface QuoteRecord {
  id: string
  symbol: string
  tick: number
  /** 我们的报价宽度（offer - bid），美元 */
  ourSpread: number
  /** 报价时市场的盘口价差（ask0 - bid0），美元 */
  marketSpread: number
  /** 距离这条 RFQ 到达过了多少个 tick（null = 手工报价，不是回应派单） */
  responseTicks: number | null
  rfqId?: string
  /** 这条报价背后是消息灵通的客户还是普通流动性客户 */
  clientType: ClientType
  /** 报价从发出到排到队首用了多少个 tick（PENDING + 排队消耗） */
  queueTicks: number
  /** 最终成交了多少股（部分成交时小于报价数量） */
  filledQty: number
}

export interface FillRecord {
  id: string
  symbol: string
  /** 我们的方向（客户卖出 → 我们买入） */
  side: Side
  qty: number
  price: number
  /** 成交时的市场中间价 */
  mid: number
  /** 每股价差收益：买入为 mid - price，卖出为 price - mid；正数=占便宜 */
  edge: number
  notional: number
  fee: number
  tick: number
  /** 成交来源：客户流 or 自己在交易所吃单 */
  venue: Venue
  /** 客户流成交时，背后客户的类型（交易所成交为空） */
  clientType?: ClientType
  /** 客户流成交时来自哪张报价 */
  quoteId?: string
  /** 这笔客户流的对手方是哪个流式智能体（没有就是普通流动性） */
  counterparty?: string
}

export interface ExposureSample {
  tick: number
  gross: number
  net: number
  pnl: number
}

export interface NewsReaction {
  id: string
  tick: number
  traded: boolean
}

export interface Telemetry {
  quotes: QuoteRecord[]
  fills: FillRecord[]
  declines: number
  rfqs: number
  exposure: ExposureSample[]
  peakPnl: number
  maxDrawdown: number
  news: NewsReaction[]
  /** 消息灵通的客户一共发来多少张 RFQ */
  informedRfqs: number
  /** 其中被我们吃下（成交）多少张 */
  informedFills: number
}

/** 事件流上限，避免长局无限增长 */
export const QUOTE_LIMIT = 240
export const FILL_LIMIT = 240
export const EXPOSURE_LIMIT = 480
export const NEWS_LIMIT = 24
/** 头条之后多少个 tick 内动手算「跟上了新闻」 */
export const NEWS_REACTION_TICKS = 20

export function createTelemetry(): Telemetry {
  return {
    quotes: [],
    fills: [],
    declines: 0,
    rfqs: 0,
    exposure: [],
    peakPnl: 0,
    maxDrawdown: 0,
    news: [],
    informedRfqs: 0,
    informedFills: 0,
  }
}

export function recordQuote(telemetry: Telemetry, quote: QuoteRecord): Telemetry {
  return { ...telemetry, quotes: [...telemetry.quotes, quote].slice(-QUOTE_LIMIT) }
}

/** 报价发出后才有结果（排队多久、最终成交多少），用这个补写到对应的记录上 */
export function patchQuote(
  telemetry: Telemetry,
  id: string,
  patch: Partial<Pick<QuoteRecord, 'queueTicks' | 'filledQty'>>,
): Telemetry {
  return {
    ...telemetry,
    quotes: telemetry.quotes.map((quote) => (quote.id === id ? { ...quote, ...patch } : quote)),
  }
}

export function recordDecline(telemetry: Telemetry): Telemetry {
  return { ...telemetry, declines: telemetry.declines + 1 }
}

export function recordRfq(telemetry: Telemetry, informed = false): Telemetry {
  return {
    ...telemetry,
    rfqs: telemetry.rfqs + 1,
    informedRfqs: telemetry.informedRfqs + (informed ? 1 : 0),
  }
}

/** 记一笔成交，并把最近一条「还没被响应」的头条标记成已响应 */
export function recordFill(telemetry: Telemetry, fill: FillRecord): Telemetry {
  const news = telemetry.news.map((item) =>
    !item.traded && fill.tick - item.tick <= NEWS_REACTION_TICKS ? { ...item, traded: true } : item,
  )
  const informedFills =
    fill.clientType === 'informed' ? telemetry.informedFills + 1 : telemetry.informedFills
  return { ...telemetry, fills: [...telemetry.fills, fill].slice(-FILL_LIMIT), news, informedFills }
}

export function recordNews(telemetry: Telemetry, id: string, tick: number): Telemetry {
  return { ...telemetry, news: [...telemetry.news, { id, tick, traded: false }].slice(-NEWS_LIMIT) }
}

/** 每个行情帧采样一次敞口与盈亏，顺带维护峰值与最大回撤 */
export function sampleExposure(
  telemetry: Telemetry,
  sample: ExposureSample,
): Telemetry {
  const peakPnl = Math.max(telemetry.peakPnl, sample.pnl)
  const maxDrawdown = Math.max(telemetry.maxDrawdown, peakPnl - sample.pnl)
  return {
    ...telemetry,
    peakPnl,
    maxDrawdown,
    exposure: [...telemetry.exposure, sample].slice(-EXPOSURE_LIMIT),
  }
}
