// Pure game engine for Settlers of Satoshi: state + reducer implementing the Catan base-game rules.
import {
  GEO, RESOURCES, RES, COSTS, PIECES, BANK_SIZE, WIN_VP, DEV, DEV_DECK, NFT_NAMES, randomBoard, shuffle,
} from './data.js'

// ---------- setup ----------

const emptyHand = () => Object.fromEntries(RESOURCES.map((r) => [r, 0]))

export function createGame(configs) {
  const n = configs.length
  const s = {
    players: configs.map((c, i) => ({
      id: i, name: c.name, token: c.token, color: c.color, isAI: c.isAI,
      hand: emptyHand(), dev: [], knights: 0,
      left: { ...PIECES },
    })),
    board: randomBoard(),
    buildings: {}, // vertexId -> { owner, dc }
    channels: {}, // edgeId -> owner
    bank: Object.fromEntries(RESOURCES.map((r) => [r, BANK_SIZE])),
    devDeck: shuffle(DEV_DECK),
    current: 0,
    phase: 'setup',
    // Snake draft: 0..n-1 then n-1..0. Each step places a node then a channel.
    setup: { order: [...Array(n).keys(), ...[...Array(n).keys()].reverse()], step: 0, node: null },
    dice: [3, 4],
    discards: {}, // pid -> number of cards still to discard
    afterHacker: null, // phase to return to once the Hacker has struck
    freeChannels: 0,
    devPlayed: false,
    longest: null, // { pid, len }
    army: null, // { pid, size }
    winner: null,
    turn: 0,
    log: [],
    logId: 0,
  }
  log(s, `Genesis round: place 2 nodes and 2 channels each. ${s.players[0].name} goes first.`)
  return s
}

// ---------- queries (also used by the UI and AI) ----------

const yes = { ok: true }
const no = (reason) => ({ ok: false, reason })

export const cur = (s) => s.players[s.current]
export const handSize = (p) => RESOURCES.reduce((t, r) => t + p.hand[r], 0)
export const canAfford = (p, cost) => RESOURCES.every((r) => p.hand[r] >= (cost[r] ?? 0))
export const settingUp = (s) => s.phase === 'setup'

export function actingPlayer(s) {
  if (s.phase === 'discard') return Number(Object.keys(s.discards)[0])
  if (s.phase === 'setup') return s.setup.order[s.setup.step]
  return s.current
}

export function victoryPoints(s, pid, { hidden = true } = {}) {
  let vp = 0
  for (const b of Object.values(s.buildings)) if (b.owner === pid) vp += b.dc ? 2 : 1
  if (s.longest?.pid === pid) vp += 2
  if (s.army?.pid === pid) vp += 2
  if (hidden) vp += s.players[pid].dev.filter((d) => d.type === 'vp').length
  return vp
}

// Distance rule: no building on this vertex or any adjacent vertex.
const vertexFree = (s, v) => !s.buildings[v] && GEO.vertices[v].neighbors.every((n) => !s.buildings[n])

const ownsChannelAt = (s, pid, v) => GEO.vertices[v].edges.some((e) => s.channels[e] === pid)

export function canPlaceNode(s, pid, v, { setup = false } = {}) {
  if (!vertexFree(s, v)) return no('Too close to another node')
  if (!setup && !ownsChannelAt(s, pid, v)) return no('Must connect to one of your channels')
  return yes
}

export function canPlaceChannel(s, pid, e, { from = null } = {}) {
  if (s.channels[e] !== undefined) return no('Channel already open')
  const edge = GEO.edges[e]
  if (from !== null) return edge.a === from || edge.b === from ? yes : no('Must touch the node you just placed')
  // Connect via an own building, or via an own channel at an endpoint not blocked by an opponent's building.
  for (const v of [edge.a, edge.b]) {
    const b = s.buildings[v]
    if (b?.owner === pid) return yes
    if (b && b.owner !== pid) continue
    if (GEO.vertices[v].edges.some((x) => x !== e && s.channels[x] === pid)) return yes
  }
  return no('Must connect to your network')
}

export const legalNodes = (s, pid, opts) => GEO.vertices.filter((v) => canPlaceNode(s, pid, v.id, opts).ok).map((v) => v.id)
export const legalChannels = (s, pid, opts) => GEO.edges.filter((e) => canPlaceChannel(s, pid, e.id, opts).ok).map((e) => e.id)
export const legalUpgrades = (s, pid) =>
  Object.entries(s.buildings).filter(([, b]) => b.owner === pid && !b.dc).map(([v]) => Number(v))

