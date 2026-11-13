import type { Side } from '../types'
import { nextRandom } from './rng'

/**
 * 流式智能体：10 个「人机」参与者。
 *
 * 它们不像真人那样把单挂在盘口上（那是 B 档的挂单式撮合），而是每隔几帧
 * 决定「买 / 卖 / 不动 + 数量」，引擎把这些净流量汇总成一个价格冲击，
 * 和新闻、微观流动一起推动价格。好处：
 * - 便宜：10 个（以后 100 个）都在同一帧里算完，纯前端毫秒级；
 * - 确定性：所有随机数都来自 state 里的 seeded RNG，回放和固定种子都成立；
 * - 可解释：每个 agent 的流量都会变成 PRICE TAPE 上的一条带名字的驱动。
 *
 * 每个 agent 有自己的现金、持仓和盈亏，所以在 FLOW 抽屉里能看到
 * 「谁在这个市场里赚钱、谁在挨打」。
 */

export type AgentArchetype = 'informed' | 'momentum' | 'value' | 'maker' | 'noise'

export interface AgentPosition {
  symbol: string
  qty: number
  avgPrice: number
}

export interface AgentState {
  id: string
  name: string
  archetype: AgentArchetype
  /** 0.2–1：决定下单量和出手频率 */
  aggression: number
  /** 每次出手的基础股数 */
  size: number
  cash: number
  startCash: number
  positions: AgentPosition[]
  lastAction: string | null
  lastActionTick: number
  nextActionAt: number
  /** 净库存的方向，给 UI 显示 LONG / SHORT / FLAT */
  posture: -1 | 0 | 1
}

/** 一帧里某个 agent 打出来的一笔主动单（我们只把它聚合成流量） */
export interface AgentFlow {
  symbol: string
  /** agent 自己的方向：BUY = 它主动买 */
  side: Side
  qty: number
  agentId: string
  agentName: string
  archetype: AgentArchetype
  /** 成交价（吃半个价差） */
  price: number
  /** 对价格的推动，基点（带符号，正 = 推高） */
  bps: number
}

export interface AgentMarketView {
  tick: number
  instruments: Array<{
    symbol: string
    last: number
    openPrice: number
    series: number[]
    lot: number
    spreadBps: number
  }>
  newsBias: Record<string, number>
}

export interface AgentStepResult {
  agents: AgentState[]
  flows: AgentFlow[]
  rng: number
}

const AGENT_TEMPLATES: Array<{
  name: string
  archetype: AgentArchetype
  size: number
  aggression: number
}> = [
  // 知情：跟着刚出的头条做
  { name: 'Sable', archetype: 'informed', size: 260, aggression: 0.85 },
  { name: 'Quill', archetype: 'informed', size: 220, aggression: 0.7 },
  { name: 'Cypher', archetype: 'informed', size: 240, aggression: 0.78 },
  { name: 'Oracle', archetype: 'informed', size: 200, aggression: 0.66 },
  { name: 'Whisper', archetype: 'informed', size: 180, aggression: 0.6 },
  { name: 'Compass', archetype: 'informed', size: 160, aggression: 0.52 },
  // 动量：追已经走出来的行情
  { name: 'Vector', archetype: 'momentum', size: 200, aggression: 0.8 },
  { name: 'Comet', archetype: 'momentum', size: 170, aggression: 0.62 },
  { name: 'Chase', archetype: 'momentum', size: 190, aggression: 0.72 },
  { name: 'Tempo', archetype: 'momentum', size: 150, aggression: 0.58 },
  { name: 'Arrow', archetype: 'momentum', size: 140, aggression: 0.5 },
  { name: 'Rocket', archetype: 'momentum', size: 130, aggression: 0.46 },
  // 价值：价格偏离开盘价就逆势接
  { name: 'Anchor', archetype: 'value', size: 240, aggression: 0.55 },
  { name: 'Ledger', archetype: 'value', size: 210, aggression: 0.5 },
  { name: 'Ballast', archetype: 'value', size: 220, aggression: 0.52 },
  { name: 'Merit', archetype: 'value', size: 180, aggression: 0.45 },
  { name: 'Stone', archetype: 'value', size: 160, aggression: 0.4 },
  { name: 'Prism', archetype: 'value', size: 140, aggression: 0.38 },
  // 做市：和短期波动做对手盘
  { name: 'Pylon', archetype: 'maker', size: 180, aggression: 0.9 },
  { name: 'Harbor', archetype: 'maker', size: 160, aggression: 0.75 },
  { name: 'Quarry', archetype: 'maker', size: 170, aggression: 0.8 },
  { name: 'Anvil', archetype: 'maker', size: 150, aggression: 0.7 },
  { name: 'Beacon', archetype: 'maker', size: 140, aggression: 0.62 },
  { name: 'Serif', archetype: 'maker', size: 120, aggression: 0.55 },
  // 噪音：随机交易，提供背景流量
  { name: 'Fizz', archetype: 'noise', size: 120, aggression: 0.65 },
  { name: 'Drift', archetype: 'noise', size: 100, aggression: 0.45 },
  { name: 'Buzz', archetype: 'noise', size: 110, aggression: 0.58 },
  { name: 'Static', archetype: 'noise', size: 90, aggression: 0.5 },
  { name: 'Wisp', archetype: 'noise', size: 80, aggression: 0.42 },
  { name: 'Echo', archetype: 'noise', size: 70, aggression: 0.36 },
]

