/**
 * 本地存档的纯逻辑层。
 *
 * 这里不依赖 React，只依赖一个极小的 `StorageLike` 接口（默认取 window.localStorage），
 * 因此可以在单元测试里用 Map 模拟存储，也可以在私密模式 / SSR 下安全降级。
 *
 * 约定的两个 key：
 *   - market-sim.archive.v1  -> ArchiveFile（sessions + settings 快照）
 *   - market-sim.settings.v1 -> ArchiveSettings（当前界面设置）
 */

export const ARCHIVE_KEY = 'market-sim.archive.v1'
export const SETTINGS_KEY = 'market-sim.settings.v1'
export const ARCHIVE_VERSION = 1

export type ArchiveDesk = 'sales' | 'market-maker'

export interface ArchivedSession {
  id: string
  savedAt: string
  desk: ArchiveDesk
  scenarioId: string
  scenarioName: string
  minutes: 5 | 15 | 30
  /** 难度档位 1-4（旧存档没有这个字段） */
  tier?: number
  seed: number
  total: number
  realised: number
  unrealised: number
  commission: number
  cash: number
  benchmarkPnl: number
  alpha: number
  composite: number
  percentile: number
  trades: number
  quotes: number
  informedFills: number
  informedRfqs: number
  adverse: number
  missed: number
  worstDrawdown: number
}

export interface ArchiveSettings {
  language: 'en' | 'zh'
  minutes: 5 | 15 | 30
  scenarioId: string
  /** 每个台面各自记住的难度档位 */
  tiers?: Record<ArchiveDesk, number>
}

