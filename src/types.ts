export type Role = 'sales' | 'market-maker'

export type Side = 'BUY' | 'SELL'

/** 成交来源：客户流（我们报价/成交客户单） vs 自己在交易所主动吃单 */
export type Venue = 'client' | 'exchange'

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
  /** 利好 +1 / 利空 -1；中性提示为空 */
  direction?: 1 | -1
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
  status: 'LIVE' | 'FILLED' | 'EXPIRED'
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
