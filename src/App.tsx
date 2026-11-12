import { useState } from 'react'
import type { Role } from './types'
import RoleSelect from './screens/RoleSelect'
import SessionSetup from './screens/SessionSetup'
import Terminal from './screens/Terminal'
import type { OpeningPosition } from './engine/simulation'

const readRoleFromHash = (): Role | null => {
  const hash = window.location.hash.replace('#', '')
  return hash === 'sales' || hash === 'market-maker' ? hash : null
}

export default function App() {
  const hashRole = readRoleFromHash()
  const [role, setRole] = useState<Role | null>(hashRole)
  // 深链进来时跳过开局设置，直接从空仓开台（方便截图与分享布局）
  const [configured, setConfigured] = useState(hashRole !== null)
  const [openingBook, setOpeningBook] = useState<OpeningPosition[]>([])

  if (!role) {
    return (
      <RoleSelect
        onSelect={(nextRole) => {
          setRole(nextRole)
          setConfigured(false)
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
      onExit={() => {
        setConfigured(false)
        setRole(null)
        setOpeningBook([])
        window.location.hash = ''
      }}
    />
  )
}
