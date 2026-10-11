import { useState } from 'react'
import { victoryPoints } from '../engine.js'

const BITS = ['🚀', '💎', '🌕', '⬡', '✨', '📈']

const makeConfetti = () =>
  Array.from({ length: 40 }, (_, i) => ({
    id: i,
    bit: BITS[i % BITS.length],
    left: Math.random() * 100,
    delay: Math.random() * 3,
    dur: 3 + Math.random() * 3,
  }))

export default function GameOver({ state, onNew, onMenu }) {
  const w = state.players[state.winner]
  const [confetti] = useState(makeConfetti)
  const standings = [...state.players].sort((a, b) => victoryPoints(state, b.id) - victoryPoints(state, a.id))
  return (
    <div className="modal-backdrop gameover">
      {confetti.map((c) => (
        <span key={c.id} className="confetti" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }}>
          {c.bit}
        </span>
      ))}
      <div className="modal winner" style={{ '--c': w.color }}>
        <div className="winner-token">{w.token}</div>
        <span className="eyebrow">To the moon</span>
        <h1>{w.name} wins!</h1>
        <ul className="st-standings">
          {standings.map((p) => (
            <li key={p.id} style={{ '--c': p.color }}>
              <span className="who">
                <span className="who-token">{p.token}</span>
                {p.name}
              </span>
              <b className="mono">{victoryPoints(state, p.id)} VP</b>
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="btn primary big" onClick={onNew}>
            Play again
          </button>
          <button className="btn ghost" onClick={onMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  )
}
