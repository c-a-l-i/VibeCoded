import { useState } from 'react'
import { TOKENS, PLAYER_COLORS, DEFAULT_NAMES } from '../data/board.js'
import { CornerTools } from './LanguageButton.jsx'
import { t, look } from '../i18n/index.js'

const makePlayer = (i) => ({ name: DEFAULT_NAMES[i], token: TOKENS[i], color: PLAYER_COLORS[i], isAI: i > 0 })

export default function Setup({ onStart, onBack }) {
  const [players, setPlayers] = useState([0, 1, 2, 3].map(makePlayer))

  const update = (i, patch) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const cycleToken = (i) => {
    const used = new Set(players.map((p) => p.token))
    let k = TOKENS.indexOf(players[i].token)
    do k = (k + 1) % TOKENS.length
    while (used.has(TOKENS[k]) && TOKENS[k] !== players[i].token)
    update(i, { token: TOKENS[k] })
  }
  const add = () => {
    const usedColors = new Set(players.map((p) => p.color))
    const usedTokens = new Set(players.map((p) => p.token))
    const usedNames = new Set(players.map((p) => p.name))
    setPlayers([
      ...players,
      {
        name: DEFAULT_NAMES.find((n) => !usedNames.has(n)) ?? `Player ${players.length + 1}`,
        token: TOKENS.find((x) => !usedTokens.has(x)),
        color: PLAYER_COLORS.find((c) => !usedColors.has(c)),
        isAI: true,
      },
    ])
  }

  const valid = players.every((p) => p.name.trim())

  return (
    <div className="setup">
      <button className="btn ghost back-btn" onClick={onBack}>
        {t('ui.allGames')}
      </button>
      <CornerTools />
      <div className="setup-hero">
        <div className="logo-mark big">◈</div>
        <h1 className="logo">{t('games.cryptopoly.title')}</h1>
        <p className="tagline">{t('games.cryptopoly.tagline')}</p>
      </div>

      <div className="setup-grid">
        <section className="panel setup-players">
          <h2>{t('ui.players')}</h2>
          {players.map((p, i) => (
            <div className="setup-row" key={i} style={{ '--c': p.color }}>
              <button className="token-pick" onClick={() => cycleToken(i)} title={t('ui.changeToken')}>
                {p.token}
              </button>
              <input
                value={p.name}
                maxLength={14}
                onChange={(e) => update(i, { name: e.target.value })}
                aria-label={t('ui.playerName', { n: i + 1 })}
              />
              <div className="seg">
                <button className={!p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: false })}>
                  {t('ui.human')}
                </button>
                <button className={p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: true })}>
                  {t('ui.bot')}
                </button>
              </div>
              <button
                className="icon-btn"
                disabled={players.length <= 2}
                onClick={() => setPlayers(players.filter((_, j) => j !== i))}
                title={t('ui.removePlayer')}
              >
                ✕
              </button>
            </div>
          ))}
          {players.length < 6 && (
            <button className="btn ghost wide" onClick={add}>
              {t('ui.addPlayer')}
            </button>
          )}
          <button
            className="btn primary wide big"
            disabled={!valid}
            onClick={() => onStart(players.map((p) => ({ ...p, name: p.name.trim() })))}
          >
            {t('mono.launch')}
          </button>
          <p className="hint">{t('ui.hotseat')}</p>
        </section>

        <section className="panel setup-legend">
          <h2>{t('ui.sameRules')}</h2>
          <ul>
            {look('mono.legend').map(([icon, name, classic]) => (
              <li key={icon}>
                <span className="legend-icon">{icon}</span>
                <strong>{name}</strong>
                <span className="muted">= {classic}</span>
              </li>
            ))}
          </ul>
          <p className="hint">{t('mono.rulesHint')}</p>
        </section>
      </div>
    </div>
  )
}
