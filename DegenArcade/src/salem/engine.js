// Game engine for Town of Solana: creates the game, runs the phase clock and applies every player action.
import { ROLES, rollRoles, AVATARS, COLORS } from './roles.js'
import {
  R, living, isCabal, sameTeam, tally, votesNeeded, voteWeight, rooms, blackmailed, validAction, resolveNight,
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
    willData: null,
    note: '',
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
    if (p.isAI) p.note = ai.deathCard(p.role)
  }
  sys(s, '☀️ Day 1 — gm, Solana. Somewhere in this town a Cabal is planning a rug.', { tone: 'day' })
  for (const p of players) {
    const r = R(p)
    tell(s, p.id, `You are the ${r.icon} ${r.name}. ${r.ability}`, 'role')
    const mates = players.filter((q) => q.id !== p.id && sameTeam(p, q))
    if (mates.length) tell(s, p.id, `Your ${isCabal(p) ? 'Cabal' : 'fellow Maxis'}: ${mates.map((q) => `${q.name} (${R(q).name})`).join(', ')}.`)
    if (p.role === 'executioner') tell(s, p.id, `📉 Your target is ${players[p.target].name}. Get them slashed.`)
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
  sys(s, `🗳️ Voting is open. ${votesNeeded(s)} votes put someone on trial.`, { tone: 'vote' })
}

function resumeVoting(s) {
  const left = s.voteLeft ?? 0
  s.trial = null
  if (s.trials >= 3 || left < 3000) return startNight(s)
  setPhase(s, 'voting', 0)
  s.dur = left
  s.votes = {}
  sys(s, `🗳️ Back to voting. ${votesNeeded(s)} votes needed.`, { tone: 'vote' })
}

function startTrial(s, acc) {
  s.voteLeft = Math.max(0, s.dur - s.clock)
  s.trials++
  s.trial = { accused: acc, n: s.trials }
  s.judge = {}
  const name = s.players[acc].name
  sys(s, `⚖️ The town put ${name} on trial. ${name}, defend yourself.`, { tone: 'warn' })
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
  const who = (ids) => ids.map((x) => s.players[x].name + (s.players[x].revealed ? ' (×3)' : '')).join(', ') || '—'
  sys(s, `${convicted ? '🔨' : '😇'} The town voted ${convicted ? 'GUILTY' : 'INNOCENT'}, ${g} to ${i}.`, { tone: convicted ? 'bad' : 'good' })
  sys(s, `Guilty: ${who(lists.guilty)} · Innocent: ${who(lists.innocent)} · Abstained: ${who(lists.abstain)}`, { tone: 'dim' })
  setPhase(s, 'verdict', DUR.verdict)
}

function lynch(s) {
  const acc = s.trial.accused
  const p = s.players[acc]
  p.alive = false
  const g = { pid: acc, day: s.day, when: 'day', causes: ['lynch'], role: p.role, will: p.will, cards: [], cleaned: false }
  s.graveyard.push(g)
  revealDeath(s, g)
  if (p.role === 'jester') {
    p.won = true
    s.haunt = { jester: acc, voters: [...s.trial.guilty, ...s.trial.abstain].filter((x) => s.players[x].alive) }
    sys(s, '🤡 The Shitposter got slashed — and will haunt one of you tonight.', { tone: 'bad' })
  }
  for (const x of s.players)
    if (x.role === 'executioner' && x.target === acc && !x.won) {
      x.won = true
      tell(s, x.id, '📉 Your target got slashed. You win!', 'good')
    }
  s.quiet = 0
  afterDeaths(s)
  if (checkWin(s)) return
  startNight(s, { lynched: true })
}

// Announce a death and fold the dead player's switch into the public record.
function revealDeath(s, g) {
  const p = s.players[g.pid]
  post(s, { room: 'system', kind: 'death', pid: g.pid, text: deathLine(s, g), tone: 'death' })
  if (g.role) sys(s, `${p.name}’s role was ${ROLES[g.role].icon} ${ROLES[g.role].name}.`, { tone: 'death' })
  else sys(s, `We couldn’t tell what ${p.name} was — their death was laundered 🧼.`, { tone: 'death' })
  if (g.will) post(s, { room: 'system', kind: 'will', pid: g.pid, text: g.will })
  for (const c of g.cards) post(s, { room: 'system', kind: 'card', pid: g.pid, text: c })
  if (g.cleaned || g.will !== p.will || !g.will) return
  const reports = p.isAI ? (p.willData ?? []) : (ai.parse(s, p.id, g.will, g.role)?.reports ?? [])
  for (const r of reports) s.reports.push({ ...r, by: g.pid, as: g.role, day: s.day, id: s.nextId, source: 'will' })
}

