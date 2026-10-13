// Pure game engine: state + reducer implementing the standard Monopoly rules.
import {
  BOARD, OWNABLE, RAIL_RENT, JAIL, GO_SALARY, JAIL_FINE, STARTING_CASH,
  TOTAL_HOUSES, TOTAL_HOTELS, groupMembers, houseCost, mortgageValue, unmortgageCost,
} from '../data/board.js'
import { DECKS, shuffled } from '../data/cards.js'

// ---------- setup ----------

export function createGame(configs) {
  const props = {}
  for (const id of OWNABLE) props[id] = { owner: null, houses: 0, mortgaged: false }
  const s = {
    players: configs.map((c, i) => ({
      id: i, name: c.name, token: c.token, color: c.color, isAI: c.isAI,
      money: STARTING_CASH, pos: 0, inJail: false, jailTurns: 0, cards: [], bankrupt: false,
    })),
    props,
    current: 0,
    phase: 'preroll',
    dice: [3, 4],
    doublesCount: 0,
    rolledDoubles: false,
    decks: { chance: shuffled(16), chest: shuffled(16) },
    bank: { houses: TOTAL_HOUSES, hotels: TOTAL_HOTELS },
    pendingBuy: null,
    card: null,
    auction: null,
    debts: [],
    resume: null,
    moving: null,
    moveOpts: null,
    log: [],
    logId: 0,
    winner: null,
    turn: 1,
  }
  log(s, 'start', { p: 0 })
  return s
}

// ---------- queries (also used by the UI and AI) ----------

export const alive = (s) => s.players.filter((p) => !p.bankrupt)
export const cur = (s) => s.players[s.current]

export function actingPlayer(s) {
  if (s.phase === 'debt' && s.debts.length) return s.debts[0].from
  if (s.phase === 'auction' && s.auction) return s.auction.active[s.auction.turn]
  return s.current
}

export const ownedBy = (s, pid) => OWNABLE.filter((id) => s.props[id].owner === pid)

export function ownsGroup(s, pid, group) {
  return groupMembers(group).every((id) => s.props[id].owner === pid)
}

export const groupHasBuildings = (s, group) => groupMembers(group).some((id) => s.props[id].houses > 0)

export function rentFor(s, id, diceSum) {
  const sp = BOARD[id]
  const pr = s.props[id]
  if (pr.owner === null || pr.mortgaged) return 0
  if (sp.type === 'street') {
    if (pr.houses > 0) return sp.rent[pr.houses]
    return sp.rent[0] * (ownsGroup(s, pr.owner, sp.group) ? 2 : 1)
  }
  const sameKind = OWNABLE.filter((o) => BOARD[o].type === sp.type && s.props[o].owner === pr.owner).length
  if (sp.type === 'rail') return RAIL_RENT[sameKind - 1]
  return (sameKind === 2 ? 10 : 4) * diceSum
}

export function canBuild(s, pid, id) {
  const sp = BOARD[id]
  const pr = s.props[id]
  if (sp.type !== 'street' || pr.owner !== pid) return no('notYours')
  if (!ownsGroup(s, pid, sp.group)) return no('needSet')
  const members = groupMembers(sp.group)
  if (members.some((m) => s.props[m].mortgaged)) return no('setMortgaged')
  if (pr.houses >= 5) return no('hasDc')
  if (pr.houses > Math.min(...members.map((m) => s.props[m].houses))) return no('buildEven')
  if (pr.houses === 4 ? s.bank.hotels < 1 : s.bank.houses < 1) return no('bankOut')
  if (s.players[pid].money < houseCost(id)) return no('noCash')
  return yes
}

export function canSell(s, pid, id) {
  const sp = BOARD[id]
  const pr = s.props[id]
  if (pr.owner !== pid || pr.houses === 0) return no('nothingToSell')
  if (pr.houses < Math.max(...groupMembers(sp.group).map((m) => s.props[m].houses))) return no('sellEven')
  return yes
}

export function canMortgage(s, pid, id) {
  const sp = BOARD[id]
  const pr = s.props[id]
  if (pr.owner !== pid || pr.mortgaged) return no('notMortgageable')
  if (sp.type === 'street' && groupHasBuildings(s, sp.group)) return no('sellFirst')
  return yes
}

export function canUnmortgage(s, pid, id) {
  const pr = s.props[id]
  if (pr.owner !== pid || !pr.mortgaged) return no('notMortgaged')
  if (s.players[pid].money < unmortgageCost(id)) return no('noCash')
  return yes
}