/** 台面里的机器交易员数量：一起决定 FLOW 抽屉的 ACTIVE n/30 与测试口径 */
export const AGENT_COUNT = AGENT_TEMPLATES.length

export const AGENT_START_CASH = 1_000_000
const START_CASH = AGENT_START_CASH
/** 每个 agent 的持仓名义金额上限（相对起始资金），超了只能减仓 */
const MAX_GROSS_RATIO = 2.5
/** 一帧里单个 agent 最多推动多少基点，避免大单把价格打飞 */
const MAX_IMPACT_BPS = 3.5
const COOLDOWN_MIN = 6
const COOLDOWN_MAX = 16

const round2 = (value: number) => Math.round(value * 100) / 100

/** 价格带上的短标签：market maker 太长，窄屏会把 DRIVER 列挤断 */
export const ARCHETYPE_TAPE_LABELS: Record<AgentArchetype, string> = {
  informed: 'informed',
  momentum: 'momentum',
  value: 'value',
  maker: 'maker',
  noise: 'noise',
}

export const ARCHETYPE_LABELS: Record<AgentArchetype, string> = {
  informed: 'informed',
  momentum: 'momentum',
  value: 'value',
  maker: 'market maker',
  noise: 'noise',
}

/** 建 10 个 agent：名字/类型固定，激进度与首次出手时间用种子打散 */
export function createAgents(rng: number): [AgentState[], number] {
  let state = rng
  const agents: AgentState[] = []
  for (let index = 0; index < AGENT_TEMPLATES.length; index += 1) {
    const template = AGENT_TEMPLATES[index]
    const [jitter, afterJitter] = nextRandom(state)
    state = afterJitter
    const [offset, afterOffset] = nextRandom(state)
    state = afterOffset
    agents.push({
      id: `AI-${String(index + 1).padStart(2, '0')}`,
      name: template.name,
      archetype: template.archetype,
      aggression: round2(template.aggression * (0.8 + jitter * 0.4)),
      size: Math.max(40, Math.round((template.size * (0.8 + jitter * 0.4)) / 10) * 10),
      cash: START_CASH,
      startCash: START_CASH,
      positions: [],
      lastAction: null,
      lastActionTick: 0,
      /* 首次出手错开，避免开局 10 个人同时下单 */
      nextActionAt: 2 + Math.floor(offset * 16),
      posture: 0,
    })
  }
  return [agents, state]
}

function positionOf(agent: AgentState, symbol: string): AgentPosition | undefined {
  return agent.positions.find((position) => position.symbol === symbol)
}

function grossNotional(agent: AgentState, view: AgentMarketView): number {
  return agent.positions.reduce((total, position) => {
    const instrument = view.instruments.find((candidate) => candidate.symbol === position.symbol)
    return total + Math.abs(position.qty) * (instrument?.last ?? position.avgPrice)
  }, 0)
}

function netPosture(agent: AgentState, view: AgentMarketView): -1 | 0 | 1 {
  const net = agent.positions.reduce((total, position) => {
    const instrument = view.instruments.find((candidate) => candidate.symbol === position.symbol)
    return total + position.qty * (instrument?.last ?? position.avgPrice)
  }, 0)
  const threshold = agent.startCash * 0.05
  if (net > threshold) return 1
  if (net < -threshold) return -1
  return 0
}

