import { useState } from 'react'
import type { Role } from './types'
import RoleSelect from './screens/RoleSelect'
import Terminal from './screens/Terminal'

const readRoleFromHash = (): Role | null => {
  const hash = window.location.hash.replace('#', '')
  return hash === 'sales' || hash === 'market-maker' ? hash : null
}

export default function App() {
  const [role, setRole] = useState<Role | null>(readRoleFromHash)

  return role ? (
    <Terminal role={role} onExit={() => setRole(null)} />
  ) : (
    <RoleSelect onSelect={setRole} />
  )
}
