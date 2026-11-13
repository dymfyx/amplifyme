/**
 * 同机跨浏览器的「共享存档文件」支持（File System Access API）。
 *
 * 思路：
 *   1. 用户用 showOpenFilePicker / showSaveFilePicker 选一个本地 JSON 文件；
 *   2. 把 FileSystemFileHandle 存进 IndexedDB（handle 可以跨会话复用，但文件内容不会）；
 *   3. 之后每次保存存档时请求一次 readwrite 权限，直接写回同一个文件。
 *
 * 只有 Chromium 系浏览器支持 File System Access API；其余浏览器里所有函数都安全降级：
 * 返回 null / false，或抛出一句可读的错误。
 */

export const HANDLE_DB = 'market-sim'
export const HANDLE_STORE = 'handles'
export const HANDLE_KEY = 'archive-file'

/** 选文件对话框里展示的过滤器 */
const PICKER_TYPES = [
  { description: 'JSON archive', accept: { 'application/json': ['.json'] } },
]

/** 写回时若用户没选文件，给一个默认文件名 */
const SUGGESTED_NAME = 'market-sim-archive.json'

interface PickerOptions {
  multiple?: boolean
  excludeAcceptAllOption?: boolean
  suggestedName?: string
  types?: typeof PICKER_TYPES
}

/** lib.dom.d.ts 里还没有 File System Access API 的 picker，这里补上最小类型 */
interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker?: (options?: PickerOptions) => Promise<FileSystemFileHandle>
}

/** queryPermission / requestPermission 不在 FileSystemHandle 的标准类型里 */
interface PermissionCapableHandle extends FileSystemFileHandle {
  queryPermission?: (descriptor?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<PermissionState>
  requestPermission?: (descriptor?: {
    mode?: 'read' | 'readwrite'
  }) => Promise<PermissionState>
}

const getPickerWindow = (): FilePickerWindow | null => {
  if (typeof window === 'undefined') return null
  const pickerWindow = window as FilePickerWindow
  const canOpen = typeof pickerWindow.showOpenFilePicker === 'function'
  const canSave = typeof pickerWindow.showSaveFilePicker === 'function'
  return canOpen || canSave ? pickerWindow : null
}

/** 浏览器是否支持 File System Access API 的选文件 / 保存文件对话框 */
export const supportsSharedFile = (): boolean => getPickerWindow() !== null

const hasIndexedDb = (): boolean => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/** 打开（必要时创建）存放 handle 的小数据库 */
const openHandleDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB is not available in this browser.'))
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(HANDLE_DB, 1)
    } catch {
      reject(new Error('Could not open IndexedDB storage.'))
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB storage.'))
    request.onblocked = () => reject(new Error('IndexedDB storage is blocked by another tab.'))
  })

const isFileHandle = (value: unknown): value is FileSystemFileHandle => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { kind?: unknown; name?: unknown }
  return candidate.kind === 'file' && typeof candidate.name === 'string'
}

/** 从 IndexedDB 读回上次选择的文件句柄；没有 / 不支持时返回 null */
export async function loadFileHandle(): Promise<FileSystemFileHandle | null> {
  if (!hasIndexedDb()) return null
  let db: IDBDatabase | null = null
  try {
    db = await openHandleDatabase()
    return await new Promise<FileSystemFileHandle | null>((resolve) => {
      const transaction = db!.transaction(HANDLE_STORE, 'readonly')
      const request = transaction.objectStore(HANDLE_STORE).get(HANDLE_KEY)
      request.onsuccess = () => resolve(isFileHandle(request.result) ? request.result : null)
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  } finally {
    db?.close()
  }
}

/** 记住用户选择的文件句柄；失败时静默（下次重新选一次即可） */
export async function saveFileHandle(handle: FileSystemFileHandle): Promise<void> {
  if (!hasIndexedDb()) return
  let db: IDBDatabase | null = null
  try {
    db = await openHandleDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(HANDLE_STORE, 'readwrite')
      transaction.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Could not store the archive file handle.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Archive handle write aborted.'))
    })
  } catch {
    // 句柄只是「下次少点一步」的便利，存不进去不影响当前这次链接
  } finally {
    db?.close()
  }
}

/** 忘掉已链接的文件句柄；失败时静默 */
export async function clearFileHandle(): Promise<void> {
  if (!hasIndexedDb()) return
  let db: IDBDatabase | null = null
  try {
    db = await openHandleDatabase()
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(HANDLE_STORE, 'readwrite')
      transaction.objectStore(HANDLE_STORE).delete(HANDLE_KEY)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('Could not clear the archive file handle.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Archive handle delete aborted.'))
    })
  } catch {
    // 忽略：即使 IndexedDB 失败，界面上也已经按「未链接」处理
  } finally {
    db?.close()
  }
}

/**
 * 让用户挑一个存档 JSON 文件。
 * 优先用打开对话框；浏览器只给了保存对话框时退而求其次（不存在就新建）。
 * 用户取消选择时返回 null（而不是抛取消异常）。
 */
export async function pickArchiveFile(): Promise<FileSystemFileHandle | null> {
  const pickerWindow = getPickerWindow()
  if (!pickerWindow) return null
  try {
    if (typeof pickerWindow.showOpenFilePicker === 'function') {
      const handles = await pickerWindow.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: PICKER_TYPES,
      })
      return handles[0] ?? null
    }
    if (typeof pickerWindow.showSaveFilePicker === 'function') {
      return await pickerWindow.showSaveFilePicker({
        suggestedName: SUGGESTED_NAME,
        types: PICKER_TYPES,
      })
    }
  } catch {
    // AbortError（用户取消）或其他浏览器错误：都当作没选
    return null
  }
  return null
}

/** 读取链接文件里的原始文本 */
export async function readArchiveHandle(handle: FileSystemFileHandle): Promise<string> {
  try {
    const file = await handle.getFile()
    return await file.text()
  } catch {
    throw new Error('Could not read the linked archive file.')
  }
}

/** 把整份存档文本写回链接文件（整体覆盖） */
export async function writeArchiveHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  try {
    const writable = await handle.createWritable()
    await writable.write(text)
    await writable.close()
  } catch {
    throw new Error('Could not write to the linked archive file.')
  }
}

/**
 * 请求链接文件的 readwrite 权限。
 * 先查再请求：已经授权时不会弹窗；API 缺失或用户拒绝都返回 false。
 */
export async function requestHandlePermission(
  handle: FileSystemFileHandle,
): Promise<boolean> {
  const capable = handle as PermissionCapableHandle
  if (typeof capable.queryPermission === 'function') {
    try {
      const state = await capable.queryPermission({ mode: 'readwrite' })
      if (state === 'granted') return true
    } catch {
      // 查询失败就继续尝试请求权限
    }
  }
  if (typeof capable.requestPermission === 'function') {
    try {
      const state = await capable.requestPermission({ mode: 'readwrite' })
      return state === 'granted'
    } catch {
      return false
    }
  }
  return false
}