/** 最近几根价格的变化（基点），用来给动量/均值回归判断 */
function recentMoveBps(instrument: AgentMarketView['instruments'][number], lookback = 6): number {
  const series = instrument.series
  if (series.length < 2) return 0
  const latest = series[series.length - 1]
  const past = series[Math.max(0, series.length - 1 - lookback)]
  if (past <= 0) return 0
  return ((latest - past) / past) * 10000
}

interface Idea {
  symbol: string
  side: Side
  qty: number
  /** 为什么出手，给 UI 的 lastAction 用 */
  reason: string
}

function pickInformed(agent: AgentState, view: AgentMarketView, roll: number): Idea | null {
  const ranked = Object.entries(view.newsBias)
    .filter(([, value]) => Math.abs(value) >= 6)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  if (ranked.length === 0) return null
  /* 越靠后的热名越可能被抽到，避免两个人永远追同一条新闻 */
  const index = Math.min(ranked.length - 1, Math.floor(roll * roll * ranked.length))
  const [symbol, bias] = ranked[index]
  const instrument = view.instruments.find((candidate) => candidate.symbol === symbol)
  if (!instrument) return null
  return {
    symbol,
    side: bias > 0 ? 'BUY' : 'SELL',
    qty: Math.round((agent.size * (1.4 + agent.aggression)) / 10) * 10,
    reason: 'news',
  }
}

function pickMomentum(agent: AgentState, view: AgentMarketView, roll: number): Idea | null {
  const scored = view.instruments
    .map((instrument) => ({ instrument, move: recentMoveBps(instrument) }))
    .filter((entry) => Math.abs(entry.move) >= 5)
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move))
  if (scored.length === 0) return null
  const index = Math.min(scored.length - 1, Math.floor(roll * roll * scored.length))
  const { instrument, move } = scored[index]
  return {
    symbol: instrument.symbol,
    side: move > 0 ? 'BUY' : 'SELL',
    qty: Math.round((agent.size * (0.8 + agent.aggression * 0.6)) / 10) * 10,
    reason: 'momentum',
  }
}

function pickValue(agent: AgentState, view: AgentMarketView, roll: number): Idea | null {
  const scored = view.instruments
    .map((instrument) => ({ instrument, gap: ((instrument.last - instrument.openPrice) / instrument.openPrice) * 10000 }))
    .filter((entry) => Math.abs(entry.gap) >= 20)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
  if (scored.length === 0) return null
  const index = Math.min(scored.length - 1, Math.floor(roll * roll * scored.length))
  const { instrument, gap } = scored[index]
  return {
    symbol: instrument.symbol,
    side: gap > 0 ? 'SELL' : 'BUY',
    qty: Math.round((agent.size * (0.9 + agent.aggression * 0.5)) / 10) * 10,
    reason: 'value',
  }
}

function pickMaker(agent: AgentState, view: AgentMarketView, roll: number): Idea | null {
  const scored = view.instruments
    .map((instrument) => ({ instrument, move: recentMoveBps(instrument, 3) }))
    .filter((entry) => Math.abs(entry.move) >= 3)
    .sort((a, b) => Math.abs(b.move) - Math.abs(a.move))
  if (scored.length === 0) return null
  const index = Math.min(scored.length - 1, Math.floor(roll * roll * scored.length))
  const { instrument, move } = scored[index]
  return {
    symbol: instrument.symbol,
    side: move > 0 ? 'SELL' : 'BUY',
    qty: Math.round((agent.size * (0.6 + agent.aggression * 0.4)) / 10) * 10,
    reason: 'make',
  }
}

function pickNoise(view: AgentMarketView, roll: number, sideRoll: number, size: number): Idea | null {
  if (view.instruments.length === 0) return null
  const instrument = view.instruments[Math.min(view.instruments.length - 1, Math.floor(roll * view.instruments.length))]
  return {
    symbol: instrument.symbol,
    side: sideRoll > 0.5 ? 'BUY' : 'SELL',
    qty: Math.max(10, Math.round((size * (0.4 + sideRoll * 0.9)) / 10) * 10),
    reason: 'flow',
  }
}

