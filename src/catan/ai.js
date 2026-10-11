// Simple heuristic bot. Returns one action per call; the UI calls it again after each state change.
import { GEO, RESOURCES, COSTS, PIPS } from './data.js'
import {
  actingPlayer, canAfford, canBuild, canPlaceChannel, handSize, legalChannels, legalNodes, legalUpgrades,
  playableDev, tradeRate, victimsAt, victoryPoints, rollDice,
} from './engine.js'


// How good is a vertex to build on: production, with a bonus for new resource types and harbors.
function vertexValue(s, pid, v) {
  const have = new Set()
  for (const [bv, b] of Object.entries(s.buildings))
    if (b.owner === pid) for (const h of GEO.vertices[bv].hexes) have.add(s.board.tiles[h].res)
  let score = 0
  const kinds = new Set()
  for (const h of GEO.vertices[v].hexes) {
    const { res } = s.board.tiles[h]
    if (res === 'desert') continue
    const pips = PIPS[s.board.tiles[h].num] ?? 0
    score += pips * (res === 'chips' || res === 'fiber' ? 1.1 : 1)
    if (!have.has(res)) score += 1.5
    kinds.add(res)
  }
  score += kinds.size * 0.8
  const port = s.board.ports.find((p) => p.vertices.includes(v))
  if (port) score += port.type === 'any' ? 1.5 : 1
  return score
}

const best = (items, score) => items.reduce((b, x) => (b === null || score(x) > score(b) ? x : b), null)

const otherEnd = (e, v) => (GEO.edges[e].a === v ? GEO.edges[e].b : GEO.edges[e].a)

// Channel that heads toward the best open vertex within two steps.
function bestChannel(s, pid) {
  const options = legalChannels(s, pid)
  if (!options.length) return null
  const open = new Set(legalNodes(s, pid, { setup: true }))
  const score = (e) => {
    const { a, b } = GEO.edges[e]
    let sc = 0
    for (const v of [a, b]) {
      if (open.has(v) && !s.buildings[v]) sc = Math.max(sc, vertexValue(s, pid, v) + 2)
      for (const n of GEO.vertices[v].neighbors)
        if (open.has(n)) sc = Math.max(sc, vertexValue(s, pid, n) * 0.6)
    }
    return sc + Math.random() * 0.2
  }
  return best(options, score)
}

function missingFor(p, cost) {
  return RESOURCES.reduce((t, r) => t + Math.max(0, (cost[r] ?? 0) - p.hand[r]), 0)
}

// Which build should this bot be saving for right now?
function goal(s, p) {
  if (p.left.dc && legalUpgrades(s, p.id).length) {
    if (missingFor(p, COSTS.dc) <= 2 || !legalNodes(s, p.id).length) return 'dc'
  }
  if (p.left.node && legalNodes(s, p.id).length) return 'node'
  if (p.left.channel && p.left.node && legalChannels(s, p.id).length && !legalNodes(s, p.id).length) return 'channel'
  if (s.devDeck.length) return 'dev'
  return 'dc'
}

// Swap a surplus resource with the bank to complete the current goal.
function bankTrade(s, p, target) {
  const cost = COSTS[target]
  const need = RESOURCES.filter((r) => p.hand[r] < (cost[r] ?? 0) && s.bank[r] > 0)
  if (!need.length || missingFor(p, cost) > 2) return null
  for (const g of RESOURCES) {
    const rate = tradeRate(s, p.id, g)
    if (p.hand[g] - (cost[g] ?? 0) >= rate) return { type: 'BANK_TRADE', give: g, get: need[0] }
  }
  return null
}

function hackerTarget(s, pid) {
  const leader = (o) => victoryPoints(s, o, { hidden: false })
  const score = (hex) => {
    if (hex === s.board.hacker) return -Infinity
    let sc = 0
    for (const v of GEO.hexes[hex].vertices) {
      const b = s.buildings[v]
      if (!b) continue
      const w = (b.dc ? 2 : 1) * (PIPS[s.board.tiles[hex].num] ?? 0)
      sc += b.owner === pid ? -w * 3 : w * (1 + leader(b.owner) / 5)
    }
    return sc + (victimsAt(s, hex, pid).length ? 2 : 0) + Math.random() * 0.1
  }
  return best(GEO.hexes.map((h) => h.id), score)
}

function discardPick(p, n) {
  const hand = { ...p.hand }
  const out = {}
  for (let i = 0; i < n; i++) {
    const r = best(RESOURCES.filter((x) => hand[x] > 0), (x) => hand[x] - (x === 'hash' || x === 'stake' ? 0.5 : 0))
    hand[r]--
    out[r] = (out[r] ?? 0) + 1
  }
  return out
}

