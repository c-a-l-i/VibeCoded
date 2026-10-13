import { ROLES } from '../roles.js'
import { factionColor } from '../view.js'
import { t, N } from '../../i18n/index.js'

export function RoleName({ role, short = false }) {
  if (role === 'cleaned') return <span className="ts-role muted">{t('salem.laundered')}</span>
  const r = ROLES[role]
  if (!r) return null
  return (
    <span className="ts-role" style={{ '--rc': factionColor(role) }} title={`${N.role(role)} = ${N.roleClassic(role)}`}>
      {r.icon} {N.role(role)}
      {!short && <span className="ts-classic"> ({N.roleClassic(role)})</span>}
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
  return <span className="mono">{t('salem.sec', { n: sec })}</span>
}
