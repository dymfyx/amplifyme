export type Role = 'sales' | 'market-maker'

export type Side = 'BUY' | 'SELL'

/** 成交来源：客户流（我们报价/成交客户单） vs 自己在交易所主动吃单 */
export type Venue = 'client' | 'dealer' | 'exchange'

export interface Instrument {
  symbol: string
  name: string
  last: number
  changePct: number
  changeAbs: number
  /** 最近一个 tick 的价格变化，UI 用来做跳动闪烁 */
  lastMove?: number
}

export interface Position {
  symbol: string
  netQty: number
  avgPrice: number
  value: number
  unrealised: number
  realised: number
  netPnl: number
}

export interface OrderRow {
  id: string
  time: string
  symbol: string
  side: Side
  qty: number
  price: number
  status: 'WORKING' | 'FILLED' | 'CANCELLED'
  venue: Venue
}

export interface TradeRow {
  id: string
  time: string
  symbol: string
  side: Side
  qty: number
  price: number
  fee: number
  venue: Venue
}

export type NewsKind = 'macro' | 'note' | 'equity'

export interface NewsItem {
  id: string
  time: string
  tag: string
  kind: NewsKind
  impact: 1 | 2 | 3
  headline: string
  /** 中文标题；界面上按语言挑一版 */
  headlineZh?: string
  /** 价格带上的短标签 */
  short?: string
  shortZh?: string
  /** 点开详情才看到的背景描述 */
  detail?: string
  detailZh?: string
  /** 消息来源，例如 market colour / exchange notice */
  source?: string
  /** 利好 +1 / 利空 -1；中性提示为空。三档以上界面不展示这个方向 */
  direction?: 1 | -1
  /** 个股新闻的标的；宏观新闻为空 */
  symbol?: string
}

export interface Rfq {
  id: string
  time: string
  client: string
  side: Side
  symbol: string
  qty: number
  note: string
}

export interface BookLevel {
  price: number
  size: number
}

export interface Book {
  bids: BookLevel[]
  asks: BookLevel[]
}

export interface QuoteRow {
  id: string
  symbol: string
  bidVolume: number
  bid: number
  offer: number
  offerVolume: number
  validFor: number
  /**
   * PENDING  = 已发出，还在去交易所的路上（延迟 1–3 帧）
   * LIVE     = 已挂上，正在排队
   * PARTIAL  = 有效期到了，但成交过一部分
   * FILLED   = 全部成交（一次或多次部分成交累加）
   * EXPIRED  = 一股没成交就过期了
   */
  status: 'PENDING' | 'LIVE' | 'PARTIAL' | 'FILLED' | 'EXPIRED'
  /** 已成交数量（部分成交时小于报价数量） */
  filledQty: number
  /** 报价数量，等于 bidVolume / offerVolume 里我们这一侧的量 */
  qty: number
  /** 排队在我们前面的股数（0 表示已经排到队首，下一笔主动流就可能打到我们） */
  queueAhead: number
  /** 还要几帧才挂到市场上（PENDING 阶段显示用） */
  latencyTicks: number
}

export interface Pnl {
  realised: number
  unrealised: number
  netExposure: number
  commission: number
  total: number
}

export interface ScoreDimension {
  key: string
  label: string
  value: number
}

export interface ScoreCard {
  composite: number
  percentile: number
  dimensions: ScoreDimension[]
}
