import { useEffect, useState } from 'react'
import { net } from './net.js'
import { TURN_TIMES } from '../games.js'
import { t, timerLength } from '../i18n/index.js'

const URGENT = 10 // seconds left when the clock turns to a warning
const HURRY = 15 // seconds the Hurry button leaves (the server's HURRY)

const clockText = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

// Seconds left on a turn timer, ticking.
function useSecondsLeft(ends) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  return ends == null ? null : Math.max(0, Math.ceil((ends - now) / 1000))
}

// The turn timer for Cryptopoly and Settlers, off unless the host turns it on: in the lobby, and mid-game in the
// host's Moderate menu when turns drag on. Everyone else sees the setting.
export function TurnTimerPicker({ room }) {
  return (
    <label className="field">
      {t('online.turnTimer')}
      <select value={room.turnTimer.secs} disabled={room.host !== net.id} onChange={(e) => net.send({ t: 'turnTimer', secs: Number(e.target.value) })}>
        {TURN_TIMES.map((s) => (
          <option key={s} value={s}>
            {timerLength(s)}
          </option>
        ))}
      </select>
      <span className="hint">{t('online.turnTimerNote')}</span>
    </label>
  )
}

// The host's Hurry button: cuts the turn being played to 15 seconds, even with the timer off.
export function HurryButton({ room, players }) {
  const timer = room.turnTimer
  const left = useSecondsLeft(timer.pid != null ? timer.ends : null)
  const p = timer.waiting != null ? players?.[timer.waiting] : null
  const can = p && (left === null || left > HURRY)
  return (
    <div className="field">
      <button className="btn" disabled={!can} onClick={() => net.send({ t: 'hurry' })}>
        {p ? t('online.hurryP', { p: p.name }) : t('online.hurry')}
      </button>
      <span className="hint">{t('online.hurryNote')}</span>
    </div>
  )
}

// The tag on the room button that tells everyone the timer is on.
export function TimerTag({ room }) {
  return room.turnTimer?.secs ? <span className="tag">⏱ {timerLength(room.turnTimer.secs)}</span> : null
}

// Countdown for the turn the game is waiting on. When it runs out, the server makes safe moves for that player.
export default function TurnClock({ timer, players }) {
  const left = useSecondsLeft(timer.ends)
  const p = players?.[timer.pid]
  // A hurried turn can run on a clock while the timer itself is off.
  const full = Math.max(timer.secs, HURRY) * 1000
  return (
    <div
      className={`turn-clock ${left <= URGENT ? 'urgent' : ''}`}
      role="timer"
      title={t('online.turnTimerNote')}
      aria-label={t('online.clockLabel', { p: p?.name ?? '', time: clockText(left) })}
    >
      <span className="turn-clock-text mono">{left > 0 ? `⏱ ${clockText(left)}` : t('online.timeUp')}</span>
      <span className="turn-clock-bar">
        <span style={{ width: `${Math.min(100, ((left * 1000) / full) * 100)}%` }} />
      </span>
    </div>
  )
}
