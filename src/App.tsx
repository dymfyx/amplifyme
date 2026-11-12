import { useState } from 'react'
import type { Role } from './types'
import RoleSelect from './screens/RoleSelect'
import SessionSetup from './screens/SessionSetup'
import Terminal from './screens/Terminal'
import type { OpeningPosition } from './engine/simulation'

interface DeepLink {
  role: Role
  /** 带 ?seed=123456 时全组练同一道题；没带就是随机新局 */
  seed: number | null
}

/**
 * 支持三种深链：
 *   #sales / #market-maker                      空仓直接开台
 *   #sales?seed=20261112 / #market-maker?seed=… 固定种子（同一道题，可重放）
 */
const readDeepLink = (): DeepLink | null => {
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return null
  const [path, query = ''] = raw.split('?')
  if (path !== 'sales' && path !== 'market-maker') return null
  const seedParam = new URLSearchParams(query).get('seed')
  const parsed = seedParam && /^\d{1,9}$/.test(seedParam) ? Number(seedParam) : null
  return { role: path, seed: parsed }
}

export default function App() {
  const deepLink = readDeepLink()
  const [role, setRole] = useState<Role | null>(deepLink?.role ?? null)
  // 深链进来时跳过开局设置，直接从空仓开台（方便截图与分享布局）
  const [configured, setConfigured] = useState(deepLink !== null)
  const [openingBook, setOpeningBook] = useState<OpeningPosition[]>([])
  const [seed, setSeed] = useState<number | null>(deepLink?.seed ?? null)

  if (!role) {
    return (
      <RoleSelect
        onSelect={(nextRole) => {
          setRole(nextRole)
          setConfigured(false)
          setSeed(null)
        }}
      />
    )
  }

  if (!configured) {
    return (
      <SessionSetup
        role={role}
        onStart={(book) => {
          setOpeningBook(book)
          setConfigured(true)
        }}
        onBack={() => setRole(null)}
      />
    )
  }

  return (
    <Terminal
      role={role}
      openingBook={openingBook}
      seed={seed}
      onExit={() => {
        setConfigured(false)
        setRole(null)
        setOpeningBook([])
        setSeed(null)
        window.location.hash = ''
      }}
    />
  )
}
