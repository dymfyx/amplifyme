import type { ScoreCard, ScoreDimension } from '../types'
import { NEWS_REACTION_TICKS } from './telemetry'
import { STARTING_CASH, selectPnl, type PriceFrame, type SimulationState } from './simulation'

/**
 * 评分：把遥测事件折算成 0–100 的六个维度 + 一个加权综合分。
 *
 * 每个维度都有明确口径（改口径就改这里的注释，别在组件里算）：
 * - RETURNS       总 P&L 相对 2 万美元的 tanh 映射，50 = 打平
 * - DISCIPLINE    报价宽度 / 市场价差 越接近 1.6x 越好；拒掉太多派单扣分
 * - REACTION      回应 RFQ 的中位响应 tick 数（1 tick = 250ms 真实时间），越快越高
 * - RESILIENCE    P&L 最大回撤相对 2000 万预算，1% 回撤 ≈ 扣 30 分
 * - MANAGEMENT    平均毛敞口相对预算，25% 敞口 ≈ 0 分
 * - ADAPTABILITY  头条之后 20 个 tick 内是否动过手，比例越高越高
 */

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round1 = (value: number) => Math.round(value * 10) / 10

const mean = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length

const median = (values: number[]) => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export interface SettlementStats {
  total: number
  realised: number
  unrealised: number
  commission: number
  cash: number
  netExposure: number
  trades: number
  buys: number
  sells: number
  winRate: number
  avgEdge: number
  bestEdge: number
  worstEdge: number
  quotes: number
  avgSpreadRatio: number | null
  medianResponseTicks: number | null
  maxDrawdown: number
  peakPnl: number
  avgGross: number
  headlines: number
  headlinesAnswered: number
  /** 客户流成交笔数（我们报价/接客户单成交） */
  clientFills: number
  /** 自己在交易所主动成交笔数 */
  exchangeFills: number
  clientNotional: number
  exchangeNotional: number
  /** 价差捕获：客户流 edge 金额 + 交易所成交 edge 金额（主动吃单通常为负） */
  spreadCapture: number
  /** 基准策略（五只股票等权买入并持有）的盈亏，用于结算时对比 */
  benchmarkPnl: number
  /** 基准收益率（%） */
  benchmarkReturnPct: number
  /** 相对基准的超额（我们的 total − benchmarkPnl） */
  alpha: number
  /** 是否跑赢基准 */
  beatsBenchmark: boolean
}

export function selectSettlement(state: SimulationState): SettlementStats {
  const pnl = selectPnl(state)
  const telemetry = state.telemetry

  /* 客户流成交和交易所主动成交分开统计：前者赚价差，后者付价差 */
  const clientFills = telemetry.fills.filter((fill) => fill.venue === 'client')
  const exchangeFills = telemetry.fills.filter((fill) => fill.venue === 'exchange')
  const fillEdges = clientFills.map((fill) => fill.edge)
  const clientNotional = clientFills.reduce((total, fill) => total + fill.notional, 0)
  const exchangeNotional = exchangeFills.reduce((total, fill) => total + fill.notional, 0)
  const spreadCapture = Math.round(
    telemetry.fills.reduce((total, fill) => total + fill.edge * fill.qty, 0),
  )
  const spreadRatios = telemetry.quotes
    .filter((quote) => quote.marketSpread > 0)
    .map((quote) => quote.ourSpread / quote.marketSpread)
  const responses = telemetry.quotes
    .map((quote) => quote.responseTicks)
    .filter((value): value is number => value !== null)
  const grossSamples = telemetry.exposure.map((sample) => Math.abs(sample.gross))

  return {
    total: pnl.total,
    realised: pnl.realised,
    unrealised: pnl.unrealised,
    commission: pnl.commission,
    cash: state.cash,
    netExposure: pnl.netExposure,
    trades: telemetry.fills.length,
    buys: telemetry.fills.filter((fill) => fill.side === 'BUY').length,
    sells: telemetry.fills.filter((fill) => fill.side === 'SELL').length,
    winRate: fillEdges.length === 0 ? 0 : fillEdges.filter((edge) => edge > 0).length / fillEdges.length,
    avgEdge: round1(mean(fillEdges)),
    bestEdge: fillEdges.length === 0 ? 0 : round1(Math.max(...fillEdges)),
    worstEdge: fillEdges.length === 0 ? 0 : round1(Math.min(...fillEdges)),
    quotes: telemetry.quotes.length,
    avgSpreadRatio: spreadRatios.length === 0 ? null : Math.round(mean(spreadRatios) * 100) / 100,
    medianResponseTicks: responses.length === 0 ? null : Math.round(median(responses)),
    maxDrawdown: Math.round(telemetry.maxDrawdown),
    peakPnl: Math.round(telemetry.peakPnl),
    avgGross: Math.round(mean(grossSamples)),
    headlines: telemetry.news.length,
    headlinesAnswered: telemetry.news.filter((item) => item.traded).length,
    clientFills: clientFills.length,
    exchangeFills: exchangeFills.length,
    clientNotional: Math.round(clientNotional),
    exchangeNotional: Math.round(exchangeNotional),
    spreadCapture,
    ...benchmark(state),
  }
}

