import type {
  Book,
  BookLevel,
  Instrument,
  NewsItem,
  OrderRow,
  Pnl,
  Position,
  QuoteRow,
  Rfq,
  Side,
  TradeRow,
} from '../types'
import { nextRandom, normalish, pickOne, randomInt, createSeed } from './rng'
import { CLIENTS, DISPATCH_NOTES, FLOW_EVENTS, NEWS_TEMPLATES, SYMBOLS, UNIVERSE } from './scenario'
import {
  createTelemetry,
  recordDecline,
  recordFill,
  recordNews,
  recordQuote,
  recordRfq,
  sampleExposure,
  type Telemetry,
} from './telemetry'

/**
 * 可推进的模拟市场引擎。
 *
 * 设计约束：
 * - 纯函数：`stepSession` 只依赖传入的 state，同样的 state 一定得到同样的结果（随机数种子存在 state 里）。
 * - 30 分钟 = 15 个交易日，所以 1 个 tick（250ms 真实时间）推进 48.75 个模拟秒。
 * - 报价/派单/成交都在引擎里结算，UI 只负责渲染和派发动作。
 */

export const TICK_MS = 250
export const SPEEDS = [1, 2, 4] as const
export const DAY_SECONDS = 6.5 * 3600
export const SESSION_DAYS = 15
export const SESSION_SECONDS = DAY_SECONDS * SESSION_DAYS
export const START_SECONDS = 9 * 3600 + 30 * 60
export const SIM_SECONDS_PER_TICK = SESSION_SECONDS / ((30 * 60 * 1000) / TICK_MS)
/**
 * 行情节奏：时钟每帧都走，价格与盘口每帧（0.25 秒真实时间）刷新一次，所以盘口是连续变的。
 * 每一帧的净变动都由「一笔微观流动 + 尚未释放完的新闻冲击」组成，没有无来源的随机噪声。
 */
export const PRICE_UPDATE_TICKS = 1
/** 新闻冲击每帧释放剩余幅度的 25%，几帧内释放完但会留下明显方向 */
const DRIFT_RELEASE = 0.25
/** 每条新闻冲击最多存活多少帧行情（超过就清掉，避免长尾一直拖） */
const DRIFT_TTL = 24
/** 每帧最多保留几个驱动因素写进价格记录 */
const MAX_PRICE_DRIVERS = 3
/** 价格记录（供 PRICE TAPE 面板）保留多少条 */
const PRICE_TAPE_LIMIT = 180
/** 只有当价格相对上次建簿的位置移动超过这个基点，才重建盘口 */
export const BOOK_MIN_MOVE_BPS = 8
/** 单条新闻冲击大于这个基点时强制重挂盘口（大消息必须立刻体现在报价上） */
const FORCED_REBOOK_BPS = 12
/** 每次行情刷新有多大概率出现一笔微观流动：几乎每帧都有，但绝大多数是小单，偶尔才有一笔扫单 */
const FLOW_CHANCE = 0.92
/** 佣金按成交额的 5 个基点/边计（真实股票佣金量级），不会吃掉正常点差利润 */
export const COMMISSION_RATE = 0.0005
/** 销售/做市台的总持有资金上限 */
export const STARTING_CASH = 20_000_000
/** 1 根 = 一次行情刷新（0.25 秒真实时间 ≈ 48.75 模拟秒），1 个交易日正好 480 根 */
export const CHART_POINTS = 480
const HISTORY_POINTS = 480
const MAX_DISPATCH = 3
const MAX_QUOTES = 14
const DISPATCH_INTERVAL = 6000
const DISPATCH_TTL = 9000

const round2 = (value: number) => Math.round(value * 100) / 100
const pad = (value: number) => String(Math.floor(value)).padStart(2, '0')

export type SessionStatus = 'RUNNING' | 'PAUSED' | 'CLOSED'

/** 价格变动的解释来源：headline = 新闻冲量，flow = 市场微观流动 */
export type DriverSource = 'headline' | 'flow'

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
  last: number
  lastMove: number
  sigma: number
  spreadBps: number
  lot: number
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
  fillInTicks: number
  rfqId?: string
}

export interface ChartEvent {
  tick: number
  label: string
  symbol?: string
}

export interface PendingNews extends NewsItem {
  at: number
  /** 短标签，作为价格驱动显示 */
  short: string
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
  /** 可用资金（买入扣钱、卖出加钱），不能为负 */
  cash: number
  nextDispatchAt: number
  counters: { rfq: number; quote: number; order: number; trade: number }
  /** 决策遥测：报价/成交/回撤/新闻响应，评分与结算报告的数据源 */
  telemetry: Telemetry
}