function executeIdea(
  agent: AgentState,
  idea: Idea,
  view: AgentMarketView,
): { agent: AgentState; flow: AgentFlow } | null {
  const instrument = view.instruments.find((candidate) => candidate.symbol === idea.symbol)
  if (!instrument) return null
  const halfSpread = (instrument.last * instrument.spreadBps) / 10000 / 2
  const price = round2(idea.side === 'BUY' ? instrument.last + halfSpread : instrument.last - halfSpread)
  const requested = Math.max(0, Math.round(idea.qty / 10) * 10)
  if (requested <= 0) return null

  const existing = positionOf(agent, idea.symbol)
  const oldQty = existing?.qty ?? 0
  const signedQty = idea.side === 'BUY' ? requested : -requested
  const proposedQty = oldQty + signedQty
  const reducing = oldQty !== 0 && Math.abs(proposedQty) < Math.abs(oldQty)

  let allowedQty = requested
  if (idea.side === 'BUY') {
    const affordable = Math.max(0, Math.floor(agent.cash / Math.max(0.01, price) / 10) * 10)
    allowedQty = Math.min(allowedQty, affordable)
  }
  /* 留 10% 缓冲：价格继续朝有利方向走时，持仓市值不会顶穿上限 */
  const headroom = agent.startCash * MAX_GROSS_RATIO * 0.9 - grossNotional(agent, view)
  if (!reducing && headroom > 0) {
    const byPosition = Math.max(0, Math.floor(headroom / Math.max(0.01, price) / 10) * 10)
    allowedQty = Math.min(allowedQty, byPosition)
  }
  if (!reducing && headroom <= 0) return null
  if (allowedQty < 10) return null

  const delta = idea.side === 'BUY' ? allowedQty : -allowedQty
  const nextCash = round2(agent.cash + (idea.side === 'BUY' ? -allowedQty * price : allowedQty * price))
  const positions = agent.positions.map((position) => ({ ...position }))
  const target = positions.find((position) => position.symbol === idea.symbol)
  if (!target) {
    positions.push({ symbol: idea.symbol, qty: delta, avgPrice: price })
  } else {
    const newQty = target.qty + delta
    if (target.qty !== 0 && Math.sign(newQty) !== Math.sign(target.qty)) {
      /* 反手：旧仓平掉，剩余按新方向以当前价开 */
      target.qty = newQty
      target.avgPrice = price
    } else if (Math.abs(newQty) > Math.abs(target.qty)) {
      target.avgPrice = round2(
        (target.avgPrice * Math.abs(target.qty) + price * allowedQty) / Math.abs(newQty),
      )
      target.qty = newQty
    } else {
      target.qty = newQty
    }
  }
  const cleaned = positions.filter((position) => position.qty !== 0)

  /* 流量 → 价格冲击：按「多少个 lot」折算，单笔最多 3.5bps */
  const lots = allowedQty / Math.max(10, instrument.lot)
  const impact = Math.min(MAX_IMPACT_BPS, Math.max(0.2, lots * 0.45)) * agent.aggression
  const bps = round2((idea.side === 'BUY' ? 1 : -1) * impact)

  const nextAgent: AgentState = {
    ...agent,
    cash: nextCash,
    positions: cleaned,
    lastAction: `${idea.side} ${allowedQty} ${idea.symbol} · ${idea.reason}`,
    lastActionTick: view.tick,
    posture: netPosture({ ...agent, positions: cleaned }, view),
  }

  return {
    agent: nextAgent,
    flow: {
      symbol: idea.symbol,
      side: idea.side,
      qty: allowedQty,
      agentId: agent.id,
      agentName: agent.name,
      archetype: agent.archetype,
      price,
      bps,
    },
  }
}

