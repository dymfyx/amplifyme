import type { Role } from '../types'
import type { SessionMinutes, SimulationState } from './simulation'
import { selectSettlement } from './scoring'
import type { DifficultyTier } from './difficulty'

/**
 * 开局目标卡：每一局给 3–4 个具体、可验证的目标。
 * 目标不参与评分（评分公式保持不变），只是把「这一局要练什么」说清楚，
 * 结算时逐条打勾，并沉淀成下一局的唯一变量。
 */
export type GoalUnit = 'count' | 'percent' | 'dollars' | 'bps'

export interface SessionGoal {
  id: string
  label: string
  /** 一句解释，鼠标悬停或卡片副标题用 */
  hint: string
  target: number
  unit: GoalUnit
  compare: 'gte' | 'lte'
}

export interface GoalStatus extends SessionGoal {
  current: number
  ok: boolean
}

export interface GoalInput {
  desk: Role
  minutes: SessionMinutes
  tier: DifficultyTier
}

const roundTarget = (value: number, step: number) => Math.max(step, Math.round(value / step) * step)

/** 高档位的限额更宽，目标里的敞口/回撤也跟着放宽，避免「档位越高越不可能达标」 */
function goalForDesk({ desk, tier }: GoalInput): SessionGoal[] {
  if (desk === 'sales') {
    return [
      {
        id: 'dealer-fills',
        label: 'Dealer fills',
        hint: 'Hit at least two prices you shopped around for instead of taking the first one.',
        target: 2,
        unit: 'count',
        compare: 'gte',
      },
      {
        id: 'entry-vs-mid',
        label: 'Entry vs mid',
        hint: 'Average entry should be at or better than the mid, not worse.',
        target: 0,
        unit: 'bps',
        compare: 'gte',
      },
      {
        id: 'alpha',
        label: 'Alpha vs buy & hold',
        hint: 'Beat the passive equal-weight benchmark.',
        target: 0,
        unit: 'dollars',
        compare: 'gte',
      },
      {
        id: 'max-drawdown',
        label: 'Max drawdown',
        hint: 'Keep the peak-to-trough loss inside the mandate.',
        target: roundTarget(tier.grossLimit * 0.15, 100_000),
        unit: 'dollars',
        compare: 'lte',
      },
    ]
  }
  return [
    {
      id: 'quotes',
      label: 'Quotes sent',
      hint: 'Keep the market making desk visible: at least eight two-way prices.',
      target: 8,
      unit: 'count',
      compare: 'gte',
    },
    {
      id: 'tight-quotes',
      label: 'Quotes inside 1.8x the market',
      hint: 'Competitive pricing: at least 90% of your quotes inside 1.8x the market spread.',
      target: 0.9,
      unit: 'percent',
      compare: 'gte',
    },
    {
      id: 'net-exposure',
      label: 'Net exposure at the close',
      hint: 'Do not carry a one-way book into the close.',
      target: roundTarget(tier.perNameLimit * 0.35, 100_000),
      unit: 'dollars',
      compare: 'lte',
    },
    {
      id: 'max-drawdown',
      label: 'Max drawdown',
      hint: 'Keep the peak-to-trough loss inside the mandate.',
      target: roundTarget(tier.grossLimit * 0.12, 100_000),
      unit: 'dollars',
      compare: 'lte',
    },
  ]
}

export function goalsForSession(input: GoalInput): SessionGoal[] {
  return goalForDesk(input)
}

/** 把当前状态映射到每条目标：结算卡片与（可选的）盘中检视都用它 */
export function evaluateGoals(goals: SessionGoal[], state: SimulationState): GoalStatus[] {
  const stats = selectSettlement(state)
  const quotes = state.telemetry.quotes.filter((quote) => quote.marketSpread > 0)
  const tightShare =
    quotes.length === 0
      ? 0
      : quotes.filter((quote) => quote.ourSpread <= quote.marketSpread * 1.8).length / quotes.length

  const current: Record<string, number> = {
    'dealer-fills': stats.dealerFills,
    'entry-vs-mid': stats.entryEdgeBps,
    alpha: stats.alpha,
    quotes: stats.quotes,
    'tight-quotes': tightShare,
    'net-exposure': Math.abs(stats.netExposure),
    'max-drawdown': Math.abs(stats.maxDrawdown),
  }

  return goals.map((goal) => {
    const value = current[goal.id] ?? 0
    const ok = goal.compare === 'gte' ? value >= goal.target : value <= goal.target
    return { ...goal, current: value, ok }
  })
}

export function formatGoalValue(value: number, unit: GoalUnit): string {
  if (unit === 'percent') return `${Math.round(value * 100)}%`
  if (unit === 'dollars') {
    const rounded = Math.round(Math.abs(value))
    const sign = value < 0 ? '-' : ''
    return `${sign}$${rounded.toLocaleString('en-US')}`
  }
  if (unit === 'bps') {
    const rounded = Math.round(value * 10) / 10
    return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)} bps`
  }
  return value.toLocaleString('en-US')
}