/**
 * 基准策略：开局把 2000 万预算等权分给五个名字、按开盘价买入并持有到收盘。
 * 不做任何交易，只承担市场风险 —— 用来回答「我这一局到底有没有跑赢躺平」。
 */
export function benchmark(state: SimulationState): {
  benchmarkPnl: number
  benchmarkReturnPct: number
  alpha: number
  beatsBenchmark: boolean
} {
  const notional = STARTING_CASH / Math.max(1, state.instruments.length)
  const raw = state.instruments.reduce(
    (total, instrument) =>
      total + notional * ((instrument.last - instrument.openPrice) / instrument.openPrice),
    0,
  )
  const benchmarkPnl = Math.round(raw * 100) / 100
  const total = selectPnl(state).total
  return {
    benchmarkPnl,
    benchmarkReturnPct: Math.round((benchmarkPnl / STARTING_CASH) * 10000) / 100,
    alpha: Math.round((total - benchmarkPnl) * 100) / 100,
    beatsBenchmark: total > benchmarkPnl,
  }
}

export function scoreSession(state: SimulationState): ScoreCard {
  const pnl = selectPnl(state)
  const telemetry = state.telemetry

  const returns = clamp(50 + 50 * Math.tanh(pnl.total / 20_000))

  const spreadRatios = telemetry.quotes
    .filter((quote) => quote.marketSpread > 0)
    .map((quote) => quote.ourSpread / quote.marketSpread)
  const avgRatio = spreadRatios.length === 0 ? 1.6 : mean(spreadRatios)
  const widthQuality = 100 * Math.exp(-Math.abs(Math.log(avgRatio / 1.6)))
  const declineRate = telemetry.rfqs === 0 ? 0 : telemetry.declines / telemetry.rfqs
  // 一张报价都没出过就没有「报价纪律」可言 —— 给中性分，别让不交易也拿满分
  const discipline = spreadRatios.length === 0 ? 50 : clamp(widthQuality - declineRate * 25)

  const responses = telemetry.quotes
    .map((quote) => quote.responseTicks)
    .filter((value): value is number => value !== null)
  const reaction = responses.length === 0 ? 50 : clamp(100 - median(responses) * 2.5)

  const carriesRisk = telemetry.exposure.some((sample) => Math.abs(sample.gross) > 0)
  const drawdownPct = (telemetry.maxDrawdown / STARTING_CASH) * 100
  const resilience = carriesRisk ? clamp(100 - drawdownPct * 30) : 50

  const avgGross =
    telemetry.exposure.length === 0
      ? Math.abs(pnl.netExposure)
      : mean(telemetry.exposure.map((sample) => Math.abs(sample.gross)))
  const management = carriesRisk ? clamp(100 - (avgGross / STARTING_CASH) * 400) : 50

  const answered = telemetry.news.filter((item) => item.traded).length
  const adaptability =
    telemetry.news.length === 0 ? 50 : clamp(35 + 65 * (answered / telemetry.news.length))

  const dimensions: ScoreDimension[] = [
    { key: 'returns', label: 'RETURNS', value: round1(returns) },
    { key: 'discipline', label: 'DISCIPLINE', value: round1(discipline) },
    { key: 'reaction', label: 'REACTION', value: round1(reaction) },
    { key: 'resilience', label: 'RESILIENCE', value: round1(resilience) },
    { key: 'management', label: 'TRADE MANAGEMENT', value: round1(management) },
    { key: 'adaptability', label: 'ADAPTABILITY', value: round1(adaptability) },
  ]

  const composite = round1(
    returns * 0.25 +
      discipline * 0.2 +
      reaction * 0.15 +
      resilience * 0.15 +
      management * 0.15 +
      adaptability * 0.1,
  )
  const percentile = Math.round(clamp(5 + composite * 0.9, 1, 99))

  return { composite, percentile, dimensions }
}

/** 结算报告里的点评：最强/最弱维度 + 针对最弱维度的建议（文案由 UI 翻译） */
export type AdviceKey =
  | 'returns'
  | 'discipline'
  | 'reaction'
  | 'resilience'
  | 'management'
  | 'adaptability'
  | 'process'

export interface Coaching {
  strongest: string
  weakest: string
  adviceKey: AdviceKey
}

export function coachingSummary(state: SimulationState): Coaching {
  const score = scoreSession(state)
  const worst = [...score.dimensions].sort((a, b) => a.value - b.value)[0]
  const best = [...score.dimensions].sort((a, b) => b.value - a.value)[0]
  return { strongest: best.label, weakest: worst.label, adviceKey: worst.key as AdviceKey }
}

