import { useState } from 'react'
import { ROLES } from '../roles.js'
import { PLURAL_TEAMS } from '../rules.js'
import { t, N } from '../../i18n/index.js'
import { RoleName, Who } from './bits.jsx'

const BITS = ['⚖️', '💎', '🌕', '🚀', '✨', '📈']
const makeConfetti = () =>
  Array.from({ length: 36 }, (_, i) => ({ id: i, bit: BITS[i % BITS.length], left: Math.random() * 100, delay: Math.random() * 3, dur: 3 + Math.random() * 3 }))

export default function GameOver({ state: s, onNew, onMenu, onClose }) {
  const [confetti] = useState(makeConfetti)
  const humans = s.players.filter((p) => !p.isAI)
  const humanWon = humans.some((p) => s.winners.includes(p.id))
  const title = s.winner ? t(PLURAL_TEAMS.has(s.winner) ? 'salem.winTitle' : 'salem.winTitleSolo', { team: N.team(s.winner) }) : t('salem.draw')
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
        <span className="eyebrow">
          {t('salem.day', { n: s.day })} · {t(humans.length ? (humanWon ? 'salem.youWin' : 'salem.youLose') : 'salem.botsOnly')}
        </span>
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
              {!p.isAI && <span className="tag">{t('ui.tagYou')}</span>}
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="btn primary big" onClick={onNew}>
            {t('ui.playAgain')}
          </button>
          <button className="btn ghost" onClick={onClose}>
            {t('salem.reviewChat')}
          </button>
          <button className="btn ghost" onClick={onMenu}>
            {t('ui.mainMenuPlain')}
          </button>
        </div>
      </div>
    </div>
  )
}
