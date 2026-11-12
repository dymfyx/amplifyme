import type { ScoreCard, ScoreDimension } from '../types'
import { STARTING_CASH, selectPnl, type SimulationState } from './simulation'
import { NEWS_REACTION_TICKS } from './telemetry'

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
}

export function selectSettlement(state: SimulationState): SettlementStats {
  const pnl = selectPnl(state)
  const telemetry = state.telemetry

  const fillEdges = telemetry.fills.map((fill) => fill.edge)
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
  // 一张报价都没出过就没有“报价纪律”可言 —— 给中性分，别让不交易也拿满分
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

/** 结算报告里的一句话点评，按最难看的那个维度说话 */
export function coachingLine(state: SimulationState): string {
  const score = scoreSession(state)
  const worst = [...score.dimensions].sort((a, b) => a.value - b.value)[0]
  const best = [...score.dimensions].sort((a, b) => b.value - a.value)[0]
  return `Strongest: ${best.label.toLowerCase()}. Weakest: ${worst.label.toLowerCase()} — ${advice(worst.key)}`
}

function advice(key: string): string {
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
      return `trade within ${NEWS_REACTION_TICKS} ticks of a headline instead of waiting it out.`
    default:
      return 'keep the same process and repeat it.'
  }
}
