import { useState } from 'react'
import { MODES, NAMES, TERMS, rollRoles } from '../roles.js'
import { PACES } from '../engine.js'
import RoleGuide from './RoleGuide.jsx'
import RoleListPicker from './RoleListPicker.jsx'
import DisplayButton from '../../components/DisplaySettings.jsx'

const seat = (i) => ({ name: NAMES[i], isAI: i > 0 })

export default function Setup({ onStart, onBack }) {
  const [mode, setMode] = useState('classic')
  const [custom, setCustom] = useState(MODES.custom.list)
  const [seats, setSeats] = useState(() => Array.from({ length: 15 }, (_, i) => seat(i)))
  const [pace, setPace] = useState('normal')
  const [guide, setGuide] = useState(false)
  const [error, setError] = useState(null)

  const list = mode === 'custom' ? custom : MODES[mode].list
  const n = list.length
  const shown = seats.slice(0, n)
  const humans = shown.filter((p) => !p.isAI).length
  const update = (i, patch) => setSeats((ss) => ss.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const names = shown.map((p) => p.name.trim().toLowerCase())
  const valid = shown.every((p) => p.name.trim()) && new Set(names).size === names.length

  const start = () => {
    if (!rollRoles(list)) {
      setError('That role list can’t be dealt: too many unique roles, or no two sides to fight. Tweak it and try again.')
      return
    }
    onStart({ mode, list, seats: shown.map((p) => ({ ...p, name: p.name.trim() })), pace })
  }

  return (
    <div className="setup ts-setup">
      <button className="btn ghost back-btn" onClick={onBack}>
        ← All games
      </button>
      <DisplayButton className="corner-btn" />
      <div className="setup-hero">
        <div className="logo-mark big">⚖️</div>
        <h1 className="logo ts-logo">TOWN OF SOLANA</h1>
        <p className="tagline">Find the Cabal before they rug the whole town.</p>
      </div>

      <div className="ts-setup-grid">
        <section className="panel ts-setup-col">
          <h2>Game mode</h2>
          <RoleListPicker
            mode={mode}
            custom={custom}
            onMode={(id) => {
              setMode(id)
              setError(null)
            }}
            onCustom={setCustom}
          />
          <button className="btn ghost wide" onClick={() => setGuide(true)}>
            📖 All 33 roles and what they used to be called
          </button>
        </section>

        <section className="panel ts-setup-col">
          <div className="panel-head">
            <h2>Players · {n}</h2>
            <div className="row">
              <button className="btn tiny ghost" onClick={() => setSeats(seats.map((p, i) => ({ ...p, isAI: i > 0 })))}>
                1 human
              </button>
              <button className="btn tiny ghost" onClick={() => setSeats(seats.map((p) => ({ ...p, isAI: true })))}>
                👀 All bots
              </button>
            </div>
          </div>
          <div className="ts-seats">
            {shown.map((p, i) => (
              <div key={i} className={`ts-seat ${p.isAI ? '' : 'human'}`}>
                <input value={p.name} maxLength={12} onChange={(e) => update(i, { name: e.target.value })} aria-label={`Seat ${i + 1} name`} />
                <div className="seg">
                  <button className={!p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: false })}>
                    Human
                  </button>
                  <button className={p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: true })}>
                    Bot
                  </button>
                </div>
              </div>
            ))}
          </div>
          <label className="field">
            Pace
            <select value={pace} onChange={(e) => setPace(e.target.value)}>
              {Object.entries(PACES).map(([k, pc]) => (
                <option key={k} value={k}>
                  {pc.name} ({Math.round(pc.mul * 100)}% phase timers)
                </option>
              ))}
            </select>
          </label>
          {error && <p className="notice neg">{error}</p>}
          <button className="btn primary wide big" disabled={!valid} onClick={start}>
            {humans ? 'Enter Solana 🚀' : 'Watch the bots 👀'}
          </button>
          <p className="hint">
            {humans === 0
              ? 'Spectator mode: every role and chat is visible.'
              : humans === 1
                ? 'You against 14 bots. Seats and roles are shuffled when the game starts.'
                : `${humans} humans share this screen. A privacy screen hides each player’s role, night action and private chats until they tap in.`}{' '}
            Names must be unique.
          </p>
          <div className="ts-terms">
            {TERMS.map(([icon, name, classic]) => (
              <span key={name} className="chip">
                {icon} <b>{name}</b> = {classic}
              </span>
            ))}
          </div>
        </section>
      </div>
      {guide && <RoleGuide onClose={() => setGuide(false)} />}
    </div>
  )
}
