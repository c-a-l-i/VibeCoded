import { useState } from 'react'
import { netWorth } from '../engine/game.js'
import { t, tx, money } from '../i18n/index.js'

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
        <span className="eyebrow">{t('mono.lastWhale')}</span>
        <h1>{t('ui.wins', { p: w.name })}</h1>
        <p className="muted">{tx('mono.finalWorth', { m: money(netWorth(state, w.id)), n: state.turn })}</p>
        <button className="btn primary big" onClick={onNew}>
          {t('ui.playAgain')}
        </button>
      </div>
    </div>
  )
}
