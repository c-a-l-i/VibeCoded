import { useEffect, useState } from 'react'
import { net } from './net.js'
import { TURN_TIMES } from '../games.js'
import { t } from '../i18n/index.js'

const URGENT = 10 // seconds left when the clock turns to a warning

const length = (secs) => (!secs ? t('online.timerOff') : secs % 60 ? t('online.timerSec', { n: secs }) : t('online.timerMin', { n: secs / 60 }))
const clockText = (secs) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`

// The turn timer for Cryptopoly and Settlers, off unless the host turns it on. The host can change it in the
// lobby or mid-game (from the room menu) when turns drag on; everyone else sees the setting.
export function TurnTimerPicker({ room }) {
  return (
    <label className="field">
      {t('online.turnTimer')}
      <select value={room.turnTimer.secs} disabled={room.host !== net.id} onChange={(e) => net.send({ t: 'turnTimer', secs: Number(e.target.value) })}>
        {TURN_TIMES.map((s) => (
          <option key={s} value={s}>
            {length(s)}
          </option>
        ))}
      </select>
      <span className="hint">{t('online.turnTimerNote')}</span>
    </label>
  )
}

// The tag on the room button that tells everyone the timer is on.
export function TimerTag({ room }) {
  return room.turnTimer?.secs ? <span className="tag">⏱ {length(room.turnTimer.secs)}</span> : null
}

// Countdown for the move the game is waiting on. When it runs out, the server makes a safe move for that player.
export default function TurnClock({ timer, players }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, Math.ceil((timer.ends - now) / 1000))
  const p = players?.[timer.pid]
  return (
    <div
      className={`turn-clock ${left <= URGENT ? 'urgent' : ''}`}
      role="timer"
      title={t('online.turnTimerNote')}
      aria-label={t('online.clockLabel', { p: p?.name ?? '', time: clockText(left) })}
    >
      <span className="turn-clock-text mono">{left > 0 ? `⏱ ${clockText(left)}` : t('online.timeUp')}</span>
      <span className="turn-clock-bar">
        <span style={{ width: `${Math.min(100, (left / timer.secs) * 100)}%` }} />
      </span>
    </div>
  )
}
