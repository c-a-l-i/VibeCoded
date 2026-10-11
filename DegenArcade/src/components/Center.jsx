import { BOARD, JAIL_FINE } from '../data/board.js'
import { DECKS } from '../data/cards.js'
import { actingPlayer, money } from '../engine/game.js'
import Dice from './Dice.jsx'
import { DeedCard } from './DeedModal.jsx'

function Who({ p }) {
  return (
    <span className="who" style={{ '--c': p.color }}>
      <span className="who-token">{p.token}</span>
      {p.name}
    </span>
  )
}

function Thinking({ p }) {
  return (
    <div className="thinking">
      <Who p={p} /> is thinking<span className="dots" />
    </div>
  )
}

function SideButtons({ openModal }) {
  return (
    <div className="row">
      <button className="btn ghost" onClick={() => openModal({ type: 'portfolio' })}>
        🗂️ Portfolio
      </button>
      <button className="btn ghost" onClick={() => openModal({ type: 'trade' })}>
        🤝 Trade
      </button>
    </div>
  )
}

function ActionPanel({ state, rolling, act, openModal }) {
  const p = state.players[state.current]
  const actor = state.players[actingPlayer(state)]
  const bot = actor.isAI

  switch (state.phase) {
    case 'preroll':
      if (bot || rolling) return rolling ? <div className="status">Rolling…</div> : <Thinking p={actor} />
      if (p.inJail)
        return (
          <div className="actions">
            <div className="status">
              🔒 <Who p={p} /> is in SEC custody · attempt {p.jailTurns + 1} of 3
            </div>
            <div className="row">
              <button className="btn primary" onClick={() => act({ type: 'ROLL' })}>
                🎲 Roll for doubles
              </button>
              <button className="btn" disabled={p.money < JAIL_FINE} onClick={() => act({ type: 'PAY_JAIL' })}>
                Post bail {money(JAIL_FINE)}
              </button>
              {p.cards.length > 0 && (
                <button className="btn" onClick={() => act({ type: 'USE_CARD' })}>
                  🎟️ Use free card
                </button>
              )}
            </div>
            <SideButtons openModal={openModal} />
          </div>
        )
      return (
        <div className="actions">
          <div className="status">
            <Who p={p} /> — your move{state.rolledDoubles ? ' (doubles, roll again!)' : ''}
          </div>
          <button className="btn primary big" onClick={() => act({ type: 'ROLL' })}>
            🎲 Roll dice
          </button>
          <SideButtons openModal={openModal} />
        </div>
      )

    case 'moving':
      return (
        <div className="status">
          <Who p={p} /> is moving…
        </div>
      )

    case 'buy': {
      const sp = BOARD[state.pendingBuy]
      return (
        <div className="actions buy">
          <DeedCard state={state} id={state.pendingBuy} compact />
          {bot ? (
            <Thinking p={p} />
          ) : (
            <>
              <div className="row">
                <button className="btn primary" disabled={p.money < sp.price} onClick={() => act({ type: 'BUY' })}>
                  Buy for {money(sp.price)}
                </button>
                <button className="btn" onClick={() => act({ type: 'AUCTION' })}>
                  🔨 Auction
                </button>
              </div>
              {p.money < sp.price && (
                <button className="link" onClick={() => openModal({ type: 'portfolio' })}>
                  Short on cash — mortgage something?
                </button>
              )}
            </>
          )}
        </div>
      )
    }

    case 'card': {
      const card = DECKS[state.card.deck].cards[state.card.id]
      return (
        <div className={`actions card-reveal reveal-${state.card.deck}`}>
          <div className="game-card">
            <div className="game-card-title">{state.card.deck === 'chance' ? '📈 FOMO' : '🏛️ DAO TREASURY'}</div>
            <p>{card.text}</p>
          </div>
          {bot ? (
            <Thinking p={p} />
          ) : (
            <button className="btn primary" onClick={() => act({ type: 'RESOLVE_CARD' })}>
              OK
            </button>
          )}
        </div>
      )
    }

    case 'auction': {
      const a = state.auction
      const sp = BOARD[a.id]
      const leader = a.bidder !== null ? state.players[a.bidder] : null
      return (
        <div className="actions auction">
          <div className="auction-head">
            <span className="eyebrow">🔨 Live auction</span>
            <strong>{sp.name}</strong>
            <span className="muted">list price {money(sp.price)}</span>
          </div>
          <div className="auction-bid">
            <span className="mono big-num">{money(a.high)}</span>
            <span className="muted">{leader ? <>high bid · <Who p={leader} /></> : 'no bids yet'}</span>
          </div>
          <div className="auction-chips">
            {a.active.map((pid, i) => {
              const ap = state.players[pid]
              return (
                <span key={pid} className={`chip ${i === a.turn ? 'on' : ''}`} style={{ '--c': ap.color }}>
                  {ap.token} {ap.name}
                </span>
              )
            })}
          </div>
          {bot ? (
            <Thinking p={actor} />
          ) : (
            <>
              <div className="status small">
                <Who p={actor} /> to bid · cash {money(actor.money)}
              </div>
              <div className="row">
                {[1, 10, 50, 100].map((inc) => (
                  <button
                    key={inc}
                    className="btn"
                    disabled={a.high + inc > actor.money}
                    onClick={() => act({ type: 'BID', amount: a.high + inc })}
                  >
                    +{inc}
                  </button>
                ))}
                <button className="btn danger" onClick={() => act({ type: 'PASS_BID' })}>
                  Pass
                </button>
              </div>
            </>
          )}
        </div>
      )
    }

    case 'debt': {
      const d = state.debts[0]
      const creditor = d.to !== null ? state.players[d.to] : null
      return (
        <div className="actions debt">
          <div className="status">
            ⚠️ <Who p={actor} /> owes <span className="mono neg">{money(d.amount)}</span>{' '}
            {creditor ? <>to <Who p={creditor} /></> : 'to the bank'}
          </div>
          <div className="muted small">
            {d.reason} · cash on hand {money(actor.money)}
          </div>
          {bot ? (
            <Thinking p={actor} />
          ) : (
            <div className="row">
              <button className="btn primary" disabled={actor.money < d.amount} onClick={() => act({ type: 'PAY_DEBT' })}>
                Pay {money(d.amount)}
              </button>
              <button className="btn" onClick={() => openModal({ type: 'portfolio' })}>
                🗂️ Raise funds
              </button>
              <button
                className="btn danger"
                onClick={() => confirm(`Declare bankruptcy for ${actor.name}?`) && act({ type: 'BANKRUPT' })}
              >
                💀 Go bankrupt
              </button>
            </div>
          )}
        </div>
      )
    }

    case 'postroll':
      if (bot) return <Thinking p={p} />
      return (
        <div className="actions">
          <div className="status">
            <Who p={p} /> — anything else before you pass the turn?
          </div>
          <button className="btn primary big" onClick={() => act({ type: 'END_TURN' })}>
            End turn ➜
          </button>
          <SideButtons openModal={openModal} />
        </div>
      )

    default:
      return null
  }
}

export default function Center({ state, rolling, act, openModal }) {
  const recent = state.log.slice(-4).reverse()
  return (
    <div className="center">
      <div className="center-glow" />
      <div className="brand">
        <span className="logo-mark">◈</span>
        <span className="logo">CRYPTOPOLY</span>
      </div>
      <div className="decks">
        <div className="deck deck-chance">
          <span>📈</span>FOMO
        </div>
        <div className="deck deck-chest">
          <span>🏛️</span>DAO TREASURY
        </div>
      </div>
      <Dice dice={state.dice} rolling={rolling} />
      <ActionPanel state={state} rolling={rolling} act={act} openModal={openModal} />
      <ul className="ticker">
        {recent.map((e) => (
          <li key={e.id} style={{ '--c': e.pid !== null ? state.players[e.pid].color : 'var(--muted)' }}>
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  )
}
