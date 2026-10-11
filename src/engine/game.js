// Pure game engine: state + reducer implementing the standard Monopoly rules.
import {
  BOARD, GROUPS, OWNABLE, RAIL_RENT, JAIL, GO_SALARY, JAIL_FINE, STARTING_CASH,
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
  log(s, `Genesis block mined. ${s.players[0].name} goes first.`)
  return s
}

// ---------- queries (also used by the UI and AI) ----------

export const alive = (s) => s.players.filter((p) => !p.bankrupt)
export const cur = (s) => s.players[s.current]
export const money = (n) => '$' + n.toLocaleString('en-US')

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
  if (sp.type !== 'street' || pr.owner !== pid) return no('Not your street')
  if (!ownsGroup(s, pid, sp.group)) return no('Need the full color set')
  const members = groupMembers(sp.group)
  if (members.some((m) => s.props[m].mortgaged)) return no('Set has a mortgaged property')
  if (pr.houses >= 5) return no('Already has a data center')
  if (pr.houses > Math.min(...members.map((m) => s.props[m].houses))) return no('Build evenly across the set')
  if (pr.houses === 4 ? s.bank.hotels < 1 : s.bank.houses < 1) return no('Bank is out of buildings')
  if (s.players[pid].money < houseCost(id)) return no('Not enough cash')
  return yes
}

export function canSell(s, pid, id) {
  const sp = BOARD[id]
  const pr = s.props[id]
  if (pr.owner !== pid || pr.houses === 0) return no('Nothing to sell')
  if (pr.houses < Math.max(...groupMembers(sp.group).map((m) => s.props[m].houses))) return no('Sell evenly across the set')
  return yes
}

export function canMortgage(s, pid, id) {
  const sp = BOARD[id]
  const pr = s.props[id]
  if (pr.owner !== pid || pr.mortgaged) return no('Not mortgageable')
  if (sp.type === 'street' && groupHasBuildings(s, sp.group)) return no('Sell buildings in this set first')
  return yes
}

export function canUnmortgage(s, pid, id) {
  const pr = s.props[id]
  if (pr.owner !== pid || !pr.mortgaged) return no('Not mortgaged')
  if (s.players[pid].money < unmortgageCost(id)) return no('Not enough cash')
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
  if (!A || !B || A.bankrupt || B.bankrupt || from === to) return no('Pick a trading partner')
  if (!give.props.length && !get.props.length && !give.cash && !get.cash && !give.cards && !get.cards) return no('Trade is empty')
  for (const [list, owner] of [[give.props, from], [get.props, to]]) {
    for (const id of list) {
      if (s.props[id].owner !== owner) return no('Property ownership changed')
      const sp = BOARD[id]
      if (sp.type === 'street' && groupHasBuildings(s, sp.group)) return no(`Sell buildings on ${GROUPS[sp.group].name} first`)
    }
  }
  if (give.cash < 0 || get.cash < 0) return no('Cash must be positive')
  if (give.cash > A.money) return no(`${A.name} lacks the cash`)
  if (get.cash > B.money) return no(`${B.name} lacks the cash`)
  if (give.cards > A.cards.length || get.cards > B.cards.length) return no('Not enough cards')
  const feeA = mortgageFees(s, get.props)
  const feeB = mortgageFees(s, give.props)
  if (A.money - give.cash + get.cash < feeA) return no(`${A.name} can't cover the 10% mortgage fee`)
  if (B.money - get.cash + give.cash < feeB) return no(`${B.name} can't cover the 10% mortgage fee`)
  return yes
}

const mortgageFees = (s, ids) =>
  ids.reduce((t, id) => t + (s.props[id].mortgaged ? Math.ceil(mortgageValue(id) * 0.1) : 0), 0)

const yes = { ok: true }
const no = (reason) => ({ ok: false, reason })

// ---------- internals ----------

