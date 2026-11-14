import type { NewsKind } from '../types'
import { CLIENTS, UNIVERSE } from './scenario'
import type { NewsCopy, NewsPool, NewsTemplate } from './news'
import { classicNews } from './news/classic'
import { crashNews } from './news/crash'
import { creditNews } from './news/credit'
import { earningsNews } from './news/earnings'
import { fomcNews } from './news/fomc'
import { geopoliticsNews } from './news/geopolitics'
import { launchNews } from './news/launch'
import { mergerNews } from './news/merger'
import { rebalanceNews } from './news/rebalance'
import { squeezeNews } from './news/squeeze'

/**
 * 场景库：一局练习的「剧本」。
 *
 * P3 起，场景不再是一条固定时间轴，而是给出一整个「新闻池」：
 * - 每局由 seed 决定从池子里抽哪几条、按什么时间铺开（见 engine/news.ts 的 scheduleNews）；
 * - 同一 seed 完全复现，不同 seed 顺序、措辞和标的都不同；
 * - spreadMultiplier / liquidityMultiplier 继续负责「这一天有多难做市」。
 *
 * 自定义场景支持从 JSON 导入（见 parseScenarioJson）。
 */

/** 与 simulation.ts 的 SESSION_SECONDS 等价；单独定义是为了避免循环依赖 */
export const SCENARIO_SESSION_SECONDS = 15 * 6.5 * 3600

export type ClientType = 'informed' | 'uninformed'

/** 系统派单背后的客户画像：决定他等多久、能不能容忍宽价 */
export interface ClientProfile {
  id: string
  type: ClientType
  patience: number
  tolerance: number
  note: string
}

const clientNote = (index: number) => CLIENTS[index % CLIENTS.length]

export const DEFAULT_CLIENTS: ClientProfile[] = [
  { id: clientNote(0), type: 'informed', patience: 14, tolerance: 0.8, note: 'Trades the headline, wants a tight market' },
  { id: clientNote(1), type: 'uninformed', patience: 22, tolerance: 1.15, note: 'Firm quote requested, client is on the line' },
  { id: clientNote(2), type: 'informed', patience: 12, tolerance: 0.75, note: 'Crosses the spread when the news hits' },
  { id: clientNote(3), type: 'uninformed', patience: 24, tolerance: 1.2, note: 'Client wants a two-way market' },
  { id: clientNote(4), type: 'informed', patience: 16, tolerance: 0.85, note: 'Working an order around the print' },
  { id: clientNote(5), type: 'uninformed', patience: 20, tolerance: 1.1, note: 'Spread-sensitive account, quote tight' },
]

export interface Scenario {
  id: string
  name: string
  blurb: string
  /** 这一局的新闻池；每局从中随机抽 newsCount 条 */
  news: NewsPool
  /** 每局最多抽几条；实际数量还会被难度档的 headlineCount 限制 */
  newsCount: number
  spreadMultiplier?: number
  liquidityMultiplier?: number
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'classic',
    name: 'Classic',
    blurb: 'Mixed macro and single-name headlines — the standard practice tape.',
    news: classicNews,
    newsCount: 12,
  },
  {
    id: 'fomc',
    name: 'FOMC day',
    blurb: 'One central-bank decision drives everything; the whole board re-rates.',
    news: fomcNews,
    newsCount: 12,
    spreadMultiplier: 1.4,
  },
  {
    id: 'earnings',
    name: 'Earnings surprise',
    blurb: 'Single-name earnings gaps — quote the print, manage the inventory.',
    news: earningsNews,
    newsCount: 12,
  },
  {
    id: 'crash',
    name: 'Risk-off crash',
    blurb: 'Wide spreads, thin books, a tape that fights back — survive first.',
    news: crashNews,
    newsCount: 12,
    spreadMultiplier: 2.2,
    liquidityMultiplier: 0.55,
  },
  {
    id: 'squeeze',
    name: 'Short squeeze',
    blurb: 'A crowded short unwinds, then fades — chase with care.',
    news: squeezeNews,
    newsCount: 12,
    spreadMultiplier: 1.6,
    liquidityMultiplier: 0.75,
  },
  {
    id: 'merger',
    name: 'Merger tape',
    blurb: 'Takeover chatter, counter-bids and regulatory risk in two names.',
    news: mergerNews,
    newsCount: 12,
    spreadMultiplier: 1.3,
    liquidityMultiplier: 0.95,
  },
  {
    id: 'rebalance',
    name: 'Index rebalance',
    blurb: 'Passive flows, closing imbalances and a thin late book.',
    news: rebalanceNews,
    newsCount: 12,
    spreadMultiplier: 1.15,
    liquidityMultiplier: 1.1,
  },
  {
    id: 'geopolitics',
    name: 'Energy shock',
    blurb: 'A supply route closes; the whole board reprices around energy.',
    news: geopoliticsNews,
    newsCount: 12,
    spreadMultiplier: 1.8,
    liquidityMultiplier: 0.7,
  },
  {
    id: 'credit',
    name: 'Credit scare',
    blurb: 'Funding stress propagates — liquidity is the only thing that matters.',
    news: creditNews,
    newsCount: 12,
    spreadMultiplier: 1.9,
    liquidityMultiplier: 0.65,
  },
  {
    id: 'launch',
    name: 'Product launch',
    blurb: 'A big reveal, a pricing decision and a wave of analyst first looks.',
    news: launchNews,
    newsCount: 12,
    spreadMultiplier: 1.2,
    liquidityMultiplier: 0.95,
  },
]