export function canBuild(s, pid, kind) {
  const p = s.players[pid]
  if (s.phase !== 'main' || s.current !== pid) return no('Not now')
  if (!canAfford(p, COSTS[kind])) return no('Not enough resources')
  if (kind === 'dev') return s.devDeck.length ? yes : no('Smart contract deck is empty')
  if (p.left[kind] < 1) return no(`No ${kind === 'dc' ? 'data centers' : kind + 's'} left`)
  const spots = kind === 'channel' ? legalChannels(s, pid) : kind === 'node' ? legalNodes(s, pid) : legalUpgrades(s, pid)
  return spots.length ? yes : no('Nowhere to build')
}

// Best rate this player gets when swapping `res` with the bank.
export function tradeRate(s, pid, res) {
  let rate = 4
  for (const port of s.board.ports) {
    if (!port.vertices.some((v) => s.buildings[v]?.owner === pid)) continue
    if (port.type === 'any') rate = Math.min(rate, 3)
    if (port.type === res) rate = 2
  }
  return rate
}

export function playableDev(s, pid) {
  const p = s.players[pid]
  if (s.current !== pid || s.devPlayed || !['preroll', 'main'].includes(s.phase)) return []
  const types = new Set(p.dev.filter((d) => d.type !== 'vp' && d.turn < s.turn).map((d) => d.type))
  // Only the Hacker may be played before rolling.
  if (s.phase === 'preroll') return types.has('knight') ? ['knight'] : []
  return [...types]
}

// Players with a building on this hex (other than pid) who hold cards — the Hacker's targets.
export function victimsAt(s, hex, pid) {
  const owners = new Set(GEO.hexes[hex].vertices.map((v) => s.buildings[v]?.owner).filter((o) => o !== undefined))
  return [...owners].filter((o) => o !== pid && handSize(s.players[o]) > 0)
}

// Longest continuous path through a player's channels; opponents' buildings break the chain.
export function chainLength(s, pid) {
  const mine = Object.keys(s.channels).map(Number).filter((e) => s.channels[e] === pid)
  if (!mine.length) return 0
  const used = new Set()
  let best = 0
  const walk = (v, len) => {
    best = Math.max(best, len)
    const b = s.buildings[v]
    if (len > 0 && b && b.owner !== pid) return
    for (const e of GEO.vertices[v].edges) {
      if (s.channels[e] !== pid || used.has(e)) continue
      used.add(e)
      const edge = GEO.edges[e]
      walk(edge.a === v ? edge.b : edge.a, len + 1)
      used.delete(e)
    }
  }
  for (const e of mine) {
    walk(GEO.edges[e].a, 0)
    walk(GEO.edges[e].b, 0)
  }
  return best
}

export function tradeCheck(s, t) {
  const A = s.players[t.from]
  const B = s.players[t.to]
  if (s.phase !== 'main' || t.from !== s.current || !B || t.to === t.from) return no('Not now')
  const nGive = RESOURCES.reduce((n, r) => n + (t.give[r] ?? 0), 0)
  const nGet = RESOURCES.reduce((n, r) => n + (t.get[r] ?? 0), 0)
  if (!nGive || !nGet) return no('Both sides must offer something')
  if (RESOURCES.some((r) => t.give[r] && t.get[r])) return no("Can't swap a resource for itself")
  if (!canAfford(A, t.give)) return no(`${A.name} doesn't have that`)
  if (!canAfford(B, t.get)) return no(`${B.name} doesn't have that`)
  return yes
}

export const resList = (bag) =>
  RESOURCES.filter((r) => bag[r]).map((r) => `${bag[r]} ${RES[r].icon}`).join(' ') || 'nothing'

// ---------- internals ----------

function log(s, text, pid = null) {
  s.log.push({ id: s.logId++, text, pid })
  if (s.log.length > 150) s.log.shift()
}

function pay(s, p, cost) {
  for (const r of RESOURCES) {
    p.hand[r] -= cost[r] ?? 0
    s.bank[r] += cost[r] ?? 0
  }
}

function give(s, p, res, n) {
  const k = Math.min(n, s.bank[res])
  p.hand[res] += k
  s.bank[res] -= k
  return k
}

