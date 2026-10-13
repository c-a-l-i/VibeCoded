// Game engine for Town of Solana: creates the game, runs the phase clock and applies every player action.
import { ROLES, rollRoles, AVATARS, COLORS, INV_GROUPS } from './roles.js'
import {
  living, isCabal, sameTeam, tally, votesNeeded, voteWeight, rooms, blackmailed, validAction, resolveNight,
  afterDeaths, becomeRole, checkWin, endGame, deathLine, initUses, post, sys, tell, fullMoon,
} from './rules.js'
import * as ai from './ai.js'

export const PACES = {
  chill: { name: 'Chill', mul: 1.5 },
  normal: { name: 'Normal', mul: 1 },
  fast: { name: 'Fast', mul: 0.6 },
  turbo: { name: 'Turbo', mul: 0.25 },
}
// Phase lengths in seconds at normal pace.
export const DUR = { day1: 24, discussion: 50, voting: 35, defense: 16, judgement: 14, verdict: 5, lastwords: 7, night: 40 }

const mul = (s) => PACES[s.pace]?.mul ?? 1

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const newMemo = () => ({
  results: [], known: {}, shared: [], fake: null, fakeResults: [], said: {}, jailClaims: {}, relay: [], relayRead: 0, answered: -1,
})

// Humans who still have something to do at night.
export const nightHumans = (s) => s.players.filter((p) => !p.isAI && (p.alive || s.haunt?.jester === p.id))

export function createGame({ mode, list, seats, pace = 'normal' }) {
  const roles = rollRoles(list)
  if (!roles) return null
  const order = shuffle(seats)
  const deal = shuffle(roles)
  const avatars = shuffle(AVATARS)
  const players = order.map((seat, i) => ({
    id: i,
    num: i + 1,
    key: seat.key ?? null,
    name: seat.name,
    isAI: seat.isAI,
    avatar: avatars[i % avatars.length],
    color: COLORS[i % COLORS.length],
    role: deal[i],
    startRole: deal[i],
    alive: true,
    will: '',
    willTr: null, // a bot's switch as message lines
    willData: null,
    note: '',
    noteTr: null, // a bot's calling card as a pool line
    uses: initUses(deal[i]),
    revealed: false,
    target: null,
    won: false,
    guilt: false,
    barrier: deal[i] === 'witch',
    vampAge: 0,
    memo: newMemo(),
  }))
  const s = {
    seed: (Math.random() * 2 ** 31) | 0,
    mode, list, pace, players,
    phase: 'day1', day: 1, clock: 0, dur: 0,
    chat: [], nextId: 1,
    claims: {}, claimLog: [], reports: [], asks: [],
    votes: {}, judge: {}, trial: null, trials: 0, voteLeft: null, history: [],
    actions: {}, done: {}, ready: {},
    jailPick: null, jail: null, seancePick: null, seance: null,
    blackmailed: {}, framed: {}, doused: {},
    graveyard: [], morning: null, haunt: null, quiet: 0,
    botAt: {}, winner: null, winners: [],
  }
  for (const p of players) {
    if (p.role === 'executioner') becomeRole(s, p, 'executioner')
    if (p.isAI) p.noteTr = ai.deathCard(p.role)
  }
  sys(s, 'day1', {}, { tone: 'day' })
  for (const p of players) {
    tell(s, p.id, 'youAre', { roleIcon: p.role, ability: p.role }, 'role')
    const mates = players.filter((q) => q.id !== p.id && sameTeam(p, q))
    if (mates.length) tell(s, p.id, isCabal(p) ? 'cabalMates' : 'maxiMates', { list: mates.map((q) => ({ k: 'mate', v: { p: q.id, role: q.role } })) })
    if (p.role === 'executioner') tell(s, p.id, 'exeTarget', { p: p.target })
  }
  afterDeaths(s) // a Cabal without a killer gets a Rug Puller
  ai.onStart(s)
  setPhase(s, 'day1', DUR.day1)
  return s
}

function setPhase(s, phase, seconds) {
  s.phase = phase
  s.clock = 0
  s.dur = seconds * 1000 * mul(s)
  s.ready = {}
  s.botAt = {}
}

// ---------- reducer ----------

