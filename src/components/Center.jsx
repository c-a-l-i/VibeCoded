import { BOARD, JAIL_FINE } from '../data/board.js'
import { actingPlayer } from '../engine/game.js'
import { t, tx, N, fmt, getLang, money } from '../i18n/index.js'
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
      {tx('ui.thinking', { p: <Who p={p} /> })}
      <span className="dots" />
    </div>
  )
}

function SideButtons({ openModal }) {
  return (
    <div className="row">
      <button className="btn ghost" onClick={() => openModal({ type: 'portfolio' })}>
        {t('mono.portfolio')}
      </button>
      <button className="btn ghost" onClick={() => openModal({ type: 'trade' })}>
        {t('ui.trade')}
      </button>
    </div>
  )
}

const deckTitle = (deck) => `${deck === 'chance' ? '📈' : '🏛️'} ${N.deck(deck).toLocaleUpperCase(getLang())}`

function ActionPanel({ state, rolling, act, openModal }) {
  const p = state.players[state.current]
  const actor = state.players[actingPlayer(state)]
  const bot = actor.isAI

  switch (state.phase) {
    case 'preroll':
      if (bot || rolling) return rolling ? <div className="status">{t('ui.rolling')}</div> : <Thinking p={actor} />
      if (p.inJail)
        return (
          <div className="actions">
            <div className="status">{tx('mono.inCustody', { p: <Who p={p} />, n: p.jailTurns + 1 })}</div>
            <div className="row">
              <button className="btn primary" onClick={() => act({ type: 'ROLL' })}>
                {t('mono.rollDoubles')}
              </button>
              <button className="btn" disabled={p.money < JAIL_FINE} onClick={() => act({ type: 'PAY_JAIL' })}>
                {t('mono.postBail', { m: money(JAIL_FINE) })}
              </button>
              {p.cards.length > 0 && (
                <button className="btn" onClick={() => act({ type: 'USE_CARD' })}>
                  {t('mono.useCard')}
                </button>
              )}
            </div>
            <SideButtons openModal={openModal} />
          </div>
        )
      return (
        <div className="actions">
          <div className="status">{tx(state.rolledDoubles ? 'mono.yourMoveAgain' : 'mono.yourMove', { p: <Who p={p} /> })}</div>
          <button className="btn primary big" onClick={() => act({ type: 'ROLL' })}>
            {t('ui.rollDice')}
          </button>
          <SideButtons openModal={openModal} />
        </div>
      )

    case 'moving':
      return <div className="status">{tx('mono.moving', { p: <Who p={p} /> })}</div>

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
                  {t('mono.buyFor', { m: money(sp.price) })}
                </button>
                <button className="btn" onClick={() => act({ type: 'AUCTION' })}>
                  {t('mono.auction')}
                </button>
              </div>
              {p.money < sp.price && (
                <button className="link" onClick={() => openModal({ type: 'portfolio' })}>
                  {t('mono.shortCash')}
                </button>
              )}
            </>
          )}
        </div>
      )
    }

    case 'card':
      return (
        <div className={`actions card-reveal reveal-${state.card.deck}`}>
          <div className="game-card">
            <div className="game-card-title">{deckTitle(state.card.deck)}</div>
            <p>{N.card(state.card.deck, state.card.id)}</p>
          </div>
          {bot ? (
            <Thinking p={p} />
          ) : (
            <button className="btn primary" onClick={() => act({ type: 'RESOLVE_CARD' })}>
              {t('ui.ok')}
            </button>
          )}
        </div>
      )

    case 'auction': {
      const a = state.auction
      const sp = BOARD[a.id]
      const leader = a.bidder !== null ? state.players[a.bidder] : null
      return (
        <div className="actions auction">
          <div className="auction-head">
            <span className="eyebrow">{t('mono.liveAuction')}</span>
            <strong>{N.space(a.id)}</strong>
            <span className="muted">{t('mono.listPrice', { m: money(sp.price) })}</span>
          </div>
          <div className="auction-bid">
            <span className="mono big-num">{money(a.high)}</span>
            <span className="muted">{leader ? tx('mono.highBid', { p: <Who p={leader} /> }) : t('mono.noBids')}</span>
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
              <div className="status small">{tx('mono.toBid', { p: <Who p={actor} />, m: money(actor.money) })}</div>
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
                  {t('ui.pass')}
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
      const amount = <span className="mono neg">{money(d.amount)}</span>
      return (
        <div className="actions debt">
          <div className="status">
            {creditor
              ? tx('mono.owesTo', { p: <Who p={actor} />, m: amount, q: <Who p={creditor} /> })
              : tx('mono.owesBank', { p: <Who p={actor} />, m: amount })}
          </div>
          <div className="muted small">
            {t('mono.debtWhy', { reason: fmt(d.reason, { ns: 'mono.log', players: state.players }), m: money(actor.money) })}
          </div>
          {bot ? (
            <Thinking p={actor} />
          ) : (
            <div className="row">
              <button className="btn primary" disabled={actor.money < d.amount} onClick={() => act({ type: 'PAY_DEBT' })}>
                {t('mono.pay', { m: money(d.amount) })}
              </button>
              <button className="btn" onClick={() => openModal({ type: 'portfolio' })}>
                {t('mono.raiseFunds')}
              </button>
              <button className="btn danger" onClick={() => confirm(t('mono.confirmBankrupt', { p: actor.name })) && act({ type: 'BANKRUPT' })}>
                {t('mono.goBankrupt')}
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
          <div className="status">{tx('mono.anythingElse', { p: <Who p={p} /> })}</div>
          <button className="btn primary big" onClick={() => act({ type: 'END_TURN' })}>
            {t('mono.endTurn')}
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
        <span className="logo">{t('games.cryptopoly.title')}</span>
      </div>
      <div className="decks">
        <div className="deck deck-chance">
          <span>📈</span>
          {N.deck('chance').toLocaleUpperCase(getLang())}
        </div>
        <div className="deck deck-chest">
          <span>🏛️</span>
          {N.deck('chest').toLocaleUpperCase(getLang())}
        </div>
      </div>
      <Dice dice={state.dice} rolling={rolling} />
      <ActionPanel state={state} rolling={rolling} act={act} openModal={openModal} />
      <ul className="ticker">
        {recent.map((e) => (
          <li key={e.id} style={{ '--c': e.pid !== null ? state.players[e.pid].color : 'var(--muted)' }}>
            {e.text ?? fmt(e, { ns: 'mono.log', players: state.players })}
          </li>
        ))}
      </ul>
    </div>
  )
}