function updateLongest(s) {
  const lens = s.players.map((p) => chainLength(s, p.id))
  const max = Math.max(...lens)
  const holder = s.longest?.pid
  let next
  if (max < 5) next = null
  else if (holder !== undefined && lens[holder] === max) next = { pid: holder, len: max }
  else {
    const top = lens.flatMap((l, i) => (l === max ? [i] : []))
    next = top.length === 1 ? { pid: top[0], len: max } : null
  }
  if (next?.pid !== holder) {
    if (next) log(s, `⛓️ ${s.players[next.pid].name} now runs the Longest Chain (${next.len})`, next.pid)
    else if (holder !== undefined) log(s, `⛓️ The Longest Chain was forked — nobody holds it`)
  }
  s.longest = next
}

function updateArmy(s, p) {
  if (p.knights < 3 || s.army?.pid === p.id) {
    if (s.army?.pid === p.id) s.army.size = p.knights
    return
  }
  if (!s.army || p.knights > s.army.size) {
    s.army = { pid: p.id, size: p.knights }
    log(s, `🤖 ${p.name} commands the Largest Botnet (${p.knights} hackers)`, p.id)
  }
}

function checkWinner(s) {
  if (s.phase === 'setup') return
  const p = cur(s)
  if (victoryPoints(s, p.id) >= WIN_VP) {
    s.winner = p.id
    s.phase = 'gameover'
    const nfts = p.dev.filter((d) => d.type === 'vp').length
    log(s, `🚀 ${p.name} hit ${victoryPoints(s, p.id)} VP${nfts ? ` (revealing ${nfts} Rare NFT${nfts > 1 ? 's' : ''})` : ''} and mooned!`, p.id)
  }
}

function produce(s, roll) {
  // Collect what each player is owed per resource, then apply the bank-shortage rule.
  const owed = Object.fromEntries(RESOURCES.map((r) => [r, {}]))
  s.board.tiles.forEach((t, hex) => {
    if (t.num !== roll || hex === s.board.hacker) return
    for (const v of GEO.hexes[hex].vertices) {
      const b = s.buildings[v]
      if (b) owed[t.res][b.owner] = (owed[t.res][b.owner] ?? 0) + (b.dc ? 2 : 1)
    }
  })
  const gains = s.players.map(() => emptyHand())
  for (const r of RESOURCES) {
    const claims = Object.entries(owed[r])
    const total = claims.reduce((t, [, n]) => t + n, 0)
    if (!total) continue
    if (total > s.bank[r] && claims.length > 1) {
      log(s, `Bank is short on ${RES[r].name} ${RES[r].icon} — nobody gets any`)
      continue
    }
    for (const [pid, n] of claims) gains[pid][r] = give(s, s.players[pid], r, n)
  }
  gains.forEach((g, pid) => {
    if (RESOURCES.some((r) => g[r])) log(s, `${s.players[pid].name} mined ${resList(g)}`, Number(pid))
  })
  if (gains.every((g) => RESOURCES.every((r) => !g[r]))) log(s, `Empty block — nothing mined`)
}

function startHacker(s, after) {
  s.afterHacker = after
  s.phase = 'hacker'
}

function finishHacker(s) {
  s.phase = s.afterHacker
  s.afterHacker = null
}

function steal(s, thief, victim) {
  const pool = RESOURCES.flatMap((r) => Array(victim.hand[r]).fill(r))
  if (!pool.length) return
  const r = pool[Math.floor(Math.random() * pool.length)]
  victim.hand[r]--
  thief.hand[r]++
  log(s, `🥷 ${thief.name} drained 1 resource from ${victim.name}`, thief.id)
}

function nextTurn(s) {
  s.current = (s.current + 1) % s.players.length
  s.turn++
  s.phase = 'preroll'
  s.devPlayed = false
  s.freeChannels = 0
  log(s, `— ${cur(s).name}'s turn —`, s.current)
  checkWinner(s) // Longest Chain can change hands on someone else's turn
}

// ---------- reducer ----------

export const rollDice = () => [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]

