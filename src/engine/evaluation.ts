import { NEWS_REACTION_TICKS } from './telemetry'
import { STARTING_CASH, type SimulationState } from './simulation'
import { verdictBand, type VerdictBand } from './difficulty'
import { decisionReview, scoreSession, selectSettlement } from './scoring'

/* 行为标签：只描述这一局看得见的动作，不做心理推断 */
export type BehaviourTagKey =
  | 'decisive'
  | 'patient'
  | 'chaser'
  | 'steady-book'
  | 'stubborn'
  | 'overtrading'
  | 'headline-hunter'
  | 'contrarian'

export const BEHAVIOUR_TAGS: Record<BehaviourTagKey, string> = {
  decisive: 'Decisive',
  patient: 'Patient',
  chaser: 'Chasing the tape',
  'steady-book': 'Steady book',
  stubborn: 'Holding losers',
  overtrading: 'Overtrading',
  'headline-hunter': 'Headline hunter',
  contrarian: 'Contrarian',
}

export interface BehaviourTag {
  key: BehaviourTagKey
  label: string
}

export type VerdictTone = 'praise' | 'neutral' | 'snark'

export interface SessionVerdict {
  band: VerdictBand
  headline: string
  tags: BehaviourTag[]
  line: string
  tone: VerdictTone
}

const bandHeadlines: Record<VerdictBand, string> = {
  elite: 'The desk would hire you.',
  strong: 'Sharp session — a couple of choices from elite.',
  solid: 'Solid, if unspectacular.',
  snark: 'The market charged you tuition.',
  brutal: 'That was a donation. The other side says thanks.',
}

const snarkLines = [
  'You are not providing liquidity — you are subsidising it.',
  'At this rate the other side should be paying you rent.',
  'A famous trader once said: trade like this and even your old school would disown you.',
  'The spread is supposed to be earned, not donated.',
]

const praiseLines = [
  'You took risk when it paid and stood aside when it did not.',
  'Clean execution: the fills landed on the right side of the mid.',
  'You kept the book small enough to survive the tape.',
]

/**
 * 一局结束后的文字评价：分档 + 行为标签 + 一句点评。
 * 评分本身不变（用户要求不加难度系数），这里只做描述。
 */
export function evaluateSession(state: SimulationState): SessionVerdict {
  const stats = selectSettlement(state)
  const score = scoreSession(state)
  const review = decisionReview(state)
  const telemetry = state.telemetry
  const band = verdictBand(score.composite)

  const fills = telemetry.fills.length
  const quotes = telemetry.quotes.length
  const median = stats.medianResponseTicks
  const ratio = stats.avgSpreadRatio ?? 1
  const edge = stats.avgEdge ?? 0
  const winRate = stats.winRate ?? 0
  const carriesRisk = telemetry.exposure.some((sample) => Math.abs(sample.gross) > 0)
  const avgGross = stats.avgGross
  const drawdown = Math.abs(review.worstDrawdown?.dollars ?? 0)
  const answered = stats.headlinesAnswered
  const headlines = stats.headlines
  const answeredShare = headlines > 0 ? answered / headlines : 0
  const adverse = review.adverse.length

  const checks: Array<[BehaviourTagKey, boolean]> = [
    ['decisive', median !== null && median <= 6 && fills >= 4 && stats.total > 0],
    ['patient', quotes >= 3 && ratio <= 1.6 && edge > 0],
    ['chaser', fills >= 4 && edge < 0 && winRate < 0.45],
    ['steady-book', carriesRisk && avgGross < STARTING_CASH * 0.15 && drawdown < STARTING_CASH * 0.05],
    ['stubborn', adverse >= 3 && drawdown > STARTING_CASH * 0.02],
    ['overtrading', quotes >= 12 && edge <= 0],
    ['headline-hunter', headlines >= 4 && answeredShare >= 0.6],
    ['contrarian', edge > 0.3 && winRate > 0.55 && (median === null || median <= NEWS_REACTION_TICKS * 2)],
  ]

  const tags: BehaviourTag[] = checks
    .filter(([, hit]) => hit)
    .map(([key]) => ({ key, label: BEHAVIOUR_TAGS[key] }))
    .slice(0, 6)

  /* 没有明显特征时，至少给一句中性描述，避免评价卡空着 */
  if (tags.length === 0) tags.push({ key: 'patient', label: BEHAVIOUR_TAGS.patient })

  const snarky = band === 'snark' || band === 'brutal'
  const pick = (lines: string[], salt: number) => lines[salt % lines.length]
  const salt = Math.abs(Math.round(stats.total / 1000)) + tags.length
  const line = snarky ? pick(snarkLines, salt) : pick(praiseLines, salt)
  const tone: VerdictTone = snarky ? 'snark' : band === 'elite' || band === 'strong' ? 'praise' : 'neutral'

  return {
    band,
    headline: bandHeadlines[band],
    tags,
    line,
    tone,
  }
}