function playDev(s, p) {
  const cards = playableDev(s, p.id)
  if (!cards.length) return null
  // Hacker: when it's sitting on our production, or to chase the botnet.
  if (cards.includes('knight')) {
    const onUs = GEO.hexes[s.board.hacker].vertices.some((v) => s.buildings[v]?.owner === p.id)
    const chase = p.knights + 1 >= 3 && (!s.army || (s.army.pid !== p.id && p.knights + 1 > s.army.size))
    if (onUs || chase) return { type: 'PLAY_DEV', card: 'knight' }
  }
  if (s.phase !== 'main') return null
  if (cards.includes('monopoly')) {
    const totals = RESOURCES.map((r) => [r, s.players.reduce((t, o) => t + (o.id === p.id ? 0 : o.hand[r]), 0)])
    const [r, n] = best(totals, ([, n]) => n)
    if (n >= 3) return { type: 'PLAY_DEV', card: 'monopoly', res: r }
  }
  if (cards.includes('plenty')) {
    const cost = COSTS[goal(s, p)]
    const need = RESOURCES.flatMap((r) => Array(Math.max(0, (cost[r] ?? 0) - p.hand[r])).fill(r))
    const pick = [...need, 'hash', 'stake'].filter((r) => s.bank[r] > 0).slice(0, 2)
    if (pick.length === 2 && (pick[0] !== pick[1] || s.bank[pick[0]] >= 2)) return { type: 'PLAY_DEV', card: 'plenty', res: pick }
  }
  if (cards.includes('road') && p.left.channel >= 1 && legalChannels(s, p.id).length) return { type: 'PLAY_DEV', card: 'road' }
  return null
}

// Would bot `pid` accept this OTC trade (`give` goes to them, `get` comes from them)?
export function wouldAccept(s, pid, t) {
  const me = s.players[pid]
  if (!canAfford(me, t.get)) return false
  if (victoryPoints(s, t.from, { hidden: false }) >= 8) return false
  const nGive = RESOURCES.reduce((n, r) => n + (t.give[r] ?? 0), 0)
  const nGet = RESOURCES.reduce((n, r) => n + (t.get[r] ?? 0), 0)
  const cost = COSTS[goal(s, me)]
  const after = { ...me.hand }
  for (const r of RESOURCES) after[r] += (t.give[r] ?? 0) - (t.get[r] ?? 0)
  const helps = missingFor({ hand: after }, cost) < missingFor(me, cost)
  return nGive > nGet || (helps && nGive >= nGet)
}

export function aiAction(s) {
  const pid = actingPlayer(s)
  const p = s.players[pid]

  switch (s.phase) {
    case 'setup': {
      if (s.setup.node === null) {
        const v = best(legalNodes(s, pid, { setup: true }), (x) => vertexValue(s, pid, x) + Math.random() * 0.3)
        return { type: 'SETUP_NODE', v }
      }
      const from = s.setup.node
      const options = GEO.vertices[from].edges.filter((e) => canPlaceChannel(s, pid, e, { from }).ok)
      const open = new Set(legalNodes(s, pid, { setup: true }))
      const e = best(options, (x) => {
        const far = otherEnd(x, from)
        return Math.max(0, ...GEO.vertices[far].neighbors.filter((n) => open.has(n)).map((n) => vertexValue(s, pid, n))) + Math.random() * 0.2
      })
      return { type: 'SETUP_CHANNEL', e }
    }

    case 'preroll':
      return playDev(s, p) ?? { type: 'ROLL', dice: rollDice() }

    case 'discard':
      return { type: 'DISCARD', cards: discardPick(p, s.discards[pid]) }

    case 'hacker':
      return { type: 'MOVE_HACKER', hex: hackerTarget(s, pid) }

    case 'steal': {
      const victims = victimsAt(s, s.board.hacker, pid)
      return { type: 'STEAL', pid: best(victims, (o) => victoryPoints(s, o, { hidden: false }) * 2 + handSize(s.players[o])) }
    }

    case 'rollup': {
      const e = bestChannel(s, pid)
      return e === null ? { type: 'END_ROLLUP' } : { type: 'BUILD_CHANNEL', e }
    }

    case 'main': {
      const dev = playDev(s, p)
      if (dev) return dev
      if (canBuild(s, pid, 'dc').ok) {
        const v = best(legalUpgrades(s, pid), (x) => vertexValue(s, pid, x))
        return { type: 'BUILD_DC', v }
      }
      if (canBuild(s, pid, 'node').ok) {
        return { type: 'BUILD_NODE', v: best(legalNodes(s, pid), (x) => vertexValue(s, pid, x)) }
      }
      const g = goal(s, p)
      // Channels: when we need somewhere to put a node, keeping enough for it afterwards.
      if (canBuild(s, pid, 'channel').ok && (g === 'channel' || (!legalNodes(s, pid).length && p.left.node))) {
        const e = bestChannel(s, pid)
        if (e !== null) return { type: 'BUILD_CHANNEL', e }
      }
      if (g === 'dev' && canBuild(s, pid, 'dev').ok) return { type: 'BUY_DEV' }
      const trade = bankTrade(s, p, g)
      if (trade) return trade
      // Nothing to save for that we can reach — spend spare on contracts.
      if (canBuild(s, pid, 'dev').ok && handSize(p) > 6) return { type: 'BUY_DEV' }
      return { type: 'END_TURN' }
    }

    default:
      return null
  }
}
