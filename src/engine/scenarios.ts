import type { NewsKind } from '../types'
import { CLIENTS, NEWS_TEMPLATES, UNIVERSE } from './scenario'

/**
 * 场景库：一局练习的「剧本」。
 *
 * 场景只描述「什么时候、哪条消息、推哪个方向、多大力度」，不改引擎逻辑：
 * - 新闻用 at（0..1 的整局位置）而不是绝对秒数，所以同一份剧本在 5 / 15 / 30 分钟档
 *   都会均匀铺开，短档位只是播得更密。
 * - spreadMultiplier / liquidityMultiplier 用来放大点差、抽干盘口深度，
 *   可以把「平静的一天」和「崩盘那天」区分开。
 *
 * 自定义场景支持从 JSON 导入（见 parseScenarioJson），方便老师出题或自己改剧本。
 */

/** 与 simulation.ts 的 SESSION_SECONDS 等价；单独定义是为了避免循环依赖，测试里会校验两者相等 */
export const SCENARIO_SESSION_SECONDS = 15 * 6.5 * 3600

export type ClientType = 'informed' | 'uninformed'

/** 系统派单背后的客户画像：决定他等多久、能不能容忍宽价 */
export interface ClientProfile {
  id: string
  type: ClientType
  /** 客户愿意等多久（tick）：派单在这么多个报价刷新后失效 */
  patience: number
  /** 宽度容忍度，乘在成交概率上：>1 更容易接受偏宽的报价 */
  tolerance: number
  /** 还没成交时，这条 RFQ 上挂的备注 */
  note: string
}

const clientNote = (index: number) => CLIENTS[index % CLIENTS.length]

/**
 * 默认客户队伍：一半消息灵通（刚出新闻就来找你，方向押得准、但也更挑剔），
 * 一半是普通流动性客户。informed 客户成交通常意味着你被逆向选择。
 */
export const DEFAULT_CLIENTS: ClientProfile[] = [
  { id: clientNote(0), type: 'informed', patience: 14, tolerance: 0.8, note: 'Trades the headline, wants a tight market' },
  { id: clientNote(1), type: 'uninformed', patience: 22, tolerance: 1.15, note: 'Firm quote requested, client is on the line' },
  { id: clientNote(2), type: 'informed', patience: 12, tolerance: 0.75, note: 'Crosses the spread when the news hits' },
  { id: clientNote(3), type: 'uninformed', patience: 24, tolerance: 1.2, note: 'Client wants a two-way market' },
  { id: clientNote(4), type: 'informed', patience: 16, tolerance: 0.85, note: 'Working an order around the print' },
  { id: clientNote(5), type: 'uninformed', patience: 20, tolerance: 1.1, note: 'Spread-sensitive account, quote tight' },
]

/** 自定义场景里一条新闻的写法：位置用 0..1 的比例，方便跨时长复用 */
export interface ScenarioNewsInput {
  at: number
  kind: NewsKind
  tag: string
  impact: 1 | 2 | 3
  headline: string
  short: string
  direction?: 1 | -1
  /** 不填表示整个市场 */
  symbol?: string
  /** 这条消息最终推动的总基点（宏观消息会按各标的波动率放大） */
  driftBps?: number
}

export interface Scenario {
  id: string
  name: string
  /** 入口卡片上的一句话说明 */
  blurb: string
  news: ScenarioNewsInput[]
  /** 点差乘数：2 表示盘口比平时宽一倍（更容易被逆向选择） */
  spreadMultiplier?: number
  /** 流动性乘数：0.5 表示每档挂单量只有平时一半 */
  liquidityMultiplier?: number
}

const classicNews: ScenarioNewsInput[] = NEWS_TEMPLATES.map((template) => ({
  at: template.offset / SCENARIO_SESSION_SECONDS,
  kind: template.kind,
  tag: template.tag,
  impact: template.impact,
  headline: template.headline,
  short: template.short,
  direction: template.direction,
  symbol: template.symbol,
  driftBps: template.driftBps,
}))