export function reducer(state, action) {
  if (action.type === 'NEW_GAME') return createGame(action.players)
  if (action.type === 'QUIT') return null
  if (!state || state.phase === 'gameover') return state
  const s = structuredClone(state)
  const p = cur(s)

  switch (action.type) {
    // ----- genesis round -----
    case 'SETUP_NODE': {
      if (s.phase !== 'setup' || s.setup.node !== null) return state
      const pid = actingPlayer(s)
      const me = s.players[pid]
      if (!canPlaceNode(s, pid, action.v, { setup: true }).ok) return state
      s.buildings[action.v] = { owner: pid, dc: false }
      me.left.node--
      s.setup.node = action.v
      // Second node pays out one of each adjacent resource.
      if (s.setup.step >= s.players.length) {
        const got = emptyHand()
        for (const h of GEO.vertices[action.v].hexes) {
          const res = s.board.tiles[h].res
          if (res !== 'desert') got[res] += give(s, me, res, 1)
        }
        log(s, `${me.name} spun up a node and got ${resList(got)}`, pid)
      } else log(s, `${me.name} spun up a node`, pid)
      return s
    }

    case 'SETUP_CHANNEL': {
      if (s.phase !== 'setup' || s.setup.node === null) return state
      const pid = actingPlayer(s)
      if (!canPlaceChannel(s, pid, action.e, { from: s.setup.node }).ok) return state
      s.channels[action.e] = pid
      s.players[pid].left.channel--
      s.setup.node = null
      s.setup.step++
      if (s.setup.step >= s.setup.order.length) {
        s.current = 0
        s.turn = 1
        s.phase = 'preroll'
        log(s, `Mainnet is live. ${cur(s).name} rolls first.`, 0)
      }
      return s
    }

    // ----- rolling -----
    case 'ROLL': {
      if (s.phase !== 'preroll') return state
      const [a, b] = action.dice
      const sum = a + b
      s.dice = [a, b]
      log(s, `${p.name} rolled ${a} + ${b} = ${sum}`, p.id)
      if (sum !== 7) {
        produce(s, sum)
        s.phase = 'main'
        return s
      }
      log(s, `🚨 7 rolled — exploit detected!`, p.id)
      for (const pl of s.players) {
        const n = handSize(pl)
        if (n > 7) s.discards[pl.id] = Math.floor(n / 2)
      }
      if (Object.keys(s.discards).length) {
        s.phase = 'discard'
        log(s, `Over-leveraged wallets get liquidated: ${Object.entries(s.discards).map(([i, n]) => `${s.players[i].name} −${n}`).join(', ')}`)
      } else startHacker(s, 'main')
      return s
    }

    case 'DISCARD': {
      if (s.phase !== 'discard') return state
      const pid = actingPlayer(s)
      const me = s.players[pid]
      const n = RESOURCES.reduce((t, r) => t + (action.cards[r] ?? 0), 0)
      if (n !== s.discards[pid] || !canAfford(me, action.cards)) return state
      pay(s, me, action.cards)
      log(s, `${me.name} was liquidated for ${resList(action.cards)}`, pid)
      delete s.discards[pid]
      if (!Object.keys(s.discards).length) startHacker(s, 'main')
      return s
    }

    case 'MOVE_HACKER': {
      if (s.phase !== 'hacker' || action.hex === s.board.hacker || !GEO.hexes[action.hex]) return state
      s.board.hacker = action.hex
      const t = s.board.tiles[action.hex]
      log(s, `🥷 The Hacker breached ${t.num ? `a ${t.num}` : 'the Bear Market'}`, p.id)
      const victims = victimsAt(s, action.hex, p.id)
      if (victims.length === 0) finishHacker(s)
      else if (victims.length === 1) {
        steal(s, p, s.players[victims[0]])
        finishHacker(s)
      } else s.phase = 'steal'
      return s
    }

    case 'STEAL': {
      if (s.phase !== 'steal' || !victimsAt(s, s.board.hacker, p.id).includes(action.pid)) return state
      steal(s, p, s.players[action.pid])
      finishHacker(s)
      return s
    }

    // ----- building -----
    case 'BUILD_CHANNEL': {
      const free = s.phase === 'rollup'
      if (!free && !canBuild(s, p.id, 'channel').ok) return state
      if (free && p.left.channel < 1) return state
      if (!canPlaceChannel(s, p.id, action.e).ok) return state
      if (!free) pay(s, p, COSTS.channel)
      s.channels[action.e] = p.id
      p.left.channel--
      log(s, `${p.name} opened a channel${free ? ' (rollup)' : ''}`, p.id)
      if (free && (--s.freeChannels <= 0 || p.left.channel < 1 || !legalChannels(s, p.id).length)) {
        s.freeChannels = 0
        s.phase = 'main'
      }
      updateLongest(s)
      checkWinner(s)
      return s
    }

    case 'END_ROLLUP': {
      if (s.phase !== 'rollup') return state
      s.freeChannels = 0
      s.phase = 'main'
      return s
    }

    case 'BUILD_NODE': {
      if (!canBuild(s, p.id, 'node').ok || !canPlaceNode(s, p.id, action.v).ok) return state
      pay(s, p, COSTS.node)
      s.buildings[action.v] = { owner: p.id, dc: false }
      p.left.node--
      log(s, `${p.name} spun up a node`, p.id)
      updateLongest(s) // a new node can cut an opponent's chain
      checkWinner(s)
      return s
    }

    case 'BUILD_DC': {
      const b = s.buildings[action.v]
      if (!canBuild(s, p.id, 'dc').ok || b?.owner !== p.id || b.dc) return state
      pay(s, p, COSTS.dc)
      b.dc = true
      p.left.dc--
      p.left.node++
      log(s, `${p.name} upgraded a node to a data center 🏢`, p.id)
      checkWinner(s)
      return s
    }

    case 'BUY_DEV': {
      if (!canBuild(s, p.id, 'dev').ok) return state
      pay(s, p, COSTS.dev)
      const type = s.devDeck.pop()
      const vpCount = p.dev.filter((d) => d.type === 'vp').length
      p.dev.push({ type, turn: s.turn, ...(type === 'vp' ? { name: NFT_NAMES[vpCount % NFT_NAMES.length] } : {}) })
      log(s, `${p.name} deployed a smart contract 📜`, p.id)
      checkWinner(s)
      return s
    }

    // ----- smart contracts -----
    case 'PLAY_DEV': {
      const { card } = action
      if (!playableDev(s, p.id).includes(card)) return state
      if (card === 'plenty' && (!action.res?.length || action.res.length !== 2 || action.res.some((r) => !s.bank[r])))
        return state
      if (card === 'plenty' && action.res[0] === action.res[1] && s.bank[action.res[0]] < 2) return state
      if (card === 'monopoly' && !RESOURCES.includes(action.res)) return state
      p.dev.splice(p.dev.findIndex((d) => d.type === card && d.turn < s.turn), 1)
      s.devPlayed = true
      log(s, `${p.name} executed ${DEV[card].icon} ${DEV[card].name}`, p.id)
      if (card === 'knight') {
        p.knights++
        updateArmy(s, p)
        startHacker(s, s.phase)
      } else if (card === 'road') {
        s.freeChannels = Math.min(2, p.left.channel)
        if (s.freeChannels && legalChannels(s, p.id).length) s.phase = 'rollup'
        else s.freeChannels = 0
      } else if (card === 'plenty') {
        for (const r of action.res) give(s, p, r, 1)
        log(s, `${p.name} claimed ${action.res.map((r) => RES[r].icon).join(' ')} from the airdrop`, p.id)
      } else if (card === 'monopoly') {
        let total = 0
        for (const o of s.players) {
          if (o.id === p.id) continue
          total += o.hand[action.res]
          p.hand[action.res] += o.hand[action.res]
          o.hand[action.res] = 0
        }
        log(s, `🧹 ${p.name} rugged everyone's ${RES[action.res].name} — ${total} ${RES[action.res].icon}`, p.id)
      }
      checkWinner(s)
      return s
    }

    // ----- trading -----
    case 'BANK_TRADE': {
      const { give: g, get } = action
      if (s.phase !== 'main' || g === get || !RESOURCES.includes(g) || !RESOURCES.includes(get)) return state
      const rate = tradeRate(s, p.id, g)
      if (p.hand[g] < rate || s.bank[get] < 1) return state
      pay(s, p, { [g]: rate })
      give(s, p, get, 1)
      log(s, `${p.name} swapped ${rate} ${RES[g].icon} → 1 ${RES[get].icon}`, p.id)
      return s
    }

    case 'TRADE': {
      const t = action.trade
      if (!tradeCheck(s, t).ok) return state
      const A = s.players[t.from]
      const B = s.players[t.to]
      for (const r of RESOURCES) {
        const g = t.give[r] ?? 0
        const w = t.get[r] ?? 0
        A.hand[r] += w - g
        B.hand[r] += g - w
      }
      log(s, `🤝 OTC: ${A.name} sent ${resList(t.give)} to ${B.name} for ${resList(t.get)}`, A.id)
      return s
    }

    case 'END_TURN': {
      if (s.phase !== 'main') return state
      nextTurn(s)
      return s
    }

    default:
      return state
  }
}
