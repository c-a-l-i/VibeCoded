import { MODES } from '../roles.js'
import { PACES } from '../engine.js'
import { fullMoon } from '../rules.js'
import DisplayButton from '../../components/DisplaySettings.jsx'
import LanguageButton from '../../components/LanguageButton.jsx'
import { t, N } from '../../i18n/index.js'

export default function TopBar({ state: s, paused, setPaused, onPace, onGuide, onQuit, onMenu, peek, setPeek }) {
  const left = Math.max(0, s.dur - s.clock)
  const pct = s.dur ? Math.min(100, (s.clock / s.dur) * 100) : 100
  const when = t(s.phase === 'night' ? (fullMoon(s) ? 'salem.nightMoon' : 'salem.night') : 'salem.day', { n: s.day })
  return (
    <header className="panel ts-top">
      <div className="ts-brand">
        <span className="ts-brand-mark">⚖️</span>
        <span className="logo">{t('games.salem.title')}</span>
        <span className="chip">{N.mode(MODES[s.mode] ? s.mode : 'custom')}</span>
      </div>
      <div className="ts-phase">
        <div className="ts-phase-name">
          <b>{s.phase === 'night' ? `🌙 ${when}` : t(`salem.phases.${s.phase}`)}</b>
          {s.phase !== 'night' && <span className="muted">{when}</span>}
          {s.phase !== 'gameover' && <span className="mono ts-left">{paused ? t('salem.paused') : t('salem.sec', { n: Math.ceil(left / 1000) })}</span>}
        </div>
        <div className="ts-timer">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="ts-controls">
        {s.phase !== 'gameover' && setPaused && (
          <button className="icon-btn" onClick={() => setPaused(!paused)} title={paused ? t('salem.resume') : t('salem.pause')}>
            {paused ? '▶' : '⏸'}
          </button>
        )}
        <select className="ts-pace" value={s.pace} disabled={!onPace} onChange={(e) => onPace(e.target.value)} aria-label={t('salem.pace')} title={onPace ? t('salem.pace') : t('salem.hostPace')}>
          {Object.keys(PACES).map((k) => (
            <option key={k} value={k}>
              ⏱ {N.pace(k)}
            </option>
          ))}
        </select>
        {setPeek && (
          <button className={`btn tiny ${peek ? 'primary' : 'ghost'}`} onClick={() => setPeek(!peek)} title={t('salem.peekTip')}>
            {peek ? t('salem.hideRoles') : t('salem.revealRoles')}
          </button>
        )}
        <button className="btn tiny ghost" onClick={onGuide}>
          {t('salem.roles')}
        </button>
        <button className="btn tiny ghost" onClick={onQuit}>
          {t('salem.newShort')}
        </button>
        <button className="btn tiny ghost" onClick={onMenu}>
          {t('ui.menu')}
        </button>
        <LanguageButton icon className="tiny" />
        <DisplayButton icon className="tiny" />
      </div>
    </header>
  )
}
