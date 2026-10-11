// Core rules for Town of Solana: queries shared by the engine, the bots and the UI, plus night resolution.
import { ROLES, teamOf, invGroup, groupText, TEAM_NAMES } from './roles.js'

export const R = (p) => ROLES[p.role]
export const living = (s) => s.players.filter((p) => p.alive)
export const fullMoon = (s) => s.day % 2 === 0
export const isCabal = (p) => ROLES[p.role].faction === 'cabal'
export const sameTeam = (a, b) => {
  const t = teamOf(a.role)
  return (t === 'cabal' || t === 'vampire') && t === teamOf(b.role)
}
export const votesNeeded = (s) => Math.floor(living(s).length / 2) + 1
export const voteWeight = (p) => (p.revealed ? 3 : 1)
export const initUses = (role) => ({ ...(ROLES[role].uses ?? {}) })
export const grave = (s, pid) => s.graveyard.find((g) => g.pid === pid)
export const shownRole = (s, pid) => grave(s, pid)?.role ?? null

export function tally(s) {
  const t = {}
  for (const [v, x] of Object.entries(s.votes)) if (x !== null && x !== undefined) t[x] = (t[x] ?? 0) + voteWeight(s.players[v])
  return t
}

// ---------- chat ----------

export function post(s, msg) {
  s.chat.push({ id: s.nextId++, day: s.day, night: s.phase === 'night', ...msg })
}
export const sys = (s, text, extra = {}) => post(s, { room: 'system', text, ...extra })
export const tell = (s, pid, text, tone = 'info') => post(s, { room: 'private', to: pid, text, tone })

// Which chat rooms a player can read right now. `viewer` is a player id, or 'all' for spectators.
export function canSee(s, m, viewer) {
  if (viewer === 'all') return true
  if (viewer === null) return m.room === 'town' || m.room === 'system'
  const V = s.players[viewer]
  switch (m.room) {
    case 'town':
    case 'system':
      return true
    case 'private':
      return m.to === viewer
    case 'cabal':
      return isCabal(V)
    case 'vamp':
      return V.role === 'vampire' || V.role === 'vampireHunter'
    case 'jail':
      return m.jailor === viewer || m.prisoner === viewer
    case 'dead':
      return !V.alive || V.role === 'medium'
    case 'seance':
      return m.medium === viewer || m.target === viewer
    case 'whisper':
      return m.from === viewer || m.to === viewer || (V.alive && (V.role === 'spy' || V.role === 'blackmailer'))
    default:
      return false
  }
}

// Rooms a player may type into during the current phase.
export function rooms(s, pid) {
  const p = s.players[pid]
  if (!p.alive) {
    const out = ['dead']
    if (s.phase === 'night' && s.seance?.medium === pid) out.push('seance')
    return out
  }
  if (s.phase === 'night') {
    const out = []
    if (s.jail && (s.jail.jailor === pid || s.jail.prisoner === pid)) out.push('jail')
    if (isCabal(p) && s.jail?.prisoner !== pid) out.push('cabal')
    if (p.role === 'vampire' && s.jail?.prisoner !== pid) out.push('vamp')
    if (p.role === 'medium') out.push('dead')
    if (s.seance?.target === pid) out.push('seance')
    return out
  }
  if (s.phase === 'gameover') return ['town']
  if ((s.phase === 'defense' || s.phase === 'lastwords') && s.trial?.accused !== pid) return []
  return ['town']
}

export const blackmailed = (s, pid) => s.blackmailed[pid] === s.day && s.phase !== 'night'

// ---------- night abilities ----------

const useKey = { vigilante: 'bullets', veteran: 'alerts', survivor: 'vests', retributionist: 'revive', amnesiac: 'remember' }

