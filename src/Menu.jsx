const GAMES = [
  {
    id: 'cryptopoly',
    mark: '◈',
    title: 'CRYPTOPOLY',
    tagline: 'Buy the dip. Stack nodes. Bankrupt your friends.',
    classic: 'Monopoly rules',
    chips: ['2–6 players', '🎲 Roll & move', '🏢 Data centers', '🔒 SEC custody'],
  },
  {
    id: 'catan',
    mark: '⬡',
    title: 'SETTLERS OF SATOSHI',
    tagline: 'Mine the island. Open channels. Moon at 10 VP.',
    classic: 'Catan rules',
    chips: ['3–4 players', '⚡ Channels', '🥷 The Hacker', '📜 Smart contracts'],
  },
]

export default function Menu({ saves, onPlay }) {
  return (
    <div className="setup menu">
      <div className="setup-hero">
        <div className="logo-mark big">◈</div>
        <h1 className="logo">DEGEN ARCADE</h1>
        <p className="tagline">Two classic board games. Zero fundamentals.</p>
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
      <p className="hint">Hot-seat on one screen with any mix of humans and bots. Games autosave in this browser.</p>
    </div>
  )
}
