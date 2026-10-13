// Bots for Town of Solana. Each bot reads the public record (claims, reported results, dead man's switches,
// trial votes) plus its own night results, forms an opinion of every player, and talks, votes and acts on it.
// Every function returns actions for the engine to apply; bots only write to their own memo directly.
import { ROLES, ROLE_KEYS, INV_GROUPS, COVERS, SLOTS, invGroup } from './roles.js'
import { living, isCabal, sameTeam, tally, votesNeeded, nightInfo, grave, blackmailed } from './rules.js'
import en from '../i18n/en.js'

const rand = (a, b) => a + Math.random() * (b - a)
const chance = (p) => Math.random() < p
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
function best(items, score) {
  let out = null
  let top = -Infinity
  for (const x of items) {
    const v = score(x)
    if (v > top) {
      top = v
      out = x
    }
  }
  return out
}

// ---------- lines ----------

// What bots say is a list of message parts (salem.msg.*) that every player reads in their own language.
// A pool part also carries which line `i` the bot picked; the English pools set how many lines there are.
const POOLS = en.salem.msg
const line = (k, v) => ({ k, i: Math.floor(Math.random() * POOLS[k].length), ...(v ? { v } : {}) })
const SAY = (pid, tr, data = null, room = 'town') => ({ type: 'SAY', pid, room, tr, data })

// ---------- alignment ----------

const TOWNISH = new Set(['survivor', 'amnesiac'])
export function mind(p) {
  if (ROLES[p.role].faction === 'town' || TOWNISH.has(p.role)) return 'town'
  if (p.role === 'executioner') return 'exe'
  if (p.role === 'jester') return 'jester'
  return 'evil'
}
const allied = (a, b) => a.id === b.id || sameTeam(a, b)

// How valuable a role is to the town (and so how badly evil wants it gone).
const POWER = {
  jailor: 4, mayor: 3, sheriff: 3.2, investigator: 3, lookout: 2.4, spy: 1.8, doctor: 2.4, bodyguard: 1.6, medium: 1.6,
  retributionist: 2.6, escort: 1.6, transporter: 1.2, vigilante: 2.2, vampireHunter: 2, veteran: -4, survivor: -1.5,
  amnesiac: 0, jester: -3, executioner: -1,
}
const VISITING = new Set(['doctor', 'bodyguard', 'lookout', 'sheriff', 'investigator', 'spy', 'escort', 'transporter', 'vampireHunter', 'vigilante'])
const REPORT_ROLE = { sus: 'sheriff', inno: 'sheriff', group: 'investigator', visitedDead: 'lookout' }

// ---------- reading the role list ----------

function capacity(s, role) {
  let n = 0
  for (const slot of s.list) if (slot === role || (SLOTS[slot] && SLOTS[slot].roles().includes(role))) n++
  return ROLES[role].unique ? Math.min(n, 1) : n
}

// Would claiming `role` put `t` over what the role list allows?
function overCapacity(s, t, role, at = Infinity) {
  const cap = capacity(s, role)
  if (cap === 0) return true
  const dead = s.graveyard.filter((g) => g.role === role && g.pid !== t).length
  const earlier = Object.entries(s.claims).filter(([pid, c]) => Number(pid) !== t && c.role === role && s.players[pid].alive && c.at < at).length
  return dead + earlier + 1 > cap
}

// ---------- opinions ----------