// ---------- night ----------

function startNight(s, { lynched = false } = {}) {
  for (const a of ai.beforeNight(s)) apply(s, a)
  if (!lynched) s.quiet++
  if (s.quiet >= 8) return endGame(s, null, 'Nobody has died in four days.')
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
    tell(s, pick, '🧊 You were hauled off to Cold Storage! Talk to the Custodian.', 'bad')
    post(s, { room: 'jail', from: null, text: `🧊 ${s.players[pick].name} is locked in Cold Storage.`, jailor: jailor.id, prisoner: pick })
  }
  s.jailPick = null
  s.seance = null
  const sp = s.seancePick
  if (sp && s.players[sp.medium].uses.seance > 0 && s.players[sp.target].alive) {
    s.players[sp.medium].uses.seance--
    s.seance = sp
    post(s, { room: 'seance', from: null, text: `🔮 An Oracle reaches out from beyond the chain to ${s.players[sp.target].name}.`, ...sp })
  }
  s.seancePick = null
  sys(s, `🌙 Night ${s.day}${fullMoon(s) ? ' — 🌕 full moon' : ''}. The town sleeps…`, { tone: 'night' })
  for (const a of ai.planNight(s)) apply(s, a)
}

function endNight(s) {
  for (const a of ai.endNight(s)) apply(s, a)
  const res = resolveNight(s)
  s.day++
  s.phase = 'morning'
  s.morning = { deaths: res.deaths, news: res.news }
  sys(s, `☀️ Day ${s.day}.`, { tone: 'day' })
  if (!res.deaths.length) sys(s, 'Nobody died last night. Bullish. 📈')
  for (const g of res.deaths) revealDeath(s, g)
  for (const n of res.news) sys(s, n, { tone: 'good' })
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
      if (t === null) sys(s, `${p.name} cancelled their vote.`, { tone: 'dim' })
      else sys(s, `🗳️ ${p.name} ${prev !== null ? 'changed their vote to' : 'voted against'} ${s.players[t].name}.`, { tone: 'vote', voter: p.id })
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
      if (!validAction(s, p.id, act)) return false
      s.actions[p.id] = act
      if (!p.isAI && isCabal(p) && act.t.length && s.jail?.prisoner !== p.id) {
        const names = act.t.map((x) => s.players[x].name).join(' → ')
        post(s, { room: 'cabal', from: null, text: `${p.name} (${R(p).name}) is targeting ${names}.` })
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
        text: a.on ? '⚖️ The Custodian has decided to liquidate the prisoner.' : '⚖️ The Custodian changed their mind.',
      })
      return true
    case 'REVEAL':
      if (p.role !== 'mayor' || p.revealed || !p.alive || !DAYTIME(s)) return false
      p.revealed = true
      s.claims[p.id] = { role: 'mayor', day: s.day, at: s.nextId }
      s.claimLog.push({ pid: p.id, role: 'mayor', day: s.day })
      sys(s, `🐋 ${p.name} has revealed themselves as the Whale! Their vote now counts 3 times.`, { tone: 'good' })
      return true
    case 'SEANCE':
      if (p.role !== 'medium' || p.alive || p.uses.seance <= 0 || !DAYTIME(s)) return false
      if (a.target !== null && !s.players[a.target]?.alive) return false
      s.seancePick = a.target === null ? null : { medium: p.id, target: a.target }
      return true
    case 'WILL':
      if (!p.alive) return false
      p.will = String(a.text ?? '').slice(0, 600)
      return true
    case 'NOTE':
      if (!p.alive) return false
      p.note = String(a.text ?? '').slice(0, 160)
      return true
    default:
      return false
  }
}

function say(s, p, { room = 'town', text, to = null, data = null }) {
  text = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 280)
  if (!text) return false
  if (room === 'whisper') {
    if (!p.alive || !DAYTIME(s) || blackmailed(s, p.id) || to === p.id || !s.players[to]?.alive) return false
    post(s, { room: 'whisper', from: p.id, to, text })
    sys(s, `🤫 ${p.name} is whispering to ${s.players[to].name}.`, { tone: 'dim' })
    return true
  }
  if (!rooms(s, p.id).includes(room)) return false
  if (room === 'town' && blackmailed(s, p.id)) {
    text = 'I am blackmailed.'
    data = null
  }
  const extra = room === 'jail' ? { jailor: s.jail.jailor, prisoner: s.jail.prisoner } : room === 'seance' ? { ...s.seance } : {}
  post(s, { room, from: p.id, text, ...(room === 'dead' && data ? { data } : {}), ...extra })
  const info = data ?? (p.isAI ? null : ai.parse(s, p.id, text))
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
