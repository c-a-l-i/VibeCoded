import { useState } from 'react'
import Modal from '../../components/Modal.jsx'
import { RESOURCES, RES, DEV } from '../data.js'
import { playableDev } from '../engine.js'

export default function DevModal({ state, act, onClose }) {
  const p = state.players[state.current]
  const playable = playableDev(state, p.id)
  const [plenty, setPlenty] = useState([])
  const run = (a) => {
    act({ type: 'PLAY_DEV', ...a })
    onClose()
  }

  return (
    <Modal title="Execute a smart contract" onClose={onClose}>
      <p className="hint">One contract per turn, and not on the turn you deployed it. Rare NFTs count automatically.</p>
      {playable.map((card) => (
        <div key={card} className="st-dev">
          <div className="st-dev-head">
            <span className="st-dev-icon">{DEV[card].icon}</span>
            <div>
              <strong>{DEV[card].name}</strong>
              <div className="muted small">{DEV[card].text}</div>
            </div>
          </div>
          {card === 'knight' && (
            <button className="btn primary" onClick={() => run({ card })}>
              Deploy the Hacker
            </button>
          )}
          {card === 'road' && (
            <button className="btn primary" onClick={() => run({ card })}>
              Roll up 2 channels
            </button>
          )}
          {card === 'monopoly' && (
            <div className="st-res-row">
              {RESOURCES.map((r) => (
                <button key={r} className="btn st-res-btn" style={{ '--rc': RES[r].color }} onClick={() => run({ card, res: r })}>
                  <span>{RES[r].icon}</span>
                  <span className="small muted">{RES[r].name}</span>
                </button>
              ))}
            </div>
          )}
          {card === 'plenty' && (
            <>
              <div className="st-res-row">
                {RESOURCES.map((r) => {
                  const picked = plenty.filter((x) => x === r).length
                  return (
                    <button
                      key={r}
                      className={`btn st-res-btn ${picked ? 'on' : ''}`}
                      style={{ '--rc': RES[r].color }}
                      disabled={plenty.length >= 2 || state.bank[r] <= picked}
                      onClick={() => setPlenty([...plenty, r])}
                    >
                      <span>{RES[r].icon}{picked ? ` ×${picked}` : ''}</span>
                      <span className="small muted">bank {state.bank[r]}</span>
                    </button>
                  )
                })}
              </div>
              <div className="row">
                <button className="btn ghost" disabled={!plenty.length} onClick={() => setPlenty([])}>
                  Clear
                </button>
                <button className="btn primary" disabled={plenty.length !== 2} onClick={() => run({ card, res: plenty })}>
                  Claim {plenty.map((r) => RES[r].icon).join(' ')}
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      {!playable.length && <p className="muted center-text">Nothing executable right now.</p>}
    </Modal>
  )
}
