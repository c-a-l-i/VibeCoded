import { useState } from 'react'
import { BOARD, spaceVars } from '../data/board.js'
import { groupHasBuildings, ownedBy, tradeCheck } from '../engine/game.js'
import { aiAcceptsTrade } from '../engine/ai.js'
import Modal from './Modal.jsx'
import { t, tx, N, fmt, tradeSide, money } from '../i18n/index.js'

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
        {props.length === 0 && <span className="muted small">{t('mono.noProperties')}</span>}
        {props.map((id) => {
          const sp = BOARD[id]
          const locked = sp.type === 'street' && groupHasBuildings(state, sp.group)
          return (
            <label key={id} className={`trade-prop ${locked ? 'locked' : ''}`} style={spaceVars(id)} title={locked ? t('mono.sellFirst') : ''}>
              <input type="checkbox" disabled={locked} checked={side.props.includes(id)} onChange={() => toggle(id)} />
              <span className="swatch" />
              {N.space(id)}
              {state.props[id].mortgaged && <span className="neg small">{t('mono.mortgagedParen')}</span>}
            </label>
          )
        })}
      </div>
      <label className="field">
        {t('mono.cash')} <span className="muted small">{t('mono.max', { m: money(player.money) })}</span>
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
          {t('mono.custodyCards')}
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
      <Modal title={t('mono.tradeTitle')} onClose={onClose}>
        <p className="muted center-text">{t('mono.tradeWhen')}</p>
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
    if (partner.remote) {
      act({ type: 'OFFER', action: { type: 'TRADE', offer } })
      onClose()
    } else if (partner.isAI) {
      if (aiAcceptsTrade(state, offer)) {
        act({ type: 'TRADE', offer })
        onClose()
      } else setStage('rejected')
    } else setStage('confirm')
  }

  return (
    <Modal title={t('mono.proposeTitle')} onClose={onClose} wide>
      <div className="tabs">
        {partners.map((x) => (
          <button key={x.id} className={`tab ${x.id === partnerId ? 'on' : ''}`} style={{ '--c': x.color }} onClick={() => pickPartner(x.id)}>
            {x.token} {x.name} {x.remote ? '🌐' : x.isAI ? '🤖' : ''}
          </button>
        ))}
      </div>

      {stage === 'confirm' ? (
        <div className="trade-confirm">
          <p>{tx('mono.passDevice', { p: <span style={{ color: partner.color }}>{partner.name}</span> })}</p>
          <p>
            {tx('mono.offers', { p: me.name, give: tradeSide(give) })}
            <br />
            {tx('mono.inExchange', { get: tradeSide(get) })}
          </p>
          <div className="row">
            <button
              className="btn primary"
              onClick={() => {
                act({ type: 'TRADE', offer })
                onClose()
              }}
            >
              {t('mono.accepts', { p: partner.name })}
            </button>
            <button className="btn danger" onClick={() => setStage('edit')}>
              {t('ui.decline')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="trade-grid">
            <Side state={state} player={me} side={give} setSide={setGive} title={t('ui.youGive')} />
            <div className="trade-arrow">⇄</div>
            <Side state={state} player={partner} side={get} setSide={setGet} title={t('ui.youGet')} />
          </div>
          {stage === 'rejected' && <div className="notice neg">{t('mono.ngmi', { p: partner.name })}</div>}
          <p className="muted small">{t('mono.feeNote')}</p>
          <div className="row end">
            {!check.ok && <span className="muted small">{fmt(check.reason, { ns: 'mono.why', players: state.players })}</span>}
            <button className="btn primary" disabled={!check.ok} onClick={propose}>
              {partner.remote ? t('ui.sendOffer') : t('mono.propose')}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