// What a player can do tonight: { can, reason, act, slots, targets: [[...], [...]] }
export function nightInfo(s, pid) {
  const p = s.players[pid]
  const r = R(p)
  const act = r.act
  const no = (reason) => ({ can: false, reason, act, slots: 0, targets: [] })
  if (p.role === 'jester') {
    if (s.haunt?.jester !== pid) return no('You have no night ability.')
    return { can: true, act, slots: 1, targets: [s.haunt.voters.filter((v) => s.players[v].alive)] }
  }
  if (!p.alive) return no('You are dead.')
  if (s.jail?.prisoner === pid) return no('You are locked in Cold Storage tonight.')
  if (!act || ['jail', 'reveal', 'seance'].includes(act.pick)) return no('You have no night ability.')
  const key = useKey[p.role]
  if (key && p.uses[key] <= 0) return no('You have no uses left.')
  if (act.from && s.day < act.from) return no(`You can’t act until Night ${act.from}.`)
  if (act.fullMoon && !fullMoon(s)) return no('You can only rampage on full-moon nights.')

  const live = living(s)
  const others = live.filter((x) => x.id !== pid).map((x) => x.id)
  const all = live.map((x) => x.id)
  const outside = live.filter((x) => x.id !== pid && !sameTeam(x, p) && !(isCabal(p) && isCabal(x))).map((x) => x.id)
  switch (act.pick) {
    case 'self':
      return { can: true, act, slots: 0, targets: [] }
    case 'other':
      return { can: true, act, slots: 1, targets: [others] }
    case 'any': {
      let list = all
      if (p.role === 'doctor' && p.uses.selfHeal <= 0) list = others
      if (p.role === 'bodyguard' && p.uses.vest <= 0) list = others
      if (p.role === 'doctor') list = list.filter((x) => !s.players[x].revealed)
      return { can: true, act, slots: 1, targets: [list] }
    }
    case 'team':
      return { can: true, act, slots: 1, targets: [outside] }
    case 'two':
      return { can: true, act, slots: 2, targets: p.role === 'witch' ? [others, all] : [all, all] }
    case 'disguise':
      return { can: true, act, slots: 2, targets: [live.filter((x) => isCabal(x)).map((x) => x.id), outside] }
    case 'dead': {
      const list = s.graveyard.filter((g) => !s.players[g.pid].alive && !ROLES[g.role ?? s.players[g.pid].role].unique).map((g) => g.pid)
      return list.length ? { can: true, act, slots: 1, targets: [list] } : no('Nobody suitable is in the Burn Address yet.')
    }
    case 'deadTown': {
      const list = s.graveyard
        .filter((g) => !s.players[g.pid].alive && g.role && ROLES[g.role].faction === 'town' && !g.cleaned)
        .map((g) => g.pid)
      return list.length ? { can: true, act, slots: 1, targets: [list] } : no('No dead Town member to revive.')
    }
    default:
      return no('You have no night ability.')
  }
}

export function validAction(s, pid, a) {
  const info = nightInfo(s, pid)
  if (!info.can) return false
  const p = s.players[pid]
  if (p.role === 'arsonist' && a.ignite) return true
  if (info.slots === 0) return true
  const t = a.t ?? []
  if (t.length !== info.slots) return false
  if (!t.every((x, i) => info.targets[i].includes(x))) return false
  if (info.slots === 2 && t[0] === t[1] && p.role === 'transporter') return false
  return true
}

// ---------- night resolution ----------

export const CAUSES = {
  cabal: 'rugged by a member of the Cabal',
  sk: 'exploited by a Black Hat',
  vigi: 'hacked back by a White Hat',
  vh: 'staked by a Maxi Hunter',
  vet: 'caught in a Honeypot',
  bg: 'taken out by a Firewall',
  jail: 'liquidated by the Custodian',
  arso: 'drained by a Drainer',
  ww: 'mauled by a Lunatic',
  vamp: 'bitten to death by a Maxi',
  haunt: 'haunted by the Shitposter they helped slash',
  guilt: 'consumed by guilt after hacking back a Town member',
  lynch: 'slashed by the town',
}
const DIRECT = new Set(['cabal', 'sk', 'vigi', 'vh', 'ww', 'vamp'])
const DID = new Set(['doctor', 'bodyguard', 'escort', 'transporter', 'vigilante', 'retributionist'])