function log(s, text, pid = null) {
  s.log.push({ id: s.logId++, text, pid })
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
  log(s, `${p.name} was raided by the SEC and sent to custody 🚨`, p.id)
}

// Transfer money, or queue a debt the payer must raise funds for.
function charge(s, from, to, amount, reason) {
  if (amount <= 0) return
  const p = s.players[from]
  const queued = s.debts.some((d) => d.from === from)
  if (!queued && p.money >= amount) {
    p.money -= amount
    if (to !== null) s.players[to].money += amount
    log(s, `${p.name} paid ${money(amount)} ${to !== null ? 'to ' + s.players[to].name : ''} (${reason})`, from)
  } else {
    s.debts.push({ from, to, amount, reason })
    log(s, `${p.name} owes ${money(amount)} for ${reason} but is short on cash`, from)
  }
}

function checkWinner(s) {
  const left = alive(s)
  if (left.length === 1) {
    s.winner = left[0].id
    s.phase = 'gameover'
    log(s, `🏆 ${left[0].name} is the last whale standing!`, left[0].id)
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
  log(s, `${s.players[n].name}'s turn`, n)
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
  if (s.phase === 'preroll') log(s, `Doubles! ${p.name} rolls again`, p.id)
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
      charge(s, p.id, null, sp.amount, sp.name)
      return continueTurn(s)
    case 'chance':
    case 'chest': {
      const deck = sp.type
      const id = s.decks[deck].shift()
      const card = DECKS[deck].cards[id]
      if (card.effect.type !== 'goojf') s.decks[deck].push(id)
      s.card = { deck, id }
      s.phase = 'card'
      log(s, `${p.name} drew ${DECKS[deck].name}: “${card.text}”`, p.id)
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
        log(s, `${sp.name} is mortgaged — no rent`, p.id)
        return continueTurn(s)
      }
      let rent
      if (sp.type === 'utility' && opts.util10) {
        const d = [roll1(), roll1()]
        rent = 10 * (d[0] + d[1])
        log(s, `${p.name} rolled ${d[0]}+${d[1]} for the mining payout`, p.id)
      } else {
        rent = rentFor(s, p.pos, s.dice[0] + s.dice[1]) * (sp.type === 'rail' && opts.rail2 ? 2 : 1)
      }
      charge(s, p.id, owner.id, rent, `rent on ${sp.name}`)
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
        log(s, `${p.name} collected ${money(e.amount)}`, p.id)
      } else charge(s, p.id, null, -e.amount, 'card')
      return continueTurn(s)
    case 'repairs': {
      let total = 0
      for (const pid of ownedBy(s, p.id)) {
        const h = s.props[pid].houses
        total += h === 5 ? e.hotel : h * e.house
      }
      if (total) charge(s, p.id, null, total, 'repairs')
      else log(s, `${p.name} has no buildings — nothing to pay`, p.id)
      return continueTurn(s)
    }
    case 'each':
      for (const o of alive(s)) {
        if (o.id === p.id) continue
        if (e.amount < 0) charge(s, p.id, o.id, -e.amount, 'DAO chair')
        else charge(s, o.id, p.id, e.amount, 'birthday gift')
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
    log(s, `💀 ${p.name} got rekt! All assets go to ${c.name}`, pid)
  } else {
    for (const id of ownedBy(s, pid)) s.props[id] = { owner: null, houses: 0, mortgaged: false }
    for (const deck of p.cards) s.decks[deck].push(goojfIndex(deck))
    log(s, `💀 ${p.name} got rekt! Properties return to the bank`, pid)
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
    log(s, `Nobody bid on ${sp.name}. It stays with the bank.`)
  } else if (a.active.length === 1 && a.bidder === a.active[0]) {
    const w = s.players[a.bidder]
    w.money -= a.high
    s.props[a.id].owner = w.id
    log(s, `🔨 ${w.name} won ${sp.name} at auction for ${money(a.high)}`, w.id)
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
      log(s, `${p.name} rolled ${a} + ${b}${doubles ? ' — doubles!' : ''}`, p.id)
      if (p.inJail) {
        s.rolledDoubles = false
        if (doubles) {
          release(p)
          log(s, `${p.name} rolled out of custody`, p.id)
          startMove(s, a + b)
        } else if (++p.jailTurns >= 3) {
          release(p)
          log(s, `Third failed attempt — ${p.name} must post ${money(JAIL_FINE)} bail`, p.id)
          charge(s, p.id, null, JAIL_FINE, 'bail')
          s.resume = { steps: a + b }
          continueTurn(s)
        } else {
          s.phase = 'postroll'
        }
        return s
      }
      if (doubles && ++s.doublesCount === 3) {
        log(s, 'Three doubles in a row looks like market manipulation…', p.id)
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
        log(s, `${p.name} passed Genesis Block, collected ${money(GO_SALARY)}`, p.id)
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
      log(s, `${p.name} bought ${BOARD[id].name} for ${money(BOARD[id].price)}`, p.id)
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
      log(s, `${BOARD[s.auction.id].name} goes up for auction`, p.id)
      return s
    }

    case 'BID': {
      const a = s.auction
      if (s.phase !== 'auction' || action.amount <= a.high || action.amount > actor.money) return state
      a.high = action.amount
      a.bidder = actor.id
      a.turn = (a.turn + 1) % a.active.length
      log(s, `${actor.name} bids ${money(action.amount)}`, actor.id)
      finishAuction(s)
      return s
    }

    case 'PASS_BID': {
      const a = s.auction
      if (s.phase !== 'auction') return state
      a.active.splice(a.turn, 1)
      if (a.turn >= a.active.length) a.turn = 0
      log(s, `${actor.name} is out of the auction`, actor.id)
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
      log(s, `${p.name} posted ${money(JAIL_FINE)} bail`, p.id)
      return s

    case 'USE_CARD': {
      if (s.phase !== 'preroll' || !p.inJail || !p.cards.length) return state
      const deck = p.cards.shift()
      s.decks[deck].push(goojfIndex(deck))
      release(p)
      log(s, `${p.name} used a Get Out of Custody Free card`, p.id)
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
        log(s, `${actor.name} built a data center on ${BOARD[id].name} 🏢`, actor.id)
      } else {
        s.bank.houses--
        log(s, `${actor.name} built a node on ${BOARD[id].name}`, actor.id)
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
      log(s, `${actor.name} sold a building on ${BOARD[id].name}`, actor.id)
      return s
    }

    case 'MORTGAGE': {
      const { id } = action
      if (![...MANAGE_PHASES, 'debt'].includes(s.phase) || !canMortgage(s, actor.id, id).ok) return state
      s.props[id].mortgaged = true
      actor.money += mortgageValue(id)
      log(s, `${actor.name} mortgaged ${BOARD[id].name} for ${money(mortgageValue(id))}`, actor.id)
      return s
    }

    case 'UNMORTGAGE': {
      const { id } = action
      if (!MANAGE_PHASES.includes(s.phase) || !canUnmortgage(s, actor.id, id).ok) return state
      s.props[id].mortgaged = false
      actor.money -= unmortgageCost(id)
      log(s, `${actor.name} lifted the mortgage on ${BOARD[id].name}`, actor.id)
      return s
    }

    case 'PAY_DEBT': {
      if (s.phase !== 'debt') return state
      const d = s.debts[0]
      if (actor.money < d.amount) return state
      s.debts.shift()
      actor.money -= d.amount
      if (d.to !== null) s.players[d.to].money += d.amount
      log(s, `${actor.name} paid ${money(d.amount)} (${d.reason})`, actor.id)
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
      log(s, `🤝 ${A.name} and ${B.name} closed a trade`, A.id)
      return s
    }

    default:
      return state
  }
}