export function netWorth(s, pid) {
  const p = s.players[pid]
  let total = p.money
  for (const id of ownedBy(s, pid)) {
    const pr = s.props[id]
    total += pr.mortgaged ? 0 : mortgageValue(id)
    total += (pr.houses * houseCost(id)) / 2
  }
  return total
}

export function tradeCheck(s, offer) {
  const { from, to, give, get } = offer
  const A = s.players[from]
  const B = s.players[to]
  if (!A || !B || A.bankrupt || B.bankrupt || from === to) return no('pickPartner')
  if (!give.props.length && !get.props.length && !give.cash && !get.cash && !give.cards && !get.cards) return no('empty')
  for (const [list, owner] of [[give.props, from], [get.props, to]]) {
    for (const id of list) {
      if (s.props[id].owner !== owner) return no('ownership')
      const sp = BOARD[id]
      if (sp.type === 'street' && groupHasBuildings(s, sp.group)) return no('sellOn', { grp: sp.group })
    }
  }
  if (give.cash < 0 || get.cash < 0) return no('positive')
  if (give.cash > A.money) return no('lacksCash', { p: from })
  if (get.cash > B.money) return no('lacksCash', { p: to })
  if (give.cards > A.cards.length || get.cards > B.cards.length) return no('noCards')
  const feeA = mortgageFees(s, get.props)
  const feeB = mortgageFees(s, give.props)
  if (A.money - give.cash + get.cash < feeA) return no('fee', { p: from })
  if (B.money - get.cash + give.cash < feeB) return no('fee', { p: to })
  return yes
}

const mortgageFees = (s, ids) =>
  ids.reduce((t, id) => t + (s.props[id].mortgaged ? Math.ceil(mortgageValue(id) * 0.1) : 0), 0)

const yes = { ok: true }
// A failed check carries its reason as a message key (mono.why.*) for the UI to translate.
const no = (k, v) => ({ ok: false, reason: { k, v } })

// ---------- internals ----------

// Log lines are message keys (mono.log.*) plus params, so every screen shows them in its own language.
function log(s, k, v = {}, pid = null) {
  s.log.push({ id: s.logId++, k, v, pid })
  if (s.log.length > 150) s.log.shift()
}

function startMove(s, steps, dir = 1, opts = {}) {
  s.moveOpts = opts
  if (steps <= 0) {
    s.moving = null
    land(s)
    return
  }
  s.moving = { steps, dir }
  s.phase = 'moving'
}

function sendToJail(s, p) {
  p.pos = JAIL
  p.inJail = true
  p.jailTurns = 0
  if (p.id === s.current) {
    s.rolledDoubles = false
    s.doublesCount = 0
    s.resume = null
  }
  log(s, 'jailed', { p: p.id }, p.id)
}

// Transfer money, or queue a debt the payer must raise funds for. `reason` is a message ({ k: 'r.rent', v }).
function charge(s, from, to, amount, reason) {
  if (amount <= 0) return
  const p = s.players[from]
  const queued = s.debts.some((d) => d.from === from)
  if (!queued && p.money >= amount) {
    p.money -= amount
    if (to !== null) s.players[to].money += amount
    log(s, to !== null ? 'paidTo' : 'paid', { p: from, q: to, m: amount, reason }, from)
  } else {
    s.debts.push({ from, to, amount, reason })
    log(s, 'owes', { p: from, m: amount, reason }, from)
  }
}

function checkWinner(s) {
  const left = alive(s)
  if (left.length === 1) {
    s.winner = left[0].id
    s.phase = 'gameover'
    log(s, 'winner', { p: left[0].id }, left[0].id)
    return true
  }
  return false
}

function nextTurn(s) {
  if (checkWinner(s)) return
  let n = s.current
  do n = (n + 1) % s.players.length
  while (s.players[n].bankrupt)
  s.current = n
  s.doublesCount = 0
  s.rolledDoubles = false
  s.resume = null
  s.phase = 'preroll'
  s.turn++
  log(s, 'turn', { p: n }, n)
}

function continueTurn(s) {
  if (checkWinner(s)) return
  if (s.debts.length) {
    s.phase = 'debt'
    return
  }
  const p = cur(s)
  if (p.bankrupt) return nextTurn(s)
  if (s.resume) {
    const steps = s.resume.steps
    s.resume = null
    return startMove(s, steps)
  }
  s.phase = s.rolledDoubles && !p.inJail ? 'preroll' : 'postroll'
  if (s.phase === 'preroll') log(s, 'doubles', { p: p.id }, p.id)
}

