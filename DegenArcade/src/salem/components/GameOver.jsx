import { useState } from 'react'
import { ROLES, TEAM_NAMES } from '../roles.js'
import { RoleName, Who } from './bits.jsx'

const BITS = ['⚖️', '💎', '🌕', '🚀', '✨', '📈']
const makeConfetti = () =>
  Array.from({ length: 36 }, (_, i) => ({ id: i, bit: BITS[i % BITS.length], left: Math.random() * 100, delay: Math.random() * 3, dur: 3 + Math.random() * 3 }))

export default function GameOver({ state: s, onNew, onMenu, onClose }) {
  const [confetti] = useState(makeConfetti)
  const humans = s.players.filter((p) => !p.isAI)
  const humanWon = humans.some((p) => s.winners.includes(p.id))
  const title = s.winner ? `${TEAM_NAMES[s.winner]} ${['town', 'cabal', 'vampire'].includes(s.winner) ? 'win' : 'wins'}!` : 'Draw'
  const sorted = [...s.players].sort((a, b) => Number(s.winners.includes(b.id)) - Number(s.winners.includes(a.id)))
  return (
    <div className="modal-backdrop gameover">
      {(humanWon || !humans.length) &&
        confetti.map((c) => (
          <span key={c.id} className="confetti" style={{ left: `${c.left}%`, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }}>
            {c.bit}
          </span>
        ))}
      <div className="modal winner ts-over" style={{ '--c': s.winner === 'town' ? 'var(--green)' : s.winner ? 'var(--red)' : 'var(--gold)' }}>
        <span className="eyebrow">Day {s.day} · {humans.length ? (humanWon ? 'You win' : 'You lose') : 'Bots only'}</span>
        <h1>{title}</h1>
        <ul className="ts-final">
          {sorted.map((p) => (
            <li key={p.id} className={s.winners.includes(p.id) ? 'won' : ''}>
              <span>{s.winners.includes(p.id) ? '🏆' : p.alive ? '·' : '🪦'}</span>
              <Who p={p} />
              <span>
                {p.startRole !== p.role && <span className="muted small">{ROLES[p.startRole].icon} → </span>}
                <RoleName role={p.role} short />
              </span>
              {!p.isAI && <span className="tag">YOU</span>}
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="btn primary big" onClick={onNew}>
            Play again
          </button>
          <button className="btn ghost" onClick={onClose}>
            Review chat
          </button>
          <button className="btn ghost" onClick={onMenu}>
            Main menu
          </button>
        </div>
      </div>
    </div>
  )
}
