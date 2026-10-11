import { useState } from 'react'
import { BOARD, spaceColor } from '../data/board.js'
import { groupHasBuildings, money, ownedBy, tradeCheck } from '../engine/game.js'
import { aiAcceptsTrade } from '../engine/ai.js'
import Modal from './Modal.jsx'

const emptySide = () => ({ props: [], cash: 0, cards: 0 })

function Side({ state, player, side, setSide, title }) {
  const props = ownedBy(state, player.id)
  const toggle = (id) =>
    setSide({ ...side, props: side.props.includes(id) ? side.props.filter((x) => x !== id) : [...side.props, id] })
  return (
    <div className="trade-side" style={{ '--c': player.color }}>
      <h3>
        {title} <span className="who-token">{player.token}</span> {player.name}
      </h3>
      <div className="trade-props">
        {props.length === 0 && <span className="muted small">No properties</span>}
        {props.map((id) => {
          const sp = BOARD[id]
          const locked = sp.type === 'street' && groupHasBuildings(state, sp.group)
          return (
            <label key={id} className={`trade-prop ${locked ? 'locked' : ''}`} style={{ '--group': spaceColor(id) }} title={locked ? 'Sell buildings in this set first' : ''}>
              <input type="checkbox" disabled={locked} checked={side.props.includes(id)} onChange={() => toggle(id)} />
              <span className="swatch" />
              {sp.name}
              {state.props[id].mortgaged && <span className="neg small"> (mortgaged)</span>}
            </label>
          )
        })}
      </div>
      <label className="field">
        Cash <span className="muted small">(max {money(player.money)})</span>
        <input
          type="number"
          min={0}
          max={player.money}
          step={10}
          value={side.cash}
          onChange={(e) => setSide({ ...side, cash: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
        />
      </label>
      {player.cards.length > 0 && (
        <label className="field">
          Free custody cards
          <input
            type="number"
            min={0}
            max={player.cards.length}
            value={side.cards}
            onChange={(e) => setSide({ ...side, cards: Math.min(player.cards.length, Math.max(0, Number(e.target.value) || 0)) })}
          />
        </label>
      )}
    </div>
  )
}

export default function TradeModal({ state, act, onClose }) {
  const me = state.players[state.current]
  const partners = state.players.filter((p) => !p.bankrupt && p.id !== me.id)
  const [partnerId, setPartnerId] = useState(partners[0]?.id)
  const [give, setGive] = useState(emptySide)
  const [get, setGet] = useState(emptySide)
  const [stage, setStage] = useState('edit') // edit | confirm | rejected
  const allowed = ['preroll', 'postroll'].includes(state.phase) && !me.isAI

  if (!allowed)
    return (
      <Modal title="Trade" onClose={onClose}>
        <p className="muted center-text">Trades can be proposed by a human player before rolling or before ending their turn.</p>
      </Modal>
    )

  const partner = state.players[partnerId]
  const offer = { from: me.id, to: partnerId, give, get }
  const check = tradeCheck(state, offer)

  const pickPartner = (id) => {
    setPartnerId(id)
    setGet(emptySide())
    setStage('edit')
  }

  const propose = () => {
    if (partner.isAI) {
      if (aiAcceptsTrade(state, offer)) {
        act({ type: 'TRADE', offer })
        onClose()
      } else setStage('rejected')
    } else setStage('confirm')
  }

  const summary = (side) =>
    [...side.props.map((id) => BOARD[id].name), side.cash ? money(side.cash) : null, side.cards ? `${side.cards} free card(s)` : null]
      .filter(Boolean)
      .join(', ') || 'nothing'

  return (
    <Modal title="Propose a trade" onClose={onClose} wide>
      <div className="tabs">
        {partners.map((x) => (
          <button key={x.id} className={`tab ${x.id === partnerId ? 'on' : ''}`} style={{ '--c': x.color }} onClick={() => pickPartner(x.id)}>
            {x.token} {x.name} {x.isAI ? '🤖' : ''}
          </button>
        ))}
      </div>

      {stage === 'confirm' ? (
        <div className="trade-confirm">
          <p>
            Pass the device to <b style={{ color: partner.color }}>{partner.name}</b>.
          </p>
          <p>
            {me.name} offers <b>{summary(give)}</b>
            <br />
            in exchange for <b>{summary(get)}</b>.
          </p>
          <div className="row">
            <button
              className="btn primary"
              onClick={() => {
                act({ type: 'TRADE', offer })
                onClose()
              }}
            >
              ✅ {partner.name} accepts
            </button>
            <button className="btn danger" onClick={() => setStage('edit')}>
              ❌ Decline
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="trade-grid">
            <Side state={state} player={me} side={give} setSide={setGive} title="You give" />
            <div className="trade-arrow">⇄</div>
            <Side state={state} player={partner} side={get} setSide={setGet} title="You get" />
          </div>
          {stage === 'rejected' && <div className="notice neg">🤖 {partner.name}: “ngmi. Sweeten the deal.”</div>}
          <p className="muted small">Receiving a mortgaged property costs a 10% fee to the bank.</p>
          <div className="row end">
            {!check.ok && <span className="muted small">{check.reason}</span>}
            <button className="btn primary" disabled={!check.ok} onClick={propose}>
              Propose trade
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
