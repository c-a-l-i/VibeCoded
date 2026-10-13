import { GAMES } from './games.js'
import { OnlinePanel } from './net/Online.jsx'
import { CornerTools } from './components/LanguageButton.jsx'
import { t, look } from './i18n/index.js'

export default function Menu({ saves, onPlay, n }) {
  return (
    <div className="setup menu">
      <CornerTools />
      <div className="setup-hero">
        <div className="logo-mark big">◈</div>
        <h1 className="logo">DEGEN ARCADE</h1>
        <p className="tagline">{t('menu.tagline')}</p>
      </div>

      <div className="menu-grid">
        {GAMES.map((g) => (
          <section key={g.id} className={`panel menu-card menu-${g.id}`}>
            <div className="menu-mark">{g.mark}</div>
            <span className="eyebrow">{t(`games.${g.id}.classic`)}</span>
            <h2 className="logo menu-title">{t(`games.${g.id}.title`)}</h2>
            <p className="tagline">{t(`games.${g.id}.tagline`)}</p>
            <div className="auction-chips">
              {look(`games.${g.id}.chips`).map((c) => (
                <span key={c} className="chip">
                  {c}
                </span>
              ))}
            </div>
            <div className="menu-actions">
              <button className="btn primary big wide" onClick={() => onPlay(g.id, { fresh: true })}>
                {t('menu.create')}
              </button>
              {saves[g.id] && (
                <button className="btn wide" onClick={() => onPlay(g.id, { fresh: false })}>
                  {t('menu.resume')}
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <OnlinePanel n={n} />
      <p className="hint">{t('menu.hint')}</p>
    </div>
  )
}
