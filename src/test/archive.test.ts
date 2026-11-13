import { describe, expect, it } from 'vitest'
import {
  ARCHIVE_KEY,
  ARCHIVE_VERSION,
  SETTINGS_KEY,
  archiveStorageAvailable,
  clearSessions,
  emptyArchive,
  formatArchiveDate,
  makeSessionId,
  mergeArchives,
  parseArchiveJson,
  readArchive,
  readSettings,
  removeSession,
  serializeArchive,
  upsertSession,
  writeArchive,
  writeSettings,
} from '../storage/archive'
import type { ArchiveFile, ArchivedSession, StorageLike } from '../storage/archive'

/** 用 Map 模拟 localStorage，测试里不碰真实浏览器存储 */
class MapStorage implements StorageLike {
  private readonly items = new Map<string, string>()

  getItem(key: string): string | null {
    return this.items.has(key) ? (this.items.get(key) as string) : null
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }

  removeItem(key: string): void {
    this.items.delete(key)
  }
}

/** 永远写不进去的存储，用来测降级 */
const brokenStorage: StorageLike = {
  getItem: () => null,
  setItem: () => {
    throw new Error('quota exceeded')
  },
  removeItem: () => undefined,
}

const makeSession = (overrides: Partial<ArchivedSession> = {}): ArchivedSession => ({
  id: 'sales-1-classic-30-2026-11-13T06:05:00.000Z',
  savedAt: '2026-11-13T06:05:00.000Z',
  desk: 'sales',
  scenarioId: 'classic',
  scenarioName: 'Classic',
  minutes: 30,
  seed: 1,
  total: 1234,
  realised: 900,
  unrealised: 334,
  commission: -120,
  cash: 100000,
  benchmarkPnl: 800,
  alpha: 434,
  composite: 72.5,
  percentile: 84,
  trades: 12,
  quotes: 88,
  informedFills: 5,
  informedRfqs: 9,
  adverse: 2,
  missed: 3,
  worstDrawdown: 250,
  ...overrides,
})

const archiveWith = (sessions: ArchivedSession[]): ArchiveFile => ({
  ...emptyArchive(),
  sessions,
})

describe('archive constants', () => {
  it('uses the documented storage keys and version', () => {
    expect(ARCHIVE_KEY).toBe('market-sim.archive.v1')
    expect(SETTINGS_KEY).toBe('market-sim.settings.v1')
    expect(ARCHIVE_VERSION).toBe(1)
  })
})

describe('emptyArchive', () => {
  it('returns version 1, an ISO timestamp, no sessions and default settings', () => {
    const file = emptyArchive()
    expect(file.version).toBe(1)
    expect(Number.isNaN(Date.parse(file.updatedAt))).toBe(false)
    expect(file.sessions).toEqual([])
    expect(file.settings).toEqual({ language: 'en', minutes: 30, scenarioId: 'classic' })
  })
})

describe('readArchive / writeArchive', () => {
  it('round-trips a written archive', () => {
    const storage = new MapStorage()
    const file = archiveWith([
      makeSession({
        id: makeSessionId('sales', 7, 'classic', 30, '2026-11-13T06:05:00.000Z'),
        total: -250.5,
      }),
    ])
    writeArchive(file, storage)

    const restored = readArchive(storage)
    expect(restored).toEqual(file)
  })

  it('falls back to an empty archive when storage is empty', () => {
    const restored = readArchive(new MapStorage())
    expect(restored.version).toBe(ARCHIVE_VERSION)
    expect(restored.sessions).toEqual([])
  })

  it('falls back to an empty archive on broken JSON', () => {
    const storage = new MapStorage()
    storage.setItem(ARCHIVE_KEY, '{ this is not json')
    const restored = readArchive(storage)
    expect(restored.sessions).toEqual([])
    expect(restored.version).toBe(ARCHIVE_VERSION)
  })

  it('falls back to an empty archive when the stored file has the wrong version', () => {
    const storage = new MapStorage()
    storage.setItem(
      ARCHIVE_KEY,
      JSON.stringify({ version: 2, updatedAt: new Date().toISOString(), sessions: [] }),
    )
    expect(readArchive(storage).sessions).toEqual([])
  })

  it('does not throw when the storage itself throws', () => {
    expect(() => readArchive(brokenStorage)).not.toThrow()
    expect(readArchive(brokenStorage).sessions).toEqual([])
    expect(() => writeArchive(emptyArchive(), brokenStorage)).not.toThrow()
  })
})

describe('readSettings / writeSettings', () => {
  it('returns the defaults when nothing has been stored', () => {
    expect(readSettings(new MapStorage())).toEqual({
      language: 'en',
      minutes: 30,
      scenarioId: 'classic',
    })
  })

  it('round-trips written settings and ignores broken JSON', () => {
    const storage = new MapStorage()
    writeSettings({ language: 'zh', minutes: 15, scenarioId: 'momentum' }, storage)
    expect(readSettings(storage)).toEqual({
      language: 'zh',
      minutes: 15,
      scenarioId: 'momentum',
    })

    storage.setItem(SETTINGS_KEY, 'not json')
    expect(readSettings(storage)).toEqual({ language: 'en', minutes: 30, scenarioId: 'classic' })
  })
})