export interface SessionMeta {
  clock: string
  dayIndex: number
  totalDays: number
  status: SessionStatus
  speed: number
  latencyMs: number
  seed: number
}

/* ------------------------------------------------------------------ */
/* 时间                                                                */
/* ------------------------------------------------------------------ */

export function formatClock(simSeconds: number): string {
  const elapsed = ((simSeconds - START_SECONDS) % DAY_SECONDS + DAY_SECONDS) % DAY_SECONDS
  const total = START_SECONDS + elapsed
  return `${pad(total / 3600)}:${pad((total % 3600) / 60)}:${pad(total % 60)}`
}

export function formatShortTime(simSeconds: number): string {
  return formatClock(simSeconds).slice(0, 5)
}

export function dayIndexAt(simSeconds: number): number {
  const elapsed = Math.max(0, simSeconds - START_SECONDS)
  return Math.min(SESSION_DAYS, Math.floor(elapsed / DAY_SECONDS) + 1)
}

/* ------------------------------------------------------------------ */
/* 盘口                                                                */
/* ------------------------------------------------------------------ */

function makeBook(
  rng: number,
  last: number,
  spreadBps: number,
  lot: number,
  previous?: Book,
): [Book, number] {
  let state = rng
  const halfSpread = Math.max(0.01, round2((last * spreadBps) / 10000))
  const step = Math.max(0.01, round2(halfSpread / 2))
  const bids: BookLevel[] = []
  const asks: BookLevel[] = []
  for (let level = 0; level < 5; level += 1) {
    const [bidRoll, afterBid] = nextRandom(state)
    state = afterBid
    const [askRoll, afterAsk] = nextRandom(state)
    state = afterAsk
    const depth = level * 0.35
    /* 有上一次的簿就沿用它的挂单量、只做 ±30% 的微调，让盘口看起来是在原地排队而不是整屏重刷 */
    const bidBase = previous ? previous.bids[level].size : lot * (2 + bidRoll * 8)
    const askBase = previous ? previous.asks[level].size : lot * (2 + askRoll * 8)
    const bidSize = Math.round((bidBase * (0.7 + bidRoll * 0.6) * (previous ? 1 : 1 + depth)) / lot) * lot
    const askSize = Math.round((askBase * (0.7 + askRoll * 0.6) * (previous ? 1 : 1 + depth)) / lot) * lot
    bids.push({
      price: round2(last - halfSpread - level * step),
      size: Math.max(lot, bidSize),
    })
    asks.push({
      price: round2(last + halfSpread + level * step),
      size: Math.max(lot, askSize),
    })
  }
  return [{ bids, asks }, state]
}

/* ------------------------------------------------------------------ */
/* 初始化                                                              */
/* ------------------------------------------------------------------ */

function initialDispatch(): DispatchState {
  return {
    id: 'RFQ-201',
    time: formatShortTime(START_SECONDS),
    client: 'AM-18',
    side: 'SELL',
    symbol: 'AZN',
    qty: 2000,
    note: 'Large size, watch your inventory',
    createdAt: START_SECONDS,
  }
}

/** 每一局换一个新的种子，保证同一局内可复现、不同局走势不同 */
function randomSeed(): number {
  return 100000 + Math.floor(Math.random() * 900000)
}

/** 过滤掉非法/为零的行，只保留本局真实可交易的名字 */
function normaliseOpeningBook(book: OpeningPosition[]): EnginePosition[] {
  return book
    .filter(
      (entry) =>
        UNIVERSE.some((instrument) => instrument.symbol === entry.symbol) &&
        Number.isFinite(entry.netQty) &&
        Number.isFinite(entry.avgPrice) &&
        Math.trunc(entry.netQty) !== 0 &&
        entry.avgPrice > 0,
    )
    .map((entry) => ({
      symbol: entry.symbol,
      netQty: Math.trunc(entry.netQty),
      avgPrice: round2(entry.avgPrice),
      realised: 0,
    }))
}

