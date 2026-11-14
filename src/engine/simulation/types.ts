import type { Book, NewsItem, OrderRow, QuoteRow, Rfq, Role, Side, TradeRow } from '../../types'
import type { DifficultyTier } from '../difficulty'
import type { AgentState } from '../agents'
import type { ClientProfile, ClientType, Scenario } from '../scenarios'
import type { Telemetry } from '../telemetry'
import type { SessionMinutes } from './constants'

export type SessionStatus = 'RUNNING' | 'PAUSED' | 'CLOSED'

/** 价格变动的解释来源：headline = 新闻冲量，flow = 市场微观流动，fill = 我们自己的成交冲击 */
export type DriverSource = 'headline' | 'flow' | 'fill' | 'agent'

/** 某一次价格刷新里起作用的一个驱动因素 */
export interface PriceDriver {
  /** 短标签，磁带上显示，如 'Fed cut' / 'buy-side flow' */
  label: string
  direction: 1 | -1
  /** 这次释放的基点 */
  bps: number
  source: DriverSource
  /** 悬停时展示的完整说明（新闻标题或流动描述） */
  hint: string
}

/** 尚未释放完的新闻冲击：每帧释放剩余幅度的一部分，逐帧衰减 */
export interface PriceImpulse {
  id: string
  label: string
  direction: 1 | -1
  /** 剩余未释放的基点 */
  bps: number
  ttl: number
  hint: string
  /** 这条冲量来自新闻还是我们自己的成交 */
  source: DriverSource
}

/** 一次价格刷新的完整记录，喂给 PRICE TAPE 面板 */
export interface PriceChangeRecord {
  id: string
  tick: number
  time: string
  symbol: string
  price: number
  /** 相对上一次刷新的涨跌幅（%） */
  pct: number
  /** 本次净推动（基点），正=利好 */
  bps: number
  direction: 1 | -1
  drivers: PriceDriver[]
}

export interface InstrumentState {
  symbol: string
  name: string
  prevClose: number
  /** 开盘价（建局时的 last），基准策略从这里起算 */
  openPrice: number
  last: number
  lastMove: number
  sigma: number
  spreadBps: number
  lot: number
  /** 盘口每档的目标股数（已乘上剧本的流动性倍数），5000 上下 */
  bookSize: number
  series: number[]
  book: Book
  /** 上次建簿时的中间价，用来判断盘口要不要跟着重挂 */
  bookMid: number
  /** 还在释放中的新闻冲击 */
  impulses: PriceImpulse[]
  /** 最近一次价格变动的解释（市场表 DRIVER 列用） */
  driver: PriceDriver | null
}

export interface EnginePosition {
  symbol: string
  netQty: number
  avgPrice: number
  realised: number
}

/** 开局自选的初始仓位：数量可正可负（负数=空头），按均价入账、P&L 从 0 起算 */
export interface OpeningPosition {
  symbol: string
  netQty: number
  avgPrice: number
}

export interface DispatchState extends Rfq {
  createdAt: number
}

export interface LiveQuote extends QuoteRow {
  symbol: string
  client: string
  qty: number
  clientSide: Side
  ttlTicks: number
  /** 报价还在路上：还要等这么多帧才挂到交易所 */
  latencyTicks: number
  /** 报价宽度相对市场价差的倍数（<1 比市场更紧，>1 更宽） */
  spreadRatio: number
  /** 客户接受这张报价的概率，由 spreadRatio 决定 */
  fillProbability: number
  /** 背后客户的类型：informed 客户跟着头条来做方向，成交时你大概率被逆向选择 */
  clientType: ClientType
  /** 客户对报价宽度的容忍度（乘在成交概率上） */
  tolerance: number
  /** 从发出到排到队首用了多少帧 */
  queueTicks: number
  /** 报价发出的 tick，用来判断「陈旧报价」会不会被知情客户打 */
  createdTick: number
  rfqId?: string
}

export interface ChartEvent {
  tick: number
  label: string
  symbol?: string
}

export interface PendingNews extends NewsItem {
  at: number
  /** 短标签，作为价格驱动显示（英文版，中文经 t() 映射） */
  short: string
  shortZh?: string
  direction?: 1 | -1
  /** 这条消息最终要推动的总基点（按标的波动率放大后释放） */
  driftBps?: number
  symbol?: string
}