export interface ArchiveFile {
  version: number
  updatedAt: string
  sessions: ArchivedSession[]
  settings: ArchiveSettings
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** 存档最多保留的场次；超过时丢掉最旧的 */
const MAX_SESSIONS = 100

/** 读写探针用的临时 key */
const PROBE_KEY = `${ARCHIVE_KEY}.probe`

const DEFAULT_TIERS: Record<ArchiveDesk, number> = { sales: 2, 'market-maker': 2 }

const DEFAULT_SETTINGS: ArchiveSettings = {
  language: 'en',
  minutes: 30,
  scenarioId: 'classic',
  tiers: { ...DEFAULT_TIERS },
}

type JsonRecord = Record<string, unknown>

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isNonNegativeInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 0

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

const isMinutes = (value: unknown): value is 5 | 15 | 30 =>
  value === 5 || value === 15 || value === 30

const isDesk = (value: unknown): value is ArchiveDesk =>
  value === 'sales' || value === 'market-maker'

const isLanguage = (value: unknown): value is 'en' | 'zh' => value === 'en' || value === 'zh'

/** 取默认 localStorage；取不到（无 window / 私密模式抛错）时返回 null */
const resolveStorage = (storage?: StorageLike): StorageLike | null => {
  if (storage) return storage
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** 深拷贝一份默认设置，避免调用方互相改到同一个对象 */
const copySettings = (settings: ArchiveSettings): ArchiveSettings => ({
  language: settings.language,
  minutes: settings.minutes,
  scenarioId: settings.scenarioId,
  tiers: { ...(settings.tiers ?? DEFAULT_TIERS) },
})

interface SettingsResult {
  settings?: ArchiveSettings
  error?: string
}

const validateSettings = (value: unknown): SettingsResult => {
  if (!isRecord(value)) return { error: 'Archive "settings" must be an object' }
  const language = value.language
  if (!isLanguage(language)) {
    return { error: 'Archive settings "language" must be "en" or "zh"' }
  }
  const minutes = value.minutes
  if (!isMinutes(minutes)) {
    return { error: 'Archive settings "minutes" must be 5, 15 or 30' }
  }
  const scenarioId = value.scenarioId
  if (!isNonEmptyString(scenarioId)) {
    return { error: 'Archive settings "scenarioId" must be a non-empty string' }
  }
  const tiers = validateTiers(value.tiers)
  if (!tiers) {
    return { error: 'Archive settings "tiers" must map both desks to a tier between 1 and 4' }
  }
  return { settings: { language, minutes, scenarioId, tiers } }
}

const isTierId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 4

/** 每台面的难度档位；旧存档没有这个字段时回落到默认档 */
const validateTiers = (value: unknown): Record<ArchiveDesk, number> | null => {
  if (value === undefined) return { ...DEFAULT_TIERS }
  if (!isRecord(value)) return null
  const sales = value.sales
  const maker = value['market-maker']
  if (!isTierId(sales) || !isTierId(maker)) return null
  return { sales, 'market-maker': maker }
}

interface SessionResult {
  session?: ArchivedSession
  error?: string
}

/** 会话里允许任意有限数值的字段（金额 / P&L 等） */
const SESSION_NUMBER_FIELDS = [
  'seed',
  'total',
  'realised',
  'unrealised',
  'commission',
  'cash',
  'benchmarkPnl',
  'alpha',
  'composite',
  'worstDrawdown',
] as const satisfies readonly (keyof ArchivedSession)[]

/** 会话里必须是非负整数的计数类字段 */
const SESSION_COUNT_FIELDS = [
  'trades',
  'quotes',
  'informedFills',
  'informedRfqs',
  'adverse',
  'missed',
] as const satisfies readonly (keyof ArchivedSession)[]

const validateSession = (value: unknown, index: number): SessionResult => {
  if (!isRecord(value)) return { error: `sessions[${index}] must be an object` }
  const where = `sessions[${index}]`

  const id = value.id
  if (!isNonEmptyString(id)) return { error: `${where}.id must be a non-empty string` }
  const savedAt = value.savedAt
  if (!isIsoTimestamp(savedAt)) {
    return { error: `${where}.savedAt must be an ISO date string` }
  }
  const desk = value.desk
  if (!isDesk(desk)) {
    return { error: `${where}.desk must be "sales" or "market-maker"` }
  }
  const scenarioId = value.scenarioId
  if (!isNonEmptyString(scenarioId)) {
    return { error: `${where}.scenarioId must be a non-empty string` }
  }
  const scenarioName = value.scenarioName
  if (typeof scenarioName !== 'string') {
    return { error: `${where}.scenarioName must be a string` }
  }
  const minutes = value.minutes
  if (!isMinutes(minutes)) {
    return { error: `${where}.minutes must be 5, 15 or 30` }
  }

  for (const field of SESSION_NUMBER_FIELDS) {
    if (!isFiniteNumber(value[field])) {
      return { error: `${where}.${field} must be a finite number` }
    }
  }
  for (const field of SESSION_COUNT_FIELDS) {
    if (!isNonNegativeInteger(value[field])) {
      return { error: `${where}.${field} must be a non-negative integer` }
    }
  }
  const percentile = value.percentile
  if (!isFiniteNumber(percentile) || percentile < 0 || percentile > 100) {
    return { error: `${where}.percentile must be a number between 0 and 100` }
  }

  return {
    session: {
      id,
      savedAt,
      desk,
      scenarioId,
      scenarioName,
      minutes,
      tier: isTierId(value.tier) ? value.tier : undefined,
      seed: value.seed as number,
      total: value.total as number,
      realised: value.realised as number,
      unrealised: value.unrealised as number,
      commission: value.commission as number,
      cash: value.cash as number,
      benchmarkPnl: value.benchmarkPnl as number,
      alpha: value.alpha as number,
      composite: value.composite as number,
      percentile,
      trades: value.trades as number,
      quotes: value.quotes as number,
      informedFills: value.informedFills as number,
      informedRfqs: value.informedRfqs as number,
      adverse: value.adverse as number,
      missed: value.missed as number,
      worstDrawdown: value.worstDrawdown as number,
    },
  }
}

export const emptyArchive = (): ArchiveFile => ({
  version: ARCHIVE_VERSION,
  updatedAt: new Date().toISOString(),
  sessions: [],
  settings: copySettings(DEFAULT_SETTINGS),
})

/**
 * 会话 id：由调用方在结束时用台面 / 种子 / 剧本 / 时长 / 收盘时刻拼出来。
 * 不使用 Math.random，保证同一场会话重复保存时能按 id 去重。
 */
export const makeSessionId = (
  desk: ArchiveDesk,
  seed: number,
  scenarioId: string,
  minutes: 5 | 15 | 30,
  closedLabel: string,
): string => `${desk}-${seed}-${scenarioId}-${minutes}-${closedLabel}`

export const serializeArchive = (file: ArchiveFile): string => JSON.stringify(file, null, 2)

export const parseArchiveJson = (text: string): { file?: ArchiveFile; error?: string } => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { error: 'Archive JSON is not valid JSON' }
  }
  if (!isRecord(raw)) return { error: 'Archive JSON must be a JSON object' }
  if (raw.version !== ARCHIVE_VERSION) {
    return { error: `Unsupported archive version: ${String(raw.version)} (expected ${ARCHIVE_VERSION})` }
  }
  if (!Array.isArray(raw.sessions)) return { error: 'Archive "sessions" must be an array' }

  const sessions: ArchivedSession[] = []
  for (let index = 0; index < raw.sessions.length; index += 1) {
    const result = validateSession(raw.sessions[index], index)
    if (!result.session) return { error: result.error }
    sessions.push(result.session)
  }

  const settingsResult = validateSettings(raw.settings)
  if (!settingsResult.settings) return { error: settingsResult.error }

