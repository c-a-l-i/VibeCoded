import { useState } from 'react'
import { money, netWorth } from '../engine/game.js'

const BITS = ['🚀', '💎', '🌕', '🪙', '✨', '📈']

const makeConfetti = () =>
  Array.from({ length: 40 }, (_, i) => ({
    id: i,
    bit: BITS[i % BITS.length],
    left: Math.random() * 100,
    delay: Math.random() * 3,
    dur: 3 + Math.random() * 3,
  }))

export default function GameOver({ state, onNew }) {
  const w = state.players[state.winner]
  const [confetti] = useState(makeConfetti)
  return (
    <div className="modal-backdrop gameover">
      {confetti.map((c) => (
        <span key={c.id} className="confetti" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }}>
          {c.bit}
        </span>
      ))}
      <div className="modal winner" style={{ '--c': w.color }}>
        <div className="winner-token">{w.token}</div>
        <span className="eyebrow">Last whale standing</span>
        <h1>{w.name} wins!</h1>
        <p className="muted">
          Final net worth <b className="mono">{money(netWorth(state, w.id))}</b> after {state.turn} turn{state.turn === 1 ? '' : 's'}.
        </p>
        <button className="btn primary big" onClick={onNew}>
          Play again
        </button>
      </div>
    </div>
  )
}