export interface SimulationState {
  rng: number
  /** 这一局的随机种子；重启会换一个新的，同一局内可复现 */
  seed: number
  tick: number
  lastPriceTick: number
  startedAt: number
  simSeconds: number
  status: SessionStatus
  speed: number
  instruments: InstrumentState[]
  positions: EnginePosition[]
  orders: OrderRow[]
  trades: TradeRow[]
  quotes: LiveQuote[]
  dispatch: DispatchState[]
  news: NewsItem[]
  pendingNews: PendingNews[]
  chartEvents: ChartEvent[]
  /** 每次价格刷新的解释记录，最新在末尾（PRICE TAPE 面板的数据源） */
  priceTape: PriceChangeRecord[]
  commission: number
  /** 本局选择的练习时长档位（5 / 15 / 30 分钟） */
  minutes: SessionMinutes
  /** 每个 tick 推进的模拟秒数，由档位决定 */
  simSecondsPerTick: number
  /** 可用资金（买入扣钱、卖出加钱），不能为负 */
  cash: number
  nextDispatchAt: number
  counters: {
    rfq: number
    quote: number
    order: number
    trade: number
    dealerQuote: number
    resting: number
  }
  /** 决策遥测：报价/成交/回撤/新闻响应，评分与结算报告的数据源 */
  telemetry: Telemetry
  /** 这一局的剧本（场景库或自定义 JSON） */
  scenario: Scenario
  /** 客户队伍与「服务态度」记忆：报价太宽/拒单会记住，久不成交会衰减 */
  clients: ClientProfile[]
  clientHeat: Record<string, number>
  /** 最近头条留下的方向性热度（带宽符号的基点，逐帧衰减），派单用它判断 informed 客户做哪个方向 */
  newsBias: Record<string, number>
  /** 每帧的价格快照，回放用 */
  history: PriceFrame[]
  /** 10 个流式智能体：它们主动买卖、推动价格，也可能成为我们报价的对手方 */
  agents: AgentState[]
  /** 这一局扮演的台面：决定交易所成交价（MM 更紧 / Sales 更宽）以及可用工具 */
  role: Role
  /** Sales 向 dealer 发出的问价与收到的回价（P2.13） */
  dealerQuotes: DealerQuote[]
  /** 交易所限价挂单（P2.17）：挂在价格上等成交 */
  restingOrders: RestingOrder[]
  /** 这一局选择的难度档位（P2.14），参数见 difficulty.ts 的预设表 */
  tier: DifficultyTier
  /** 本局每边佣金（由难度档位决定，基准 5bps） */
  commissionRate: number
  /** 本局已拒单数：超过档位配额后客户热度涨得更快 */
  declines: number
  /** S4 黑天鹅：流动性被抽干的截止 tick（0 = 未触发/已结束） */
  drainUntilTick: number
}

/** Sales 向 dealer 要价：一条回价记录 */
export interface DealerQuote {
  id: string
  /** 同一次 RFQ 发出的几家回价共用一个 requestId */
  requestId: string
  dealerId: string
  dealerName: string
  symbol: string
  /** 我们要做的方向：BUY = 我们想买（打 dealer 的 offer），SELL = 想卖（砸 dealer 的 bid） */
  side: Side
  qty: number
  bid: number
  offer: number
  /** dealer 愿意承接的数量（可能小于 request） */
  size: number
  /** 回价最早可成交的 tick（模拟电话/系统延迟） */
  readyAt: number
  /** 回价过期 tick */
  expiresAt: number
}

/**
 * 交易所限价挂单：挂在价格上等别人来成交，而不是主动吃盘口。
 * 价格穿过挂单价之后按每帧的市场成交量逐笔成交，可以部分成交、可以撤单。
 */
export interface RestingOrder {
  id: string
  /** 对应的 ORDER 行 id，面板里显示 WORKING / FILLED / CANCELLED */
  orderId: string
  symbol: string
  side: Side
  qty: number
  remaining: number
  limit: number
  tick: number
  status: 'WORKING' | 'FILLED' | 'CANCELLED'
}

/** 回放用的一帧：时间和五个名字的最新价 */
export interface PriceFrame {
  tick: number
  time: string
  prices: Record<string, number>
}

export interface SessionMeta {
  clock: string
  dayIndex: number
  totalDays: number
  status: SessionStatus
  speed: number
  latencyMs: number
  seed: number
  /** 练习时长档位 */
  minutes: SessionMinutes
  /** 剩余真实时间（毫秒），顶栏倒计时用 */
  timeLeftMs: number
}

export interface SessionOptions {
  /** 5 / 15 / 30 分钟档位，默认 30 */
  minutes?: SessionMinutes
  /** 这一局的剧本，默认 classic（就是原来的 20 条新闻） */
  scenario?: Scenario
  /** 台面角色：决定交易所成交价（MM 更紧 / Sales 更宽）和可用工具，默认 market-maker */
  role?: Role
  /** 难度档位（P2.14）：不传则用该角色的 2 档（基准手感） */
  tier?: DifficultyTier
}

export interface VenuePricePreview {
  mid: number
  buy: number
  sell: number
  /** 买卖价之间的差距（绝对价格） */
  gapPoints: number
  gapBps: number
  volatility: number
}

/* ------------------------------------------------------------------ */
/* 玩家动作                                                            */
/* ------------------------------------------------------------------ */
export interface ActionResult {
  state: SimulationState
  message: string
}

export interface QuoteInput {
  symbol: string
  bid: number
  offer: number
  bidVolume: number
  offerVolume: number
  validFor: number
  rfqId?: string
}

export interface FillInput {
  symbol: string
  clientSide: Side
  client: string
  qty: number
  price: number
  rfqId?: string
}

export interface ExchangeTradeInput {
  symbol: string
  /** 我们的方向：BUY = 主动打卖盘（lift the offer），SELL = 主动砸买盘 */
  side: Side
  qty: number
}

/* ------------------------------------------------------------------ */
/* 交易所限价挂单：挂在价格上等市场来成交（P2.17）                    */
/* ------------------------------------------------------------------ */
export interface LimitOrderInput {
  symbol: string
  side: Side
  qty: number
  limit: number
}

/* ------------------------------------------------------------------ */
/* Sales 问价：向 dealer 要双边价，挑一家打或者放着等过期            */
/* ------------------------------------------------------------------ */
export interface DealerDefinition {
  id: string
  name: string
  /** 报价宽度系数：越大越宽（越不划算） */
  width: number
  /** 回价延迟（tick）：电话打过去要等 */
  latency: number
}

export interface DealerRequestInput {
  symbol: string
  /** 我们想做方向：BUY = 想买，SELL = 想卖 */
  side: Side
  qty: number
}

export interface DealerHitInput {
  quoteId: string
  /** 我们要做的方向：BUY 打 dealer 的 offer，SELL 砸 dealer 的 bid */
  side: Side
  /** 打多少，默认 dealer 能承接的全部 */
  qty?: number
}