export const SCENARIOS: Scenario[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Mixed macro and single-name headlines — the standard practice tape.',
    news: classicNews,
  },
  {
    id: 'fomc',
    name: 'FOMC day',
    blurb: 'One central-bank decision drives everything; the whole board re-rates.',
    spreadMultiplier: 1.4,
    news: [
      { at: 0.06, kind: 'note', tag: 'NOTE', impact: 2, headline: 'Traders brace for the Fed decision at 18:00', short: 'Fed watch', },
      { at: 0.14, kind: 'macro', tag: 'MACRO', impact: 3, headline: 'Fed holds rates but signals two cuts later this year', short: 'Fed hold', direction: 1, driftBps: 70 },
      { at: 0.22, kind: 'macro', tag: 'MACRO', impact: 3, headline: 'Press conference turns hawkish; long-end yields back up', short: 'hawkish', direction: -1, driftBps: 80 },
      { at: 0.3, kind: 'equity', tag: 'NFLX', impact: 2, headline: 'Growth names give back the knee-jerk rally', short: 'growth slip', direction: -1, symbol: 'NFLX', driftBps: 55 },
      { at: 0.38, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'Dollar index pushes higher as rate-cut odds fade', short: 'USD bid', direction: -1, driftBps: 45 },
      { at: 0.47, kind: 'equity', tag: 'AZN', impact: 2, headline: 'Defensive pharma catches a safety bid', short: 'safety bid', direction: 1, symbol: 'AZN', driftBps: 50 },
      { at: 0.56, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Liquidity thins into the European close', short: 'thin close' },
      { at: 0.64, kind: 'macro', tag: 'MACRO', impact: 3, headline: 'Fed speaker walks back the hawkish read from the presser', short: 'walk back', direction: 1, driftBps: 65 },
      { at: 0.72, kind: 'equity', tag: 'TSLA', impact: 2, headline: 'Tesla extends gains as risk appetite returns', short: 'risk on', direction: 1, symbol: 'TSLA', driftBps: 60 },
      { at: 0.81, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'Bond yields retrace; equities grind back to the highs', short: 'yields fade', direction: 1, driftBps: 40 },
      { at: 0.9, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Closing imbalance expected in the last thirty minutes', short: 'imbalance' },
      { at: 0.96, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'Late dip-buyers step in ahead of the close', short: 'dip bid', direction: 1, driftBps: 35 },
    ],
  },
  {
    id: 'earnings',
    name: 'Earnings surprise',
    blurb: 'Single-name earnings gaps — quote the print, manage the inventory.',
    news: [
      { at: 0.05, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Desk expects a quiet morning before the results', short: 'quiet open' },
      { at: 0.12, kind: 'equity', tag: 'NFLX', impact: 3, headline: 'Netflix beats on subscribers and raises the full-year guide', short: 'NFLX beat', direction: 1, symbol: 'NFLX', driftBps: 140 },
      { at: 0.19, kind: 'equity', tag: 'DUOL', impact: 2, headline: 'Duolingo guides cautiously on marketing spend', short: 'DUOL guide', direction: -1, symbol: 'DUOL', driftBps: 90 },
      { at: 0.26, kind: 'equity', tag: 'TSLA', impact: 2, headline: 'Tesla deliveries land in line; margins in focus', short: 'TSLA inline', direction: 1, symbol: 'TSLA', driftBps: 55 },
      { at: 0.34, kind: 'note', tag: 'NOTE', impact: 2, headline: 'Research desks start publishing upgrades', short: 'upgrades' },
      { at: 0.42, kind: 'equity', tag: 'AZN', impact: 2, headline: 'AstraZeneca trial data beats the primary endpoint', short: 'AZN data', direction: 1, symbol: 'AZN', driftBps: 100 },
      { at: 0.5, kind: 'equity', tag: 'NFLX', impact: 2, headline: 'Netflix gains fade as profit-takers hit the tape', short: 'NFLX fade', direction: -1, symbol: 'NFLX', driftBps: 70 },
      { at: 0.58, kind: 'equity', tag: 'DUOL', impact: 2, headline: 'Duolingo slides on a downgrade after the guide', short: 'DUOL cut', direction: -1, symbol: 'DUOL', driftBps: 75 },
      { at: 0.66, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Analysts flag crowded ownership in the winners', short: 'crowding' },
      { at: 0.74, kind: 'equity', tag: 'TSLA', impact: 2, headline: 'Tesla rebounds on a large option expiry flow', short: 'TSLA bounce', direction: 1, symbol: 'TSLA', driftBps: 60 },
      { at: 0.83, kind: 'equity', tag: 'AZN', impact: 1, headline: 'AstraZeneca consolidates after the data pop', short: 'AZN pause' },
      { at: 0.91, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Volumes thin out into the close', short: 'thin close' },
      { at: 0.97, kind: 'equity', tag: 'NFLX', impact: 2, headline: 'Netflix salvages most of the morning gap', short: 'NFLX close', direction: 1, symbol: 'NFLX', driftBps: 40 },
    ],
  },
  {
    id: 'crash',
    name: 'Risk-off crash',
    blurb: 'Wide spreads, thin books, falling tape — sell into every bounce.',
    spreadMultiplier: 2.2,
    liquidityMultiplier: 0.55,
    news: [
      { at: 0.03, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Credit spreads start widening in Asia', short: 'spreads' },
      { at: 0.1, kind: 'macro', tag: 'MACRO', impact: 3, headline: 'Bank funding stress spills into European equities', short: 'funding', direction: -1, driftBps: 85 },
      { at: 0.18, kind: 'macro', tag: 'MACRO', impact: 3, headline: 'VIX doubles as forced deleveraging kicks in', short: 'VIX spike', direction: -1, driftBps: 95 },
      { at: 0.27, kind: 'equity', tag: 'DUOL', impact: 3, headline: 'Duolingo down 18% as high-multiple names get sold', short: 'DUOL sold', direction: -1, symbol: 'DUOL', driftBps: 120 },
      { at: 0.35, kind: 'equity', tag: 'NFLX', impact: 2, headline: 'Netflix cut to neutral; growth stock de-rating spreads', short: 'NFLX cut', direction: -1, symbol: 'NFLX', driftBps: 90 },
      { at: 0.44, kind: 'note', tag: 'NOTE', impact: 2, headline: 'Liquidity providers widen; fills are expensive', short: 'wide books' },
      { at: 0.52, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'A short-covering bounce lifts the tape off the lows', short: 'short cover', direction: 1, driftBps: 70 },
      { at: 0.6, kind: 'equity', tag: 'AZN', impact: 1, headline: 'Defensive healthcare outperforms in the sell-off', short: 'AZN defence', direction: 1, symbol: 'AZN', driftBps: 45 },
      { at: 0.68, kind: 'macro', tag: 'MACRO', impact: 3, headline: 'Second wave of redemptions hits the close of risk', short: 'redemptions', direction: -1, driftBps: 85 },
      { at: 0.76, kind: 'equity', tag: 'TSLA', impact: 2, headline: 'Tesla breaks a key support level on heavy volume', short: 'TSLA break', direction: -1, symbol: 'TSLA', driftBps: 80 },
      { at: 0.84, kind: 'note', tag: 'NOTE', impact: 2, headline: 'Central bank announces an emergency liquidity call', short: 'emergency' },
      { at: 0.9, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'Bids appear; the market claws back a third of the drop', short: 'claw back', direction: 1, driftBps: 65 },
      { at: 0.97, kind: 'macro', tag: 'MACRO', impact: 1, headline: 'Stocks settle near the lows as the session ends', short: 'weak close', direction: -1, driftBps: 30 },
    ],
  },
  {
    id: 'squeeze',
    name: 'Short squeeze',
    blurb: 'A crowded short unwinds violently, then fades — chase with care.',
    spreadMultiplier: 1.6,
    liquidityMultiplier: 0.75,
    news: [
      { at: 0.04, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Options desks flag heavy call buying in Autos', short: 'call buying' },
      { at: 0.12, kind: 'equity', tag: 'TSLA', impact: 3, headline: 'Tesla retail flow explodes; shorts start to cover', short: 'TSLA squeeze', direction: 1, symbol: 'TSLA', driftBps: 150 },
      { at: 0.2, kind: 'equity', tag: 'DUOL', impact: 2, headline: 'Duolingo squeezes higher on a buy-to-cover scramble', short: 'DUOL squeeze', direction: 1, symbol: 'DUOL', driftBps: 110 },
      { at: 0.28, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'Risk appetite improves as the squeeze pulls the tape up', short: 'risk on', direction: 1, driftBps: 60 },
      { at: 0.36, kind: 'note', tag: 'NOTE', impact: 2, headline: 'Short interest drops sharply; the fuel is running out', short: 'fuel out' },
      { at: 0.44, kind: 'equity', tag: 'TSLA', impact: 3, headline: 'Tesla stalls at the highs; early buyers take profit', short: 'TSLA fade', direction: -1, symbol: 'TSLA', driftBps: 120 },
      { at: 0.52, kind: 'equity', tag: 'DUOL', impact: 2, headline: 'Duolingo reverses; calls get unwound into the bid', short: 'DUOL fade', direction: -1, symbol: 'DUOL', driftBps: 95 },
      { at: 0.6, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Volatility sellers return; spreads tighten again', short: 'vol down' },
      { at: 0.68, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'Broader market flat as the squeeze fades', short: 'flat tape', direction: -1, driftBps: 40 },
      { at: 0.76, kind: 'equity', tag: 'TSCO', impact: 2, headline: 'Tesco jumps on an activist stake report', short: 'TSCO stake', direction: 1, symbol: 'TSCO', driftBps: 85 },
      { at: 0.84, kind: 'equity', tag: 'AZN', impact: 1, headline: 'AstraZeneca drifts on no news', short: 'AZN flat' },
      { at: 0.92, kind: 'macro', tag: 'MACRO', impact: 2, headline: 'Late sellers hit the bounce; the squeeze fades for good', short: 'late fade', direction: -1, driftBps: 50 },
      { at: 0.97, kind: 'note', tag: 'NOTE', impact: 1, headline: 'Closing imbalance expected in the last thirty minutes', short: 'imbalance' },
    ],
  },
]

export function scenarioById(id: string | undefined | null): Scenario {
  if (!id) return SCENARIOS[0]
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]
}

export const DEFAULT_SCENARIO = SCENARIOS[0]

const KINDS: NewsKind[] = ['macro', 'note', 'equity']

/** 校验通过时原样返回，失败时给一句人话错误信息 */
function validateScenario(value: unknown): { scenario?: Scenario; error?: string } {
  if (!value || typeof value !== 'object') return { error: 'Scenario must be a JSON object.' }
  const raw = value as Record<string, unknown>
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Custom'
  const news = raw.news
  if (!Array.isArray(news) || news.length < 1) return { error: 'Scenario needs a non-empty "news" array.' }
  if (news.length > 40) return { error: 'Use at most 40 headlines per scenario.' }
  const parsedNews: ScenarioNewsInput[] = []
  for (let index = 0; index < news.length; index += 1) {
    const item = news[index] as Record<string, unknown>
    const prefix = `news[${index}]`
    if (!item || typeof item !== 'object') return { error: `${prefix} must be an object.` }
    const at = Number(item.at)
    if (!Number.isFinite(at) || at < 0 || at > 1) return { error: `${prefix}.at must be between 0 and 1.` }
    const kind = item.kind as NewsKind
    if (!KINDS.includes(kind)) return { error: `${prefix}.kind must be macro, note or equity.` }
    const impact = Number(item.impact)
    if (![1, 2, 3].includes(impact)) return { error: `${prefix}.impact must be 1, 2 or 3.` }
    if (typeof item.headline !== 'string' || !item.headline.trim()) return { error: `${prefix}.headline is required.` }
    if (typeof item.short !== 'string' || !item.short.trim()) return { error: `${prefix}.short is required (the tape label).` }
    const symbol = typeof item.symbol === 'string' ? item.symbol.toUpperCase() : undefined
    if (symbol && !UNIVERSE.some((entry) => entry.symbol === symbol)) {
      return { error: `${prefix}.symbol must be one of ${UNIVERSE.map((entry) => entry.symbol).join(', ')}.` }
    }
    const direction = item.direction === undefined ? undefined : Number(item.direction)
    if (direction !== undefined && direction !== 1 && direction !== -1) {
      return { error: `${prefix}.direction must be 1, -1 or omitted.` }
    }
    const driftBps = item.driftBps === undefined ? undefined : Number(item.driftBps)
    if (driftBps !== undefined && (!Number.isFinite(driftBps) || driftBps < 0 || driftBps > 500)) {
      return { error: `${prefix}.driftBps must be between 0 and 500.` }
    }
    parsedNews.push({
      at,
      kind,
      tag: typeof item.tag === 'string' && item.tag.trim() ? item.tag.trim() : kind.toUpperCase(),
      impact: impact as 1 | 2 | 3,
      headline: item.headline.trim(),
      short: item.short.trim(),
      direction: direction as 1 | -1 | undefined,
      symbol,
      driftBps,
    })
  }
  const spreadMultiplier = raw.spreadMultiplier === undefined ? undefined : Number(raw.spreadMultiplier)
  if (spreadMultiplier !== undefined && (!Number.isFinite(spreadMultiplier) || spreadMultiplier < 0.2 || spreadMultiplier > 5)) {
    return { error: 'spreadMultiplier must be between 0.2 and 5.' }
  }
  const liquidityMultiplier = raw.liquidityMultiplier === undefined ? undefined : Number(raw.liquidityMultiplier)
  if (
    liquidityMultiplier !== undefined &&
    (!Number.isFinite(liquidityMultiplier) || liquidityMultiplier < 0.2 || liquidityMultiplier > 5)
  ) {
    return { error: 'liquidityMultiplier must be between 0.2 and 5.' }
  }
  return {
    scenario: {
      id: 'custom',
      name,
      blurb: typeof raw.blurb === 'string' && raw.blurb.trim() ? raw.blurb.trim() : 'Custom scenario imported from JSON.',
      news: parsedNews,
      spreadMultiplier,
      liquidityMultiplier,
    },
  }
}

/** 把用户粘贴的 JSON 变成场景；解析失败时返回 { error }，UI 直接展示 */
export function parseScenarioJson(text: string): { scenario?: Scenario; error?: string } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (error) {
    return { error: error instanceof Error ? `Invalid JSON: ${error.message}` : 'Invalid JSON.' }
  }
  return validateScenario(value)
}

/** 自定义场景的示例，入口弹窗里一键填入 */
export const EXAMPLE_SCENARIO_JSON = `{
  "name": "My morning",
  "blurb": "A quiet open, one upgrade, one miss.",
  "spreadMultiplier": 1.2,
  "liquidityMultiplier": 0.9,
  "news": [
    { "at": 0.1, "kind": "macro", "tag": "MACRO", "impact": 2,
      "headline": "Inflation cools more than expected", "short": "CPI miss",
      "direction": 1, "driftBps": 60 },
    { "at": 0.35, "kind": "equity", "tag": "NFLX", "impact": 2,
      "headline": "Netflix upgraded at a major broker", "short": "NFLX upgrade",
      "direction": 1, "symbol": "NFLX", "driftBps": 80 },
    { "at": 0.6, "kind": "equity", "tag": "DUOL", "impact": 2,
      "headline": "Duolingo misses on subscriber adds", "short": "DUOL miss",
      "direction": -1, "symbol": "DUOL", "driftBps": 90 }
  ]
}`
