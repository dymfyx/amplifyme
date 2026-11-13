import type { Role } from '../types'
import { SCENARIOS, type Scenario } from '../engine/scenarios'
import type { OpeningPosition, SessionMinutes, SimulationState } from '../engine/simulation'
import { decisionReview, selectSettlement } from '../engine/scoring'

/** 训练模式里的一组固定练习：每个 drill 锁死台面、时长、剧本与开局仓位 */
export type DrillId =
  | 'quote-discipline'
  | 'news-reaction'
  | 'inventory-control'
  | 'adverse-selection'
  | 'two-venues'

export type MetricUnit = 'count' | 'percent' | 'shares' | 'dollars' | 'ratio'

export interface DrillCriterion {
  id: string
  /** 英文原文，界面按 t() 查中文 */
  label: string
  /** 通过线 / 比较方式 */
  compare: 'gte' | 'lte' | 'gt'
  target: number
  unit: MetricUnit
}

export interface Drill {
  id: DrillId
  /** 英文名，界面按 t() 查中文 */
  name: string
  /** 一句话说明这道题练什么 */
  blurb: string
  /** 固定台面 */
  role: Role
  /** 固定 5 分钟，训练不看长局 */
  minutes: SessionMinutes
  /** 固定种子：同一道题可重试，分数可比 */
  seed: number
  scenarioId: string
  /** 开局仓位；空数组 = 空仓 */
  openingBook: OpeningPosition[]
  criteria: DrillCriterion[]
}

export interface DrillMetric {
  id: string
  label: string
  value: number
  target: number
  unit: MetricUnit
  compare: DrillCriterion['compare']
  ok: boolean
}

export interface DrillProgress {
  drillId: DrillId
  metrics: DrillMetric[]
  passed: boolean
}

const scenarioFor = (id: string): Scenario =>
  SCENARIOS.find((candidate) => candidate.id === id) ?? SCENARIOS[0]

export const DRILLS: Drill[] = [
  {
    id: 'quote-discipline',
    name: 'Quote discipline',
    blurb: 'Stream at least eight quotes and keep 90% of them inside 1.8x the market spread.',
    role: 'market-maker',
    minutes: 5,
    seed: 1042,
    scenarioId: 'classic',
    openingBook: [],
    criteria: [
      { id: 'quotes', label: 'Quotes sent', compare: 'gte', target: 8, unit: 'count' },
      { id: 'tight', label: 'Quotes inside 1.8x', compare: 'gte', target: 0.9, unit: 'percent' },
    ],
  },
  {
    id: 'news-reaction',
    name: 'Headline reaction',
    blurb: 'Trade inside the 20-tick window on at least four of the day’s headlines.',
    role: 'market-maker',
    minutes: 5,
    seed: 2213,
    scenarioId: 'fomc',
    openingBook: [],
    criteria: [
      { id: 'headlines', label: 'Headlines traded', compare: 'gte', target: 4, unit: 'count' },
      { id: 'answered', label: 'Share of headlines answered', compare: 'gte', target: 0.6, unit: 'percent' },
    ],
  },
  {
    id: 'inventory-control',
    name: 'Inventory control',
    blurb: 'You start long 1,500 TSLA. Be flat enough at the close: no name left above 300 shares.',
    role: 'market-maker',
    minutes: 5,
    seed: 3307,
    scenarioId: 'classic',
    openingBook: [{ symbol: 'TSLA', netQty: 1500, avgPrice: 196.8 }],
    criteria: [{ id: 'maxPosition', label: 'Largest position at close', compare: 'lte', target: 300, unit: 'shares' }],
  },
  {
    id: 'adverse-selection',
    name: 'Adverse selection',
    blurb: 'A risk-off tape. Get picked off at most twice and still beat buy & hold.',
    role: 'market-maker',
    minutes: 5,
    seed: 4409,
    scenarioId: 'crash',
    openingBook: [],
    criteria: [
      { id: 'pickedOff', label: 'Fills run over', compare: 'lte', target: 2, unit: 'count' },
      { id: 'alpha', label: 'Alpha vs buy & hold', compare: 'gt', target: 0, unit: 'dollars' },
    ],
  },
  {
    id: 'two-venues',
    name: 'Two venues',
    blurb: 'Take client flow and lay it off on the exchange: hedge at least 80% of client notional and capture spread.',
    role: 'sales',
    minutes: 5,
    seed: 5501,
    scenarioId: 'classic',
    openingBook: [],
    criteria: [
      { id: 'hedge', label: 'Client notional hedged on exchange', compare: 'gte', target: 0.8, unit: 'percent' },
      { id: 'capture', label: 'Spread capture', compare: 'gt', target: 0, unit: 'dollars' },
    ],
  },
]

export const drillById = (id: string): Drill | null =>
  DRILLS.find((candidate) => candidate.id === id) ?? null

export const scenarioForDrill = (drill: Drill): Scenario => scenarioFor(drill.scenarioId)

/** 五种单位统一格式化，入口卡片、盘中 HUD、结算判定都用它 */
export const formatMetric = (value: number, unit: MetricUnit): string => {
  if (unit === 'percent') return `${Math.round(value * 100)}%`
  if (unit === 'dollars') {
    const digits = String(Math.round(Math.abs(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return `${value < 0 ? '-' : ''}$${digits}`
  }
  if (unit === 'ratio') return `${value.toFixed(2)}x`
  if (unit === 'shares') return `${Math.round(value)}`
  return `${Math.round(value)}`
}

const passes = (value: number, criterion: DrillCriterion): boolean => {
  if (criterion.compare === 'gte') return value >= criterion.target
  if (criterion.compare === 'lte') return value <= criterion.target
  return value > criterion.target
}

/** 从实时引擎状态里取指标：盘中 HUD 与结算判定共用同一套口径 */
export const drillMetrics = (drill: Drill, state: SimulationState): DrillMetric[] => {
  const stats = selectSettlement(state)
  const review = decisionReview(state)
  const quotes = state.telemetry.quotes
  const tightQuotes = quotes.filter(
    (quote) => quote.marketSpread > 0 && quote.ourSpread / quote.marketSpread <= 1.8,
  ).length
  const headlines = state.telemetry.news
  const traded = headlines.filter((reaction) => reaction.traded).length
  const maxPosition = state.positions.reduce(
    (largest, position) => Math.max(largest, Math.abs(position.netQty)),
    0,
  )

  const values: Record<string, number> = {
    quotes: quotes.length,
    tight: quotes.length === 0 ? 0 : tightQuotes / quotes.length,
    headlines: traded,
    answered: headlines.length === 0 ? 0 : traded / headlines.length,
    maxPosition,
    pickedOff: review.adverse.length,
    alpha: stats.alpha,
    hedge: stats.clientNotional === 0 ? 0 : stats.exchangeNotional / stats.clientNotional,
    capture: stats.spreadCapture,
  }

  return drill.criteria.map((criterion) => {
    const value = values[criterion.id] ?? 0
    return {
      id: criterion.id,
      label: criterion.label,
      value,
      target: criterion.target,
      unit: criterion.unit,
      compare: criterion.compare,
      ok: passes(value, criterion),
    }
  })
}

export const drillProgress = (drill: Drill, state: SimulationState): DrillProgress => {
  const metrics = drillMetrics(drill, state)
  return { drillId: drill.id, metrics, passed: metrics.every((metric) => metric.ok) }
}