export function createSession(seed = randomSeed(), openingBook: OpeningPosition[] = []): SimulationState {
  let rng = createSeed(seed)
  const instruments = UNIVERSE.map((entry) => {
    const prevClose = round2(entry.last / (1 + entry.changePct / 100))
    const raw: number[] = []
    let value = entry.last * (1 - entry.sigma * 10)
    for (let i = 0; i < HISTORY_POINTS; i += 1) {
      const [shock, next] = normalish(rng)
      rng = next
      value = Math.max(0.01, value * (1 + shock * entry.sigma))
      raw.push(value)
    }
    const scale = entry.last / raw[raw.length - 1]
    const series = raw.map((point) => round2(point * scale))
    const [book, afterBook] = makeBook(rng, entry.last, entry.spreadBps, entry.lot)
    rng = afterBook
    return {
      symbol: entry.symbol,
      name: entry.name,
      prevClose,
      last: entry.last,
      lastMove: 0,
      sigma: entry.sigma,
      spreadBps: entry.spreadBps,
      lot: entry.lot,
      series,
      book,
      bookMid: entry.last,
      impulses: [],
      driver: null,
    }
  })

  return {
    rng,
    seed,
    tick: 0,
    lastPriceTick: 0,
    startedAt: START_SECONDS,
    simSeconds: START_SECONDS,
    status: 'RUNNING',
    speed: 1,
    instruments,
    // 新的一局：持仓只来自开局自选的初始仓位，成交、委托、佣金、已实现盈亏都归零
    positions: normaliseOpeningBook(openingBook),
    orders: [],
    trades: [],
    quotes: [],
    dispatch: [initialDispatch()],
    news: [],
    pendingNews: NEWS_TEMPLATES.map((template) => ({
      id: template.id,
      time: formatShortTime(START_SECONDS + template.offset),
      tag: template.tag,
      kind: template.kind,
      impact: template.impact,
      headline: template.headline,
      direction: template.direction,
      at: START_SECONDS + template.offset,
      short: template.short,
      driftBps: template.driftBps,
      symbol: template.symbol,
    })),
    chartEvents: [],
    priceTape: [],
    commission: 0,
    cash: STARTING_CASH,
    nextDispatchAt: START_SECONDS + 900,
    counters: { rfq: 201, quote: 118, order: 1043, trade: 8841 },
    telemetry: recordRfq(createTelemetry()),
  }
}

/** 按最新价格把持仓 mark-to-market：敞口、净额和总 P&L（已实现 + 未实现 − 佣金） */
function markToMarket(positions: EnginePosition[], instruments: InstrumentState[], commission: number) {
  let realised = 0
  let unrealised = 0
  let gross = 0
  let net = 0
  for (const position of positions) {
    const instrument = instruments.find((item) => item.symbol === position.symbol)
    const last = instrument?.last ?? position.avgPrice
    realised += position.realised
    unrealised += position.netQty * (last - position.avgPrice)
    const value = position.netQty * last
    gross += Math.abs(value)
    net += value
  }
  return {
    gross: round2(gross),
    net: round2(net),
    pnl: round2(realised + unrealised - commission),
  }
}

/** 盘口中间价，用来衡量成交是否占到了点差 */
function bookMid(book: Book): number {
  const bid = book.bids[0]?.price ?? 0
  const ask = book.asks[0]?.price ?? bid
  return round2((bid + ask) / 2)
}

function bookOf(instruments: InstrumentState[], symbol: string): Book {
  return instruments.find((item) => item.symbol === symbol)?.book ?? { bids: [], asks: [] }
}

/** 波动率缩放：同一句话对不同名字的影响不同（高波动名字反应更大） */
const volScale = (sigma: number) => Math.min(1.8, Math.max(0.7, sigma / 0.0018))

/** 按权重抽一个微观流动来源（每次行情刷新都会抽一个，保证价格变动有解释） */
function pickFlowEvent(roll: number) {
  const total = FLOW_EVENTS.reduce((sum, event) => sum + event.weight, 0)
  let target = roll * total
  for (const event of FLOW_EVENTS) {
    target -= event.weight
    if (target <= 0) return event
  }
  return FLOW_EVENTS[FLOW_EVENTS.length - 1]
}

/* ------------------------------------------------------------------ */
/* 推进                                                                */
/* ------------------------------------------------------------------ */