function noise(s, b, t) {
  let h = Math.imul(s.seed ^ Math.imul(b + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(t + 1, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2f)
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

function groupScore(s, g, t) {
  const roles = INV_GROUPS[g]
  const c = s.claims[t]?.role
  if (c) return roles.includes(c) ? 0.3 : -0.9
  const town = roles.filter((r) => ROLES[r].faction === 'town').length
  return town === 0 ? -0.6 : (town / roles.length - 0.5) * 0.5
}

function reportScore(s, rep, t) {
  switch (rep.kind) {
    case 'sus':
      return -0.7
    case 'inno':
      return 0.4
    case 'group':
      return groupScore(s, rep.value, t)
    case 'evil':
      return -0.85
    case 'town':
      return 0.5
    case 'visitedDead':
      return VISITING.has(s.claims[t]?.role) ? -0.25 : -0.5
    case 'accuse':
      return -0.1
    case 'vouch':
      return 0.07
    default:
      return 0
  }
}

function claimScore(s, t) {
  const c = s.claims[t]
  if (!c) return s.asks.some((a) => a.target === t && a.day < s.day) ? -0.2 : 0
  let w = ROLES[c.role].faction === 'town' ? 0.12 : TOWNISH.has(c.role) ? 0 : -0.9
  if (c.role === 'mayor' && !s.players[t].revealed) w -= 0.45
  if (overCapacity(s, t, c.role, c.at)) w -= 0.55
  else if (overCapacity(s, t, c.role)) w -= 0.4
  if (s.claimLog.filter((x) => x.pid === t).length > 1) w -= 0.6
  return w
}

// Reports by t that the Burn Address has since proven right or wrong.
function liarScore(s, t) {
  let w = 0
  for (const rep of s.reports) {
    if (rep.by !== t) continue
    const g = grave(s, rep.target)
    if (!g || !g.role) continue
    const r = ROLES[g.role]
    const town = r.faction === 'town'
    const caught = isCabal({ role: g.role }) && !r.detectImmune || g.role === 'serialKiller'
    switch (rep.kind) {
      case 'sus':
        w += town ? -0.5 : 0.15
        break
      case 'inno':
        w += caught ? -0.8 : town ? 0.1 : 0
        break
      case 'group':
        w += INV_GROUPS[rep.value].includes(g.role) ? 0.2 : -0.9
        break
      case 'evil':
        w += town ? -0.8 : 0.2
        break
      case 'town':
        w += town ? 0.1 : -0.7
        break
      case 'accuse':
        w += town ? -0.06 : 0.08
        break
      case 'vouch':
        w += town ? 0 : -0.15
        break
      default:
        break
    }
  }
  return w
}

function voteScore(s, t) {
  let w = 0
  for (const h of s.history) {
    const g = grave(s, h.accused)
    if (!g || !g.role) continue
    const town = ROLES[g.role].faction === 'town'
    const evil = !town && mind({ role: g.role }) === 'evil'
    if (h.innocent.includes(t)) w += evil ? -0.3 : town ? 0.05 : 0
    if (h.guilty.includes(t)) w += evil ? 0.1 : town ? -0.15 : 0
  }
  return w
}

function ownScore(s, B, t) {
  let w = 0
  for (const r of B.memo.results) {
    if (r.kind === 'visitors') {
      if (!r.value.includes(t)) continue
      const g = grave(s, r.target)
      if (g && g.when === 'night' && g.day === r.night) w += VISITING.has(s.claims[t]?.role) ? -0.25 : -0.6
      continue
    }
    if (r.target !== t) continue
    if (r.kind === 'sus') w -= 0.85
    else if (r.kind === 'inno') w += 0.5
    else if (r.kind === 'group') w += groupScore(s, r.value, t)
    else if (r.kind === 'vamp') w -= 1
  }
  for (const x of B.memo.relay) if (x.target === t) w += reportScore(s, x, t) * 0.8
  const jc = B.memo.jailClaims[t]
  if (jc && s.claims[t] && s.claims[t].role !== jc) w -= 0.6
  // Someone claiming my own one-of-a-kind role is lying, and I know it.
  if (mind(B) === 'town' && s.claims[t]?.role === B.role && capacity(s, B.role) <= 1) w -= 1.5
  return w
}

function baseTrust(s, b, t) {
  const B = b === null ? null : s.players[b]
  return (B ? noise(s, b, t) * 0.16 + ownScore(s, B, t) : 0) + claimScore(s, t) + liarScore(s, t) + voteScore(s, t)
}

function credibility(s, b, x) {
  const X = s.players[x]
  const k = b === null ? null : s.players[b].memo.known[x]
  if (k) return ROLES[k].faction === 'town' ? 1 : 0
  if (X.revealed) return 0.95
  if (!X.alive) {
    const g = grave(s, x)
    if (!g || !g.role) return 0.5
    return ROLES[g.role].faction === 'town' ? 0.95 : 0.05
  }
  return clamp(0.55 + 0.5 * baseTrust(s, b, x), 0.05, 1)
}

// -1 (surely evil) … +1 (surely town), from bot b's point of view. b = null reads the public record only.
export function opinion(s, b, t) {
  if (b === t) return 1
  const T = s.players[t]
  const k = b === null ? null : s.players[b].memo.known[t]
  if (k) return ROLES[k].faction === 'town' ? 0.9 : -1
  if (T.revealed) return 1
  let sc = baseTrust(s, b, t)
  const cred = {}
  for (const rep of s.reports) {
    if (rep.target !== t || rep.by === b || rep.by === t) continue
    cred[rep.by] ??= credibility(s, b, rep.by)
    const need = rep.relay ? 'medium' : REPORT_ROLE[rep.kind]
    const fit = !need || rep.as === need ? 1 : 0.35
    sc += reportScore(s, rep, t) * cred[rep.by] * fit
  }
  return clamp(sc, -1, 1)
}

// How much an evil bot wants t dead.
function threat(s, b, t) {
  const B = s.players[b]
  const T = s.players[t]
  let v = Math.random() * 1.2
  const c = B.memo.known[t] ?? s.claims[t]?.role
  if (c) v += POWER[c] ?? 0.4
  if (T.revealed) v += 3
  for (const rep of s.reports)
    if (rep.by === t && ['sus', 'accuse', 'group', 'evil', 'visitedDead'].includes(rep.kind) && allied(B, s.players[rep.target])) v += 1.5
  const po = opinion(s, null, t)
  v += po * 1.2
  if (po < -0.5) v -= 2
  // Someone keeps patching them? Hit somebody else for a while.
  for (const r of B.memo.results) if (r.kind === 'failed' && r.target === t && s.day - r.night <= 2) v -= 3
  return v
}

function protectValue(s, b, t) {
  const c = s.claims[t]?.role
  let v = Math.random() * 2
  if (c) v += POWER[c] ?? 0.5
  const op = opinion(s, b, t)
  if (op < -0.2) v -= 3
  v += op
  if (s.players[t].revealed) v += 1.5
  return v
}

// Has anyone pointed at b since b last answered?
function pressured(s, b) {
  const since = s.players[b].memo.answered
  return (
    s.asks.some((a) => a.target === b && a.id > since) ||
    s.reports.some((r) => r.target === b && r.id > since && ['accuse', 'sus', 'group', 'visitedDead', 'evil'].includes(r.kind))
  )
}
const underFire = (s, b) => opinion(s, null, b) < -0.25 || pressured(s, b)

// The longer nobody dies and the smaller the town, the less proof the town needs before it acts.
function urgency(s) {
  const n = living(s).length
  return clamp(s.quiet / 8 + (n <= 6 ? 0.25 : 0) + (n <= 4 ? 0.25 : 0) + Math.max(0, s.day - 6) * 0.05, 0, 1)
}

// ---------- claims and results ----------

function chooseFake(s, B) {
  const taken = (r) => Object.entries(s.claims).some(([pid, c]) => Number(pid) !== B.id && c.role === r && s.players[pid].alive)
  const fits = (r) => ROLES[r].faction === 'town' && !overCapacity(s, B.id, r) && !(ROLES[r].unique && taken(r))
  const prefs = (COVERS[B.role] ?? []).filter(fits)
  if (B.role === 'jester' && chance(0.5)) return pick(['jailor', 'mayor', 'sheriff'])
  if (prefs.length) return pick(prefs)
  const any = ROLE_KEYS.filter((r) => fits(r) && !ROLES[r].unique && r !== 'mayor')
  return any.length ? pick(any) : 'survivor'
}

// The role a bot says it is when asked.
function claimRole(s, B, { forced = false } = {}) {
  const k = mind(B)
  if (k === 'town') {
    if (B.role === 'jailor' && !forced && opinion(s, null, B.id) > -0.3) return null
    return B.role
  }
  if (s.claims[B.id]) return s.claims[B.id].role
  B.memo.fake ??= B.role === 'executioner' ? 'sheriff' : chooseFake(s, B)
  return B.memo.fake
}

// Invented results for a bot that claims an investigative role it doesn't have. Generated once per night and kept.
function fakeResults(s, B) {
  const m = B.memo
  const role = claimRole(s, B, { forced: true })
  const others = living(s).filter((p) => p.id !== B.id)
  for (let n = 1; n < s.day; n++) {
    if (m.fakeResults.some((r) => r.night === n)) continue
    const allies = others.filter((p) => allied(B, p))
    const outsiders = others.filter((p) => !allied(B, p))
    if (!outsiders.length) break
    const fresh = n === s.day - 1
    let r = null
    if (B.role === 'executioner' && B.target !== null && s.players[B.target].alive && n > 1 && role === 'sheriff') r = { kind: 'sus', target: B.target }
    else if (role === 'sheriff') {
      if (allies.length && chance(0.35)) r = { kind: 'inno', target: pick(allies).id }
      else {
        const t = fresh && chance(0.25) ? best(outsiders, (p) => -opinion(s, null, p.id)).id : pick(outsiders).id
        r = { kind: fresh && chance(0.25) ? 'sus' : 'inno', target: t }
      }
    } else if (role === 'investigator') {
      const t = pick(allies.length && chance(0.3) ? allies : outsiders)
      const c = s.claims[t.id]?.role
      const g = c ? invGroup(c) : chance(0.2) && !allied(B, t) ? invGroup('framer') : invGroup(pick(ROLE_KEYS.filter((x) => ROLES[x].faction === 'town')))
      r = { kind: 'group', target: t.id, value: g }
    } else if (role === 'lookout') r = { kind: 'visitors', target: pick(outsiders).id, value: [] }
    else if (ROLES[role]?.act?.pick && ['other', 'any', 'team'].includes(ROLES[role].act.pick)) r = { kind: 'did', target: pick(others).id }
    if (r) m.fakeResults.push({ night: n, ...r })
  }
  return m.fakeResults
}

// Roles that report who they visited ("N2: patched Bob").
const PAST = new Set(Object.keys(en.salem.msg.rDid))

// One result as a short line (a message part) plus the structured reports it makes.
function describe(s, role, r) {
  const v = { n: r.night, x: r.target }
  switch (r.kind) {
    case 'sus':
      return { imp: 3, part: { k: 'rSus', v }, reports: [{ kind: 'sus', target: r.target }] }
    case 'inno':
      return { imp: opinion(s, null, r.target) < -0.2 ? 2.2 : 0.8, part: { k: 'rClean', v }, reports: [{ kind: 'inno', target: r.target }] }
    case 'group': {
      const sc = groupScore(s, r.value, r.target)
      return { imp: sc < -0.3 ? 3 : 0.8, part: { k: 'rGroup', v: { ...v, inv: r.value } }, reports: [{ kind: 'group', target: r.target, value: r.value }] }
    }
    case 'visitors': {
      const g = grave(s, r.target)
      const died = g && g.when === 'night' && g.day === r.night
      return {
        imp: died && r.value.length ? 3 : 0.4,
        part: r.value.length ? { k: 'rWatched', v: { ...v, ps: r.value } } : { k: 'rWatchedNone', v },
        reports: died ? r.value.map((x) => ({ kind: 'visitedDead', target: x })) : [],
      }
    }
    case 'cabalVisits':
      return r.value.length ? { imp: 1, part: { k: 'rCabal', v: { n: r.night, ps: r.value } }, reports: [] } : null
    case 'vamp':
      return { imp: 3, part: { k: 'rMaxi', v }, reports: [{ kind: 'evil', target: r.target }] }
    case 'did':
      return PAST.has(role) && r.target !== undefined ? { imp: 0.3, part: { k: `rDid.${role}`, v }, reports: [] } : null
    default:
      return null
  }
}

function pending(s, B) {
  const town = mind(B) === 'town' || !B.isAI
  const role = town ? B.role : claimRole(s, B, { forced: true })
  const list = town ? B.memo.results : fakeResults(s, B)
  const out = []
  for (const r of list) {
    const key = `${r.night}:${r.kind}:${r.target}`
    if (B.memo.shared.includes(key)) continue
    const d = describe(s, role, r)
    if (d) out.push({ key, ...d })
  }
  for (const [i, x] of B.memo.relay.entries()) {
    const key = `relay:${i}`
    if (B.memo.shared.includes(key)) continue
    const k = { sus: 'relaySus', inno: 'relayClean', evil: 'relayEvil', visitedDead: 'relaySeen', group: 'relayGroup' }[x.kind]
    if (!k) continue
    const v = x.kind === 'group' ? { x: x.target, inv: x.value } : { x: x.target }
    out.push({ key, imp: 2.5, part: { k, v }, reports: [{ ...x, relay: true }] })
  }
  return out
}

// A claim plus results, as one chat message ({ tr, data }). Exported so humans get the same one-click "share my results".
export function claimMessage(s, pid, { defense = false, all = false, forced = false, keep = false } = {}) {
  const B = s.players[pid]
  B.memo.answered = s.nextId
  const role = B.isAI ? claimRole(s, B, { forced: forced || defense }) : B.role
  if (!role) return { tr: [line('noClaim')], data: null }
  const list = pending(s, B)
    .filter((x) => all || defense || x.imp >= 2 || !B.isAI)
    .slice(-5)
  if (!keep) B.memo.shared.push(...list.map((x) => x.key))
  const again = s.claims[pid]?.role === role && !defense
  const head = line(defense ? 'defend' : again ? 'update' : 'claim', { role })
  return {
    tr: [head, ...list.map((x) => x.part)],
    data: { claim: role, reports: list.flatMap((x) => x.reports) },
  }
}

// Dead man's switch, one message part per line, plus the reports it carries once revealed.
export function willFor(s, pid) {
  const B = s.players[pid]
  const town = mind(B) === 'town'
  const role = town || !B.isAI ? B.role : claimRole(s, B, { forced: true })
  const list = town || !B.isAI ? B.memo.results : fakeResults(s, B)
  const tr = [{ k: 'willRole', v: { roleIcon: role } }]
  const reports = []
  for (const r of list) {
    const d = describe(s, role, r)
    if (!d) continue
    tr.push(d.part)
    reports.push(...d.reports)
  }
  if (B.role === 'survivor') tr.push({ k: 'vestsUsed', v: { n: 4 - B.uses.vests } })
  return { tr, reports }
}

// ---------- start / phases ----------

export function onStart(s) {
  for (const p of s.players) {
    for (const q of s.players) if (q.id !== p.id && sameTeam(p, q)) p.memo.known[q.id] = q.role
  }
}

// Called as each day begins: the newly dead tell the dead chat what they knew.
export function dayStart(s) {
  const out = []
  for (const B of s.players) {
    if (!B.isAI || !B.alive) continue
    const w = willFor(s, B.id)
    B.willData = w.reports
    out.push({ type: 'WILL', pid: B.id, text: '', tr: w.tr })
  }
  for (const g of s.morning?.deaths ?? []) {
    const p = s.players[g.pid]
    if (!p.isAI) continue
    const w = willFor(s, p.id)
    const truth = mind(p) === 'town'
    const results = truth && w.reports.length ? w.tr.slice(1) : []
    out.push(SAY(p.id, [{ k: 'iWas', v: { role: p.role } }, ...results], truth ? { reports: w.reports } : null, 'dead'))
  }
  return out
}

export function beforeNight(s) {
  const out = []
  for (const B of s.players) {
    if (!B.isAI || !B.alive) continue
    if (B.role === 'jailor') {
      const t = jailPick(s, B)
      if (t !== null) out.push({ type: 'JAIL', pid: B.id, target: t })
    }
    const w = willFor(s, B.id)
    B.willData = w.reports
    out.push({ type: 'WILL', pid: B.id, text: '', tr: w.tr })
  }
  return out
}

function jailPick(s, B) {
  const b = B.id
  const others = living(s).filter((p) => p.id !== b && !p.revealed)
  if (!others.length) return null
  const sus = best(others, (p) => -opinion(s, b, p.id) + Math.random() * 0.2)
  if (opinion(s, b, sus.id) < -0.15) return sus.id
  if (chance(0.35)) return best(others, (p) => protectValue(s, b, p.id)).id
  const unknown = others.filter((p) => !s.claims[p.id] && !B.memo.jailClaims[p.id])
  return pick(unknown.length ? unknown : others).id
}

// ---------- day ticks ----------

const DELAYS = {
  day1: [[1, 9], [6, 15]],
  morning: [[1.5, 6], null],
  discussion: [[0.6, 6], [4, 11]],
  voting: [[1.5, 9], [3, 8]],
  defense: [[1.2, 2], [6, 9]],
  judgement: [[1.5, 9], [4, 9]],
  lastwords: [[0.8, 1.4], null],
  night: [[1, 3], [2.5, 5]],
}

export function tick(s, pace) {
  const out = []
  const d = DELAYS[s.phase]
  if (!d) return out
  for (const B of s.players) {
    if (!B.isAI) continue
    if (!B.alive && s.phase !== 'night') continue
    const b = B.id
    if (s.botAt[b] === undefined) {
      s.botAt[b] = rand(...d[0]) * 1000 * pace
      continue
    }
    if (s.clock < s.botAt[b]) continue
    s.botAt[b] = d[1] ? s.clock + rand(...d[1]) * 1000 * pace : Infinity
    out.push(...act(s, b))
  }
  return out
}

function act(s, b) {
  const B = s.players[b]
  switch (s.phase) {
    case 'day1':
    case 'discussion':
      return talk(s, b)
    case 'morning': {
      const d = s.morning?.deaths ?? []
      return d.length && chance(0.3) ? [SAY(b, [line('rip', { x: pick(d).pid })])] : []
    }
    case 'voting':
      return [...vote(s, b), ...(chance(0.35) ? talk(s, b) : [])]
    case 'defense':
      return s.trial?.accused === b && !B.memo.said[`def${s.day}:${s.trial.n}`] ? defense(s, b) : []
    case 'judgement':
      return judge(s, b)
    case 'lastwords':
      return s.trial?.accused === b ? lastWords(s, b) : []
    case 'night':
      return nightTalk(s, b)
    default:
      return []
  }
}

function talk(s, b) {
  const B = s.players[b]
  const m = B.memo
  const day = s.day
  const tk = `t${day}`
  m.said[tk] = (m.said[tk] ?? 0) + 1
  if (m.said[tk] > 7) return []
  if (blackmailed(s, b)) {
    if (m.said[`bm${day}`]) return []
    m.said[`bm${day}`] = 1
    return [SAY(b, [{ k: 'blackmailed' }])]
  }
  const k = mind(B)
  const live = living(s).filter((p) => p.id !== b)

  // The Whale reveals when it would help.
  if (B.role === 'mayor' && !B.revealed && day >= 2 && (underFire(s, b) || chance(0.3)))
    return [{ type: 'REVEAL', pid: b }, SAY(b, [line('whale')])]

  // Call out anyone faking my one-of-a-kind role.
  if (k === 'town' && capacity(s, B.role) <= 1) {
    const fake = live.find((p) => s.claims[p.id]?.role === B.role && !m.said[`cc${p.id}`])
    if (fake) {
      m.said[`cc${fake.id}`] = 1
      const msg = claimMessage(s, b, { forced: true, all: true })
      const data = { ...msg.data, reports: [...(msg.data?.reports ?? []), { kind: 'accuse', target: fake.id }] }
      return [SAY(b, [line('counter', { x: fake.id, role: B.role }), ...msg.tr.slice(1)], data)]
    }
  }

  // Answer whoever is asking (or voting).
  if (pressured(s, b) || (!s.claims[b] && tally(s)[b])) {
    if (!s.claims[b] || k === 'jester') {
      const forced = opinion(s, null, b) < -0.15 || day >= 3 || !!m.said[`nc${day}`]
      m.said[`nc${day}`] = 1
      const msg = claimMessage(s, b, { forced })
      return [SAY(b, msg.tr, msg.data)]
    }
    m.answered = s.nextId
    return [SAY(b, [line('again', { role: s.claims[b].role })])]
  }

  // Share fresh results.
  const news = pending(s, B)
  const big = news.filter((x) => x.imp >= 2)
  const wants = k === 'town' ? big.length && chance(0.9) : (k === 'evil' || k === 'exe') && big.length && day >= 2 && chance(0.35)
  if (wants && (k !== 'town' || B.role !== 'jailor')) {
    const msg = claimMessage(s, b)
    return [SAY(b, msg.tr, msg.data)]
  }

  if (k === 'town') {
    const scored = live.map((p) => [p.id, opinion(s, b, p.id)]).sort((x, y) => x[1] - y[1])
    const [t, v] = scored[0] ?? [null, 0]
    const pile = s.reports.filter((r) => r.target === t && r.day === day && r.kind === 'accuse').length
    if (t !== null && v < -0.45 && !m.said[`acc${day}:${t}`] && (pile < 3 || chance(0.3))) {
      m.said[`acc${day}:${t}`] = 1
      return [SAY(b, [line('accuse', { x: t })], { reports: [{ kind: 'accuse', target: t }] })]
    }
    const quiet = scored.filter(([x, o]) => !s.claims[x] && o < -0.1 && !s.players[x].revealed)
    if (quiet.length && chance(0.5) && !m.said[`ask${day}:${quiet[0][0]}`]) {
      m.said[`ask${day}:${quiet[0][0]}`] = 1
      return [SAY(b, [line('ask', { x: quiet[0][0] })], { asks: [quiet[0][0]] })]
    }
  } else if (k === 'evil') {
    const outs = live.filter((p) => !allied(B, p))
    const t = best(outs, (p) => -opinion(s, null, p.id))
    if (t && opinion(s, null, t.id) < -0.2 && chance(0.6) && !m.said[`acc${day}:${t.id}`]) {
      m.said[`acc${day}:${t.id}`] = 1
      return [SAY(b, [line('accuse', { x: t.id })], { reports: [{ kind: 'accuse', target: t.id }] })]
    }
    const pal = live.find((p) => p.id !== b && allied(B, p) && opinion(s, null, p.id) < -0.35)
    if (pal && chance(0.3) && !m.said[`vouch${day}:${pal.id}`]) {
      m.said[`vouch${day}:${pal.id}`] = 1
      return [SAY(b, [line('vouch', { x: pal.id })], { reports: [{ kind: 'vouch', target: pal.id }] })]
    }
    if (day >= 2 && chance(0.12)) {
      const r = pick(outs.filter((p) => !s.claims[p.id]).length ? outs.filter((p) => !s.claims[p.id]) : outs)
      if (r && !m.said[`acc${day}:${r.id}`]) {
        m.said[`acc${day}:${r.id}`] = 1
        return [SAY(b, [line('accuse', { x: r.id })], { reports: [{ kind: 'accuse', target: r.id }] })]
      }
    }
  } else if (k === 'exe' && B.target !== null && s.players[B.target].alive && day >= 2 && !m.said[`acc${day}:${B.target}`]) {
    m.said[`acc${day}:${B.target}`] = 1
    return [SAY(b, [line('accuse', { x: B.target })], { reports: [{ kind: 'accuse', target: B.target }] })]
  } else if (k === 'jester' && chance(0.4)) {
    if (!s.claims[b] && day >= 2 && chance(0.5)) {
      const msg = claimMessage(s, b)
      return [SAY(b, msg.tr, msg.data)]
    }
    return [SAY(b, [line('jesterTalk')])]
  }

  const p = day === 1 ? 0.55 : m.said[tk] <= 2 ? 0.2 : 0.06
  if (!chance(p)) return []
  // Small talk, skipping lines someone said recently.
  const k2 = day === 1 ? 'greet' : 'chatter'
  const recent = new Set(s.chat.slice(-30).map((x) => x.tr?.[0] && `${x.tr[0].k}:${x.tr[0].i}`))
  const fresh = POOLS[k2].map((_, i) => i).filter((i) => !recent.has(`${k2}:${i}`))
  return fresh.length ? [SAY(b, [{ k: k2, i: pick(fresh) }])] : []
}

function vote(s, b) {
  const B = s.players[b]
  const cur = s.votes[b] ?? null
  const t = tally(s)
  const need = votesNeeded(s)
  const others = living(s).filter((p) => p.id !== b)
  const k = mind(B)
  let target = null
  if (k === 'town') {
    const strict = (TOWNISH.has(B.role) ? -0.5 : -0.35) + urgency(s) * 0.6
    const scored = others.map((p) => [p.id, opinion(s, b, p.id)]).sort((x, y) => x[1] - y[1])
    const [w, v] = scored[0] ?? [null, 1]
    if (v < strict) target = w
    else if (v < -0.1 && (t[w] ?? 0) >= Math.ceil(need / 2)) target = w
  } else if (k === 'exe') {
    if (B.target !== null && s.players[B.target].alive) target = B.target
  } else if (k === 'jester') {
    if (chance(0.3)) target = pick(others)?.id ?? null
  } else {
    const outs = others.filter((p) => !allied(B, p))
    const piled = outs.filter((p) => t[p.id]).sort((x, y) => t[y.id] - t[x.id])
    if (piled.length && t[piled[0].id] >= Math.ceil(need / 3)) target = piled[0].id
    else {
      const w = best(outs, (p) => -opinion(s, null, p.id))
      if (w && opinion(s, null, w.id) < -0.25) target = w.id
    }
  }
  if (target === cur) return []
  if (target === null) return cur !== null && chance(0.4) ? [{ type: 'VOTE', pid: b, target: null }] : []
  return [{ type: 'VOTE', pid: b, target }]
}

function defense(s, b) {
  const B = s.players[b]
  B.memo.said[`def${s.day}:${s.trial.n}`] = 1
  if (blackmailed(s, b)) return []
  if (B.role === 'mayor' && !B.revealed) return [{ type: 'REVEAL', pid: b }, SAY(b, [{ k: 'whaleDefense' }])]
  if (B.role === 'jester') return [SAY(b, [line('jesterTalk')])]
  const msg = claimMessage(s, b, { defense: true })
  return [SAY(b, msg.tr, msg.data)]
}

// A bot's verdict on whoever is on trial: 'guilty' | 'innocent' | 'abstain'.
export function verdictFor(s, b) {
  const B = s.players[b]
  const acc = s.trial.accused
  const k = mind(B)
  if (k === 'town') {
    const v = opinion(s, b, acc)
    if (v < -0.2 + urgency(s) * 0.4) return 'guilty'
    if (v > 0.25) return 'innocent'
    return chance(0.5) ? 'abstain' : v < 0 ? 'guilty' : 'innocent'
  }
  if (k === 'exe') return acc === B.target ? 'guilty' : opinion(s, null, acc) < 0 ? 'guilty' : 'abstain'
  if (k === 'jester') return pick(['guilty', 'innocent', 'abstain'])
  if (allied(B, s.players[acc])) return opinion(s, null, acc) < -0.6 && chance(0.35) ? 'guilty' : 'innocent'
  return opinion(s, null, acc) > 0.5 ? 'abstain' : 'guilty'
}

function judge(s, b) {
  if (s.trial?.accused === b || s.judge[b]) return []
  const v = verdictFor(s, b)
  const out = [{ type: 'JUDGE', pid: b, verdict: v }]
  if (v !== 'abstain' && chance(0.15) && !blackmailed(s, b)) out.push(SAY(b, [line(v === 'guilty' ? 'saysGuilty' : 'saysInno')]))
  return out
}

function lastWords(s, b) {
  const B = s.players[b]
  if (blackmailed(s, b)) return []
  if (B.role === 'jester') return [SAY(b, [line('lastJester')])]
  if (mind(B) === 'town') return [SAY(b, [line('lastTown', { role: B.role })])]
  return [SAY(b, [line('lastEvil')])]
}

// ---------- night ----------

function nightTalk(s, b) {
  const B = s.players[b]
  const m = B.memo
  const j = s.jail
  if (!j) return []
  if (j.jailor === b && !m.said[`jq${s.day}`]) {
    m.said[`jq${s.day}`] = 1
    return [SAY(b, [line('jailAsk')], null, 'jail')]
  }
  const asked = s.chat.some((x) => x.room === 'jail' && x.day === s.day && x.from === j.jailor)
  if (j.prisoner === b && !m.said[`ja${s.day}`] && (asked || s.clock > 5000)) {
    m.said[`ja${s.day}`] = 1
    const msg = claimMessage(s, b, { forced: true, all: true, keep: true })
    return [SAY(b, msg.tr, msg.data, 'jail')]
  }
  return []
}

export function planNight(s) {
  const out = []
  const live = living(s)
  const bots = s.players.filter((p) => p.isAI && (p.alive || s.haunt?.jester === p.id))

  const cabal = live.filter(isCabal)
  let kill = null
  if (cabal.length) {
    const boss = cabal.find((p) => p.role === 'godfather') ?? cabal[0]
    const cands = live.filter((p) => !isCabal(p)).map((p) => p.id)
    kill = cands.length ? best(cands, (t) => threat(s, boss.id, t)) : null
  }
  let bite = null
  const vamps = live.filter((p) => p.role === 'vampire')
  if (vamps.length) {
    const cands = live.filter((p) => p.role !== 'vampire').map((p) => p.id)
    bite = best(cands, (t) => Math.random() + (s.claims[t] ? 0 : 0.5) - (s.claims[t]?.role === 'veteran' ? 3 : 0))
  }

  // Oracles read what the dead have shared.
  for (const B of bots) {
    if (B.role !== 'medium' || !B.alive) continue
    for (const msg of s.chat)
      if (msg.room === 'dead' && msg.id > B.memo.relayRead && msg.data?.reports)
        for (const r of msg.data.reports) if (s.players[r.target]?.alive) B.memo.relay.push({ kind: r.kind, target: r.target, value: r.value })
    B.memo.relayRead = s.nextId
  }

  const plans = {}
  for (const B of bots) {
    const a = nightChoice(s, B, { kill, bite })
    if (!a) continue
    plans[B.id] = a
    out.push({ type: 'NIGHT', pid: B.id, ...a })
  }

  // Cabal and Maxi group chats.
  const cabalBots = bots.filter((p) => p.alive && isCabal(p))
  const humanBoss = cabal.some((p) => p.role === 'godfather' && !p.isAI)
  for (const B of cabalBots) {
    const a = plans[B.id]
    const T = a?.t?.[0]
    const has = T !== undefined
    let plan = null
    if ((B.role === 'godfather' || (B.role === 'mafioso' && !cabal.some((p) => p.role === 'godfather'))) && kill !== null) plan = { k: 'planKill', v: { x: kill } }
    else if (B.role === 'mafioso' && humanBoss && kill !== null) plan = { k: 'planBoss', v: { x: kill } }
    else if (B.role === 'framer' && has) plan = { k: 'planFrame', v: { x: T } }
    else if (B.role === 'blackmailer' && has) plan = { k: 'planDox', v: { x: T } }
    else if (B.role === 'consort' && has) plan = { k: 'planShill', v: { x: T } }
    else if (B.role === 'janitor' && has) plan = { k: 'planLaunder', v: { x: T } }
    else if (B.role === 'forger' && has) plan = { k: 'planSpoof', v: { x: T } }
    else if (B.role === 'disguiser' && a) plan = { k: 'planDisguise', v: { x: a.t[0], y: a.t[1] } }
    else if (B.role === 'consigliere' && has) plan = { k: 'planSnoop', v: { x: T } }
    if (plan) out.push(SAY(B.id, [plan], null, 'cabal'))
    if (s.day === 1) out.push(SAY(B.id, [{ k: 'planCover', v: { role: claimRole(s, B, { forced: true }) } }], null, 'cabal'))
  }
  const youngest = [...vamps].sort((a, b) => b.vampAge - a.vampAge)[0]
  if (youngest?.isAI && bite !== null) out.push(SAY(youngest.id, [{ k: 'planBite', v: { x: bite } }], null, 'vamp'))
  return out
}

function nightChoice(s, B, { kill, bite }) {
  const info = nightInfo(s, B.id)
  if (!info.can) return null
  const b = B.id
  const T0 = info.targets[0] ?? []
  const one = (t) => (t === null || t === undefined ? null : { t: [t] })
  const by = (list, score) => (list.length ? best(list, score) : null)
  const checked = (t) => B.memo.results.some((r) => r.target === t && ['sus', 'inno', 'group', 'role', 'notVamp'].includes(r.kind))
  const investigate = (t) => {
    if (checked(t) || B.memo.known[t] || s.players[t].revealed) return -5 + Math.random()
    const op = mind(B) === 'town' ? opinion(s, b, t) : opinion(s, null, t)
    let v = Math.random()
    if (!s.claims[t]) v += 0.7
    if (op < -0.15) v += 0.9
    if (op > 0.6) v -= 1
    if (mind(B) !== 'town' && s.claims[t]) v += (POWER[s.claims[t].role] ?? 0) * 0.3
    return v
  }
  switch (B.role) {
    case 'sheriff':
    case 'investigator':
    case 'consigliere':
    case 'vampireHunter':
      return one(by(T0, investigate))
    case 'lookout':
    case 'spy':
      return one(by(T0, (t) => protectValue(s, b, t)))
    case 'doctor': {
      if (T0.includes(b) && underFire(s, b) && chance(0.6)) return one(b)
      return one(by(T0.filter((t) => t !== b), (t) => protectValue(s, b, t)))
    }
    case 'bodyguard': {
      if (T0.includes(b) && underFire(s, b) && chance(0.5)) return one(b)
      return one(by(T0.filter((t) => t !== b), (t) => protectValue(s, b, t)))
    }
    case 'escort': {
      const t = by(T0, (x) => -opinion(s, b, x) + Math.random() * 0.2)
      if (t !== null && opinion(s, b, t) < -0.25) return one(t)
      const meh = T0.filter((x) => opinion(s, b, x) < 0.4)
      return one(meh.length ? pick(meh) : null)
    }
    case 'transporter': {
      const v = by(T0.filter((t) => t !== b), (t) => protectValue(s, b, t))
      return v !== null && protectValue(s, b, v) > 2.6 && chance(0.6) ? { t: [b, v] } : null
    }
    case 'vigilante': {
      const t = by(T0, (x) => -opinion(s, b, x))
      if (t === null) return null
      const v = opinion(s, b, t)
      return v < -0.55 + urgency(s) * 0.4 || (v < -0.4 && s.day >= 4) ? one(t) : null
    }
    case 'veteran':
      return chance(s.day === 1 ? 0.45 : 0.3 + (s.claims[b] ? 0.35 : 0)) ? { t: [] } : null
    case 'survivor':
      return chance(s.day === 1 ? 0.25 : underFire(s, b) ? 0.85 : 0.35) ? { t: [] } : null
    case 'retributionist': {
      const t = by(T0, (x) => POWER[s.players[x].role] ?? 1)
      return t !== null && ((POWER[s.players[t].role] ?? 1) >= 2.4 || s.day >= 4) ? one(t) : null
    }
    case 'amnesiac':
      return s.day >= 2 && chance(0.6) ? one(by(T0, (x) => (ROLES[s.players[x].role].faction === 'town' ? 2 : 1) + Math.random())) : null
    case 'godfather':
    case 'mafioso':
      return one(kill !== null && T0.includes(kill) ? kill : T0.length ? pick(T0) : null)
    case 'framer':
      return one(by(T0.filter((x) => x !== kill), (x) => -opinion(s, null, x) + Math.random() * 0.6))
    case 'blackmailer':
      return one(by(T0.filter((x) => x !== kill), (x) => threat(s, b, x)))
    case 'consort':
      return one(by(T0.filter((x) => x !== kill), (x) => (POWER[B.memo.known[x] ?? s.claims[x]?.role] ?? 0.5) + Math.random()))
    case 'janitor':
      return kill !== null && T0.includes(kill) && threat(s, b, kill) > 2.4 ? one(kill) : null
    case 'forger':
      return kill !== null && T0.includes(kill) && threat(s, b, kill) > 2.4 && chance(0.7)
        ? { t: [kill], forgeRole: 'jester', forgeWill: '', forgeWillTr: [{ k: 'willRole', v: { roleIcon: 'jester' } }, { k: 'forgedLol' }] }
        : null
    case 'disguiser': {
      const killer = s.players.find((p) => p.alive && p.role === 'mafioso') ?? s.players.find((p) => p.alive && p.role === 'godfather')
      const pool = (info.targets[1] ?? []).filter((x) => x !== kill)
      return killer && pool.length ? { t: [killer.id, pick(pool)] } : null
    }
    case 'witch': {
      const x = by(T0, (t) => Math.random() + (['vigilante', 'veteran'].includes(s.claims[t]?.role) ? 1 : 0))
      const y = by((info.targets[1] ?? []).filter((t) => t !== b && t !== x), (t) => opinion(s, null, t) + Math.random() * 0.3)
      return x !== null && y !== null ? { t: [x, y] } : null
    }
    case 'arsonist': {
      const doused = living(s).filter((p) => p.id !== b && s.doused[p.id]).length
      const others = living(s).length - 1
      if (doused >= 3 || (doused >= 2 && s.day >= 4) || (doused >= 1 && doused >= others - 1)) return { t: [], ignite: true }
      const t = by(T0.filter((x) => !s.doused[x]), (x) => threat(s, b, x))
      return t === null ? (doused ? { t: [], ignite: true } : null) : one(t)
    }
    case 'serialKiller':
      return one(by(T0, (x) => threat(s, b, x)))
    case 'werewolf':
      if (chance(0.15) && T0.length > 4 && T0.includes(b)) return one(b)
      return one(by(T0.filter((x) => x !== b), (x) => protectValue(s, b, x) * 0.5 + threat(s, b, x)))
    case 'vampire':
      return one(bite !== null && T0.includes(bite) ? bite : null)
    case 'jester': {
      const guilty = new Set(s.history.at(-1)?.guilty ?? [])
      return one(by(T0, (x) => (guilty.has(x) ? 1 : 0) + Math.random()))
    }
    default:
      return null
  }
}

// Last call before the night resolves: a bot Custodian decides whether to liquidate.
export function endNight(s) {
  const j = s.jail
  if (!j) return []
  const J = s.players[j.jailor]
  if (!J.isAI || s.day < 2 || J.uses.executions <= 0) return []
  let v = opinion(s, J.id, j.prisoner)
  const jc = J.memo.jailClaims[j.prisoner]
  if (jc === undefined) v -= 0.3
  else {
    if (ROLES[jc].faction !== 'town' && !TOWNISH.has(jc)) v -= 1.2
    if (s.claims[j.prisoner] && s.claims[j.prisoner].role !== jc) v -= 0.7
    if (overCapacity(s, j.prisoner, jc)) v -= 0.5
  }
  const exec = v < -0.35 + urgency(s) * 0.5
  return [SAY(J.id, [line(exec ? 'jailExec' : 'jailSpare')], null, 'jail'), ...(exec ? [{ type: 'EXECUTE', pid: J.id, on: true }] : [])]
}

// A bot killer's calling card: a line from its pool, or null.
export function deathCard(role) {
  const k = isCabal({ role }) ? 'cardCabal' : { serialKiller: 'cardSerialKiller', arsonist: 'cardArsonist', werewolf: 'cardWerewolf' }[role]
  return k ? line(k) : null
}

// ---------- reading humans ----------

const escape = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const SUS_WORDS = /^(sus|suspicious|cabal|maf|mafia|evil|scum|bad|lying|liar|fake|rugger|vc|godfather|shady|guilty)\b/
const TOWN_WORDS = /^(town|clean|clear|cleared|inno|innocent|legit|good|confirmed|trusted|fine)\b/

// Pulls structured claims, accusations and questions out of free text so bots can react to humans.
export function parse(s, pid, text, asRole = null) {
  const low = ` ${text.toLowerCase().replace(/[’']/g, '')} `
  const out = { claim: null, reports: [], asks: [] }
  for (const key of ROLE_KEYS) {
    const names = [ROLES[key].name, ROLES[key].classic].map((n) => escape(n.toLowerCase().replace(/[’']/g, '')))
    for (const n of names) {
      const re = new RegExp(`\\b(im|i am|claim|claiming|im the|i am the|im a|im an)\\s+(the\\s+|a\\s+|an\\s+)?${n}\\b|\\b${n}\\s+here\\b`)
      if (re.test(low)) out.claim = key
    }
    if (out.claim) break
  }
  const role = asRole ?? out.claim ?? s.claims[pid]?.role
  for (const p of s.players) {
    if (p.id === pid) continue
    const ref = new RegExp(`(?:^|[^a-z0-9#])(?:${escape(p.name.toLowerCase())}|#?${p.num})(?![a-z0-9])`, 'g')
    let m
    while ((m = ref.exec(low))) {
      const after = low.slice(m.index + m[0].length).replace(/^[\s,:-]*(is|=|looks|seems|was|are)?\s*/, '')
      const before = low.slice(Math.max(0, m.index - 14), m.index + 1)
      if (SUS_WORDS.test(after)) out.reports.push({ kind: role === 'sheriff' ? 'sus' : 'accuse', target: p.id })
      else if (TOWN_WORDS.test(after)) out.reports.push({ kind: role === 'sheriff' ? 'inno' : 'vouch', target: p.id })
      else if (/(vote|slash|lynch|hang|kill|rug)\s*$/.test(before)) out.reports.push({ kind: 'accuse', target: p.id })
      if (/^\s*(claim|role|\?)/.test(after) || /claim\s*$/.test(before)) out.asks.push(p.id)
    }
  }
  return out.claim || out.reports.length || out.asks.length ? out : null
}
