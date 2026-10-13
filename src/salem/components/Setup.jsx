import { useState } from 'react'
import { MODES, NAMES, rollRoles } from '../roles.js'
import { PACES } from '../engine.js'
import RoleGuide from './RoleGuide.jsx'
import RoleListPicker from './RoleListPicker.jsx'
import { CornerTools } from '../../components/LanguageButton.jsx'
import { t, N } from '../../i18n/index.js'

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
      setError(t('salem.cantDeal'))
      return
    }
    onStart({ mode, list, seats: shown.map((p) => ({ ...p, name: p.name.trim() })), pace })
  }

  return (
    <div className="setup ts-setup">
      <button className="btn ghost back-btn" onClick={onBack}>
        {t('ui.allGames')}
      </button>
      <CornerTools />
      <div className="setup-hero">
        <div className="logo-mark big">⚖️</div>
        <h1 className="logo ts-logo">{t('games.salem.title')}</h1>
        <p className="tagline">{t('games.salem.tagline')}</p>
      </div>

      <div className="ts-setup-grid">
        <section className="panel ts-setup-col">
          <h2>{t('salem.gameMode')}</h2>
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
            {t('salem.allRoles')}
          </button>
        </section>

        <section className="panel ts-setup-col">
          <div className="panel-head">
            <h2>{t('salem.playersN', { n })}</h2>
            <div className="row">
              <button className="btn tiny ghost" onClick={() => setSeats(seats.map((p, i) => ({ ...p, isAI: i > 0 })))}>
                {t('salem.oneHuman')}
              </button>
              <button className="btn tiny ghost" onClick={() => setSeats(seats.map((p) => ({ ...p, isAI: true })))}>
                {t('salem.allBots')}
              </button>
            </div>
          </div>
          <div className="ts-seats">
            {shown.map((p, i) => (
              <div key={i} className={`ts-seat ${p.isAI ? '' : 'human'}`}>
                <input value={p.name} maxLength={12} onChange={(e) => update(i, { name: e.target.value })} aria-label={t('salem.seatName', { n: i + 1 })} />
                <div className="seg">
                  <button className={!p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: false })}>
                    {t('ui.human')}
                  </button>
                  <button className={p.isAI ? 'on' : ''} onClick={() => update(i, { isAI: true })}>
                    {t('ui.bot')}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <label className="field">
            {t('salem.pace')}
            <select value={pace} onChange={(e) => setPace(e.target.value)}>
              {Object.entries(PACES).map(([k, pc]) => (
                <option key={k} value={k}>
                  {t('salem.paceOption', { name: N.pace(k), pct: Math.round(pc.mul * 100) })}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="notice neg">{error}</p>}
          <button className="btn primary wide big" disabled={!valid} onClick={start}>
            {humans ? t('salem.enter') : t('salem.watchBots')}
          </button>
          <p className="hint">
            {humans === 0 ? t('salem.hintSpectate') : humans === 1 ? t('salem.hintSolo') : t('salem.hintHotseat', { n: humans })}{' '}
            {t('salem.uniqueNames')}
          </p>
          <div className="ts-terms">
            {N.terms().map(([icon, name, classic]) => (
              <span key={icon} className="chip">
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