export function stepSession(state: SimulationState): SimulationState {
  if (state.status !== 'RUNNING') return state

  const tick = state.tick + 1
  const simSeconds = state.simSeconds + SIM_SECONDS_PER_TICK
  let rng = state.rng
  let telemetry = state.telemetry

  /* 1. 到达的新闻与冲击 */
  const due = state.pendingNews.filter((item) => item.at <= simSeconds)
  const pendingNews = state.pendingNews.filter((item) => item.at > simSeconds)
  const revealed: NewsItem[] = due.map((item) => ({
    id: item.id,
    time: item.time,
    tag: item.tag,
    kind: item.kind,
    impact: item.impact,
    headline: item.headline,
    direction: item.direction,
  }))
  const news = revealed.length === 0 ? state.news : [...state.news, ...revealed]
  for (const item of revealed) {
    telemetry = recordNews(telemetry, item.id, tick)
  }
  const revealedEvents: ChartEvent[] = due.map((item) =>
    item.symbol ? { tick, label: item.symbol, symbol: item.symbol } : { tick, label: 'MACRO' },
  )
  const chartEvents =
    revealedEvents.length === 0 ? state.chartEvents : [...state.chartEvents, ...revealedEvents].slice(-40)

  /* 1b. 把到点的新闻转成对标的的价格冲量：利好推高、利空压低，按标的波动率放大后逐帧释放 */
  const impulsesBySymbol = new Map<string, PriceImpulse[]>()
  for (const item of due) {
    if (!item.direction || !item.driftBps) continue
    const targets = item.symbol ? [item.symbol] : SYMBOLS
    for (const symbol of targets) {
      const instrument = state.instruments.find((candidate) => candidate.symbol === symbol)
      if (!instrument) continue
      const impulse: PriceImpulse = {
        id: `${item.id}-${symbol}`,
        label: item.short,
        direction: item.direction,
        bps: round2(item.driftBps * volScale(instrument.sigma)),
        ttl: DRIFT_TTL,
        hint: item.headline,
      }
      impulsesBySymbol.set(symbol, [...(impulsesBySymbol.get(symbol) ?? []), impulse])
    }
  }

  /* 2. 价格与盘口：时钟每帧都走，行情每 PRICE_UPDATE_TICKS 帧（0.25 秒）刷新一次 */
  const priceDue = tick - state.lastPriceTick >= PRICE_UPDATE_TICKS
  let priceTape = state.priceTape
  const instruments = priceDue
    ? state.instruments.map((instrument) => {
        const scale = volScale(instrument.sigma)

        /* 先释放还没走完的新闻冲量 + 本帧刚到点的新闻冲量 */
        const released: PriceDriver[] = []
        const impulses: PriceImpulse[] = []
        for (const impulse of [...instrument.impulses, ...(impulsesBySymbol.get(instrument.symbol) ?? [])]) {
          const bps = round2(impulse.bps * DRIFT_RELEASE)
          if (bps >= 0.05) {
            released.push({
              label: impulse.label,
              direction: impulse.direction,
              bps,
              source: 'headline',
              hint: impulse.hint,
            })
          }
          const remaining = round2(impulse.bps * (1 - DRIFT_RELEASE))
          const ttl = impulse.ttl - 1
          if (ttl > 0 && remaining >= 0.5) impulses.push({ ...impulse, bps: remaining, ttl })
        }

        /* 本帧的微观流动来源：绝大多数帧都有成交（多为小单、偶尔扫单），只要有价格变动就一定有来源 */
        const [chanceRoll, afterChance] = nextRandom(rng)
        rng = afterChance
        let flowDriver: PriceDriver | null = null
        if (chanceRoll < FLOW_CHANCE) {
          const [flowRoll, afterFlow] = nextRandom(rng)
          rng = afterFlow
          const [sizeRoll, afterSize] = nextRandom(rng)
          rng = afterSize
          const [dirRoll, afterDir] = nextRandom(rng)
          rng = afterDir
          const event = pickFlowEvent(flowRoll)
          const flowDirection = (event.direction === 0 ? (dirRoll < 0.5 ? -1 : 1) : event.direction) as 1 | -1
          flowDriver = {
            label: event.label,
            direction: flowDirection,
            bps: round2(event.bps * (0.6 + sizeRoll * 1.0 + 2.4 * Math.pow(sizeRoll, 8)) * scale),
            source: 'flow',
            hint: event.hint,
          }
        }

        const netBps = round2(
          released.reduce((sum, driver) => sum + driver.direction * driver.bps, 0) +
            (flowDriver ? flowDriver.direction * flowDriver.bps : 0),
        )
        const last = round2(Math.max(0.01, instrument.last * (1 + netBps / 10000)))
        const direction: 1 | -1 = netBps >= 0 ? 1 : -1
        const drivers = [...released, ...(flowDriver ? [flowDriver] : [])]
          .sort((a, b) => b.bps - a.bps)
          .slice(0, MAX_PRICE_DRIVERS)
        /* 用「和实际涨跌方向一致的最大驱动」解释这次变动，箭头就不会和标签打架 */
        const driver = drivers.find((candidate) => candidate.direction === direction) ?? drivers[0] ?? null

        if (last !== instrument.last) {
          priceTape = [
            ...priceTape,
            {
              id: `PX-${tick}-${instrument.symbol}`,
              tick,
              time: formatShortTime(simSeconds),
              symbol: instrument.symbol,
              price: last,
              pct: round2(((last - instrument.last) / instrument.last) * 100),
              bps: netBps,
              direction,
              drivers,
            },
          ].slice(-PRICE_TAPE_LIMIT)
        }

        /* 盘口只在价格相对上次挂单的位置明显移动、或刚吃到一条大新闻时才重挂 */
        const movedBps = (Math.abs(last - instrument.bookMid) / instrument.bookMid) * 10000
        const headlineBps = released.reduce((sum, candidate) => sum + candidate.bps, 0)
        let book = instrument.book
        let bookMid = instrument.bookMid
        if (headlineBps >= FORCED_REBOOK_BPS || movedBps >= BOOK_MIN_MOVE_BPS) {
          const [nextBook, afterBook] = makeBook(rng, last, instrument.spreadBps, instrument.lot, instrument.book)
          rng = afterBook
          book = nextBook
          bookMid = last
        }

        return {
          ...instrument,
          last,
          lastMove: round2(last - instrument.last),
          series: [...instrument.series.slice(-(CHART_POINTS - 1)), last],
          book,
          bookMid,
          impulses,
          driver,
        }
      })
    : state.instruments.map((instrument) =>
        instrument.lastMove === 0 ? instrument : { ...instrument, lastMove: 0 },
      )
  /* 3. 报价存活、成交与过期 */
  let positions = state.positions
  let trades = state.trades
  let orders = state.orders
  let commission = state.commission
  let cash = state.cash
  let counters = state.counters
  let dispatch = state.dispatch
  const quotes: LiveQuote[] = []

  for (const quote of state.quotes) {
    if (quote.status !== 'LIVE') {
      quotes.push(quote)
      continue
    }
    const ttlTicks = quote.ttlTicks - 1
    const fillInTicks = quote.fillInTicks - 1

    if (ttlTicks <= 0) {
      quotes.push({ ...quote, status: 'EXPIRED', ttlTicks: 0, fillInTicks: 0 })
      continue
    }

    if (fillInTicks > 0) {
      quotes.push({ ...quote, ttlTicks, fillInTicks })
      continue
    }

    const [roll, afterRoll] = nextRandom(rng)
    rng = afterRoll
    if (roll >= 0.82) {
      quotes.push({ ...quote, status: 'EXPIRED', ttlTicks, fillInTicks: 0 })
      continue
    }

    const ourSide: Side = quote.clientSide === 'SELL' ? 'BUY' : 'SELL'
    const price = quote.clientSide === 'SELL' ? quote.bid : quote.offer
    const gross = price * quote.qty
    const fee = round2(gross * COMMISSION_RATE)
    /* 资金约束：买入必须有足够现金，否则这张报价自然作废 */
    if (ourSide === 'BUY' && gross + fee > cash) {
      quotes.push({ ...quote, status: 'EXPIRED', ttlTicks, fillInTicks: 0 })
      continue
    }
    cash = round2(cash + (ourSide === 'BUY' ? -(gross + fee) : gross - fee))
    positions = applyPositionFill(positions, quote.symbol, ourSide, quote.qty, price)
    commission = round2(commission + fee)
    counters = {
      ...counters,
      trade: counters.trade + 1,
      order: counters.order + 1,
    }
    const filledTrade: TradeRow = {
      id: `TRD-${counters.trade}`,
      time: formatShortTime(simSeconds),
      symbol: quote.symbol,
      side: ourSide,
      qty: quote.qty,
      price,
      fee,
    }
    const filledOrder: OrderRow = {
      id: `ORD-${counters.order}`,
      time: formatShortTime(simSeconds),
      symbol: quote.symbol,
      side: ourSide,
      qty: quote.qty,
      price,
      status: 'FILLED',
    }
    trades = [filledTrade, ...trades].slice(0, 20)
    orders = [filledOrder, ...orders].slice(0, 20)
    const fillMid = bookMid(bookOf(instruments, quote.symbol))
    telemetry = recordFill(telemetry, {
      id: filledTrade.id,
      symbol: quote.symbol,
      side: ourSide,
      qty: quote.qty,
      price,
      mid: fillMid,
      edge: round2(ourSide === 'BUY' ? fillMid - price : price - fillMid),
      notional: round2(gross),
      fee,
      tick,
    })
    if (quote.rfqId) {
      dispatch = dispatch.filter((item) => item.id !== quote.rfqId)
    }
    quotes.push({ ...quote, status: 'FILLED', ttlTicks, fillInTicks: 0 })
  }

  /* 4. 系统派单：过期清理 + 新单到达 */
  dispatch = dispatch.filter((item) => simSeconds - item.createdAt < DISPATCH_TTL)
  let nextDispatchAt = state.nextDispatchAt
  if (simSeconds >= nextDispatchAt && dispatch.length < MAX_DISPATCH) {
    const [symbol, afterSymbol] = pickOne(rng, SYMBOLS)
    rng = afterSymbol
    const [client, afterClient] = pickOne(rng, CLIENTS)
    rng = afterClient
    const [sideRoll, afterSide] = nextRandom(rng)
    rng = afterSide
    const [note, afterNote] = pickOne(rng, DISPATCH_NOTES)
    rng = afterNote
    const [units, afterUnits] = randomInt(rng, 1, 4)
    rng = afterUnits
    const rfqCounter = counters.rfq + 1
    counters = { ...counters, rfq: rfqCounter }
    telemetry = recordRfq(telemetry)
    dispatch = [
      ...dispatch,
      {
        id: `RFQ-${rfqCounter}`,
        time: formatShortTime(simSeconds),
        client,
        side: sideRoll < 0.5 ? 'SELL' : 'BUY',
        symbol,
        qty: units * 500,
        note,
        createdAt: simSeconds,
      },
    ]
    nextDispatchAt = simSeconds + DISPATCH_INTERVAL
  }

  /* 5. 遥测采样：每帧记一次敞口与 P&L，维护峰值/最大回撤 */
  const marked = markToMarket(positions, instruments, commission)
  telemetry = sampleExposure(telemetry, { tick, gross: marked.gross, net: marked.net, pnl: marked.pnl })

  /* 6. 会话结束 */
  const status: SessionStatus = simSeconds - state.startedAt >= SESSION_SECONDS ? 'CLOSED' : 'RUNNING'

  return {
    ...state,
    rng,
    tick,
    lastPriceTick: priceDue ? tick : state.lastPriceTick,
    simSeconds,
    status,
    instruments,
    positions,
    orders,
    trades,
    quotes: quotes.slice(-MAX_QUOTES),
    dispatch,
    news,
    pendingNews,
    chartEvents,
    priceTape,
    commission,
    cash,
    nextDispatchAt,
    counters,
    telemetry,
  }
}