export function resolveNight(s) {
  const N = s.day
  const moon = fullMoon(s)
  const P = s.players
  const wasAlive = new Set(P.filter((p) => p.alive).map((p) => p.id))
  const role = (pid) => P[pid].role
  const notes = {}
  const note = (pid, text, tone = 'info') => (notes[pid] ??= []).push({ text, tone })
  const rec = (pid, r) => P[pid].memo.results.push({ night: N, ...r })
  const nm = (pid) => P[pid].name

  const jail = s.jail && wasAlive.has(s.jail.jailor) && wasAlive.has(s.jail.prisoner) ? s.jail : null
  const jailed = jail ? jail.prisoner : null

  // Actions that can still happen tonight.
  const acts = {}
  for (const p of P) {
    const a = s.actions[p.id]
    if (!a || p.id === jailed || !validAction(s, p.id, a)) continue
    acts[p.id] = { t: [...(a.t ?? [])], ignite: !!a.ignite, forgeRole: a.forgeRole, forgeWill: a.forgeWill }
  }
  for (const [k, a] of Object.entries(acts)) if (DID.has(role(Number(k))) && a.t.length) rec(Number(k), { kind: 'did', target: a.t[0] })
  // A guilty White Hat skips their shot and dies instead.
  const attacks = []
  const atk = (from, to, level, cause) => attacks.push({ from, to, level, cause, direct: DIRECT.has(cause) })
  for (const p of P)
    if (p.alive && p.guilt) {
      delete acts[p.id]
      atk(p.id, p.id, 3, 'guilt')
    }
  const ofRole = (r) => Object.keys(acts).map(Number).filter((pid) => role(pid) === r)

  const visits = []
  const visit = (from, to) => {
    if (to === jailed && from !== to) {
      note(from, 'Your target was in Cold Storage, so you couldn’t reach them.')
      return false
    }
    if (from !== to) visits.push({ from, to })
    return true
  }

  // 1. Mixers swap targets.
  let swap = (x) => x
  for (const t of ofRole('transporter')) {
    const [a, b] = acts[t].t
    if (a === jailed || b === jailed) {
      note(t, 'One of your targets was in Cold Storage, so the mix failed.')
      continue
    }
    if (a !== t) visits.push({ from: t, to: a })
    if (b !== t) visits.push({ from: t, to: b })
    const prev = swap
    swap = (x) => {
      const y = prev(x)
      return y === a ? b : y === b ? a : y
    }
    note(a, 'You were mixed — tonight you swapped places with someone.')
    note(b, 'You were mixed — tonight you swapped places with someone.')
  }
  for (const [k, a] of Object.entries(acts)) {
    const pid = Number(k)
    if (['transporter', 'retributionist', 'amnesiac', 'jester'].includes(role(pid))) continue
    a.t = a.t.map((x) => (x === pid ? x : swap(x)))
  }

  // 2. Phishers take control.
  for (const w of ofRole('witch')) {
    const [x, y] = acts[w].t
    if (!visit(w, x)) continue
    const X = P[x]
    rec(w, { kind: 'role', target: x, value: X.role })
    P[w].memo.known[x] = X.role
    note(w, `Your victim is the ${R(X).name}.`)
    if (R(X).controlImmune) {
      note(w, 'Your victim couldn’t be phished.')
      continue
    }
    note(x, 'A Phisher hijacked your wallet tonight — you were controlled!', 'bad')
    const forced = acts[x] ?? (nightInfo(s, x).slots > 0 ? { t: [] } : null)
    if (!forced || nightInfo(s, x).slots === 0) continue
    if (X.role === 'disguiser') forced.t = [forced.t[0] ?? x, y]
    else forced.t = [y]
    forced.controlled = true
    forced.ignite = false
    acts[x] = forced
  }

  // 3. Influencers and Paid Shills distract.
  const blocked = new Set()
  for (const e of [...ofRole('escort'), ...ofRole('consort')]) {
    const x = acts[e].t[0]
    if (!visit(e, x)) continue
    const X = P[x]
    if (R(X).rbImmune || X.role === 'witch') {
      note(x, 'Someone tried to distract you, but you were immune.')
      continue
    }
    if (X.role === 'serialKiller' || (X.role === 'werewolf' && moon && acts[x])) {
      acts[x] = { t: [e] }
      note(x, 'Someone tried to distract you, so you went after them instead.')
      continue
    }
    blocked.add(x)
    delete acts[x]
    note(x, 'Someone kept you busy all night — you were roleblocked!', 'bad')
  }

  // 4. The Cabal's kill: the Rug Puller carries out the VC's order, or the VC does it himself.
  const gf = P.find((p) => p.alive && p.role === 'godfather')
  const maf = P.find((p) => p.alive && p.role === 'mafioso')
  const active = (p) => p && p.id !== jailed && !blocked.has(p.id)
  const order = active(gf) && acts[gf.id] ? acts[gf.id].t[0] : null
  let killer = null
  let kill = null
  if (active(maf) && (acts[maf.id] || order !== null)) {
    killer = maf.id
    kill = acts[maf.id]?.controlled ? acts[maf.id].t[0] : (order ?? acts[maf.id].t[0])
    if (order !== null && !acts[maf.id]?.controlled) note(maf.id, `The VC ordered you to rug ${nm(order)}.`)
  } else if (order !== null) {
    killer = gf.id
    kill = order
  }
  if (gf) delete acts[gf.id]
  if (maf) delete acts[maf.id]
  if (killer !== null && kill !== null && visit(killer, kill)) atk(killer, kill, 1, 'cabal')

  // 5. Everyone else.
  const heals = {}
  const guards = {}
  const extraDef = {}
  const alerts = new Set()
  const inv = []
  const disguise = {}
  const forge = {}
  const clean = {}
  const dox = []
  const douse = []
  const ignite = []
  const rampage = []
  const remember = []
  const revive = []
  for (const [k, a] of Object.entries(acts)) {
    const pid = Number(k)
    const t = a.t[0]
    const p = P[pid]
    switch (role(pid)) {
      case 'veteran':
        alerts.add(pid)
        p.uses.alerts--
        note(pid, 'You armed your honeypot. Anyone who visits tonight gets caught.')
        break
      case 'survivor':
        extraDef[pid] = 1
        p.uses.vests--
        note(pid, 'You moved everything into a cold wallet for the night.')
        break
      case 'bodyguard':
        if (t === pid) {
          extraDef[pid] = 1
          p.uses.vest--
        } else if (visit(pid, t)) (guards[t] ??= []).push(pid)
        break
      case 'doctor':
        if (t === pid) {
          p.uses.selfHeal--
          ;(heals[pid] ??= []).push(pid)
        } else if (P[t].revealed) note(pid, 'A revealed Whale can’t be patched.')
        else if (visit(pid, t)) (heals[t] ??= []).push(pid)
        break
      case 'sheriff':
      case 'investigator':
      case 'consigliere':
      case 'lookout':
      case 'spy':
        if (visit(pid, t)) inv.push({ pid, r: role(pid), t })
        break
      case 'vampireHunter':
        if (visit(pid, t)) {
          inv.push({ pid, r: 'vampireHunter', t })
          if (role(t) === 'vampire') atk(pid, t, 1, 'vh')
        }
        break
      case 'framer':
        if (visit(pid, t)) s.framed[t] = true
        break
      case 'disguiser':
        if (visit(pid, a.t[1])) disguise[a.t[0]] = a.t[1]
        break
      case 'forger':
        if (visit(pid, t)) forge[t] = { by: pid, role: a.forgeRole ?? 'jester', will: a.forgeWill ?? '' }
        break
      case 'janitor':
        if (visit(pid, t)) clean[t] = pid
        break
      case 'blackmailer':
        if (visit(pid, t)) dox.push(t)
        break
      case 'arsonist':
        if (a.ignite) ignite.push(pid)
        else if (visit(pid, t)) douse.push(t)
        break
      case 'vigilante':
        p.uses.bullets--
        if (visit(pid, t)) atk(pid, t, 1, 'vigi')
        break
      case 'serialKiller':
        if (visit(pid, t)) atk(pid, t, 1, 'sk')
        break
      case 'werewolf':
        if (t === pid || visit(pid, t)) rampage.push({ pid, house: t })
        break
      case 'amnesiac':
        remember.push({ pid, t })
        break
      case 'retributionist':
        revive.push({ pid, t })
        break
      case 'jester':
        atk(pid, t, 3, 'haunt')
        break
      default:
        break
    }
  }

  // Maxis vote; the youngest free Maxi does the biting.
  let bite = null
  const vamps = P.filter((p) => p.alive && p.role === 'vampire')
  const vampActs = vamps.filter((v) => acts[v.id])
  if (vampActs.length) {
    const count = {}
    for (const v of vampActs) count[acts[v.id].t[0]] = (count[acts[v.id].t[0]] ?? 0) + 1
    const youngest = [...vampActs].sort((a, b) => b.vampAge - a.vampAge)[0]
    const top = Math.max(...Object.values(count))
    const pickT = Object.keys(count).map(Number).filter((t) => count[t] === top)
    const target = pickT.includes(acts[youngest.id].t[0]) ? acts[youngest.id].t[0] : pickT[0]
    if (visit(youngest.id, target)) {
      const T = P[target]
      const convertible = vamps.length < 4 && !isCabal(T) && T.role !== 'vampireHunter' && R(T).defense === 0
      if (convertible) bite = { from: youngest.id, to: target }
      else atk(youngest.id, target, 1, 'vamp')
    }
  }

  // Visitors walk into honeypots, Maxi Hunters and Lunatic rampages.
  for (const v of visits) {
    if (alerts.has(v.to)) atk(v.to, v.from, 2, 'vet')
    if (role(v.to) === 'vampireHunter' && role(v.from) === 'vampire' && v.to !== jailed) atk(v.to, v.from, 1, 'vh')
  }
  for (const { pid, house } of rampage) {
    if (house !== pid) atk(pid, house, 2, 'ww')
    for (const v of visits) if (v.to === house && v.from !== pid) attacks.push({ from: pid, to: v.from, level: 2, cause: 'ww', direct: false })
  }
  if (jail && jail.execute && N >= 2 && P[jail.jailor].uses.executions > 0) atk(jail.jailor, jail.prisoner, 3, 'jail')
  for (const a of ignite) {
    for (const [d] of Object.entries(s.doused)) if (wasAlive.has(Number(d)) && Number(d) !== a) atk(a, Number(d), 3, 'arso')
    note(a, 'You triggered every approval you planted. Drain them all.')
  }
  for (const t of douse) {
    s.doused[t] = true
    note(t, 'You found a weird token approval in your wallet — a Drainer doused you.', 'bad')
  }

  // Firewalls step in front of direct attacks.
  const usedBg = new Set()
  for (const a of [...attacks]) {
    if (!a.direct) continue
    const g = (guards[a.to] ?? []).find((b) => !usedBg.has(b) && b !== a.from)
    if (g === undefined) continue
    usedBg.add(g)
    note(a.to, 'You were attacked, but a Firewall stepped in to protect you!', 'good')
    a.to = g
    a.guarded = true
    atk(g, a.from, 2, 'bg')
  }

  // Resolve attacks against defense.
  const dead = new Map()
  const attackedBy = {}
  for (const a of attacks) {
    if (!wasAlive.has(a.to)) continue
    const T = P[a.to]
    let def = Math.max(R(T).defense, extraDef[a.to] ?? 0, alerts.has(a.to) ? 1 : 0)
    let barrier = false
    if (T.role === 'witch' && T.barrier && def < 1) {
      def = 1
      barrier = true
    }
    const healers = heals[a.to] ?? []
    const eff = healers.length ? Math.max(def, 2) : def
    ;(attackedBy[a.to] ??= []).push(a)
    for (const d of healers) note(d, 'Your target was attacked last night!')
    if (a.level > eff) {
      if (!dead.has(a.to)) dead.set(a.to, [])
      dead.get(a.to).push(a)
      continue
    }
    if (barrier) {
      T.barrier = false
      note(a.to, 'Someone attacked you, but your barrier absorbed it. It’s gone now.', 'good')
    } else if (healers.length && a.level > def) note(a.to, 'You were attacked, but a Core Dev patched you up!', 'good')
    else note(a.to, 'Someone attacked you, but your defense was too strong!', 'good')
    if (DIRECT.has(a.cause) && a.from !== a.to) {
      note(a.from, 'Your target’s defense was too strong to kill.')
      // Killers remember who survived them; the whole Cabal shares that.
      const team = a.cause === 'cabal' ? P.filter((p) => isCabal(p)) : [P[a.from]]
      for (const p of team) p.memo.results.push({ night: N, kind: 'failed', target: a.to })
    }
  }
  for (const [pid] of dead) {
    for (const a of dead.get(pid)) if (a.cause === 'vigi' && ROLES[role(pid)].faction === 'town' && P[a.from].role === 'vigilante') P[a.from].guilt = true
  }
  if (bite && !dead.has(bite.to)) {
    const T = P[bite.to]
    const def = Math.max(extraDef[bite.to] ?? 0, alerts.has(bite.to) ? 1 : 0, (heals[bite.to] ?? []).length ? 2 : 0)
    if (def === 0 && !(guards[bite.to] ?? []).length) {
      becomeRole(s, T, 'vampire')
      note(bite.to, '🧛 You were orange-pilled! You are now a Maxi. Help your fellow Maxis win.', 'bad')
      post(s, { room: 'vamp', from: null, text: `🧡 ${T.name} has been orange-pilled and joined the Maxis.` })
    } else note(bite.from, 'Your target resisted the orange pill.')
  }

  // 6. Investigations.
  for (const { pid, r, t } of inv) {
    const T = P[t]
    switch (r) {
      case 'sheriff': {
        const sus = !!s.framed[t] || (isCabal(T) && !R(T).detectImmune) || T.role === 'serialKiller' || (T.role === 'werewolf' && moon)
        note(pid, sus ? `🚩 ${T.name} failed the audit — your target is Suspicious!` : `✅ ${T.name} passed the audit. No red flags.`, sus ? 'bad' : 'good')
        rec(pid, { kind: sus ? 'sus' : 'inno', target: t })
        break
      }
      case 'investigator': {
        const g = s.framed[t] ? invGroup('framer') : invGroup(disguise[t] !== undefined ? role(disguise[t]) : T.role)
        note(pid, `🔍 ${T.name} could be: ${groupText(g)}.`)
        rec(pid, { kind: 'group', target: t, value: g })
        break
      }
      case 'consigliere':
        note(pid, `🤫 ${T.name} is the ${R(T).name}.`)
        rec(pid, { kind: 'role', target: t, value: T.role })
        P[pid].memo.known[t] = T.role
        post(s, { room: 'cabal', from: null, text: `🤫 Insider intel: ${T.name} is the ${R(T).name}.` })
        for (const c of P) if (c.alive && isCabal(c)) c.memo.known[t] = T.role
        break
      case 'lookout': {
        const seen = [...new Set(visits.filter((v) => v.to === t && v.from !== pid).map((v) => disguise[v.from] ?? v.from))]
        note(pid, seen.length ? `👁️ ${seen.map(nm).join(', ')} visited ${T.name}.` : `👁️ Nobody visited ${T.name}.`)
        rec(pid, { kind: 'visitors', target: t, value: seen })
        break
      }
      case 'vampireHunter':
        note(pid, T.role === 'vampire' ? `🗡️ ${T.name} has laser eyes — you staked them!` : `${T.name} is not a Maxi.`)
        rec(pid, { kind: T.role === 'vampire' ? 'vamp' : 'notVamp', target: t })
        break
      default:
        break
    }
  }
  for (const { r, t } of inv) if (r === 'sheriff' || r === 'investigator') delete s.framed[t]
  const spies = inv.filter((i) => i.r === 'spy')
  for (const { pid } of spies) {
    const cabalVisits = [...new Set(visits.filter((v) => isCabal(P[v.from]) && !isCabal(P[v.to])).map((v) => v.to))]
    for (const t of cabalVisits) note(pid, `🎧 A Cabal member visited ${nm(t)}.`)
    if (!cabalVisits.length) note(pid, '🎧 The Cabal visited no one tonight.')
    rec(pid, { kind: 'cabalVisits', value: cabalVisits })
  }

  // 7. Deaths, laundering and spoofing.
  const deaths = []
  for (const [pid, hits] of dead) {
    const T = P[pid]
    T.alive = false
    const cleaned = clean[pid] !== undefined && P[clean[pid]].uses.cleans > 0
    const forged = !cleaned && forge[pid] !== undefined && P[forge[pid].by].uses.forges > 0
    if (cleaned) {
      const j = clean[pid]
      P[j].uses.cleans--
      P[j].memo.known[pid] = T.role
      note(j, `🧼 You laundered ${T.name}'s death. They were the ${R(T).name}.${T.will ? ` Their switch read: “${T.will}”` : ''}`)
    }
    if (forged) P[forge[pid].by].uses.forges--
    const cards = hits.map((h) => P[h.from].note).filter((c, i) => c && ['cabal', 'sk', 'arso', 'ww'].includes(hits[i].cause))
    const g = {
      pid,
      day: N,
      when: 'night',
      causes: [...new Set(hits.map((h) => h.cause))],
      role: cleaned ? null : forged ? forge[pid].role : T.role,
      will: cleaned ? '' : forged ? forge[pid].will : T.will,
      cards: [...new Set(cards)],
      cleaned,
    }
    s.graveyard.push(g)
    deaths.push(g)
    if (hits.some((h) => h.cause === 'jail')) {
      const jl = P[jail.jailor]
      if (ROLES[T.role].faction === 'town') {
        jl.uses.executions = 0
        note(jail.jailor, 'You liquidated a Town member. You can no longer liquidate anyone.', 'bad')
      } else jl.uses.executions--
    }
  }
  for (const t of dox) if (P[t].alive) {
    s.blackmailed[t] = N + 1
    note(t, '📸 Someone doxxed you! You can’t talk tomorrow.', 'bad')
  }

  const news = []
  for (const { pid, t } of revive) {
    const T = P[t]
    const g = grave(s, t)
    if (T.alive || !g || g.cleaned || ROLES[T.role].faction !== 'town') {
      note(pid, 'The fork failed — that player can’t be revived.')
      continue
    }
    P[pid].uses.revive--
    T.alive = true
    s.graveyard = s.graveyard.filter((x) => x.pid !== t)
    note(t, '🍴 A Hard Forker rolled the chain back — you have been revived!', 'good')
    news.push(`🍴 ${T.name} has been revived by a hard fork!`)
  }
  for (const { pid, t } of remember) {
    const p = P[pid]
    if (!p.alive) continue
    const newRole = P[t].role
    p.uses.remember--
    becomeRole(s, p, newRole)
    note(pid, `📋 You copied ${P[t].name}. You are now the ${ROLES[newRole].name}.`, 'good')
    news.push(`📋 A Copy Trader copied the ${ROLES[newRole].name}!`)
  }

  // Bugs report what happened to their target.
  for (const { pid, t } of spies) for (const n of notes[t] ?? []) note(pid, `🪲 Your bug on ${nm(t)}: ${n.text}`)

  afterDeaths(s, notes)
  for (const [pid, list] of Object.entries(notes)) {
    const seen = new Set()
    for (const n of list) if (!seen.has(n.text)) {
      seen.add(n.text)
      tell(s, Number(pid), n.text, n.tone)
    }
  }
  s.haunt = null
  return { deaths, news, attackedBy }
}

