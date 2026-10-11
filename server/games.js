// How the server runs each game: starting it from lobby seats, checking that an action comes from the
// player whose turn it is, driving the bots, and deciding what each seat is allowed to see.
import * as mono from '../src/engine/game.js'
import { aiAction as monoBot, aiAcceptsTrade } from '../src/engine/ai.js'
import * as monoData from '../src/data/board.js'
import * as catan from '../src/catan/engine.js'
import { aiAction as catanBot, wouldAccept } from '../src/catan/ai.js'
import * as catanData from '../src/catan/data.js'
import { reducer as salemReducer } from '../src/salem/engine.js'
import { MODES, NAMES as SALEM_NAMES, ROLES, SLOTS } from '../src/salem/roles.js'
import { viewFor, chatFor } from '../src/salem/redact.js'

const SERVER_ONLY = new Set(['NEW_GAME', 'LOAD', 'QUIT', 'STEP', 'TICK', 'PACE'])

// Shared shape of the two turn-based board games.
function boardGame({ reducer, actingPlayer, rollDice, bot, delays, accepts, data, min, max, view }) {
  const apply = (state, action) => {
    const next = reducer(state, action)
    return next === state ? null : next
  }
  return {
    min,
    max,
    seats: 4,
    names: data.DEFAULT_NAMES,
    options: {},
    start: (seats) =>
      reducer(null, {
        type: 'NEW_GAME',
        players: seats.map((s, i) => ({ name: s.name, token: data.TOKENS[i], color: data.PLAYER_COLORS[i], isAI: s.bot })),
      }),
    playerFor: (state, seatIndex) => seatIndex,
    // A player's own action. Returns the new state, or null if it isn't allowed.
    act(state, pid, action) {
      if (!action || typeof action.type !== 'string' || SERVER_ONLY.has(action.type)) return null
      if (action.type === 'TRADE') {
        const t = action.offer ?? action.trade
        if (!t || t.from !== pid || !state.players[t.to]?.isAI || !accepts(state, t)) return null
        return apply(state, action)
      }
      if (actingPlayer(state) !== pid) return null
      return apply(state, action.type === 'ROLL' ? { type: 'ROLL', dice: rollDice() } : action)
    },
    // A trade one human offered another. Valid only if it would actually go through right now.
    offer(state, pid, action) {
      const t = action?.type === 'TRADE' ? (action.offer ?? action.trade) : null
      if (!t || t.from !== pid || !state.players[t.to] || state.players[t.to].isAI) return null
      return apply(state, action) ? { from: t.from, to: t.to } : null
    },
    accept: apply,
    // The next thing the server should do on its own: animate a move, or let a bot act.
    next(state) {
      if (state.phase === 'gameover') return null
      if (state.phase === 'moving') return { delay: state.moving.steps > 8 ? 85 : 190, run: () => ({ type: 'STEP' }) }
      if (!state.players[actingPlayer(state)].isAI) return null
      return {
        delay: delays[state.phase] ?? delays.default,
        run: (s) => {
          const a = bot(s)
          return a?.type === 'ROLL' ? { type: 'ROLL', dice: rollDice() } : a
        },
      }
    },
    view,
  }
}

export const GAMES = {
  cryptopoly: boardGame({
    reducer: mono.reducer,
    actingPlayer: mono.actingPlayer,
    rollDice: mono.rollDice,
    bot: monoBot,
    delays: { card: 1800, auction: 650, buy: 1100, default: 850 },
    accepts: (s, offer) => aiAcceptsTrade(s, offer),
    data: monoData,
    min: 2,
    max: 6,
    // The order of the FOMO and DAO Treasury decks stays on the server.
    view: (s) => ({ ...s, decks: { chance: s.decks.chance.map(() => -1), chest: s.decks.chest.map(() => -1) } }),
  }),

  catan: boardGame({
    reducer: catan.reducer,
    actingPlayer: catan.actingPlayer,
    rollDice: catan.rollDice,
    bot: catanBot,
    delays: { setup: 650, preroll: 800, hacker: 1000, steal: 700, discard: 900, default: 750 },
    accepts: (s, t) => wouldAccept(s, t.to, t),
    data: catanData,
    min: 3,
    max: 4,
    // Nobody sees which smart contracts the others hold, or what's next in the deck.
    view: (s, pid) =>
      s.phase === 'gameover'
        ? s
        : {
            ...s,
            devDeck: s.devDeck.map(() => 'hidden'),
            players: s.players.map((p) => (p.id === pid ? p : { ...p, dev: p.dev.map((d) => ({ type: 'hidden', turn: d.turn })) })),
          },
  }),

  salem: {
    min: 7,
    max: 15,
    seats: 15,
    names: SALEM_NAMES,
    options: { mode: 'classic', custom: MODES.custom.list, pace: 'normal' },
    listFor: (o) => (o.mode === 'custom' ? o.custom : MODES[o.mode].list),
    // Clean up options sent by the host.
    sanitize(o, prev) {
      const out = { ...prev }
      if (MODES[o?.mode]) out.mode = o.mode
      if (['chill', 'normal', 'fast', 'turbo'].includes(o?.pace)) out.pace = o.pace
      if (Array.isArray(o?.custom) && o.custom.length >= 7 && o.custom.length <= 15 && o.custom.every((x) => ROLES[x] || SLOTS[x])) out.custom = [...o.custom]
      return out
    },
    start(seats, options) {
      const list = GAMES.salem.listFor(options)
      return salemReducer(null, {
        type: 'NEW_GAME',
        config: { mode: options.mode, list, pace: options.pace, seats: seats.map((s, i) => ({ name: s.name, isAI: s.bot, key: i })) },
      })
    },
    playerFor: (state, seatIndex) => state.players.find((p) => p.key === seatIndex)?.id ?? null,
    act(state, pid, action) {
      if (!action || typeof action.type !== 'string' || SERVER_ONLY.has(action.type)) return null
      const next = salemReducer(state, { ...action, pid })
      return next === state ? null : next
    },
    hostAct: (state, action) => (action?.type === 'PACE' ? salemReducer(state, { type: 'PACE', pace: action.pace }) : null),
    tick: (state, dt) => salemReducer(state, { type: 'TICK', dt }),
    view: viewFor,
    chat: chatFor,
  },
}
