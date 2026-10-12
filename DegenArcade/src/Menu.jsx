import { GAMES } from './games.js'
import { OnlinePanel } from './net/Online.jsx'
import DisplayButton from './components/DisplaySettings.jsx'

export default function Menu({ saves, onPlay, n }) {
  return (
    <div className="setup menu">
      <DisplayButton className="corner-btn" />
      <div className="setup-hero">
        <div className="logo-mark big">◈</div>
        <h1 className="logo">DEGEN ARCADE</h1>
        <p className="tagline">Three classic games. Zero fundamentals.</p>
      </div>

      <div className="menu-grid">
        {GAMES.map((g) => (
          <section key={g.id} className={`panel menu-card menu-${g.id}`}>
            <div className="menu-mark">{g.mark}</div>
            <span className="eyebrow">{g.classic}</span>
            <h2 className="logo menu-title">{g.title}</h2>
            <p className="tagline">{g.tagline}</p>
            <div className="auction-chips">
              {g.chips.map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
            <div className="menu-actions">
              <button className="btn primary big wide" onClick={() => onPlay(g.id, { fresh: true })}>
                Create game 🚀
              </button>
              {saves[g.id] && (
                <button className="btn wide" onClick={() => onPlay(g.id, { fresh: false })}>
                  ↻ Resume game in progress
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <OnlinePanel n={n} />
      <p className="hint">Play on one screen (hot-seat) or online with friends, with bots in any empty seats. Local games autosave in this browser.</p>
    </div>
  )
}
