import { useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { RESOURCES, RES, bagSize } from '../data.js'
import { tradeCheck, tradeRate } from '../engine.js'
import { wouldAccept } from '../ai.js'
import { ResPicker } from './bits.jsx'
import { t, tx, N, fmt } from '../../i18n/index.js'

function Swap({ state, act }) {
  const p = state.players[state.current]
  const [give, setGive] = useState(null)
  return (
    <div className="st-swap">
      <p className="hint">{tx('catan.swapHint')}</p>
      <div className="eyebrow">{t('ui.youGive')}</div>
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
              <span className="small muted">{t('catan.have', { n: p.hand[r] })}</span>
            </button>
          )
        })}
      </div>
      <div className="eyebrow">{t('catan.getOne')}</div>
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
            <span className="small muted">{N.res(r)}</span>
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
    const trade = { type: 'TRADE', trade: { from: p.id, to, give, get } }
    act(state.players[to].remote ? { type: 'OFFER', action: trade } : trade)
    onClose()
  }

  return (
    <div className="st-otc">
      <div className="trade-grid">
        <div className="trade-side" style={{ '--c': p.color }}>
          <h3>{t('catan.youSend')}</h3>
          <ResPicker value={give} onChange={setGive} max={p.hand} disabled={Object.fromEntries(RESOURCES.map((r) => [r, get[r] > 0]))} />
        </div>
        <div className="trade-arrow">⇄</div>
        <div className="trade-side" style={{ '--c': 'var(--violet)' }}>
          <h3>{t('catan.youWant')}</h3>
          <ResPicker value={get} onChange={setGet} disabled={Object.fromEntries(RESOURCES.map((r) => [r, give[r] > 0]))} />
        </div>
      </div>
      <div className="st-counterparties">
        {others.map((o) => {
          const trade = { from: p.id, to: o.id, give, get }
          const check = ready ? tradeCheck(state, trade) : { ok: false, reason: { k: 'buildOffer' } }
          const reason = check.ok ? '' : fmt(check.reason, { ns: 'catan.why', players: state.players })
          const accepts = check.ok && (!o.isAI || o.remote || wouldAccept(state, o.id, trade))
          return (
            <div key={o.id} className="st-cp" style={{ '--c': o.color }}>
              <span className="who">
                <span className="who-token">{o.token}</span>
                {o.name}
              </span>
              <span className="muted small">
                {!check.ok
                  ? reason
                  : o.remote
                    ? t('catan.theyDecide')
                    : o.isAI
                      ? accepts
                        ? t('catan.willTake')
                        : t('catan.notInterested')
                      : t('catan.handScreen')}
              </span>
              <button className="btn tiny" disabled={!accepts} onClick={() => execute(o.id)}>
                {o.remote ? t('ui.sendOffer') : o.isAI ? t('catan.executeTrade') : t('catan.acceptAs', { p: o.name })}
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
    <Modal title={t('catan.desk')} onClose={onClose} wide>
      <div className="tabs" style={{ '--c': p.color }}>
        <button className={`tab ${tab === 'swap' ? 'on' : ''}`} onClick={() => setTab('swap')}>
          {t('catan.marketSwap')}
        </button>
        <button className={`tab ${tab === 'otc' ? 'on' : ''}`} onClick={() => setTab('otc')}>
          {t('catan.otc')}
        </button>
      </div>
      {tab === 'swap' ? <Swap state={state} act={act} /> : <Otc state={state} act={act} onClose={onClose} />}
    </Modal>
  )
}
