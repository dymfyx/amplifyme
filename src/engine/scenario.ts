import type { NewsKind } from '../types'

/**
 * 引擎用到的静态素材：可选标的、新闻剧本、系统派单素材。
 * 这里只放"配置"，不放状态，方便单测直接引用。
 */

export interface UniverseEntry {
  symbol: string
  name: string
  /** 初始价格（同时作为盘口基准） */
  last: number
  /** 初始相对昨收的涨跌幅，用来反推 prevClose，让首屏和设计稿一致 */
  changePct: number
  /** 每个 tick 的波动率 */
  sigma: number
  /** 半个点差的基点（万分之一） */
  spreadBps: number
  /** 每档深度基准手数 */
  lot: number
}

export const UNIVERSE: UniverseEntry[] = [
  { symbol: 'TSCO', name: 'Tesco plc', last: 317.91, changePct: 1.83, sigma: 0.0014, spreadBps: 4, lot: 200 },
  { symbol: 'NFLX', name: 'Netflix', last: 537.53, changePct: 9.14, sigma: 0.0024, spreadBps: 6, lot: 50 },
  { symbol: 'TSLA', name: 'Tesla', last: 197.12, changePct: 0.37, sigma: 0.0028, spreadBps: 5, lot: 100 },
  { symbol: 'AZN', name: 'AstraZeneca', last: 802.99, changePct: -10.51, sigma: 0.0018, spreadBps: 6, lot: 100 },
  { symbol: 'DUOL', name: 'Duolingo', last: 281.37, changePct: 14.12, sigma: 0.0036, spreadBps: 10, lot: 50 },
]

export interface NewsTemplate {
  id: string
  /** 相对开盘的模拟秒数 */
  offset: number
  kind: NewsKind
  tag: string
  impact: 1 | 2 | 3
  headline: string
  /** 影响的标的；不填表示整个市场 */
  symbol?: string
  /** 事件冲击（比例）与方向 */
  shock?: number
}

const MINUTE = 60
const HOUR = 60 * MINUTE
/** 15 个交易日 × 6.5 小时，与 simulation.ts 的 SESSION_SECONDS 保持一致 */
const SESSION = 15 * 6.5 * HOUR

/**
 * 12 条剧本，均匀铺在 15 个交易日的压缩时间轴上。
 * 一条新闻大约隔 2–3 分钟真实时间（约 1 至 1.5 个模拟交易日），
 * 早期把 offset 挤在开盘后几十分钟会让右栏一秒弹三条，读都读不完。
 */
export const NEWS_TEMPLATES: NewsTemplate[] = [
  {
    id: 'N1',
    offset: 0.012 * SESSION,
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    headline: 'Fed cuts rates to 0% and relaunches quantitative easing',
    shock: 0.012,
  },
  {
    id: 'N2',
    offset: 0.1 * SESSION,
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    headline: 'Investment banks: make sure you manage market risk across the exchange',
  },
  {
    id: 'N3',
    offset: 0.175 * SESSION,
    kind: 'equity',
    tag: 'TSLA',
    impact: 3,
    headline: 'Tesla CFO announces investment in self-driving AI with a fully self-driving beta',
    symbol: 'TSLA',
    shock: 0.016,
  },
  {
    id: 'N4',
    offset: 0.25 * SESSION,
    kind: 'equity',
    tag: 'DUOL',
    impact: 2,
    headline: 'Duolingo faces scrutiny in France over language certification standards',
    symbol: 'DUOL',
    shock: -0.021,
  },
  {
    id: 'N5',
    offset: 0.33 * SESSION,
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    headline: 'US Central Bank to decide rates in 1 minute — a cut to 1% is expected',
    shock: -0.006,
  },
  {
    id: 'N6',
    offset: 0.41 * SESSION,
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    headline: 'Investment banks: provide fast and competitive quotes for your clients',
  },
  {
    id: 'N7',
    offset: 0.5 * SESSION,
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    headline: 'Risk: keep net exposure inside the desk limits, the session is being scored',
  },
  {
    id: 'N8',
    offset: 0.58 * SESSION,
    kind: 'equity',
    tag: 'DUOL',
    impact: 3,
    headline: 'Duolingo extends its French certification review, shares whipsaw on the headline',
    symbol: 'DUOL',
    shock: 0.028,
  },
  {
    id: 'N9',
    offset: 0.67 * SESSION,
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    headline: 'Bond yields spike as the market digests the emergency rate cut',
    shock: -0.009,
  },
  {
    id: 'N10',
    offset: 0.75 * SESSION,
    kind: 'equity',
    tag: 'TSLA',
    impact: 2,
    headline: 'Tesla deliveries beat consensus, guidance left unchanged',
    symbol: 'TSLA',
    shock: 0.011,
  },
  {
    id: 'N11',
    offset: 0.84 * SESSION,
    kind: 'equity',
    tag: 'AZN',
    impact: 2,
    headline: 'AstraZeneca lifts full-year guidance on oncology sales',
    symbol: 'AZN',
    shock: 0.014,
  },
  {
    id: 'N12',
    offset: 0.92 * SESSION,
    kind: 'equity',
    tag: 'NFLX',
    impact: 3,
    headline: 'Netflix raises prices across EMEA as subscriber growth beats estimates',
    symbol: 'NFLX',
    shock: 0.019,
  },
]

export const CLIENTS = ['AM-39', 'AM-21', 'AM-18', 'AM-11', 'AM-29', 'AM-07'] as const

export const DISPATCH_NOTES = [
  'Firm quote requested, client is on the line',
  'Client wants a two-way market',
  'Large size, watch your inventory',
  'Client is working an index rebalance',
  'Urgent — client needs a price in 30 seconds',
  'Spread-sensitive account, quote tight',
] as const

export const SYMBOLS = UNIVERSE.map((entry) => entry.symbol)
