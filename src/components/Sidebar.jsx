import { useEffect, useRef, useState } from 'react'
import { BOARD, OWNABLE, spaceVars } from '../data/board.js'
import { money, netWorth } from '../engine/game.js'
import DisplayButton from './DisplaySettings.jsx'

function PlayerCard({ state, p, openModal }) {
  const prev = useRef(p.money)
  const [deltas, setDeltas] = useState([])

  useEffect(() => {
    const d = p.money - prev.current
    prev.current = p.money
    if (!d) return
    const id = Math.random()
    setDeltas((x) => [...x, { id, d }])
    const t = setTimeout(() => setDeltas((x) => x.filter((y) => y.id !== id)), 1600)
    return () => clearTimeout(t)
  }, [p.money])

  const active = state.current === p.id && state.phase !== 'gameover'
  const owned = OWNABLE.filter((id) => state.props[id].owner === p.id)

  return (
    <div className={`player ${active ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''}`} style={{ '--c': p.color }}>
      <div className="player-top">
        <div className="avatar">{p.token}</div>
        <div className="player-id">
          <div className="player-name">
            {p.name}
            {p.isAI && <span className="tag">{p.remote ? '🌐 ONLINE' : 'BOT'}</span>}
            {p.inJail && <span className="tag warn">🔒 CUSTODY</span>}
            {p.cards.length > 0 && <span className="tag">🎟️×{p.cards.length}</span>}
            {p.bankrupt && <span className="tag neg">REKT</span>}
          </div>
          <div className="muted small">
            {p.bankrupt ? 'Bankrupt' : `on ${BOARD[p.pos].name} · worth ${money(netWorth(state, p.id))}`}
          </div>
        </div>
        <div className="player-money mono">
          {money(p.money)}
          {deltas.map(({ id, d }) => (
            <span key={id} className={`delta ${d > 0 ? 'pos' : 'neg'}`}>
              {d > 0 ? '+' : '−'}
              {money(Math.abs(d))}
            </span>
          ))}
        </div>
      </div>
      {owned.length > 0 && (
        <div className="holdings">
          {owned.map((id) => (
            <button
              key={id}
              className={`holding ${state.props[id].mortgaged ? 'mortgaged' : ''}`}
              style={spaceVars(id)}
              title={BOARD[id].name}
              onClick={() => openModal({ type: 'deed', id })}
            >
              {state.props[id].houses === 5 ? 'DC' : state.props[id].houses || ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ state, openModal, onQuit, onMenu }) {
  const logRef = useRef(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [state.log.length])

  return (
    <aside className="sidebar">
      <div className="panel">
        <div className="panel-head">
          <h2>Players</h2>
          <span className="muted small">Turn {state.turn}</span>
        </div>
        <div className="players">
          {state.players.map((p) => (
            <PlayerCard key={p.id} state={state} p={p} openModal={openModal} />
          ))}
        </div>
      </div>

      <div className="panel toolbar">
        <button className="btn ghost" onClick={() => openModal({ type: 'portfolio' })}>
          🗂️ Portfolio
        </button>
        <button className="btn ghost" onClick={() => openModal({ type: 'trade' })}>
          🤝 Trade
        </button>
        <button className="btn ghost" onClick={onQuit}>
          ↺ New game
        </button>
        <button className="btn ghost" onClick={onMenu}>
          ⌂ Menu
        </button>
        <DisplayButton icon />
      </div>

      <div className="panel log-panel">
        <div className="panel-head">
          <h2>On-chain activity</h2>
          <span className="muted small">
            🟩 {state.bank.houses} · 🏢 {state.bank.hotels} left
          </span>
        </div>
        <ul className="log" ref={logRef}>
          {state.log.map((e) => (
            <li key={e.id} style={{ '--c': e.pid !== null ? state.players[e.pid].color : 'var(--muted)' }}>
              {e.text}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
