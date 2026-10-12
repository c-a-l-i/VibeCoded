import { MODES } from '../roles.js'
import { PACES } from '../engine.js'
import { fullMoon } from '../rules.js'
import DisplayButton from '../../components/DisplaySettings.jsx'

const PHASES = {
  day1: '☀️ Introductions',
  morning: '🌅 Morning',
  discussion: '💬 Discussion',
  voting: '🗳️ Voting',
  defense: '⚖️ Defense',
  judgement: '⚖️ Judgement',
  verdict: '⚖️ Verdict',
  lastwords: '🕯️ Last words',
  night: '🌙 Night',
  gameover: '🏁 Game over',
}

export default function TopBar({ state: s, paused, setPaused, onPace, onGuide, onQuit, onMenu, peek, setPeek }) {
  const left = Math.max(0, s.dur - s.clock)
  const pct = s.dur ? Math.min(100, (s.clock / s.dur) * 100) : 100
  const when = s.phase === 'night' ? `Night ${s.day}${fullMoon(s) ? ' · 🌕 full moon' : ''}` : `Day ${s.day}`
  return (
    <header className="panel ts-top">
      <div className="ts-brand">
        <span className="ts-brand-mark">⚖️</span>
        <span className="logo">TOWN OF SOLANA</span>
        <span className="chip">{MODES[s.mode]?.name ?? 'Custom'}</span>
      </div>
      <div className="ts-phase">
        <div className="ts-phase-name">
          <b>{s.phase === 'night' ? `🌙 ${when}` : PHASES[s.phase]}</b>
          {s.phase !== 'night' && <span className="muted">{when}</span>}
          {s.phase !== 'gameover' && <span className="mono ts-left">{paused ? '⏸ paused' : `${Math.ceil(left / 1000)}s`}</span>}
        </div>
        <div className="ts-timer">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="ts-controls">
        {s.phase !== 'gameover' && setPaused && (
          <button className="icon-btn" onClick={() => setPaused(!paused)} title={paused ? 'Resume' : 'Pause'}>
            {paused ? '▶' : '⏸'}
          </button>
        )}
        <select className="ts-pace" value={s.pace} disabled={!onPace} onChange={(e) => onPace(e.target.value)} aria-label="Pace" title={onPace ? 'Pace' : 'The host sets the pace'}>
          {Object.entries(PACES).map(([k, p]) => (
            <option key={k} value={k}>
              ⏱ {p.name}
            </option>
          ))}
        </select>
        {setPeek && (
          <button className={`btn tiny ${peek ? 'primary' : 'ghost'}`} onClick={() => setPeek(!peek)} title="You’re out of the game. Peek at every role and chat.">
            👁️ {peek ? 'Hide roles' : 'Reveal roles'}
          </button>
        )}
        <button className="btn tiny ghost" onClick={onGuide}>
          📖 Roles
        </button>
        <button className="btn tiny ghost" onClick={onQuit}>
          ↺ New
        </button>
        <button className="btn tiny ghost" onClick={onMenu}>
          ⌂ Menu
        </button>
        <DisplayButton icon className="tiny" />
      </div>
    </header>
  )
}