// Promotions and role changes that follow any death (night or day).
export function afterDeaths(s, notes = null) {
  const P = s.players
  const msg = (pid, text, tone = 'info') => (notes ? (notes[pid] ??= []).push({ text, tone }) : tell(s, pid, text, tone))
  for (const p of P) {
    if (!p.alive) continue
    if (p.role === 'executioner' && p.target !== null && !P[p.target].alive && !p.won) {
      becomeRole(s, p, 'jester')
      msg(p.id, '📉 Your target died before the town could slash them. You are now a Shitposter.', 'bad')
    }
  }
  const cabal = P.filter((p) => p.alive && isCabal(p))
  if (cabal.length && !cabal.some((p) => p.role === 'godfather')) {
    const maf = cabal.find((p) => p.role === 'mafioso')
    if (maf && P.some((p) => p.role === 'godfather' && !p.alive)) {
      becomeRole(s, maf, 'godfather')
      msg(maf.id, '💼 The VC is dead. You are the new VC.', 'good')
      post(s, { room: 'cabal', from: null, text: `💼 ${maf.name} has been promoted to VC.` })
    }
  }
  if (cabal.length && !cabal.some((p) => p.role === 'godfather' || p.role === 'mafioso')) {
    const pick = cabal[Math.floor(Math.random() * cabal.length)]
    becomeRole(s, pick, 'mafioso')
    msg(pick.id, '🔪 No Cabal killer is left. You are now the Rug Puller.', 'good')
    post(s, { room: 'cabal', from: null, text: `🔪 ${pick.name} is now the Rug Puller.` })
  }
  if (!P.some((p) => p.alive && p.role === 'vampire'))
    for (const p of P)
      if (p.alive && p.role === 'vampireHunter') {
        becomeRole(s, p, 'vigilante')
        p.uses.bullets = 1
        msg(p.id, '🎩 Every Maxi is dead. You are now a White Hat with 1 bullet.', 'good')
      }
}