export function scenarioById(id: string | undefined | null): Scenario {
  if (!id) return SCENARIOS[0]
  return SCENARIOS.find((scenario) => scenario.id === id) ?? SCENARIOS[0]
}

export const DEFAULT_SCENARIO = SCENARIOS[0]

const KINDS: NewsKind[] = ['macro', 'note', 'equity']

const copy = (value: unknown, field: string): NewsCopy | { error: string } => {
  if (typeof value === 'string' && value.trim()) return { en: value.trim(), zh: value.trim() }
  if (value && typeof value === 'object') {
    const raw = value as Record<string, unknown>
    const en = typeof raw.en === 'string' ? raw.en.trim() : ''
    const zh = typeof raw.zh === 'string' ? raw.zh.trim() : ''
    if (!en) return { error: `${field}.en is required.` }
    return { en, zh: zh || en }
  }
  return { error: `${field} is required.` }
}

/** 校验通过时原样返回，失败时给一句人话错误信息 */
function validateScenario(value: unknown): { scenario?: Scenario; error?: string } {
  if (!value || typeof value !== 'object') return { error: 'Scenario must be a JSON object.' }
  const raw = value as Record<string, unknown>
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Custom'
  const news = raw.news
  if (!Array.isArray(news) || news.length < 1) return { error: 'Scenario needs a non-empty "news" array.' }
  if (news.length > 40) return { error: 'Use at most 40 headlines per scenario.' }
  const parsedNews: NewsPool = []
  for (let index = 0; index < news.length; index += 1) {
    const item = news[index] as Record<string, unknown>
    const prefix = `news[${index}]`
    if (!item || typeof item !== 'object') return { error: `${prefix} must be an object.` }
    const kind = item.kind as NewsKind
    if (!KINDS.includes(kind)) return { error: `${prefix}.kind must be macro, note or equity.` }
    const impact = Number(item.impact)
    if (![1, 2, 3].includes(impact)) return { error: `${prefix}.impact must be 1, 2 or 3.` }
    const headline = copy(item.headline, `${prefix}.headline`)
    if ('error' in headline) return { error: headline.error }
    const short = copy(item.short, `${prefix}.short`)
    if ('error' in short) return { error: short.error }
    const detail = item.detail === undefined ? headline : copy(item.detail, `${prefix}.detail`)
    if ('error' in detail) return { error: detail.error }
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
    const template: NewsTemplate = {
      id: `custom-${index + 1}`,
      kind,
      tag: typeof item.tag === 'string' && item.tag.trim() ? item.tag.trim() : kind.toUpperCase(),
      impact: impact as 1 | 2 | 3,
      headline,
      short,
      detail,
      source: typeof item.source === 'string' && item.source.trim() ? item.source.trim() : 'custom scenario',
      direction: direction as 1 | -1 | undefined,
      symbol,
      driftBps,
    }
    parsedNews.push(template)
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
      newsCount: Math.min(parsedNews.length, 12),
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
  "blurb": "A quiet open, one update, one review.",
  "spreadMultiplier": 1.2,
  "liquidityMultiplier": 0.9,
  "news": [
    { "kind": "macro", "tag": "MACRO", "impact": 2,
      "headline": "Inflation data lands ahead of the consensus whisper",
      "short": "CPI print",
      "detail": "The release came early and the details are still being read. Desks are watching the front end for confirmation.",
      "source": "wire", "direction": 1, "driftBps": 60 },
    { "kind": "equity", "tag": "NFLX", "impact": 2,
      "headline": "A large broker revisits its Netflix model",
      "short": "NFLX review",
      "detail": "The note changes the target but keeps the rating. Flow has been two-way all morning.",
      "source": "broker round", "direction": 1, "symbol": "NFLX", "driftBps": 80 },
    { "kind": "equity", "tag": "DUOL", "impact": 2,
      "headline": "Duolingo subscriber adds draw a second look",
      "short": "DUOL adds",
      "detail": "The metric is directionally weaker than the whisper number, though the company has not confirmed the figure.",
      "source": "market colour", "direction": -1, "symbol": "DUOL", "driftBps": 90 }
  ]
}`
