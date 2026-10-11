// Simple heuristic bot. Returns one action per call; the UI calls it again after each state change.
import { BOARD, OWNABLE, JAIL_FINE, groupMembers, houseCost, unmortgageCost } from '../data/board.js'
import {
  actingPlayer, canBuild, canSell, canMortgage, canUnmortgage, ownedBy, ownsGroup,
} from './game.js'

const RESERVE = 200

// Would owning `id` give `pid` the whole color set?
function completesSet(s, pid, id) {
  const sp = BOARD[id]
  if (sp.type !== 'street') return false
  return groupMembers(sp.group).every((m) => m === id || s.props[m].owner === pid)
}

// Does some other player already own the rest of this set?
function blocksSet(s, pid, id) {
  const sp = BOARD[id]
  if (sp.type !== 'street') return false
  const others = groupMembers(sp.group).filter((m) => m !== id).map((m) => s.props[m].owner)
  return others[0] !== null && others[0] !== pid && others.every((o) => o === others[0])
}

function manage(s, p) {
  // Lift mortgages on completed sets first, then build.
  for (const id of ownedBy(s, p.id)) {
    if (s.props[id].mortgaged && canUnmortgage(s, p.id, id).ok && p.money - unmortgageCost(id) > RESERVE + 150) {
      return { type: 'UNMORTGAGE', id }
    }
  }
  const buildable = OWNABLE.filter((id) => canBuild(s, p.id, id).ok && p.money - houseCost(id) >= RESERVE)
  if (buildable.length) {
    buildable.sort((a, b) => s.props[a].houses - s.props[b].houses || BOARD[b].price - BOARD[a].price)
    return { type: 'BUILD', id: buildable[0] }
  }
  return null
}

function raiseFunds(s, p) {
  const mine = ownedBy(s, p.id)
  const sellable = mine.filter((id) => canSell(s, p.id, id).ok)
  // Mortgage loose properties before breaking up sets.
  const mortgageable = mine
    .filter((id) => canMortgage(s, p.id, id).ok)
    .sort((a, b) => {
      const sa = BOARD[a].type === 'street' && ownsGroup(s, p.id, BOARD[a].group)
      const sb = BOARD[b].type === 'street' && ownsGroup(s, p.id, BOARD[b].group)
      return sa - sb || BOARD[a].price - BOARD[b].price
    })
  if (mortgageable.length) return { type: 'MORTGAGE', id: mortgageable[0] }
  if (sellable.length) return { type: 'SELL', id: sellable[0] }
  return null
}

export function aiAction(s) {
  const p = s.players[actingPlayer(s)]
  switch (s.phase) {
    case 'preroll':
      if (p.inJail) {
        if (p.cards.length) return { type: 'USE_CARD' }
        const unowned = OWNABLE.filter((id) => s.props[id].owner === null).length
        if (unowned > 8 && p.money > JAIL_FINE + 300) return { type: 'PAY_JAIL' }
        return { type: 'ROLL' }
      }
      return manage(s, p) || { type: 'ROLL' }

    case 'buy': {
      const id = s.pendingBuy
      const price = BOARD[id].price
      if (p.money - price >= 100 || (completesSet(s, p.id, id) && p.money >= price)) return { type: 'BUY' }
      return { type: 'AUCTION' }
    }

    case 'card':
      return { type: 'RESOLVE_CARD' }

    case 'auction': {
      const { id, high } = s.auction
      let value = BOARD[id].price
      if (completesSet(s, p.id, id)) value *= 1.6
      else if (blocksSet(s, p.id, id)) value *= 1.3
      const limit = Math.min(Math.floor(value * (0.85 + Math.random() * 0.25)), p.money - 50)
      const next = high + (high < 100 ? 10 : 5 + Math.floor(Math.random() * 3) * 5)
      if (s.auction.bidder !== p.id && next <= limit) return { type: 'BID', amount: next }
      return { type: 'PASS_BID' }
    }

    case 'debt': {
      if (p.money >= s.debts[0].amount) return { type: 'PAY_DEBT' }
      return raiseFunds(s, p) || { type: 'BANKRUPT' }
    }

    case 'postroll':
      return manage(s, p) || { type: 'END_TURN' }

    default:
      return null
  }
}

// AI's valuation of a property from `pid`'s point of view.
function worth(s, pid, id) {
  const base = s.props[id].mortgaged ? BOARD[id].price * 0.45 : BOARD[id].price
  return base + (completesSet(s, pid, id) ? BOARD[id].price * 1.2 : 0)
}

export function aiAcceptsTrade(s, offer) {
  const me = offer.to
  const them = offer.from
  const gain =
    offer.give.props.reduce((t, id) => t + worth(s, me, id), 0) + offer.give.cash + offer.give.cards * 50
  const loss =
    offer.get.props.reduce((t, id) => t + worth(s, me, id) + (completesSet(s, them, id) ? BOARD[id].price * 2 : 0), 0) +
    offer.get.cash +
    offer.get.cards * 50
  return gain > loss * 1.15 + 10
}