  // updatedAt 缺失或坏掉时不拒绝整份存档，补一个当前时间即可
  const updatedAt = isIsoTimestamp(raw.updatedAt) ? raw.updatedAt : new Date().toISOString()

  return {
    file: {
      version: ARCHIVE_VERSION,
      updatedAt,
      sessions,
      settings: settingsResult.settings,
    },
  }
}

export const readArchive = (storage?: StorageLike): ArchiveFile => {
  const target = resolveStorage(storage)
  if (!target) return emptyArchive()
  try {
    const text = target.getItem(ARCHIVE_KEY)
    if (!text) return emptyArchive()
    const parsed = parseArchiveJson(text)
    return parsed.file ?? emptyArchive()
  } catch {
    return emptyArchive()
  }
}

export const writeArchive = (file: ArchiveFile, storage?: StorageLike): void => {
  const target = resolveStorage(storage)
  if (!target) return
  try {
    target.setItem(ARCHIVE_KEY, serializeArchive(file))
  } catch {
    // 存储满 / 被禁用时静默失败，界面可以继续用内存里的状态
  }
}

export const readSettings = (storage?: StorageLike): ArchiveSettings => {
  const target = resolveStorage(storage)
  if (target) {
    try {
      const text = target.getItem(SETTINGS_KEY)
      if (text) {
        const result = validateSettings(JSON.parse(text) as unknown)
        if (result.settings) return result.settings
      }
    } catch {
      // 坏 JSON 回退到存档里的设置 / 默认值
    }
  }
  return readArchive(storage).settings
}

export const writeSettings = (settings: ArchiveSettings, storage?: StorageLike): void => {
  const target = resolveStorage(storage)
  if (!target) return
  try {
    target.setItem(SETTINGS_KEY, JSON.stringify(copySettings(settings)))
    // 若已经有存档文件，顺手把快照里的 settings 同步过去，导出时不会带上旧设置
    const text = target.getItem(ARCHIVE_KEY)
    if (text) {
      const parsed = parseArchiveJson(text)
      if (parsed.file) {
        target.setItem(ARCHIVE_KEY, serializeArchive({ ...parsed.file, settings: copySettings(settings) }))
      }
    }
  } catch {
    // 忽略存储异常
  }
}

/** 按 id 去重后保存；最新 savedAt 的排最前，最多 100 条 */
export const upsertSession = (file: ArchiveFile, session: ArchivedSession): ArchiveFile => {
  const sessions = [session, ...file.sessions.filter((item) => item.id !== session.id)]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(0, MAX_SESSIONS)
  return {
    ...file,
    version: ARCHIVE_VERSION,
    updatedAt: new Date().toISOString(),
    sessions,
  }
}

export const removeSession = (file: ArchiveFile, id: string): ArchiveFile => ({
  ...file,
  version: ARCHIVE_VERSION,
  updatedAt: new Date().toISOString(),
  sessions: file.sessions.filter((session) => session.id !== id),
})

export const clearSessions = (file: ArchiveFile): ArchiveFile => ({
  ...file,
  version: ARCHIVE_VERSION,
  updatedAt: new Date().toISOString(),
  sessions: [],
})

/** 两份存档按 id 合并去重；重复 id 取 savedAt 较新的一条，顶层 updatedAt 取新 */
export const mergeArchives = (a: ArchiveFile, b: ArchiveFile): ArchiveFile => {
  const newer = a.updatedAt.localeCompare(b.updatedAt) >= 0 ? a : b
  const byId = new Map<string, ArchivedSession>()
  for (const session of a.sessions) byId.set(session.id, session)
  for (const session of b.sessions) {
    const existing = byId.get(session.id)
    if (!existing || session.savedAt.localeCompare(existing.savedAt) >= 0) {
      byId.set(session.id, session)
    }
  }
  const sessions = [...byId.values()]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, MAX_SESSIONS)
  return {
    version: ARCHIVE_VERSION,
    updatedAt: newer.updatedAt,
    sessions,
    settings: copySettings(newer.settings),
  }
}

/** 探针式检测：写一个临时 key、读回、删掉；任何一步抛错都视为不可用 */
export const archiveStorageAvailable = (storage?: StorageLike): boolean => {
  const target = resolveStorage(storage)
  if (!target) return false
  const probeValue = `${Date.now()}`
  try {
    target.setItem(PROBE_KEY, probeValue)
    const available = target.getItem(PROBE_KEY) === probeValue
    target.removeItem(PROBE_KEY)
    return available
  } catch {
    try {
      target.removeItem(PROBE_KEY)
    } catch {
      // 连清理都失败就放弃
    }
    return false
  }
}

/** `2026-11-13 14:05`，本地时区（存档里存的始终是 UTC ISO） */
export const formatArchiveDate = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '--'
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}
