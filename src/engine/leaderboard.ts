import { AGENT_START_CASH, type AgentArchetype, type AgentView } from './agents'
import { STARTING_CASH } from './simulation'
import type { ArchivedSession } from '../storage/archive'

/**
 * 结算榜单：把这一局放进「同一张台面的人机 + 你」里排个序，
 * 再把本地历史里分数最高的几局拉出来对照。
 * 纯前端：人机成绩来自当前对局，历史成绩来自 localStorage 存档。
 * 名次按「投入资本的百分比收益」排序，避免 $1M 的人机和 $20M 的你直接比美元。
 */
export interface LeaderboardEntry {
  kind: 'agent' | 'you'
  id: string
  name: string
  archetype?: AgentArchetype
  /** 这一局的美元盈亏 */
  pnl: number
  /** 相对投入资本的百分比收益 */
  returnPct: number
  isYou: boolean
}

export interface YouStanding {
  rank: number
  total: number
  returnPct: number
  pnl: number
}

export interface SessionLeaderboard {
  entries: LeaderboardEntry[]
  you: YouStanding
}

export interface HistoryEntry {
  id: string
  savedAt: string
  desk: 'sales' | 'market-maker'
  scenarioName: string
  tier: number
  minutes: number
  score: number
  alpha: number
  total: number
  isCurrent: boolean
}

export interface HistoryBoard {
  entries: HistoryEntry[]
  you: { rank: number; total: number } | null
}

const pct = (pnl: number, capital: number) =>
  capital > 0 ? Math.round((pnl / capital) * 10_000) / 100 : 0

const toHistoryEntry = (session: ArchivedSession, currentId: string | null): HistoryEntry => ({
  id: session.id,
  savedAt: session.savedAt,
  desk: session.desk,
  scenarioName: session.scenarioName,
  tier: session.tier ?? 2,
  minutes: session.minutes,
  score: session.composite,
  alpha: session.alpha,
  total: session.total,
  isCurrent: session.id === currentId,
})

const sortHistory = (a: HistoryEntry, b: HistoryEntry) =>
  b.score - a.score || b.alpha - a.alpha || (a.savedAt < b.savedAt ? 1 : -1)

/** 这一局：30 个人机 + 你，按投入资本的百分比收益排名 */
export function sessionLeaderboard(agents: AgentView[], playerPnl: number): SessionLeaderboard {
  const entries: LeaderboardEntry[] = agents.map((agent) => ({
    kind: 'agent',
    id: agent.id,
    name: agent.name,
    archetype: agent.archetype,
    pnl: agent.pnl,
    returnPct: pct(agent.pnl, AGENT_START_CASH),
    isYou: false,
  }))

  const you: LeaderboardEntry = {
    kind: 'you',
    id: 'you',
    name: 'You',
    pnl: playerPnl,
    returnPct: pct(playerPnl, STARTING_CASH),
    isYou: true,
  }

  const ranked = [...entries, you].sort(
    (a, b) => b.returnPct - a.returnPct || b.pnl - a.pnl || a.name.localeCompare(b.name),
  )
  const rank = ranked.findIndex((entry) => entry.isYou) + 1
  return { entries: ranked, you: { rank, total: ranked.length, returnPct: you.returnPct, pnl: you.pnl } }
}

/**
 * 历史榜：按 composite 排名（同分看 alpha），取前 limit 名；
 * 这一局还没写进存档，就先当作一条临时记录参与排名，结算后写档时 id 一致。
 */
export function historyLeaderboard(
  sessions: ArchivedSession[],
  current: ArchivedSession | null,
  limit = 8,
): HistoryBoard {
  const currentId = current?.id ?? null
  const entries = sessions
    .filter((session) => session.id !== currentId)
    .map((session) => toHistoryEntry(session, currentId))
  if (current) entries.push(toHistoryEntry(current, currentId))
  entries.sort(sortHistory)

  const currentIndex = entries.findIndex((entry) => entry.isCurrent)
  /* 这一局如果掉出前 limit，也要把这一行带上，免得「榜上无我」 */
  const cutoff = currentIndex >= 0 ? Math.max(limit, currentIndex + 1) : limit
  return {
    entries: entries.slice(0, cutoff),
    you: currentIndex >= 0 ? { rank: currentIndex + 1, total: entries.length } : null,
  }
}