/** 推进一帧：每个到点的 agent 做一次决定，返回新的 agent 列表与这一帧的流量 */
export function stepAgents(agents: AgentState[], rng: number, view: AgentMarketView): AgentStepResult {
  let state = rng
  const nextAgents: AgentState[] = []
  const flows: AgentFlow[] = []

  for (const agent of agents) {
    if (view.tick < agent.nextActionAt) {
      nextAgents.push(agent)
      continue
    }
    const [roll, afterRoll] = nextRandom(state)
    state = afterRoll
    const [sideRoll, afterSide] = nextRandom(state)
    state = afterSide
    const [cooldownRoll, afterCooldown] = nextRandom(state)
    state = afterCooldown
    const [sizeRoll, afterSize] = nextRandom(state)
    state = afterSize

    let idea: Idea | null = null
    switch (agent.archetype) {
      case 'informed':
        idea = pickInformed(agent, view, roll)
        break
      case 'momentum':
        idea = pickMomentum(agent, view, roll)
        break
      case 'value':
        idea = pickValue(agent, view, roll)
        break
      case 'maker':
        idea = pickMaker(agent, view, roll)
        break
      default:
        idea = pickNoise(view, roll, sideRoll, agent.size * (0.7 + sizeRoll))
    }

    const executed = idea ? executeIdea(agent, idea, view) : null
    const cooldown = Math.round(COOLDOWN_MIN + cooldownRoll * (COOLDOWN_MAX - COOLDOWN_MIN))
    if (executed) {
      flows.push(executed.flow)
      nextAgents.push({ ...executed.agent, nextActionAt: view.tick + cooldown })
    } else {
      nextAgents.push({
        ...agent,
        posture: netPosture(agent, view),
        nextActionAt: view.tick + Math.max(2, Math.round(cooldown / 2)),
      })
    }
  }

  return { agents: nextAgents, flows, rng: state }
}

/** 把一帧里同一标的的流量合成一条驱动：净方向 + 净基点 + 最大那笔的标签 */
export interface AgentSymbolFlow {
  symbol: string
  bps: number
  label: string
  hint: string
  direction: 1 | -1
}

export function aggregateFlows(flows: AgentFlow[]): AgentSymbolFlow[] {
  const bySymbol = new Map<string, AgentFlow[]>()
  for (const flow of flows) {
    bySymbol.set(flow.symbol, [...(bySymbol.get(flow.symbol) ?? []), flow])
  }
  const aggregated: AgentSymbolFlow[] = []
  for (const [symbol, list] of bySymbol) {
    const bps = round2(list.reduce((total, flow) => total + flow.bps, 0))
    if (Math.abs(bps) < 0.05) continue
    const lead = [...list].sort((a, b) => Math.abs(b.bps) - Math.abs(a.bps))[0]
    const qty = list.reduce((total, flow) => total + flow.qty, 0)
    aggregated.push({
      symbol,
      bps,
      label: `${ARCHETYPE_TAPE_LABELS[lead.archetype]} ${bps > 0 ? 'buy' : 'sell'}`,
      hint: `${lead.agentName} + ${list.length - 1} more · ${qty} shares`,
      direction: bps > 0 ? 1 : -1,
    })
  }
  return aggregated
}

/** 给 FLOW 抽屉用的展示数据 */
export interface AgentView {
  id: string
  name: string
  archetype: AgentArchetype
  aggression: number
  posture: -1 | 0 | 1
  gross: number
  pnl: number
  lastAction: string | null
  lastActionTick: number
  /** 每个标的的持仓（只留非零） */
  holdings: Array<{ symbol: string; qty: number }>
}

export function agentViews(agents: AgentState[], view: AgentMarketView): AgentView[] {
  return agents.map((agent) => {
    const gross = grossNotional(agent, view)
    const marketValue = agent.positions.reduce((total, position) => {
      const instrument = view.instruments.find((candidate) => candidate.symbol === position.symbol)
      return total + position.qty * (instrument?.last ?? position.avgPrice)
    }, 0)
    return {
      id: agent.id,
      name: agent.name,
      archetype: agent.archetype,
      aggression: agent.aggression,
      posture: agent.posture,
      gross: round2(gross),
      pnl: round2(agent.cash + marketValue - agent.startCash),
      lastAction: agent.lastAction,
      lastActionTick: agent.lastActionTick,
      holdings: agent.positions.map((position) => ({ symbol: position.symbol, qty: position.qty })),
    }
  })
}

/** 这一帧里，谁最可能是接我们报价的对手方（按同方向的最大流量挑） */
export function findCounterparty(flows: AgentFlow[], symbol: string, clientSide: Side): string | null {
  const candidates = flows
    .filter((flow) => flow.symbol === symbol && flow.side === clientSide)
    .sort((a, b) => b.qty - a.qty)
  return candidates[0]?.agentName ?? null
}