export function reducer(state, action) {
  if (action.type === 'NEW_GAME') return createGame(action.config)
  if (action.type === 'QUIT') return null
  if (!state) return state
  const s = structuredClone(state)
  if (action.type === 'TICK') {
    if (s.phase === 'gameover') return state
    s.clock += action.dt
    for (const a of ai.tick(s, mul(s))) apply(s, a)
    if (s.phase !== 'gameover' && phaseDone(s)) advance(s)
    return s
  }
  if (action.type === 'PACE') {
    const old = mul(s)
    s.pace = action.pace
    s.dur = s.clock + (s.dur - s.clock) * (mul(s) / old)
    return s
  }
  return apply(s, action) ? s : state
}

function phaseDone(s) {
  if (s.clock >= s.dur) return true
  if (s.phase === 'night') {
    const hs = nightHumans(s)
    return hs.length > 0 && s.clock > 1200 && hs.every((p) => s.done[p.id])
  }
  const hs = living(s).filter((p) => !p.isAI)
  if (!hs.length) return false
  if (s.phase === 'judgement') {
    const voters = hs.filter((p) => p.id !== s.trial.accused)
    if (voters.length && voters.every((p) => s.judge[p.id]) && s.clock > 1500) return true
  }
  return hs.every((p) => s.ready[p.id])
}

function advance(s) {
  switch (s.phase) {
    case 'day1':
      return startNight(s)
    case 'night':
      return endNight(s)
    case 'morning':
      return setPhase(s, 'discussion', DUR.discussion)
    case 'discussion':
      return startVoting(s)
    case 'voting':
      return startNight(s)
    case 'defense':
      return setPhase(s, 'judgement', DUR.judgement)
    case 'judgement':
      return verdict(s)
    case 'verdict':
      return s.trial.convicted ? setPhase(s, 'lastwords', DUR.lastwords) : resumeVoting(s)
    case 'lastwords':
      return lynch(s)
    default:
      return undefined
  }
}

// ---------- day ----------

function startVoting(s) {
  if (s.trials >= 3) return startNight(s)
  s.votes = {}
  setPhase(s, 'voting', DUR.voting)
  sys(s, 'votingOpen', { n: votesNeeded(s) }, { tone: 'vote' })
}

function resumeVoting(s) {
  const left = s.voteLeft ?? 0
  s.trial = null
  if (s.trials >= 3 || left < 3000) return startNight(s)
  setPhase(s, 'voting', 0)
  s.dur = left
  s.votes = {}
  sys(s, 'votingBack', { n: votesNeeded(s) }, { tone: 'vote' })
}

function startTrial(s, acc) {
  s.voteLeft = Math.max(0, s.dur - s.clock)
  s.trials++
  s.trial = { accused: acc, n: s.trials }
  s.judge = {}
  sys(s, 'trial', { p: acc }, { tone: 'warn' })
  setPhase(s, 'defense', DUR.defense)
}

function verdict(s) {
  const acc = s.trial.accused
  for (const p of living(s)) if (p.isAI && p.id !== acc && !s.judge[p.id]) s.judge[p.id] = ai.verdictFor(s, p.id)
  const lists = { guilty: [], innocent: [], abstain: [] }
  let g = 0
  let i = 0
  for (const p of living(s)) {
    if (p.id === acc) continue
    const v = s.judge[p.id] ?? 'abstain'
    lists[v].push(p.id)
    if (v === 'guilty') g += voteWeight(p)
    if (v === 'innocent') i += voteWeight(p)
  }
  const convicted = g > i
  Object.assign(s.trial, lists, { g, i, convicted })
  s.history.push({ day: s.day, accused: acc, ...lists, lynched: convicted })
  sys(s, convicted ? 'guilty' : 'innocent', { g, i }, { tone: convicted ? 'bad' : 'good' })
  const x3 = living(s).filter((p) => p.revealed).map((p) => p.id)
  sys(s, 'tally', { guilty: lists.guilty, inno: lists.innocent, abst: lists.abstain, x3 }, { tone: 'dim' })
  setPhase(s, 'verdict', DUR.verdict)
}

function lynch(s) {
  const acc = s.trial.accused
  const p = s.players[acc]
  p.alive = false
  const g = { pid: acc, day: s.day, when: 'day', causes: ['lynch'], role: p.role, will: p.will, willTr: p.willTr ?? null, cards: [], cleaned: false, forged: false }
  s.graveyard.push(g)
  revealDeath(s, g)
  if (p.role === 'jester') {
    p.won = true
    s.haunt = { jester: acc, voters: [...s.trial.guilty, ...s.trial.abstain].filter((x) => s.players[x].alive) }
    sys(s, 'jesterHaunt', {}, { tone: 'bad' })
  }
  for (const x of s.players)
    if (x.role === 'executioner' && x.target === acc && !x.won) {
      x.won = true
      tell(s, x.id, 'exeWin', {}, 'good')
    }
  s.quiet = 0
  afterDeaths(s)
  if (checkWin(s)) return
  startNight(s, { lynched: true })
}

