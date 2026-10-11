import { useEffect, useRef } from 'react'
import { RESOURCES, RES, DEV, WIN_VP } from '../data.js'
import { chainLength, handSize, victoryPoints } from '../engine.js'

function PlayerCard({ state, p, viewer }) {
  const active = state.current === p.id && state.phase !== 'gameover'
  const vp = victoryPoints(state, p.id, { hidden: p.id === viewer })
  return (
    <div className={`player ${active ? 'active' : ''}`} style={{ '--c': p.color }}>
      <div className="player-top">
        <div className="avatar">{p.token}</div>
        <div className="player-id">
          <div className="player-name">
            {p.name}
            {p.isAI && <span className="tag">{p.remote ? '🌐 ONLINE' : 'BOT'}</span>}
            {state.longest?.pid === p.id && <span className="tag warn">⛓️ LONGEST CHAIN</span>}
            {state.army?.pid === p.id && <span className="tag warn">🤖 BOTNET</span>}
          </div>
          <div className="muted small st-stats">
            <span title="Resource cards">🃏 {handSize(p)}</span>
            <span title="Smart contracts held">📜 {p.dev.length}</span>
            <span title="Hackers deployed">🥷 {p.knights}</span>
            <span title="Longest chain">⛓️ {chainLength(state, p.id)}</span>
          </div>
        </div>
        <div className="player-money mono st-vp" title="Victory points">
          {vp}
          <span className="muted">/{WIN_VP}</span>
        </div>
      </div>
    </div>
  )
}

function Wallet({ state, pid }) {
  const p = state.players[pid]
  const grouped = {}
  for (const d of p.dev) grouped[d.type] = [...(grouped[d.type] ?? []), d]
  return (
    <div className="panel st-wallet" style={{ '--c': p.color }}>
      <div className="panel-head">
        <h2>
          {p.token} {p.name}'s wallet
        </h2>
        <span className="muted small">
          ⚡{p.left.channel} 🟩{p.left.node} 🏢{p.left.dc} left
        </span>
      </div>
      <div className="st-hand">
        {RESOURCES.map((r) => (
          <div key={r} className={`st-card ${p.hand[r] ? '' : 'empty'}`} style={{ '--rc': RES[r].color }} title={`${RES[r].name} (${RES[r].classic})`}>
            <span className="st-card-icon">{RES[r].icon}</span>
            <span className="mono st-card-n">{p.hand[r]}</span>
            <span className="st-card-name">{RES[r].name}</span>
          </div>
        ))}
      </div>
      {p.dev.length > 0 && (
        <div className="st-devs">
          {Object.entries(grouped).map(([type, cards]) => (
            <span
              key={type}
              className={`chip ${cards.every((c) => c.turn === state.turn) ? 'fresh' : ''}`}
              title={type === 'vp' ? cards.map((c) => c.name).join(', ') : DEV[type].text}
            >
              {DEV[type].icon} {DEV[type].name}
              {cards.length > 1 ? ` ×${cards.length}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ state, viewer, onQuit, onMenu }) {
  const logRef = useRef(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [state.log.length])

  return (
    <aside className="sidebar">
      <div className="panel">
        <div className="panel-head">
          <h2>Players</h2>
          <span className="muted small">{state.turn ? `Turn ${state.turn}` : 'Genesis round'}</span>
        </div>
        <div className="players">
          {state.players.map((p) => (
            <PlayerCard key={p.id} state={state} p={p} viewer={viewer} />
          ))}
        </div>
      </div>

      {viewer !== null && <Wallet state={state} pid={viewer} />}

      <div className="panel toolbar">
        <button className="btn ghost" onClick={onQuit}>
          ↺ New game
        </button>
        <button className="btn ghost" onClick={onMenu}>
          ⌂ Main menu
        </button>
      </div>

      <div className="panel log-panel">
        <div className="panel-head">
          <h2>On-chain activity</h2>
          <span className="muted small">
            {RESOURCES.map((r) => `${RES[r].icon}${state.bank[r]}`).join(' ')} · 📜{state.devDeck.length}
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
