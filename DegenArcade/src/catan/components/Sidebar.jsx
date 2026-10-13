import { useEffect, useRef } from 'react'
import { RESOURCES, RES, DEV, WIN_VP } from '../data.js'
import { chainLength, handSize, victoryPoints } from '../engine.js'
import DisplayButton from '../../components/DisplaySettings.jsx'
import LanguageButton from '../../components/LanguageButton.jsx'
import { t, N, fmt } from '../../i18n/index.js'

function PlayerCard({ state, p, viewer }) {
  const active = state.current === p.id && state.phase !== 'gameover'
  const vp = victoryPoints(state, p.id, { hidden: p.id === viewer })
  return (
    <div className={`player ${active ? 'active' : ''}`} style={{ '--c': p.color }}>
      <div className="player-top">
        <div className="avatar">{p.token}</div>
        <div className="player-id">
          <div className="player-name">
            {p.name}
            {p.isAI && <span className="tag">{p.remote ? t('ui.tagOnline') : t('ui.tagBot')}</span>}
            {state.longest?.pid === p.id && <span className="tag warn">{t('catan.tagLongest')}</span>}
            {state.army?.pid === p.id && <span className="tag warn">{t('catan.tagBotnet')}</span>}
          </div>
          <div className="muted small st-stats">
            <span title={t('catan.cardsTip')}>🃏 {handSize(p)}</span>
            <span title={t('catan.devsTip')}>📜 {p.dev.length}</span>
            <span title={t('catan.hackersTip')}>🥷 {p.knights}</span>
            <span title={t('catan.chainTip')}>⛓️ {chainLength(state, p.id)}</span>
          </div>
        </div>
        <div className="player-money mono st-vp" title={t('catan.vpTip')}>
          {vp}
          <span className="muted">/{WIN_VP}</span>
        </div>
      </div>
    </div>
  )
}

function Wallet({ state, pid }) {
  const p = state.players[pid]
  const grouped = {}
  for (const d of p.dev) grouped[d.type] = [...(grouped[d.type] ?? []), d]
  return (
    <div className="panel st-wallet" style={{ '--c': p.color }}>
      <div className="panel-head">
        <h2>{t('catan.wallet', { token: p.token, p: p.name })}</h2>
        <span className="muted small">{t('catan.piecesLeft', { c: p.left.channel, n: p.left.node, d: p.left.dc })}</span>
      </div>
      <div className="st-hand">
        {RESOURCES.map((r) => (
          <div key={r} className={`st-card ${p.hand[r] ? '' : 'empty'}`} style={{ '--rc': RES[r].color }} title={`${N.res(r)} (${N.resClassic(r)})`}>
            <span className="st-card-icon">{RES[r].icon}</span>
            <span className="mono st-card-n">{p.hand[r]}</span>
            <span className="st-card-name">{N.res(r)}</span>
          </div>
        ))}
      </div>
      {p.dev.length > 0 && (
        <div className="st-devs">
          {Object.entries(grouped).map(([type, cards]) => (
            <span
              key={type}
              className={`chip ${cards.every((c) => c.turn === state.turn) ? 'fresh' : ''}`}
              title={type === 'vp' ? cards.map((c) => c.name).join(', ') : N.devText(type)}
            >
              {DEV[type].icon} {N.dev(type)}
              {cards.length > 1 ? ` ×${cards.length}` : ''}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// `chat` is the online room chat, shown under the activity log.
export default function Sidebar({ state, viewer, onQuit, onMenu, chat = null }) {
  const logRef = useRef(null)
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [state.log.length])

  return (
    <aside className={`sidebar ${chat ? 'has-talk' : ''}`}>
      <div className="panel">
        <div className="panel-head">
          <h2>{t('ui.players')}</h2>
          <span className="muted small">{state.turn ? t('ui.turn', { n: state.turn }) : t('catan.genesisRound')}</span>
        </div>
        <div className="players">
          {state.players.map((p) => (
            <PlayerCard key={p.id} state={state} p={p} viewer={viewer} />
          ))}
        </div>
      </div>

      {viewer !== null && <Wallet state={state} pid={viewer} />}

      <div className="panel toolbar">
        <button className="btn ghost" onClick={onQuit}>
          {t('ui.newGame')}
        </button>
        <button className="btn ghost" onClick={onMenu}>
          {t('ui.mainMenu')}
        </button>
        <LanguageButton icon />
        <DisplayButton icon />
      </div>

      <div className="panel log-panel">
        <div className="panel-head">
          <h2>{t('ui.activity')}</h2>
          <span className="muted small">
            {RESOURCES.map((r) => `${RES[r].icon}${state.bank[r]}`).join(' ')} · 📜{state.devDeck.length}
          </span>
        </div>
        <ul className="log" ref={logRef}>
          {state.log.map((e) => (
            <li key={e.id} style={{ '--c': e.pid !== null ? state.players[e.pid].color : 'var(--muted)' }}>
              {e.text ?? fmt(e, { ns: 'catan.log', players: state.players })}
            </li>
          ))}
        </ul>
      </div>
      {chat}
    </aside>
  )
}
