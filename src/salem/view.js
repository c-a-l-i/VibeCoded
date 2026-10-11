// What a given viewer is allowed to know, for the UI.
import { ROLES, FACTIONS } from './roles.js'
import { grave, sameTeam } from './rules.js'

// The role a viewer can see for a player: their own, teammates, intel, revealed Whales and the Burn Address.
// Returns a role key, 'cleaned' for a laundered death, or null if unknown.
export function knownRole(s, view, pid) {
  const p = s.players[pid]
  if (view === 'all' || pid === view) return p.role
  const V = typeof view === 'number' ? s.players[view] : null
  if (V && sameTeam(V, p)) return p.role
  if (V && V.memo.known[pid]) return V.memo.known[pid]
  if (!p.alive) {
    const g = grave(s, pid)
    if (g) return g.role ?? 'cleaned'
  }
  if (p.revealed) return 'mayor'
  return null
}

export const factionColor = (role) => (ROLES[role] ? FACTIONS[ROLES[role].faction].color : 'var(--muted)')
