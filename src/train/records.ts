import type { DrillId } from './drills'

/** 训练模式的跨局记录：每个 drill 的尝试次数、通过次数与最好综合分 */
export interface DrillRecord {
  attempts: number
  passes: number
  /** 通过过的局里最高的综合分；没过也记录最好分，便于看进步 */
  bestComposite: number | null
  lastPlayedAt: string
}

export type DrillRecords = Record<string, DrillRecord>

export const DRILLS_KEY = 'market-sim.drills.v1'

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'> | undefined

const storageOf = (storage: StorageLike): StorageLike => {
  if (storage !== undefined) return storage
  return typeof window === 'undefined' ? undefined : window.localStorage
}

export const emptyDrillRecords = (): DrillRecords => ({})

export const readDrillRecords = (storage?: StorageLike): DrillRecords => {
  const target = storageOf(storage)
  if (!target) return emptyDrillRecords()
  try {
    const raw = target.getItem(DRILLS_KEY)
    if (!raw) return emptyDrillRecords()
    const parsed = JSON.parse(raw) as { version?: number; drills?: DrillRecords }
    if (!parsed || parsed.version !== 1 || !parsed.drills) return emptyDrillRecords()
    const clean: DrillRecords = {}
    for (const [id, record] of Object.entries(parsed.drills)) {
      if (!record || typeof record !== 'object') continue
      clean[id] = {
        attempts: Number(record.attempts) || 0,
        passes: Number(record.passes) || 0,
        bestComposite: record.bestComposite === null ? null : Number(record.bestComposite) || null,
        lastPlayedAt: typeof record.lastPlayedAt === 'string' ? record.lastPlayedAt : '',
      }
    }
    return clean
  } catch {
    return emptyDrillRecords()
  }
}

export const writeDrillRecords = (records: DrillRecords, storage?: StorageLike): void => {
  const target = storageOf(storage)
  if (!target) return
  try {
    target.setItem(DRILLS_KEY, JSON.stringify({ version: 1, drills: records }))
  } catch {
    // 存储满/被禁用时静默放弃：训练仍可继续，只是不留记录
  }
}

/** 一局结束后累加记录；返回更新后的整份记录，方便 UI 立刻刷新 */
export const recordDrillAttempt = (
  id: DrillId,
  passed: boolean,
  composite: number,
  storage?: StorageLike,
): DrillRecords => {
  const current = readDrillRecords(storage)
  const previous = current[id]
  const best =
    previous?.bestComposite === undefined || previous.bestComposite === null
      ? composite
      : Math.max(previous.bestComposite, composite)
  const next: DrillRecords = {
    ...current,
    [id]: {
      attempts: (previous?.attempts ?? 0) + 1,
      passes: (previous?.passes ?? 0) + (passed ? 1 : 0),
      bestComposite: best,
      lastPlayedAt: new Date().toISOString(),
    },
  }
  writeDrillRecords(next, storage)
  return next
}

export const recordFor = (records: DrillRecords, id: DrillId): DrillRecord | null => records[id] ?? null
