import { ROLES } from '../roles.js'
import { factionColor } from '../view.js'

export function RoleName({ role, short = false }) {
  if (role === 'cleaned') return <span className="ts-role muted">🧼 Laundered</span>
  const r = ROLES[role]
  if (!r) return null
  return (
    <span className="ts-role" style={{ '--rc': factionColor(role) }} title={`${r.name} = ${r.classic}`}>
      {r.icon} {r.name}
      {!short && <span className="ts-classic"> ({r.classic})</span>}
    </span>
  )
}

export function Who({ p, num = true }) {
  return (
    <span className="who ts-who" style={{ '--c': p.color }}>
      {num && <span className="ts-who-num">{p.num}</span>}
      {p.name}
    </span>
  )
}

export function Clock({ ms }) {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  return <span className="mono">{sec}s</span>
}