describe('upsertSession', () => {
  it('prepends the newest session', () => {
    const older = makeSession({ id: 'older', savedAt: '2026-11-12T10:00:00.000Z' })
    const newer = makeSession({ id: 'newer', savedAt: '2026-11-13T10:00:00.000Z' })

    const file = upsertSession(archiveWith([older]), newer)
    expect(file.sessions.map((session) => session.id)).toEqual(['newer', 'older'])
  })

  it('deduplicates by id instead of appending a second copy', () => {
    const original = makeSession({ id: 'same', total: 100 })
    const updated = makeSession({
      id: 'same',
      total: 999,
      savedAt: '2026-11-13T11:00:00.000Z',
    })

    const file = upsertSession(archiveWith([original]), updated)
    expect(file.sessions).toHaveLength(1)
    expect(file.sessions[0]?.total).toBe(999)
  })

  it('keeps at most 100 sessions, dropping the oldest', () => {
    let file = emptyArchive()
    for (let index = 0; index < 101; index += 1) {
      file = upsertSession(
        file,
        makeSession({
          id: `session-${index}`,
          savedAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
        }),
      )
    }
    expect(file.sessions).toHaveLength(100)
    expect(file.sessions.some((session) => session.id === 'session-0')).toBe(false)
    expect(file.sessions[0]?.id).toBe('session-100')
  })

  it('stamps a fresh updatedAt', () => {
    const file = archiveWith([])
    const before = Date.parse(file.updatedAt)
    const next = upsertSession(file, makeSession())
    expect(Date.parse(next.updatedAt)).toBeGreaterThanOrEqual(before)
  })
})

describe('removeSession / clearSessions', () => {
  it('removes only the matching id', () => {
    const keep = makeSession({ id: 'keep' })
    const drop = makeSession({ id: 'drop' })
    const file = removeSession(archiveWith([drop, keep]), 'drop')
    expect(file.sessions.map((session) => session.id)).toEqual(['keep'])
  })

  it('clears every session but keeps settings', () => {
    const file: ArchiveFile = {
      ...archiveWith([makeSession()]),
      settings: { language: 'zh', minutes: 5, scenarioId: 'momentum' },
    }
    const cleared = clearSessions(file)
    expect(cleared.sessions).toEqual([])
    expect(cleared.settings).toEqual({ language: 'zh', minutes: 5, scenarioId: 'momentum' })
  })
})

describe('serializeArchive / parseArchiveJson', () => {
  it('accepts a valid serialized archive', () => {
    const file = archiveWith([makeSession()])
    const parsed = parseArchiveJson(serializeArchive(file))
    expect(parsed.error).toBeUndefined()
    expect(parsed.file).toEqual(file)
  })

  it('rejects a session with a missing required field', () => {
    const file = archiveWith([makeSession()])
    const raw = JSON.parse(serializeArchive(file)) as Record<string, unknown>
    const sessions = raw.sessions as Array<Record<string, unknown>>
    const first = sessions[0]
    if (first) delete first.total

    const parsed = parseArchiveJson(JSON.stringify(raw))
    expect(parsed.file).toBeUndefined()
    expect(parsed.error).toContain('total')
  })

  it('rejects a mismatched version', () => {
    const file = archiveWith([])
    const parsed = parseArchiveJson(JSON.stringify({ ...file, version: 2 }))
    expect(parsed.file).toBeUndefined()
    expect(parsed.error).toMatch(/version/i)
  })

  it('never throws on garbage input', () => {
    expect(() => parseArchiveJson('')).not.toThrow()
    expect(parseArchiveJson('').file).toBeUndefined()
    expect(parseArchiveJson('null').error).toBeDefined()
    expect(parseArchiveJson('[]').error).toBeDefined()
  })
})

describe('mergeArchives', () => {
  it('deduplicates by id and keeps the newer copy', () => {
    const older = makeSession({
      id: 'shared',
      savedAt: '2026-11-12T10:00:00.000Z',
      total: 100,
    })
    const newer = makeSession({
      id: 'shared',
      savedAt: '2026-11-13T10:00:00.000Z',
      total: 500,
    })
    const onlyB = makeSession({ id: 'only-b', savedAt: '2026-11-11T10:00:00.000Z' })

    const merged = mergeArchives(
      {
        version: 1,
        updatedAt: '2026-11-12T10:00:00.000Z',
        sessions: [older],
        settings: { language: 'en', minutes: 30, scenarioId: 'classic' },
      },
      {
        version: 1,
        updatedAt: '2026-11-13T10:00:00.000Z',
        sessions: [newer, onlyB],
        settings: { language: 'zh', minutes: 15, scenarioId: 'momentum' },
      },
    )

    expect(merged.sessions).toHaveLength(2)
    expect(merged.sessions[0]?.id).toBe('shared')
    expect(merged.sessions[0]?.total).toBe(500)
    expect(merged.sessions[1]?.id).toBe('only-b')
    expect(merged.updatedAt).toBe('2026-11-13T10:00:00.000Z')
    expect(merged.settings.language).toBe('zh')
  })
})

describe('archiveStorageAvailable', () => {
  it('returns true for a working storage and cleans up the probe key', () => {
    const storage = new MapStorage()
    expect(archiveStorageAvailable(storage)).toBe(true)
    expect(storage.getItem(`${ARCHIVE_KEY}.probe`)).toBeNull()
  })

  it('returns false when the storage throws', () => {
    expect(archiveStorageAvailable(brokenStorage)).toBe(false)
  })
})

describe('formatArchiveDate', () => {
  it('formats an ISO timestamp as local `YYYY-MM-DD HH:mm`', () => {
    expect(formatArchiveDate('2026-11-13T06:05:00.000Z')).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/,
    )
  })

  it('returns a placeholder for invalid input', () => {
    expect(formatArchiveDate('nope')).toBe('--')
  })
})
