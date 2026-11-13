import { useCallback, useEffect, useRef, useState } from 'react'
import {
  archiveStorageAvailable,
  clearSessions,
  emptyArchive,
  mergeArchives,
  parseArchiveJson,
  removeSession,
  readArchive,
  readSettings,
  serializeArchive,
  upsertSession,
  writeArchive,
  writeSettings,
  type ArchiveFile,
  type ArchivedSession,
  type ArchiveSettings,
} from '../storage/archive'
import {
  clearFileHandle,
  loadFileHandle,
  pickArchiveFile,
  readArchiveHandle,
  requestHandlePermission,
  saveFileHandle,
  supportsSharedFile,
  writeArchiveHandle,
} from '../storage/shared-file'

export interface ArchiveApi {
  file: ArchiveFile
  /** localStorage 是否可用（隐私模式/被禁用时为 false） */
  available: boolean
  /** 浏览器是否支持 File System Access，用于同机跨浏览器共用存档 */
  sharedSupported: boolean
  /** 已链接的共享存档文件名 */
  sharedLabel: string | null
  busy: boolean
  addSession: (session: ArchivedSession) => void
  deleteSession: (id: string) => void
  clearAll: () => void
  importText: (text: string) => string
  linkSharedFile: () => Promise<void>
  unlinkSharedFile: () => Promise<void>
  settings: ArchiveSettings
  saveSettings: (patch: Partial<ArchiveSettings>) => void
}

const labelFor = (handle: FileSystemFileHandle): string => handle.name

/**
 * 把存档读写集中在一处：
 * - localStorage 永远是最新的主副本
 * - 链接了共享文件时，每次写入都会顺手覆盖那个 JSON 文件（同机换浏览器共用）
 */
export function useArchive(): ArchiveApi {
  const [file, setFile] = useState<ArchiveFile>(() => readArchive())
  const [settings, setSettings] = useState<ArchiveSettings>(() => readSettings())
  const [sharedLabel, setSharedLabel] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const handleRef = useRef<FileSystemFileHandle | null>(null)

  // 启动时恢复上次链接的共享存档文件
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const handle = await loadFileHandle()
      if (!handle || cancelled) return
      handleRef.current = handle
      setSharedLabel(labelFor(handle))
      try {
        const text = await readArchiveHandle(handle)
        if (!text || cancelled) return
        const parsed = parseArchiveJson(text)
        if (!parsed.file) return
        const merged = mergeArchives(readArchive(), parsed.file)
        writeArchive(merged)
        if (!cancelled) setFile(merged)
      } catch {
        // 权限被回收或文件被删时保持本地副本，不打扰用户
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const pushToShared = useCallback(async (next: ArchiveFile) => {
    const handle = handleRef.current
    if (!handle) return
    try {
      await writeArchiveHandle(handle, serializeArchive(next))
    } catch {
      // 写入失败时 localStorage 仍然是最新的，用户在下次链接时可以重新同步
    }
  }, [])


  const addSession = useCallback(
    (session: ArchivedSession) => {
      setFile((current) => {
        const next = upsertSession(current, session)
        writeArchive(next)
        void pushToShared(next)
        return next
      })
    },
    [pushToShared],
  )

  const deleteSession = useCallback(
    (id: string) => {
      setFile((current) => {
        const next = removeSession(current, id)
        writeArchive(next)
        void pushToShared(next)
        return next
      })
    },
    [pushToShared],
  )

  const clearAll = useCallback(() => {
    setFile((current) => {
      const next = clearSessions(current)
      writeArchive(next)
      void pushToShared(next)
      return next
    })
  }, [pushToShared])

  const importText = useCallback(
    (text: string): string => {
      const parsed = parseArchiveJson(text)
      if (!parsed.file) return parsed.error ?? 'Could not read this archive file.'
      setFile((current) => {
        const next = mergeArchives(current, parsed.file as ArchiveFile)
        writeArchive(next)
        void pushToShared(next)
        return next
      })
      return ''
    },
    [pushToShared],
  )

  const linkSharedFile = useCallback(async () => {
    setBusy(true)
    try {
      const handle = await pickArchiveFile()
      if (!handle) return
      const granted = await requestHandlePermission(handle)
      if (!granted) return
      handleRef.current = handle
      await saveFileHandle(handle)
      setSharedLabel(labelFor(handle))
      const text = await readArchiveHandle(handle).catch(() => '')
      let next = readArchive()
      if (text) {
        const parsed = parseArchiveJson(text)
        if (parsed.file) next = mergeArchives(next, parsed.file)
      }
      writeArchive(next)
      setFile(next)
      await pushToShared(next)
    } finally {
      setBusy(false)
    }
  }, [pushToShared])

  const unlinkSharedFile = useCallback(async () => {
    handleRef.current = null
    setSharedLabel(null)
    await clearFileHandle().catch(() => undefined)
  }, [])

  const saveSettings = useCallback((patch: Partial<ArchiveSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch }
      writeSettings(next)
      return next
    })
  }, [])

  return {
    file: file ?? emptyArchive(),
    available: archiveStorageAvailable(),
    sharedSupported: supportsSharedFile(),
    sharedLabel,
    busy,
    addSession,
    deleteSession,
    clearAll,
    importText,
    linkSharedFile,
    unlinkSharedFile,
    settings,
    saveSettings,
  }
}
