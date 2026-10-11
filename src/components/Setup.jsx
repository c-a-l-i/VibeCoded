import { useState } from 'react'
import { TOKENS, PLAYER_COLORS, DEFAULT_NAMES } from '../data/board.js'

const LEGEND = [
  ['⛓️', 'Genesis Block', 'GO — collect $200'],
  ['🔒', 'SEC Custody', 'Jail'],
  ['🚨', 'SEC Raid!', 'Go to Jail'],
  ['💎', 'HODL Zone', 'Free Parking'],
  ['📈', 'FOMO', 'Chance'],
  ['🏛️', 'DAO Treasury', 'Community Chest'],
  ['🟩', 'Nodes', 'Houses'],
  ['🏢', 'Data Centers', 'Hotels'],
  ['⚡', 'Networks', 'Railroads'],
  ['⛏️', 'Mining', 'Utilities'],
]

const makePlayer = (i) => ({ name: DEFAULT_NAMES[i], token: TOKENS[i], color: PLAYER_COLORS[i], isAI: i > 0 })

export default function Setup({ onStart }) {
  const [players, setPlayers] = useState([0, 1, 2, 3].map(makePlayer))

  const update = (i, patch) => setPlayers((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const cycleToken = (i) => {
    const used = new Set(players.map((p) => p.token))
    let t = TOKENS.indexOf(players[i].token)
    do t = (t + 1) % TOKENS.length
    while (used.has(TOKENS[t]) && TOKENS[t] !== players[i].token)
    update(i, { token: TOKENS[t] })
  }
  const add = () => {
    const usedColors = new Set(players.map((p) => p.color))
    const usedTokens = new Set(players.map((p) => p.token))
    const usedNames = new Set(players.map((p) => p.name))
    setPlayers([
      ...players,
      {
        name: DEFAULT_NAMES.find((n) => !usedNames.has(n)) ?? `Player ${players.length + 1}`,
        token: TOKENS.find((t) => !usedTokens.has(t)),
        color: PLAYER_COLORS.find((c) => !usedColors.has(c)),
        isAI: true,
      },
    ])
  }

  const valid = players.every((p) => p.name.trim())

  return (
    <div className="setup">
      <div className="setup-hero">
        <div className="logo-mark big">◈</div>
        <h1 className="logo">CRYPTOPOLY</h1>
        <p className="tagline">Buy the dip. Stack nodes. Bankrupt your friends.</p>
      </div>

      <div className="setup-grid">
        <section className="panel setup-players">
          <h2>Players</h2>
          {players.map((p, i) => (
            <div className="setup-row" key={i} style={{ '--c': p.color }}>
              <button className="token-pick" onClick={() => cycleToken(i)} title="Change token">
                {p.token}
              </button>
              <input
                value={p.name}
                maxLength={14}
                onChange={(e) => update(i, { name: e.target.value })}
                aria-label={`Player ${i + 1} name`}
              />
              <div className="seg">
                <button className={!p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: false })}>
                  Human
                </button>
                <button className={p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: true })}>
                  Bot
                </button>
              </div>
              <button
                className="icon-btn"
                disabled={players.length <= 2}
                onClick={() => setPlayers(players.filter((_, j) => j !== i))}
                title="Remove player"
              >
                ✕
              </button>
            </div>
          ))}
          {players.length < 6 && (
            <button className="btn ghost wide" onClick={add}>
              + Add player
            </button>
          )}
          <button
            className="btn primary wide big"
            disabled={!valid}
            onClick={() => onStart(players.map((p) => ({ ...p, name: p.name.trim() })))}
          >
            Launch game 🚀
          </button>
          <p className="hint">Humans share this screen (hot-seat). Bots play themselves.</p>
        </section>

        <section className="panel setup-legend">
          <h2>Same rules, new bags</h2>
          <ul>
            {LEGEND.map(([icon, name, classic]) => (
              <li key={name}>
                <span className="legend-icon">{icon}</span>
                <strong>{name}</strong>
                <span className="muted">= {classic}</span>
              </li>
            ))}
          </ul>
          <p className="hint">
            $1,500 to start · doubles roll again · three doubles = custody · unbought property goes to auction · build
            evenly on full color sets · mortgage for half price, lift for +10%.
          </p>
        </section>
      </div>
    </div>
  )
}