function land(s) {
  const p = cur(s)
  const sp = BOARD[p.pos]
  const opts = s.moveOpts || {}
  s.moveOpts = null
  switch (sp.type) {
    case 'gotojail':
      sendToJail(s, p)
      return continueTurn(s)
    case 'tax':
      charge(s, p.id, null, sp.amount, { k: 'r.tax', v: { sp: sp.id } })
      return continueTurn(s)
    case 'chance':
    case 'chest': {
      const deck = sp.type
      const id = s.decks[deck].shift()
      const card = DECKS[deck].cards[id]
      if (card.effect.type !== 'goojf') s.decks[deck].push(id)
      s.card = { deck, id }
      s.phase = 'card'
      log(s, 'drew', { p: p.id, deck, card: [deck, id] }, p.id)
      return
    }
    case 'street':
    case 'rail':
    case 'utility': {
      const pr = s.props[p.pos]
      if (pr.owner === null) {
        s.pendingBuy = p.pos
        s.phase = 'buy'
        return
      }
      if (pr.owner === p.id) return continueTurn(s)
      const owner = s.players[pr.owner]
      if (pr.mortgaged) {
        log(s, 'noRent', { sp: sp.id }, p.id)
        return continueTurn(s)
      }
      let rent
      if (sp.type === 'utility' && opts.util10) {
        const d = [roll1(), roll1()]
        rent = 10 * (d[0] + d[1])
        log(s, 'utilRoll', { p: p.id, a: d[0], b: d[1] }, p.id)
      } else {
        rent = rentFor(s, p.pos, s.dice[0] + s.dice[1]) * (sp.type === 'rail' && opts.rail2 ? 2 : 1)
      }
      charge(s, p.id, owner.id, rent, { k: 'r.rent', v: { sp: sp.id } })
      return continueTurn(s)
    }
    case 'go':
    case 'jail':
    case 'parking':
    default:
      return continueTurn(s)
  }
}

const roll1 = () => 1 + Math.floor(Math.random() * 6)
export const rollDice = () => [roll1(), roll1()]

function resolveCard(s) {
  const { deck, id } = s.card
  const e = DECKS[deck].cards[id].effect
  s.card = null
  const p = cur(s)
  switch (e.type) {
    case 'advance':
      return startMove(s, (e.to - p.pos + 40) % 40)
    case 'nearest': {
      let n = p.pos
      do n = (n + 1) % 40
      while (BOARD[n].type !== e.kind)
      return startMove(s, (n - p.pos + 40) % 40, 1, e.kind === 'rail' ? { rail2: true } : { util10: true })
    }
    case 'back':
      return startMove(s, e.n, -1)
    case 'jail':
      sendToJail(s, p)
      return continueTurn(s)
    case 'goojf':
      p.cards.push(deck)
      return continueTurn(s)
    case 'money':
      if (e.amount > 0) {
        p.money += e.amount
        log(s, 'collected', { p: p.id, m: e.amount }, p.id)
      } else charge(s, p.id, null, -e.amount, { k: 'r.card' })
      return continueTurn(s)
    case 'repairs': {
      let total = 0
      for (const pid of ownedBy(s, p.id)) {
        const h = s.props[pid].houses
        total += h === 5 ? e.hotel : h * e.house
      }
      if (total) charge(s, p.id, null, total, { k: 'r.repairs' })
      else log(s, 'noBuildings', { p: p.id }, p.id)
      return continueTurn(s)
    }
    case 'each':
      for (const o of alive(s)) {
        if (o.id === p.id) continue
        if (e.amount < 0) charge(s, p.id, o.id, -e.amount, { k: 'r.chair' })
        else charge(s, o.id, p.id, e.amount, { k: 'r.gift' })
      }
      return continueTurn(s)
  }
}

function goBankrupt(s, pid, creditor) {
  const p = s.players[pid]
  for (const id of ownedBy(s, pid)) {
    const pr = s.props[id]
    if (pr.houses) {
      p.money += (pr.houses * houseCost(id)) / 2
      if (pr.houses === 5) s.bank.hotels++
      else s.bank.houses += pr.houses
      pr.houses = 0
    }
  }
  if (creditor !== null) {
    const c = s.players[creditor]
    c.money += p.money
    for (const id of ownedBy(s, pid)) s.props[id].owner = creditor
    c.cards.push(...p.cards)
    log(s, 'rektTo', { p: pid, q: c.id }, pid)
  } else {
    for (const id of ownedBy(s, pid)) s.props[id] = { owner: null, houses: 0, mortgaged: false }
    for (const deck of p.cards) s.decks[deck].push(goojfIndex(deck))
    log(s, 'rektBank', { p: pid }, pid)
  }
  p.money = 0
  p.cards = []
  p.bankrupt = true
  p.inJail = false
  s.debts = s.debts.filter((d) => d.from !== pid && d.to !== pid)
  if (pid === s.current) {
    s.resume = null
    s.rolledDoubles = false
  }
}

