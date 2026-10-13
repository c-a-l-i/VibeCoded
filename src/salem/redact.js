// What one seat may see of a Town of Solana game, for online play. The server sends each player only this,
// so nobody can read other roles, night actions or private chats out of the network traffic.
import { canSee, sameTeam } from './rules.js'

// Unknown players get a harmless placeholder role so shared helpers (isCabal, nightInfo…) keep working.
const MASK = 'survivor'
const blankMemo = () => ({
  results: [], known: {}, shared: [], fake: null, fakeResults: [], said: {}, jailClaims: {}, relay: [], relayRead: 0, answered: -1,
})

// The game state for `seat` (a player id, or null for a spectator), without chat or the clock.
export function viewFor(s, seat) {
  // nextId only changes with chat, which travels separately, so leaving it out avoids resending the state.
  const { chat: _chat, botAt: _botAt, seed: _seed, clock: _clock, nextId: _nextId, ...rest } = s
  if (s.phase === 'gameover') return rest
  const V = seat === null || seat === undefined ? null : s.players[seat]
  const own = (pid) => V !== null && pid === V.id
  const players = s.players.map((p) => {
    if (own(p.id)) return p
    const mate = V !== null && sameTeam(V, p)
    return {
      id: p.id, num: p.num, key: p.key, name: p.name, isAI: p.isAI, avatar: p.avatar, color: p.color,
      alive: p.alive, revealed: p.revealed,
      role: mate ? p.role : MASK, startRole: mate ? p.startRole : MASK, vampAge: mate ? p.vampAge : 0,
      will: '', willTr: null, willData: null, note: '', noteTr: null, uses: {}, target: null, won: false, guilt: false, barrier: false,
      memo: blankMemo(),
    }
  })
  const inJail = s.jail && V && (s.jail.jailor === V.id || s.jail.prisoner === V.id)
  const inSeance = s.seance && V && (s.seance.medium === V.id || s.seance.target === V.id)
  return {
    ...rest,
    players,
    actions: V && s.actions[V.id] ? { [V.id]: s.actions[V.id] } : {},
    jail: inJail ? { ...s.jail, jailor: own(s.jail.jailor) ? V.id : -1 } : null,
    jailPick: V?.role === 'jailor' ? s.jailPick : null,
    seance: inSeance ? { ...s.seance, medium: own(s.seance.medium) ? V.id : -1 } : null,
    seancePick: V && s.seancePick?.medium === V.id ? s.seancePick : null,
    framed: {},
    doused: V?.role === 'arsonist' ? s.doused : {},
    blackmailed: Object.fromEntries(Object.entries(s.blackmailed).filter(([, d]) => d <= s.day)),
    judge: Object.fromEntries(Object.entries(s.judge).map(([k, v]) => [k, own(Number(k)) ? v : 'hidden'])),
  }
}

// Chat lines `seat` may read with an id above `since`, with anonymous speakers stripped of their identity.
export function chatFor(s, seat, since = 0) {
  const view = s.phase === 'gameover' ? 'all' : (seat ?? null)
  const V = typeof view === 'number' ? s.players[view] : null
  const out = []
  for (const m of s.chat) {
    if (m.id <= since || !canSee(s, m, view)) continue
    out.push(view === 'all' ? m : scrub(s, m, V))
  }
  return out
}

function scrub(s, m, V) {
  const { data: _data, ...msg } = m
  const mine = (pid) => V !== null && pid === V.id
  const spoke = m.from !== null && m.from !== undefined
  // An anonymous speaker is shown by their role (the Custodian, a Maxi, the Oracle).
  const anon = (role) => ({ ...msg, from: undefined, anon: role })
  if (m.room === 'jail') {
    const out = { ...msg, jailor: mine(m.jailor) ? V.id : -1 }
    return spoke && m.from === m.jailor && !mine(m.jailor) ? { ...out, from: undefined, anon: 'jailor' } : out
  }
  if (m.room === 'vamp' && spoke && V?.role === 'vampireHunter') return anon('vampire')
  if (m.room === 'seance') {
    const out = { ...msg, medium: mine(m.medium) ? V.id : -1 }
    const F = spoke ? s.players[m.from] : null
    return F && F.alive && F.role === 'medium' && !mine(m.from) ? { ...out, from: undefined, anon: 'medium' } : out
  }
  if (m.room === 'dead' && spoke) {
    const F = s.players[m.from]
    if (F.alive && F.role === 'medium' && !mine(m.from)) return anon('medium')
  }
  return msg
}
