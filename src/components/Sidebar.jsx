import { useEffect, useRef, useState } from 'react'
import { OWNABLE, spaceVars } from '../data/board.js'
import { netWorth } from '../engine/game.js'
import DisplayButton from './DisplaySettings.jsx'
import LanguageButton from './LanguageButton.jsx'
import { t, N, fmt, money } from '../i18n/index.js'

function PlayerCard({ state, p, openModal }) {
  const prev = useRef(p.money)
  const [deltas, setDeltas] = useState([])

  useEffect(() => {
    const d = p.money - prev.current
    prev.current = p.money
    if (!d) return
    const id = Math.random()
    setDeltas((x) => [...x, { id, d }])
    const timer = setTimeout(() => setDeltas((x) => x.filter((y) => y.id !== id)), 1600)
    return () => clearTimeout(timer)
  }, [p.money])

  const active = state.current === p.id && state.phase !== 'gameover'
  const owned = OWNABLE.filter((id) => state.props[id].owner === p.id)

  return (
    <div className={`player ${active ? 'active' : ''} ${p.bankrupt ? 'bankrupt' : ''}`} style={{ '--c': p.color }}>
      <div className="player-top">
        <div className="avatar">{p.token}</div>
        <div className="player-id">
          <div className="player-name">
            {p.name}
            {p.isAI && <span className="tag">{p.remote ? t('ui.tagOnline') : t('ui.tagBot')}</span>}
            {p.inJail && <span className="tag warn">{t('mono.tagCustody')}</span>}
            {p.cards.length > 0 && <span className="tag">🎟️×{p.cards.length}</span>}
            {p.bankrupt && <span className="tag neg">{t('mono.tagRekt')}</span>}
          </div>
          <div className="muted small">
            {p.bankrupt ? t('mono.bankrupt') : t('mono.onWorth', { sp: N.space(p.pos), m: money(netWorth(state, p.id)) })}
          </div>
        </div>
        <div className="player-money mono">
          {money(p.money)}
          {deltas.map(({ id, d }) => (
            <span key={id} className={`delta ${d > 0 ? 'pos' : 'neg'}`}>
              {d > 0 ? '+' : '−'}
              {money(Math.abs(d))}
            </span>
          ))}
        </div>
      </div>
      {owned.length > 0 && (
        <div className="holdings">
          {owned.map((id) => (
            <button
              key={id}
              className={`holding ${state.props[id].mortgaged ? 'mortgaged' : ''}`}
              style={spaceVars(id)}
              title={N.space(id)}
              onClick={() => openModal({ type: 'deed', id })}
            >
              {state.props[id].houses === 5 ? t('mono.dcShort') : state.props[id].houses || ''}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ state, openModal, onQuit, onMenu }) {
  const logRef = useRef(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [state.log.length])

  return (
    <aside className="sidebar">
      <div className="panel">
        <div className="panel-head">
          <h2>{t('ui.players')}</h2>
          <span className="muted small">{t('ui.turn', { n: state.turn })}</span>
        </div>
        <div className="players">
          {state.players.map((p) => (
            <PlayerCard key={p.id} state={state} p={p} openModal={openModal} />
          ))}
        </div>
      </div>

      <div className="panel toolbar">
        <button className="btn ghost" onClick={() => openModal({ type: 'portfolio' })}>
          {t('mono.portfolio')}
        </button>
        <button className="btn ghost" onClick={() => openModal({ type: 'trade' })}>
          {t('ui.trade')}
        </button>
        <button className="btn ghost" onClick={onQuit}>
          {t('ui.newGame')}
        </button>
        <button className="btn ghost" onClick={onMenu}>
          {t('ui.menu')}
        </button>
        <LanguageButton icon />
        <DisplayButton icon />
      </div>

      <div className="panel log-panel">
        <div className="panel-head">
          <h2>{t('ui.activity')}</h2>
          <span className="muted small">{t('mono.bankLeft', { h: state.bank.houses, d: state.bank.hotels })}</span>
        </div>
        <ul className="log" ref={logRef}>
          {state.log.map((e) => (
            <li key={e.id} style={{ '--c': e.pid !== null ? state.players[e.pid].color : 'var(--muted)' }}>
              {e.text ?? fmt(e, { ns: 'mono.log', players: state.players })}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