/** 每个维度的建议原文（英文），中文翻译见 src/i18n/zh-chrome.ts */
export function adviceFor(key: AdviceKey): string {
  switch (key) {
    case 'returns':
      return 'size up the good trades and cut the ones that go against you early.'
    case 'discipline':
      return 'quote closer to the market spread instead of shading every price.'
    case 'reaction':
      return 'answer RFQs faster — the first few seconds decide whether you keep the flow.'
    case 'resilience':
      return 'flatten inventory after a drawdown instead of doubling down.'
    case 'management':
      return 'carry less gross risk into headlines.'
    case 'adaptability':
      return 'trade within {ticks} ticks of a headline instead of waiting it out.'
    default:
      return 'keep the same process and repeat it.'
  }
}

/* ------------------------------------------------------------------ */
/* 决策审阅：结算后回看「哪几笔被逆向选择」和「哪条消息没接住」        */
/* ------------------------------------------------------------------ */

export interface ReviewFill {
  id: string
  time: string
  tick: number
  symbol: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  /** 成交后窗口内价格朝不利于我们的方向走了多少 bps（正数 = 逆向选择） */
  adverseBps: number
}

export interface ReviewMissed {
  id: string
  time: string
  tick: number
  symbol: string | null
  /** 消息出来后窗口内该标的的涨跌（bps，带方向） */
  moveBps: number
}

export interface ReviewDrawdown {
  tick: number
  time: string
  /** 从峰值回撤的美元数（正数） */
  dollars: number
}

export interface DecisionReview {
  /** 审阅窗口：成交后/消息后看多少 tick 的价格变化 */
  windowTicks: number
  /** 被逆向选择的客户流成交，最严重的三笔 */
  adverse: ReviewFill[]
  /** 出了消息却没动手的机会，按错过的幅度排序 */
  missed: ReviewMissed[]
  /** 峰值到谷底最大回撤发生的那一刻 */
  worstDrawdown: ReviewDrawdown | null
  /** 消息灵通的客户来了多少张、我们接下了多少张 */
  informed: { rfqs: number; fills: number }
}

function priceAt(history: PriceFrame[], tick: number, symbol: string): number | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].tick <= tick) return history[index].prices[symbol] ?? null
  }
  return null
}

function timeAt(history: PriceFrame[], tick: number): string {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].tick <= tick) return history[index].time
  }
  return '--:--'
}

export function decisionReview(state: SimulationState): DecisionReview {
  const windowTicks = NEWS_REACTION_TICKS
  const history = state.history
  const telemetry = state.telemetry

  /* 1. 逆向选择：客户流成交之后，价格是否马上朝我们不利的方向走 */
  const adverse: ReviewFill[] = telemetry.fills
    .filter((fill) => fill.venue === 'client')
    .map((fill) => {
      const start = priceAt(history, fill.tick, fill.symbol)
      const later = priceAt(history, fill.tick + windowTicks, fill.symbol)
      if (start === null || later === null || start === 0) return null
      const moveBps = ((later - start) / start) * 10_000
      const adverseBps = fill.side === 'BUY' ? -moveBps : moveBps
      return {
        id: fill.id,
        time: timeAt(history, fill.tick),
        tick: fill.tick,
        symbol: fill.symbol,
        side: fill.side,
        qty: fill.qty,
        price: fill.price,
        adverseBps: Math.round(adverseBps * 10) / 10,
      } satisfies ReviewFill
    })
    .filter((fill): fill is ReviewFill => fill !== null && fill.adverseBps > 1)
    .sort((a, b) => b.adverseBps - a.adverseBps)
    .slice(0, 3)

  /* 2. 错过的消息：头条出来后我们没在同一方向动手，事后价格走了多远 */
  const missed: ReviewMissed[] = telemetry.news
    .filter((reaction) => !reaction.traded)
    .map((reaction): ReviewMissed | null => {
      const item = state.news.find((candidate) => candidate.id === reaction.id)
      if (!item || !item.symbol) return null
      const start = priceAt(history, reaction.tick, item.symbol)
      const later = priceAt(history, reaction.tick + windowTicks, item.symbol)
      if (start === null || later === null || start === 0) return null
      return {
        id: item.id,
        time: timeAt(history, reaction.tick),
        tick: reaction.tick,
        symbol: item.symbol,
        moveBps: Math.round(((later - start) / start) * 10_000 * 10) / 10,
      } satisfies ReviewMissed
    })
    .filter((item): item is ReviewMissed => item !== null)
    .sort((a, b) => Math.abs(b.moveBps) - Math.abs(a.moveBps))
    .slice(0, 3)

  /* 3. 最大回撤发生在哪一刻：P&L 从峰值往下掉得最深的那一帧 */
  let peak = Number.NEGATIVE_INFINITY
  let worstDrawdown: ReviewDrawdown | null = null
  for (const sample of telemetry.exposure) {
    peak = Math.max(peak, sample.pnl)
    const dollars = peak - sample.pnl
    if (dollars > (worstDrawdown?.dollars ?? 0)) {
      worstDrawdown = { tick: sample.tick, time: timeAt(history, sample.tick), dollars: Math.round(dollars) }
    }
  }

  return {
    windowTicks,
    adverse,
    missed,
    worstDrawdown,
    informed: { rfqs: telemetry.informedRfqs, fills: telemetry.informedFills },
  }
}
