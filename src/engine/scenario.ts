import type { NewsKind } from '../types'

/**
 * 引擎用到的静态素材：可选标的、新闻剧本、市场微观流动素材、系统派单素材。
 * 这里只放"配置"，不放状态，方便单测直接引用。
 */

export interface UniverseEntry {
  symbol: string
  name: string
  /** 初始价格（同时作为盘口基准） */
  last: number
  /** 初始相对昨收的涨跌幅，用来反推 prevClose，让首屏和设计稿一致 */
  changePct: number
  /** 波动率：只用来放大/缩小"同样的消息对不同名字的影响"，不再直接驱动随机噪声 */
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
  /** 磁带上显示的短标签（≤ 16 字符） */
  short: string
  /** 利好 +1 / 利空 -1；不填表示中性提示，只进新闻流、不动价格 */
  direction?: 1 | -1
  /** 影响的标的；不填表示整个市场 */
  symbol?: string
  /** 这条消息最终推动价格的总幅度（基点），按标的波动率放大后再释放 */
  driftBps?: number
}

/** 市场微观流动：每 0.5 秒的行情刷新都会抽一个来源，保证每次价格变动都有解释 */
export interface FlowEvent {
  id: string
  label: string
  /** 固定方向；0 表示随机（用来表示方向不明的指数/大宗流） */
  direction: 1 | -1 | 0
  /** 单次推动幅度（基点），会按标的波动率放大 */
  bps: number
  hint: string
  /** 出现概率权重 */
  weight: number
}

export const FLOW_EVENTS: FlowEvent[] = [
  { id: 'flow-buy', label: 'buy flow', direction: 1, bps: 3, hint: 'A broker is working a buy order in the name', weight: 20 },
  { id: 'flow-sell', label: 'sell flow', direction: -1, bps: 3, hint: 'Sell-side inventory is being worked', weight: 20 },
  { id: 'flow-etf', label: 'ETF bid', direction: 1, bps: 5, hint: 'Index rebalance flow is leaning bid', weight: 10 },
  { id: 'flow-etf-out', label: 'ETF offer', direction: -1, bps: 5, hint: 'Index rebalance flow is leaning offer', weight: 10 },
  { id: 'flow-cover', label: 'short cover', direction: 1, bps: 5, hint: 'Shorts are covering into the move', weight: 8 },
  { id: 'flow-unwind', label: 'long unwind', direction: -1, bps: 5, hint: 'A long is unwinding into the bid', weight: 8 },
  { id: 'flow-retail', label: 'retail bid', direction: 1, bps: 2, hint: 'Retail flow is leaning bid', weight: 12 },
  { id: 'flow-retail-out', label: 'retail sell', direction: -1, bps: 2, hint: 'Retail flow is leaning offer', weight: 12 },
  { id: 'flow-index', label: 'index flow', direction: 0, bps: 3, hint: 'Index futures are driving the tape', weight: 12 },
  { id: 'flow-block', label: 'block print', direction: 0, bps: 8, hint: 'A block just printed through the book', weight: 4 },
]

const MINUTE = 60
const HOUR = 60 * MINUTE
/** 15 个交易日 × 6.5 小时，与 simulation.ts 的 SESSION_SECONDS 保持一致 */
const SESSION = 15 * 6.5 * HOUR
/** 把 offset 写成占整局的比例，方便调密度 */
const at = (fraction: number) => fraction * SESSION

/**
 * 20 条剧本，均匀铺在 15 个交易日的压缩时间轴上（约 1.5 分钟真实时间一条）。
 * 每条消息都有明确的利好/利空方向与受影响标的：
 * - 个股消息只推那一只（按它的波动率放大），
 * - 宏观消息推全市场，但按 beta 缩放，所以同一句话对不同名字的影响不同。
 * 中性的监管/风控提示只进新闻流，不制造价格变动。
 */