export function becomeRole(s, p, role) {
  p.role = role
  p.uses = initUses(role)
  if (role === 'witch') p.barrier = true
  if (role === 'vampire') p.vampAge = s.day
  if (role === 'executioner') {
    const options = s.players.filter((x) => x.alive && ROLES[x.role].faction === 'town' && x.role !== 'jailor' && x.role !== 'mayor')
    p.target = options.length ? options[Math.floor(Math.random() * options.length)].id : null
    if (p.target === null) p.role = 'jester'
  }
  p.memo.fake = null
}

// ---------- winning ----------

// The game ends once at most one team that needs others dead is left standing.
export function checkWin(s) {
  const teams = new Set(living(s).map((p) => teamOf(p.role)).filter(Boolean))
  if (teams.size > 1) return false
  endGame(s, teams.size ? [...teams][0] : null)
  return true
}

export function endGame(s, winner, reason = null) {
  s.phase = 'gameover'
  s.winner = winner
  s.winners = s.players
    .filter((p) => {
      const team = teamOf(p.role)
      if (team) return team === winner
      if (p.won) return true
      if (p.role === 'survivor') return p.alive
      if (p.role === 'witch') return p.alive && winner !== 'town'
      return false
    })
    .map((p) => p.id)
  const head = winner ? `🏆 ${TEAM_NAMES[winner]} ${winner === 'town' || winner === 'cabal' || winner === 'vampire' ? 'win' : 'wins'}!` : '🤝 The game ends in a draw.'
  sys(s, reason ? `${head} ${reason}` : head, { tone: 'win' })
}

// One-line summary of a death for chat and the Burn Address.
export function deathLine(s, g) {
  const p = s.players[g.pid]
  const how = g.causes.map((c) => CAUSES[c]).join(', and ')
  return `${p.name} was ${how}.`
}