// Announce a death and fold the dead player's switch into the public record.
function revealDeath(s, g) {
  const p = s.players[g.pid]
  post(s, { room: 'system', kind: 'death', pid: g.pid, ...deathLine(g), tone: 'death' })
  if (g.role) sys(s, 'roleWas', { p: g.pid, roleIcon: g.role }, { tone: 'death' })
  else sys(s, 'launderedDeath', { p: g.pid }, { tone: 'death' })
  // A bot's switch is a list of message lines (willTr); a human's is their own text.
  if (g.will || g.willTr) post(s, { room: 'system', kind: 'will', pid: g.pid, text: g.will, ...(g.willTr ? { tr: g.willTr } : {}) })
  // Calling cards are a human's text, or a bot's line from a pool ({ k, i }).
  for (const c of g.cards) post(s, { room: 'system', kind: 'card', pid: g.pid, ...(typeof c === 'string' ? { text: c } : { tr: [c] }) })
  if (g.cleaned || g.forged || !(g.will || g.willTr)) return
  const reports = p.isAI ? (p.willData ?? []) : (ai.parse(s, p.id, g.will, g.role)?.reports ?? [])
  for (const r of reports) s.reports.push({ ...r, by: g.pid, as: g.role, day: s.day, id: s.nextId, source: 'will' })
}

// ---------- night ----------

function startNight(s, { lynched = false } = {}) {
  for (const a of ai.beforeNight(s)) apply(s, a)
  if (!lynched) s.quiet++
  if (s.quiet >= 8) return endGame(s, null, 'quiet')
  const hs = nightHumans(s)
  setPhase(s, 'night', hs.length ? DUR.night * Math.max(1, hs.length) : 3)
  s.actions = {}
  s.done = {}
  s.votes = {}
  s.trial = null
  s.judge = {}
  s.trials = 0
  s.voteLeft = null
  s.jail = null
  const jailor = living(s).find((p) => p.role === 'jailor')
  const pick = s.jailPick
  if (jailor && pick !== null && pick !== jailor.id && s.players[pick].alive) {
    s.jail = { jailor: jailor.id, prisoner: pick, execute: false }
    tell(s, pick, 'hauled', {}, 'bad')
    post(s, { room: 'jail', from: null, k: 'locked', v: { p: pick }, jailor: jailor.id, prisoner: pick })
  }
  s.jailPick = null
  s.seance = null
  const sp = s.seancePick
  if (sp && s.players[sp.medium].uses.seance > 0 && s.players[sp.target].alive) {
    s.players[sp.medium].uses.seance--
    s.seance = sp
    post(s, { room: 'seance', from: null, k: 'seance', v: { p: sp.target }, ...sp })
  }
  s.seancePick = null
  sys(s, fullMoon(s) ? 'nightMoon' : 'night', { n: s.day }, { tone: 'night' })
  for (const a of ai.planNight(s)) apply(s, a)
}

function endNight(s) {
  for (const a of ai.endNight(s)) apply(s, a)
  const res = resolveNight(s)
  s.day++
  s.phase = 'morning'
  s.morning = { deaths: res.deaths, news: res.news }
  sys(s, 'day', { n: s.day }, { tone: 'day' })
  if (!res.deaths.length) sys(s, 'noDeaths')
  for (const g of res.deaths) revealDeath(s, g)
  for (const n of res.news) sys(s, n.k, n.v, { tone: 'good' })
  s.quiet = res.deaths.length ? 0 : s.quiet + 1
  s.jail = null
  s.seance = null
  s.actions = {}
  s.done = {}
  if (checkWin(s)) return
  setPhase(s, 'morning', 3 + res.deaths.length * 5 + res.news.length * 2.5)
  for (const a of ai.dayStart(s)) apply(s, a)
}

// ---------- player actions ----------

const DAYTIME = (s) => !['night', 'gameover'].includes(s.phase)

