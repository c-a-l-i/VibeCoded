import { useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { RESOURCES, RES, bagSize } from '../data.js'
import { tradeCheck, tradeRate } from '../engine.js'
import { wouldAccept } from '../ai.js'
import { ResPicker } from './bits.jsx'

function Swap({ state, act }) {
  const p = state.players[state.current]
  const [give, setGive] = useState(null)
  return (
    <div className="st-swap">
      <p className="hint">
        Swap with the market at 4:1. Nodes on a harbor unlock a <b>DEX</b> (3:1, any resource) or a <b>CEX</b> pool (2:1 for one
        resource).
      </p>
      <div className="eyebrow">You give</div>
      <div className="st-res-row">
        {RESOURCES.map((r) => {
          const rate = tradeRate(state, p.id, r)
          return (
            <button
              key={r}
              className={`btn st-res-btn ${give === r ? 'on' : ''}`}
              style={{ '--rc': RES[r].color }}
              disabled={p.hand[r] < rate}
              onClick={() => setGive(r)}
            >
              <span>
                {rate}× {RES[r].icon}
              </span>
              <span className="small muted">have {p.hand[r]}</span>
            </button>
          )
        })}
      </div>
      <div className="eyebrow">You get 1</div>
      <div className="st-res-row">
        {RESOURCES.map((r) => (
          <button
            key={r}
            className="btn st-res-btn"
            style={{ '--rc': RES[r].color }}
            disabled={!give || give === r || !state.bank[r]}
            onClick={() => act({ type: 'BANK_TRADE', give, get: r })}
          >
            <span>{RES[r].icon}</span>
            <span className="small muted">{RES[r].name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Otc({ state, act, onClose }) {
  const p = state.players[state.current]
  const [give, setGive] = useState({})
  const [get, setGet] = useState({})
  const others = state.players.filter((o) => o.id !== p.id)
  const ready = bagSize(give) > 0 && bagSize(get) > 0

  const execute = (to) => {
    act({ type: 'TRADE', trade: { from: p.id, to, give, get } })
    onClose()
  }

  return (
    <div className="st-otc">
      <div className="trade-grid">
        <div className="trade-side" style={{ '--c': p.color }}>
          <h3>You send</h3>
          <ResPicker value={give} onChange={setGive} max={p.hand} disabled={Object.fromEntries(RESOURCES.map((r) => [r, get[r] > 0]))} />
        </div>
        <div className="trade-arrow">⇄</div>
        <div className="trade-side" style={{ '--c': 'var(--violet)' }}>
          <h3>You want</h3>
          <ResPicker value={get} onChange={setGet} disabled={Object.fromEntries(RESOURCES.map((r) => [r, give[r] > 0]))} />
        </div>
      </div>
      <div className="st-counterparties">
        {others.map((o) => {
          const trade = { from: p.id, to: o.id, give, get }
          const check = ready ? tradeCheck(state, trade) : { ok: false, reason: 'Build an offer' }
          const accepts = check.ok && (!o.isAI || wouldAccept(state, o.id, trade))
          return (
            <div key={o.id} className="st-cp" style={{ '--c': o.color }}>
              <span className="who">
                <span className="who-token">{o.token}</span>
                {o.name}
              </span>
              <span className="muted small">
                {o.isAI ? (!check.ok ? check.reason : accepts ? '✅ will take it' : '❌ not interested') : check.ok ? 'hand them the screen' : check.reason}
              </span>
              <button className="btn tiny" disabled={!accepts} onClick={() => execute(o.id)}>
                {o.isAI ? 'Execute' : `Accept as ${o.name}`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function TradeModal({ state, act, onClose }) {
  const [tab, setTab] = useState('swap')
  const p = state.players[state.current]
  return (
    <Modal title="Trading desk" onClose={onClose} wide>
      <div className="tabs" style={{ '--c': p.color }}>
        <button className={`tab ${tab === 'swap' ? 'on' : ''}`} onClick={() => setTab('swap')}>
          🏦 Market swap
        </button>
        <button className={`tab ${tab === 'otc' ? 'on' : ''}`} onClick={() => setTab('otc')}>
          🤝 OTC with players
        </button>
      </div>
      {tab === 'swap' ? <Swap state={state} act={act} /> : <Otc state={state} act={act} onClose={onClose} />}
    </Modal>
  )
}