export function advanceSession(state: SimulationState, ticks: number): SimulationState {
  let next = state
  for (let i = 0; i < ticks; i += 1) {
    const stepped = stepSession(next)
    if (stepped === next) break
    next = stepped
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

export function sendQuote(state: SimulationState, input: QuoteInput): ActionResult {
  if (!(input.bid > 0) || !(input.offer > 0) || input.offer < input.bid) {
    return { state, message: 'QUOTE REJECTED · bid/offer out of range' }
  }
  const rfq = input.rfqId ? state.dispatch.find((item) => item.id === input.rfqId) : undefined
  const clientSide = rfq?.side ?? 'SELL'
  const qty = rfq?.qty ?? Math.max(500, Math.round((input.bidVolume + input.offerVolume) / 4))
  /* 客户卖给我们 = 我们要拿现金接货，接不下就别报价 */
  if (clientSide === 'SELL' && qty * input.bid * (1 + COMMISSION_RATE) > state.cash) {
    return {
      state,
      message: `QUOTE REJECTED · buying ${qty.toLocaleString('en-US')} would exceed the cash budget`,
    }
  }
  const counter = state.counters.quote + 1
  let rng = state.rng
  const [fillDelay, afterFill] = randomInt(rng, 1, 3)
  rng = afterFill
  /** "Valid for" 用模拟秒表示；按 tick 折算，最少 3 个 tick，保证能看到 LIVE 报价 */
  const ttlTicks = Math.min(24, Math.max(3, Math.round(input.validFor / 12)))
  const quote: LiveQuote = {
    id: `Q-${counter}`,
    symbol: input.symbol,
    bidVolume: input.bidVolume,
    bid: round2(input.bid),
    offer: round2(input.offer),
    offerVolume: input.offerVolume,
    validFor: input.validFor,
    status: 'LIVE',
    client: rfq?.client ?? 'AM-39',
    qty,
    clientSide,
    ttlTicks,
    fillInTicks: fillDelay,
    rfqId: rfq?.id,
  }
  const marketBook = state.instruments.find((item) => item.symbol === input.symbol)?.book
  const liveSpread = marketBook ? round2(marketBook.asks[0].price - marketBook.bids[0].price) : 0
  const responseTicks = rfq
    ? Math.max(0, Math.round((state.simSeconds - rfq.createdAt) / SIM_SECONDS_PER_TICK))
    : null
  const telemetry = recordQuote(state.telemetry, {
    id: quote.id,
    symbol: quote.symbol,
    tick: state.tick,
    ourSpread: round2(quote.offer - quote.bid),
    marketSpread: liveSpread,
    responseTicks,
    rfqId: rfq?.id,
  })

  return {
    state: {
      ...state,
      rng,
      telemetry,
      quotes: [...state.quotes, quote].slice(-MAX_QUOTES),
      counters: { ...state.counters, quote: counter },
    },
    message: `QUOTE SENT · ${input.symbol} ${quote.bid.toFixed(2)} / ${quote.offer.toFixed(2)} · VALID ${input.validFor}s`,
  }
}

export interface FillInput {
  symbol: string
  clientSide: Side
  client: string
  qty: number
  price: number
  rfqId?: string
}

export function fillClientOrder(state: SimulationState, input: FillInput): ActionResult {
  if (!(input.qty > 0) || !(input.price > 0)) {
    return { state, message: 'ORDER REJECTED · quantity and price must be positive' }
  }
  const ourSide: Side = input.clientSide === 'SELL' ? 'BUY' : 'SELL'
  const gross = input.qty * input.price
  const fee = round2(gross * COMMISSION_RATE)
  if (ourSide === 'BUY' && gross + fee > state.cash) {
    const need = Math.ceil(gross + fee).toLocaleString('en-US')
    const have = Math.floor(state.cash).toLocaleString('en-US')
    return { state, message: `ORDER REJECTED · insufficient cash (need $${need}, have $${have})` }
  }
  const positions = applyPositionFill(state.positions, input.symbol, ourSide, input.qty, input.price)
  const counters = { ...state.counters, trade: state.counters.trade + 1, order: state.counters.order + 1 }
  const order: OrderRow = {
    id: `ORD-${counters.order}`,
    time: formatShortTime(state.simSeconds),
    symbol: input.symbol,
    side: ourSide,
    qty: input.qty,
    price: round2(input.price),
    status: 'FILLED',
  }
  const trade: TradeRow = {
    id: `TRD-${counters.trade}`,
    time: formatShortTime(state.simSeconds),
    symbol: input.symbol,
    side: ourSide,
    qty: input.qty,
    price: round2(input.price),
    fee,
  }
  const mid = bookMid(bookOf(state.instruments, input.symbol))
  const telemetry = recordFill(state.telemetry, {
    id: trade.id,
    symbol: input.symbol,
    side: ourSide,
    qty: input.qty,
    price: round2(input.price),
    mid,
    edge: round2(ourSide === 'BUY' ? mid - input.price : input.price - mid),
    notional: round2(gross),
    fee,
    tick: state.tick,
  })
  return {
    state: {
      ...state,
      positions,
      telemetry,
      commission: round2(state.commission + fee),
      orders: [order, ...state.orders].slice(0, 20),
      trades: [trade, ...state.trades].slice(0, 20),
      cash: round2(state.cash + (ourSide === 'BUY' ? -(gross + fee) : gross - fee)),
      counters,
      dispatch: input.rfqId ? state.dispatch.filter((item) => item.id !== input.rfqId) : state.dispatch,
    },
    message: `FILLED · ${ourSide} ${input.qty.toLocaleString('en-US')} ${input.symbol} @ ${round2(
      input.price,
    ).toFixed(2)} · ${input.client}`,
  }
}

export function declineDispatch(state: SimulationState, rfqId: string): ActionResult {
  const rfq = state.dispatch.find((item) => item.id === rfqId)
  if (!rfq) return { state, message: 'DISPATCH NOT FOUND' }
  return {
    state: {
      ...state,
      dispatch: state.dispatch.filter((item) => item.id !== rfqId),
      telemetry: recordDecline(state.telemetry),
    },
    message: `DISPATCH DECLINED · ${rfq.id} ${rfq.client}`,
  }
}

export function togglePause(state: SimulationState): SimulationState {
  if (state.status === 'CLOSED') return state
  return { ...state, status: state.status === 'PAUSED' ? 'RUNNING' : 'PAUSED' }
}

export function cycleSpeed(state: SimulationState): SimulationState {
  const index = SPEEDS.indexOf(state.speed as (typeof SPEEDS)[number])
  return { ...state, speed: SPEEDS[(index + 1) % SPEEDS.length] }
}

export function setSpeed(state: SimulationState, speed: number): SimulationState {
  const next = SPEEDS.find((option) => option === speed)
  return next && next !== state.speed ? { ...state, speed: next } : state
}

/* ------------------------------------------------------------------ */
/* 选择器（把引擎状态映射成 UI 需要的形状）                            */
/* ------------------------------------------------------------------ */

export function selectInstruments(state: SimulationState): Instrument[] {
  return state.instruments.map((instrument) => ({
    symbol: instrument.symbol,
    name: instrument.name,
    last: instrument.last,
    changePct: (instrument.last / instrument.prevClose - 1) * 100,
    changeAbs: round2(instrument.last - instrument.prevClose),
    lastMove: instrument.lastMove,
  }))
}

export function selectPositions(state: SimulationState): Position[] {
  return state.positions.map((position) => {
    const instrument = state.instruments.find((item) => item.symbol === position.symbol)
    const last = instrument?.last ?? position.avgPrice
    const value = position.netQty * last
    const unrealised = position.netQty * (last - position.avgPrice)
    return {
      symbol: position.symbol,
      netQty: position.netQty,
      avgPrice: position.avgPrice,
      value: round2(value),
      unrealised: round2(unrealised),
      realised: position.realised,
      netPnl: round2(position.realised + unrealised),
    }
  })
}

export function selectPnl(state: SimulationState): Pnl {
  const positions = selectPositions(state)
  const realised = positions.reduce((total, position) => total + position.realised, 0)
  const unrealised = positions.reduce((total, position) => total + position.unrealised, 0)
  const netExposure = positions.reduce((total, position) => total + position.value, 0)
  return {
    realised: round2(realised),
    unrealised: round2(unrealised),
    netExposure: round2(netExposure),
    commission: round2(state.commission),
    total: round2(realised + unrealised - state.commission),
  }
}

export function selectBook(state: SimulationState, symbol: string): Book {
  const instrument = state.instruments.find((item) => item.symbol === symbol) ?? state.instruments[0]
  return instrument.book
}

export function selectSeries(state: SimulationState, symbol: string): number[] {
  const instrument = state.instruments.find((item) => item.symbol === symbol) ?? state.instruments[0]
  return instrument.series
}

export function selectChartMarkers(
  state: SimulationState,
  symbol: string,
): Array<{ index: number; label: string }> {
  const instrument = state.instruments.find((item) => item.symbol === symbol) ?? state.instruments[0]
  const total = instrument.series.length
  const priceIndexNow = Math.floor(state.tick / PRICE_UPDATE_TICKS)
  return state.chartEvents
    .filter((event) => !event.symbol || event.symbol === symbol)
    .map((event) => ({
      index: total - 1 - (priceIndexNow - Math.floor(event.tick / PRICE_UPDATE_TICKS)),
      label: event.label,
    }))
    .filter((marker) => marker.index >= 0 && marker.index < total)
}

export function selectCash(state: SimulationState): number {
  return round2(state.cash)
}

/** 最近的价格变动记录：只留下有明显来源或幅度够看的，给 PRICE TAPE 面板 */
export function selectPriceTape(state: SimulationState, limit = 7, minBps = 4): PriceChangeRecord[] {
  const notable = state.priceTape.filter(
    (change) =>
      Math.abs(change.bps) >= minBps || change.drivers.some((driver) => driver.source === 'headline'),
  )
  return notable.slice(-limit)
}

/** 每个标的最新一次价格变动的解释，给 MARKET WATCH 的 DRIVER 列 */
export function selectDrivers(state: SimulationState): Record<string, PriceDriver | null> {
  return Object.fromEntries(state.instruments.map((instrument) => [instrument.symbol, instrument.driver]))
}

export function selectSessionMeta(state: SimulationState, latencyMs = 0): SessionMeta {
  return {
    // 收盘时刻 simSeconds 正好停在 15 个交易日的边界上，formatClock 会回绕成 09:30:00，
    // 所以结束态直接钉在最后一天的收盘时间。
    clock: state.status === 'CLOSED' ? '16:00:00' : formatClock(state.simSeconds),
    dayIndex: dayIndexAt(state.simSeconds),
    totalDays: SESSION_DAYS,
    status: state.status,
    speed: state.speed,
    latencyMs,
    seed: state.seed,
  }
}