const goojfIndex = (deck) => DECKS[deck].cards.findIndex((c) => c.effect.type === 'goojf')

function release(p) {
  p.inJail = false
  p.jailTurns = 0
}

function finishAuction(s) {
  const a = s.auction
  const sp = BOARD[a.id]
  if (a.active.length === 0) {
    log(s, 'noBidders', { sp: sp.id })
  } else if (a.active.length === 1 && a.bidder === a.active[0]) {
    const w = s.players[a.bidder]
    w.money -= a.high
    s.props[a.id].owner = w.id
    log(s, 'wonAuction', { p: w.id, sp: sp.id, m: a.high }, w.id)
  } else return
  s.auction = null
  continueTurn(s)
}

// ---------- reducer ----------

const MANAGE_PHASES = ['preroll', 'postroll', 'buy']

export function reducer(state, action) {
  if (action.type === 'NEW_GAME') return createGame(action.players)
  if (action.type === 'LOAD') return action.state
  if (action.type === 'QUIT') return null
  if (!state) return state
  const s = structuredClone(state)
  const p = cur(s)
  const actor = s.players[actingPlayer(s)]

  switch (action.type) {
    case 'ROLL': {
      if (s.phase !== 'preroll') return state
      const [a, b] = action.dice
      const doubles = a === b
      s.dice = [a, b]
      log(s, doubles ? 'rolledDoubles' : 'rolled', { p: p.id, a, b }, p.id)
      if (p.inJail) {
        s.rolledDoubles = false
        if (doubles) {
          release(p)
          log(s, 'rolledOut', { p: p.id }, p.id)
          startMove(s, a + b)
        } else if (++p.jailTurns >= 3) {
          release(p)
          log(s, 'thirdFail', { p: p.id, m: JAIL_FINE }, p.id)
          charge(s, p.id, null, JAIL_FINE, { k: 'r.bail' })
          s.resume = { steps: a + b }
          continueTurn(s)
        } else {
          s.phase = 'postroll'
        }
        return s
      }
      if (doubles && ++s.doublesCount === 3) {
        log(s, 'manipulation', {}, p.id)
        sendToJail(s, p)
        continueTurn(s)
        return s
      }
      s.rolledDoubles = doubles
      startMove(s, a + b)
      return s
    }

    case 'STEP': {
      if (s.phase !== 'moving' || !s.moving) return state
      const { dir } = s.moving
      p.pos = (p.pos + dir + 40) % 40
      if (dir === 1 && p.pos === 0) {
        p.money += GO_SALARY
        log(s, 'passedGo', { p: p.id, m: GO_SALARY }, p.id)
      }
      if (--s.moving.steps === 0) {
        s.moving = null
        land(s)
      }
      return s
    }

    case 'BUY': {
      if (s.phase !== 'buy') return state
      const id = s.pendingBuy
      if (p.money < BOARD[id].price) return state
      p.money -= BOARD[id].price
      s.props[id].owner = p.id
      s.pendingBuy = null
      log(s, 'bought', { p: p.id, sp: id, m: BOARD[id].price }, p.id)
      continueTurn(s)
      return s
    }

    case 'AUCTION': {
      if (s.phase !== 'buy') return state
      const ids = alive(s).map((x) => x.id)
      const start = ids.indexOf(s.current)
      s.auction = {
        id: s.pendingBuy,
        high: 0,
        bidder: null,
        active: [...ids.slice(start), ...ids.slice(0, start)],
        turn: 0,
      }
      s.pendingBuy = null
      s.phase = 'auction'
      log(s, 'upForAuction', { sp: s.auction.id }, p.id)
      return s
    }

    case 'BID': {
      const a = s.auction
      if (s.phase !== 'auction' || action.amount <= a.high || action.amount > actor.money) return state
      a.high = action.amount
      a.bidder = actor.id
      a.turn = (a.turn + 1) % a.active.length
      log(s, 'bid', { p: actor.id, m: action.amount }, actor.id)
      finishAuction(s)
      return s
    }

    case 'PASS_BID': {
      const a = s.auction
      if (s.phase !== 'auction') return state
      a.active.splice(a.turn, 1)
      if (a.turn >= a.active.length) a.turn = 0
      log(s, 'outOfAuction', { p: actor.id }, actor.id)
      finishAuction(s)
      return s
    }

    case 'RESOLVE_CARD':
      if (s.phase !== 'card') return state
      resolveCard(s)
      return s

    case 'PAY_JAIL':
      if (s.phase !== 'preroll' || !p.inJail || p.money < JAIL_FINE) return state
      p.money -= JAIL_FINE
      release(p)
      log(s, 'bail', { p: p.id, m: JAIL_FINE }, p.id)
      return s

    case 'USE_CARD': {
      if (s.phase !== 'preroll' || !p.inJail || !p.cards.length) return state
      const deck = p.cards.shift()
      s.decks[deck].push(goojfIndex(deck))
      release(p)
      log(s, 'usedCard', { p: p.id }, p.id)
      return s
    }

    case 'END_TURN':
      if (s.phase !== 'postroll') return state
      nextTurn(s)
      return s

    case 'BUILD': {
      const { id } = action
      if (!MANAGE_PHASES.includes(s.phase) || !canBuild(s, actor.id, id).ok) return state
      const pr = s.props[id]
      actor.money -= houseCost(id)
      pr.houses++
      if (pr.houses === 5) {
        s.bank.hotels--
        s.bank.houses += 4
        log(s, 'builtDc', { p: actor.id, sp: id }, actor.id)
      } else {
        s.bank.houses--
        log(s, 'builtNode', { p: actor.id, sp: id }, actor.id)
      }
      return s
    }

    case 'SELL': {
      const { id } = action
      if (![...MANAGE_PHASES, 'debt'].includes(s.phase) || !canSell(s, actor.id, id).ok) return state
      const pr = s.props[id]
      const cost = houseCost(id)
      if (pr.houses === 5) {
        const back = Math.min(4, s.bank.houses)
        s.bank.hotels++
        s.bank.houses -= back
        actor.money += ((5 - back) * cost) / 2
        pr.houses = back
      } else {
        pr.houses--
        s.bank.houses++
        actor.money += cost / 2
      }
      log(s, 'sold', { p: actor.id, sp: id }, actor.id)
      return s
    }

    case 'MORTGAGE': {
      const { id } = action
      if (![...MANAGE_PHASES, 'debt'].includes(s.phase) || !canMortgage(s, actor.id, id).ok) return state
      s.props[id].mortgaged = true
      actor.money += mortgageValue(id)
      log(s, 'mortgaged', { p: actor.id, sp: id, m: mortgageValue(id) }, actor.id)
      return s
    }

    case 'UNMORTGAGE': {
      const { id } = action
      if (!MANAGE_PHASES.includes(s.phase) || !canUnmortgage(s, actor.id, id).ok) return state
      s.props[id].mortgaged = false
      actor.money -= unmortgageCost(id)
      log(s, 'unmortgaged', { p: actor.id, sp: id }, actor.id)
      return s
    }

    case 'PAY_DEBT': {
      if (s.phase !== 'debt') return state
      const d = s.debts[0]
      if (actor.money < d.amount) return state
      s.debts.shift()
      actor.money -= d.amount
      if (d.to !== null) s.players[d.to].money += d.amount
      log(s, d.to !== null ? 'paidTo' : 'paid', { p: actor.id, q: d.to, m: d.amount, reason: d.reason }, actor.id)
      continueTurn(s)
      return s
    }

    case 'BANKRUPT': {
      if (s.phase !== 'debt') return state
      goBankrupt(s, actor.id, s.debts[0].to)
      continueTurn(s)
      return s
    }

    case 'TRADE': {
      const o = action.offer
      if (!['preroll', 'postroll'].includes(s.phase) || o.from !== s.current || !tradeCheck(s, o).ok) return state
      const A = s.players[o.from]
      const B = s.players[o.to]
      A.money += o.get.cash - o.give.cash
      B.money += o.give.cash - o.get.cash
      for (const id of o.give.props) s.props[id].owner = B.id
      for (const id of o.get.props) s.props[id].owner = A.id
      A.money -= mortgageFees(s, o.get.props)
      B.money -= mortgageFees(s, o.give.props)
      B.cards.push(...A.cards.splice(0, o.give.cards))
      A.cards.push(...B.cards.splice(0, o.get.cards))
      log(s, 'traded', { p: A.id, q: B.id }, A.id)
      return s
    }

    default:
      return state
  }
}