export const NEWS_TEMPLATES: NewsTemplate[] = [
  {
    id: 'N1',
    offset: at(0.012),
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    headline: 'Fed cuts rates to 0% and relaunches quantitative easing',
    short: 'Fed cut',
    direction: 1,
    driftBps: 55,
  },
  {
    id: 'N2',
    offset: at(0.055),
    kind: 'equity',
    tag: 'TSCO',
    impact: 2,
    headline: 'Tesco wins UK grocery share as volumes accelerate',
    short: 'share gains',
    direction: 1,
    symbol: 'TSCO',
    driftBps: 45,
  },
  {
    id: 'N3',
    offset: at(0.1),
    kind: 'note',
    tag: 'NOTE',
    impact: 2,
    headline: 'Investment banks: make sure you manage market risk across the exchange',
    short: 'risk note',
  },
  {
    id: 'N4',
    offset: at(0.145),
    kind: 'equity',
    tag: 'TSLA',
    impact: 3,
    headline: 'Tesla CFO announces investment in self-driving AI with a fully self-driving beta',
    short: 'FSD investment',
    direction: 1,
    symbol: 'TSLA',
    driftBps: 80,
  },
  {
    id: 'N5',
    offset: at(0.175),
    kind: 'equity',
    tag: 'NFLX',
    impact: 3,
    headline: 'Netflix ad-tier signups top expectations across EMEA',
    short: 'ad-tier signups',
    direction: 1,
    symbol: 'NFLX',
    driftBps: 60,
  },
  {
    id: 'N6',
    offset: at(0.215),
    kind: 'equity',
    tag: 'DUOL',
    impact: 2,
    headline: 'Duolingo faces scrutiny in France over language certification standards',
    short: 'France review',
    direction: -1,
    symbol: 'DUOL',
    driftBps: 95,
  },
  {
    id: 'N7',
    offset: at(0.25),
    kind: 'macro',
    tag: 'MACRO',
    impact: 3,
    headline: 'US Central Bank to decide rates in 1 minute — a cut to 1% is expected',
    short: 'rate cut odds',
    direction: 1,
    driftBps: 35,
  },
  {
    id: 'N8',
    offset: at(0.295),
    kind: 'equity',
    tag: 'TSLA',
    impact: 2,
    headline: 'Tesla recalls 40k vehicles in Europe over a software fault',
    short: 'EU recall',
    direction: -1,
    symbol: 'TSLA',
    driftBps: 60,
  },
  {
    id: 'N9',
    offset: at(0.33),
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    headline: 'Investment banks: provide fast and competitive quotes for your clients',
    short: 'quote note',
  },
  {
    id: 'N10',
    offset: at(0.375),
    kind: 'equity',
    tag: 'AZN',
    impact: 2,
    headline: 'AstraZeneca trial misses its primary endpoint in late-stage study',
    short: 'trial miss',
    direction: -1,
    symbol: 'AZN',
    driftBps: 70,
  },
  {
    id: 'N11',
    offset: at(0.41),
    kind: 'macro',
    tag: 'MACRO',
    impact: 2,
    headline: 'Bond yields spike as the market digests the emergency rate cut',
    short: 'yields spike',
    direction: -1,
    driftBps: 45,
  },
  {
    id: 'N12',
    offset: at(0.46),
    kind: 'equity',
    tag: 'NFLX',
    impact: 2,
    headline: 'Netflix lifts content spend guidance, margin risk back in focus',
    short: 'content spend',
    direction: -1,
    symbol: 'NFLX',
    driftBps: 50,
  },
  {
    id: 'N13',
    offset: at(0.5),
    kind: 'note',
    tag: 'NOTE',
    impact: 1,
    headline: 'Risk: keep net exposure inside the desk limits, the session is being scored',
    short: 'risk limits',
  },
  {
    id: 'N14',
    offset: at(0.545),
    kind: 'equity',
    tag: 'DUOL',
    impact: 3,
    headline: 'Duolingo extends its French certification review, shares whipsaw on the headline',
    short: 'review extended',
    direction: 1,
    symbol: 'DUOL',
    driftBps: 110,
  },
  {
    id: 'N15',
    offset: at(0.58),
    kind: 'equity',
    tag: 'AZN',
    impact: 3,
    headline: 'AstraZeneca gets FDA fast-track for its oncology candidate',
    short: 'FDA fast-track',
    direction: 1,
    symbol: 'AZN',
    driftBps: 75,
  },
  {
    id: 'N16',
    offset: at(0.63),
    kind: 'equity',
    tag: 'TSCO',
    impact: 2,
    headline: 'Barclays downgrades Tesco to underweight on margin pressure',
    short: 'downgrade',
    direction: -1,
    symbol: 'TSCO',
    driftBps: 55,
  },
  {
    id: 'N17',
    offset: at(0.71),
    kind: 'equity',
    tag: 'TSLA',
    impact: 2,
    headline: 'Tesla deliveries beat consensus, guidance left unchanged',
    short: 'deliveries beat',
    direction: 1,
    symbol: 'TSLA',
    driftBps: 55,
  },
  {
    id: 'N18',
    offset: at(0.79),
    kind: 'equity',
    tag: 'DUOL',
    impact: 2,
    headline: 'Duolingo daily active users slow, engagement worries build',
    short: 'DAU slowdown',
    direction: -1,
    symbol: 'DUOL',
    driftBps: 65,
  },
  {
    id: 'N19',
    offset: at(0.88),
    kind: 'equity',
    tag: 'AZN',
    impact: 2,
    headline: 'AstraZeneca lifts full-year guidance on oncology sales',
    short: 'guidance lift',
    direction: 1,
    symbol: 'AZN',
    driftBps: 60,
  },
  {
    id: 'N20',
    offset: at(0.96),
    kind: 'equity',
    tag: 'NFLX',
    impact: 3,
    headline: 'Netflix raises prices across EMEA as subscriber growth beats estimates',
    short: 'pricing power',
    direction: 1,
    symbol: 'NFLX',
    driftBps: 85,
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