export function apply(s, a) {
  const p = s.players[a.pid]
  if (!p || s.phase === 'gameover') return false
  switch (a.type) {
    case 'SAY':
      return say(s, p, a)
    case 'VOTE': {
      const t = a.target ?? null
      if (s.phase !== 'voting' || !p.alive) return false
      if (t !== null && (!s.players[t]?.alive || t === p.id)) return false
      const prev = s.votes[p.id] ?? null
      if (prev === t) return false
      s.votes[p.id] = t
      if (t === null) sys(s, 'unvoted', { p: p.id }, { tone: 'dim' })
      else sys(s, prev !== null ? 'revoted' : 'voted', { p: p.id, q: t }, { tone: 'vote', voter: p.id })
      if (t !== null && (tally(s)[t] ?? 0) >= votesNeeded(s)) startTrial(s, t)
      return true
    }
    case 'JUDGE':
      if (s.phase !== 'judgement' || !p.alive || s.trial.accused === p.id) return false
      if (!['guilty', 'innocent', 'abstain'].includes(a.verdict)) return false
      s.judge[p.id] = a.verdict
      return true
    case 'NIGHT': {
      if (s.phase !== 'night') return false
      if (a.clear) {
        delete s.actions[p.id]
        return true
      }
      const act = { t: a.t ?? [], ignite: !!a.ignite, forgeRole: a.forgeRole, forgeWill: a.forgeWill }
      if (p.isAI && Array.isArray(a.forgeWillTr)) act.forgeWillTr = a.forgeWillTr
      if (!validAction(s, p.id, act)) return false
      s.actions[p.id] = act
      if (!p.isAI && isCabal(p) && act.t.length && s.jail?.prisoner !== p.id) {
        post(s, { room: 'cabal', from: null, k: 'targeting', v: { p: p.id, role: p.role, chain: act.t } })
      }
      return true
    }
    case 'DONE':
      if (s.phase !== 'night') return false
      s.done[p.id] = a.on !== false
      return true
    case 'READY':
      s.ready[p.id] = a.on !== false
      return true
    case 'JAIL':
      if (!DAYTIME(s) || !p.alive || p.role !== 'jailor') return false
      if (a.target !== null && (!s.players[a.target]?.alive || a.target === p.id)) return false
      s.jailPick = a.target
      return true
    case 'EXECUTE':
      if (s.phase !== 'night' || s.jail?.jailor !== p.id || s.day < 2 || p.uses.executions <= 0) return false
      if (s.jail.execute === !!a.on) return false
      s.jail.execute = !!a.on
      post(s, {
        room: 'jail', from: null, jailor: s.jail.jailor, prisoner: s.jail.prisoner,
        k: a.on ? 'execOn' : 'execOff',
      })
      return true
    case 'REVEAL':
      if (p.role !== 'mayor' || p.revealed || !p.alive || !DAYTIME(s)) return false
      p.revealed = true
      s.claims[p.id] = { role: 'mayor', day: s.day, at: s.nextId }
      s.claimLog.push({ pid: p.id, role: 'mayor', day: s.day })
      sys(s, 'revealed', { p: p.id }, { tone: 'good' })
      return true
    case 'SEANCE':
      if (p.role !== 'medium' || p.alive || p.uses.seance <= 0 || !DAYTIME(s)) return false
      if (a.target !== null && !s.players[a.target]?.alive) return false
      s.seancePick = a.target === null ? null : { medium: p.id, target: a.target }
      return true
    case 'WILL':
      if (!p.alive) return false
      p.will = String(a.text ?? '').slice(0, 600)
      // Bots write their switch as message lines so each player reads it in their own language.
      p.willTr = p.isAI && Array.isArray(a.tr) ? a.tr : null
      return true
    case 'NOTE':
      if (!p.alive) return false
      p.note = String(a.text ?? '').slice(0, 160)
      return true
    default:
      return false
  }
}

