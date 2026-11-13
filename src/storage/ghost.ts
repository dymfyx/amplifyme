import type { Role } from '../types'

/**
 * 一个可以「带在身边」的单局记录：
 * - summary 足够做同题对比（分数、alpha、标签、档位）
 * - decisions 用来在对局结束后逐条看别人怎么下的
 *
 * 存成 JSON 文件，组里互相发就行，不需要后端。
 */
export interface GhostDecision {
  id: string
  tick: number
  time: string
  kind: 'quote' | 'fill' | 'decline'
  label: string
  detail: string
}

export interface GhostSummary {
  desk: Role
  scenarioName: string
  tier: number
  minutes: number
  seed: number
  composite: number
  percentile: number
  total: number
  alpha: number
  trades: number
  tags: string[]
}

export interface GhostSession {
  version: 1
  id: string
  savedAt: string
  summary: GhostSummary
  decisions: GhostDecision[]
}

export const GHOST_KEY = 'market-sim.ghost.v1'
export const GHOST_VERSION = 1

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function emptyGhost(): GhostSession | null {
  return null
}

export function buildGhost(
  summary: GhostSummary,
  decisions: GhostDecision[],
  savedAt: string = new Date().toISOString(),
): GhostSession {
  return {
    version: GHOST_VERSION,
    id: `GH-${summary.desk}-${summary.seed}-${Date.now()}`,
    savedAt,
    summary,
    /* 一局最多带 200 条决策，文件保持在几十 KB */
    decisions: decisions.slice(-200),
  }
}

export function serializeGhost(ghost: GhostSession): string {
  return JSON.stringify(ghost, null, 2)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function parseGhost(text: string): { ghost?: GhostSession; error?: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: 'That file is not valid JSON.' }
  }
  if (!raw || typeof raw !== 'object') return { error: 'That file does not contain a session.' }
  const record = raw as Record<string, unknown>
  const summary = record.summary as Record<string, unknown> | undefined
  if (!summary) return { error: 'That session has no summary to compare against.' }
  if (summary.desk !== 'sales' && summary.desk !== 'market-maker') {
    return { error: 'Session summary is missing its desk.' }
  }
  if (!isNumber(summary.composite) || !isNumber(summary.alpha)) {
    return { error: 'Session summary is missing score or alpha.' }
  }
  const decisions = Array.isArray(record.decisions) ? record.decisions : []
  const parsed: GhostSession = {
    version: GHOST_VERSION,
    id: typeof record.id === 'string' ? record.id : `GH-imported-${Date.now()}`,
    savedAt: typeof record.savedAt === 'string' ? record.savedAt : new Date().toISOString(),
    summary: {
      desk: summary.desk,
      scenarioName: typeof summary.scenarioName === 'string' ? summary.scenarioName : 'Classic',
      tier: isNumber(summary.tier) ? summary.tier : 2,
      minutes: isNumber(summary.minutes) ? summary.minutes : 30,
      seed: isNumber(summary.seed) ? summary.seed : 0,
      composite: summary.composite,
      percentile: isNumber(summary.percentile) ? summary.percentile : 0,
      total: isNumber(summary.total) ? summary.total : 0,
      alpha: summary.alpha,
      trades: isNumber(summary.trades) ? summary.trades : 0,
      tags: Array.isArray(summary.tags) ? summary.tags.filter((tag): tag is string => typeof tag === 'string') : [],
    },
    decisions: decisions
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry, index) => ({
        id: typeof entry.id === 'string' ? entry.id : `D-${index}`,
        tick: isNumber(entry.tick) ? entry.tick : 0,
        time: typeof entry.time === 'string' ? entry.time : '',
        kind:
          entry.kind === 'quote' || entry.kind === 'fill' || entry.kind === 'decline' ? entry.kind : 'fill',
        label: typeof entry.label === 'string' ? entry.label : '',
        detail: typeof entry.detail === 'string' ? entry.detail : '',
      })),
  }
  return { ghost: parsed }
}

export function readGhost(storage: StorageLike | null = safeStorage()): GhostSession | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(GHOST_KEY)
    if (!raw) return null
    return parseGhost(raw).ghost ?? null
  } catch {
    return null
  }
}

export function writeGhost(ghost: GhostSession, storage: StorageLike | null = safeStorage()): void {
  if (!storage) return
  try {
    storage.setItem(GHOST_KEY, JSON.stringify(ghost))
  } catch {
    /* 存不下就算了，文件本身还能手动导入 */
  }
}

export function clearGhost(storage: StorageLike | null = safeStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(GHOST_KEY)
  } catch {
    /* ignore */
  }
}