// Message parts a chat line may be built from, checked so a client can't post anything else.
const TR_KEYS = new Set([
  'greet', 'chatter', 'rip', 'claim', 'update', 'counter', 'defend', 'accuse', 'ask', 'vouch', 'again', 'noClaim', 'saysGuilty',
  'saysInno', 'lastTown', 'lastEvil', 'lastJester', 'jesterTalk', 'whale', 'jailAsk', 'jailExec', 'jailSpare', 'iAm', 'iWas',
  'qAccuse', 'qVouch', 'qAsk', 'blackmailed', 'whaleDefense', 'rSus', 'rClean', 'rGroup', 'rWatched', 'rWatchedNone', 'rCabal',
  'rMaxi', 'relaySus', 'relayClean', 'relayEvil', 'relaySeen', 'relayGroup', 'planKill', 'planBoss', 'planFrame', 'planDox',
  'planShill', 'planLaunder', 'planSpoof', 'planDisguise', 'planSnoop', 'planCover', 'planBite',
])
const small = (x) => Number.isInteger(x) && x >= 0 && x < 100

function cleanTr(s, tr) {
  if (!Array.isArray(tr) || !tr.length || tr.length > 8) return null
  const seat = (x) => Number.isInteger(x) && x >= 0 && x < s.players.length
  const ok = {
    x: seat,
    y: seat,
    p: seat,
    ps: (x) => Array.isArray(x) && x.length <= 15 && x.every(seat),
    role: (x) => typeof x === 'string' && Object.hasOwn(ROLES, x),
    n: small,
    inv: (x) => Number.isInteger(x) && x >= 0 && x < INV_GROUPS.length,
  }
  const out = []
  for (const part of tr) {
    const k = part?.k
    if (typeof k !== 'string' || !(TR_KEYS.has(k) || (k.startsWith('rDid.') && Object.hasOwn(ROLES, k.slice(5))))) return null
    const v = {}
    for (const [name, x] of Object.entries(part.v ?? {})) {
      if (!Object.hasOwn(ok, name) || !ok[name](x)) return null
      v[name] = x
    }
    if (part.i !== undefined && !small(part.i)) return null
    out.push({ k, ...(Object.keys(v).length ? { v } : {}), ...(part.i !== undefined ? { i: part.i } : {}) })
  }
  return out
}

// A chat line is free text, or `tr`: a line built from message parts (bot lines and the quick-chat buttons),
// which every player reads in their own language.
function say(s, p, { room = 'town', text, tr = null, to = null, data = null }) {
  text = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 280)
  tr = cleanTr(s, tr)
  if (!text && !tr) return false
  if (tr) text = ''
  if (room === 'whisper') {
    if (!p.alive || !DAYTIME(s) || blackmailed(s, p.id) || to === p.id || !s.players[to]?.alive) return false
    post(s, { room: 'whisper', from: p.id, to, text, ...(tr ? { tr } : {}) })
    sys(s, 'whispering', { p: p.id, q: to }, { tone: 'dim' })
    return true
  }
  if (!rooms(s, p.id).includes(room)) return false
  if (room === 'town' && blackmailed(s, p.id)) {
    text = ''
    tr = [{ k: 'blackmailed' }]
    data = null
  }
  const extra = room === 'jail' ? { jailor: s.jail.jailor, prisoner: s.jail.prisoner } : room === 'seance' ? { ...s.seance } : {}
  post(s, { room, from: p.id, text, ...(tr ? { tr } : {}), ...(room === 'dead' && data ? { data } : {}), ...extra })
  const info = data ?? (p.isAI || !text ? null : ai.parse(s, p.id, text))
  if (!info) return true
  if (room === 'town') record(s, p.id, info)
  if (room === 'jail' && info.claim && s.jail.prisoner === p.id) s.players[s.jail.jailor].memo.jailClaims[p.id] = info.claim
  return true
}

// Fold a message's structured content (claims, reported results, questions) into the public record.
function record(s, pid, info) {
  const at = s.nextId - 1
  if (info.claim && ROLES[info.claim] && !s.players[pid].revealed) {
    const prev = s.claims[pid]
    if (!prev || prev.role !== info.claim) {
      s.claims[pid] = { role: info.claim, day: s.day, at }
      s.claimLog.push({ pid, role: info.claim, day: s.day })
    }
  }
  const as = s.claims[pid]?.role ?? null
  for (const r of info.reports ?? []) {
    if (!s.players[r.target] || r.target === pid) continue
    const dup = s.reports.some((x) => x.by === pid && x.target === r.target && x.kind === r.kind && (x.day === s.day || !['accuse', 'vouch'].includes(r.kind)))
    if (dup) continue
    s.reports.push({ ...r, by: pid, as, day: s.day, id: at })
  }
  for (const t of info.asks ?? []) if (s.players[t] && t !== pid) s.asks.push({ by: pid, target: t, day: s.day, id: at })
}
