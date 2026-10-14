import { useState } from 'react'
import { net } from './net.js'
import CopyLink from './CopyLink.jsx'
import { GAMES } from '../games.js'
import { PACES } from '../salem/engine.js'
import RoleListPicker from '../salem/components/RoleListPicker.jsx'
import CryptopolyApp from '../CryptopolyApp.jsx'
import CatanApp from '../catan/CatanApp.jsx'
import SalemApp from '../salem/SalemApp.jsx'
import TableTalk, { SpectatorChat } from './TableTalk.jsx'
import TurnClock, { TimerTag, TurnTimerPicker } from './TurnClock.jsx'
import './online.css'
import { CornerTools } from '../components/LanguageButton.jsx'
import { t, tx, look, N, tradeSide, bagText } from '../i18n/index.js'

function Status({ n }) {
  if (n.status === 'online' || n.status === 'offline') return null
  return <span className="on-status">{n.status === 'reconnecting' ? t('online.reconnecting') : t('online.connecting')}</span>
}

// Errors arrive as a code to translate; anything this client doesn't know shows the server's own text.
const errorText = (e) => (e.code && look(`online.err.${e.code}`) ? t(`online.err.${e.code}`, e.v ?? {}) : (e.msg ?? String(e)))

function ErrorBanner({ n }) {
  if (!n.error) return null
  return (
    <div className="on-error notice neg" role="alert">
      {errorText(n.error)}
      <button className="icon-btn" onClick={net.clearError} aria-label={t('online.dismiss')}>
        ✕
      </button>
    </div>
  )
}

// ---------- lobby ----------

function Lobby({ n }) {
  const room = n.room
  const game = GAMES.find((g) => g.id === room.game)
  const isHost = room.host === net.id
  const members = Object.fromEntries(room.members.map((m) => [m.id, m]))
  const watching = room.members.filter((m) => m.seat < 0)
  const salem = room.game === 'salem'
  const host = members[room.host]
  const fixed = salem // Town of Solana's seat count comes from its role list
  const [name, setName] = useState(n.name)

  const leave = () => confirm(t('online.leaveConfirm')) && net.leave()

  return (
    <div className="setup on-lobby">
      <button className="btn ghost back-btn" onClick={leave}>
        {t('online.leaveRoomBack')}
      </button>
      <CornerTools />
      <div className="setup-hero">
        <div className="logo-mark big">{game.mark}</div>
        <h1 className="logo on-title">{t(`games.${game.id}.title`)}</h1>
        <p className="tagline">{t('online.lobby')}</p>
      </div>

      <div className="panel on-code">
        <div>
          <span className="eyebrow">{t('online.roomCode')}</span>
          <div className="on-code-text mono">{room.code}</div>
        </div>
        <p className="muted small">{t('online.codeHint')}</p>
        <CopyLink code={room.code} />
        <Status n={n} />
      </div>
      <ErrorBanner n={n} />

      <div className="on-grid">
        <section className="panel on-col">
          <div className="panel-head">
            <h2>
              {t('online.seats', { n: room.seats.length })}
              {!fixed && (
                <span className="muted">
                  {' '}
                  ({room.min}–{room.max})
                </span>
              )}
            </h2>
          </div>
          <ol className="on-seats">
            {room.seats.map((s, i) => {
              const m = s.client ? members[s.client] : null
              const mine = s.client === net.id
              return (
                <li key={i} className={`on-seat ${mine ? 'mine' : ''} ${s.bot ? 'bot' : m ? 'human' : 'open'}`}>
                  <span className="on-seat-n mono">{i + 1}</span>
                  <span className="on-seat-name">
                    {m ? m.name : s.bot ? `🤖 ${s.name}` : <span className="muted">{t('online.openSeat')}</span>}
                    {m && m.id === room.host && <span title={t('online.host')}> 👑</span>}
                    {mine && <span className="tag">{t('ui.tagYou')}</span>}
                    {m && !m.online && <span className="tag warn">{t('online.offline')}</span>}
                  </span>
                  <span className="on-seat-actions">
                    {!s.client && !s.bot && room.you.seat !== i && (
                      <button className="btn tiny primary" onClick={() => net.send({ t: 'sit', seat: i })}>
                        {t('online.sit')}
                      </button>
                    )}
                    {mine && (
                      <button className="btn tiny ghost" onClick={() => net.send({ t: 'stand' })}>
                        {t('online.stand')}
                      </button>
                    )}
                    {isHost && !s.client && (
                      <button className="btn tiny ghost" onClick={() => net.send({ t: 'botSeat', seat: i })} title={s.bot ? t('online.saveSeat') : t('online.botSeat')}>
                        {s.bot ? t('online.openBtn') : t('online.botBtn')}
                      </button>
                    )}
                    {isHost && s.bot && room.you.seat < 0 && (
                      <button className="btn tiny ghost" onClick={() => net.send({ t: 'sit', seat: i })}>
                        {t('online.take')}
                      </button>
                    )}
                    {isHost && !fixed && !s.client && room.seats.length > room.min && (
                      <button className="icon-btn" onClick={() => net.send({ t: 'seat', seat: i, remove: true })} title={t('online.removeSeat')}>
                        ✕
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ol>
          {isHost && !fixed && room.seats.length < room.max && (
            <button className="btn ghost wide" onClick={() => net.send({ t: 'seat', add: true })}>
              {t('online.addSeat')}
            </button>
          )}
          <p className="hint">{t('online.seatsHint')}</p>
        </section>

        <section className="panel on-col">
          <h2>{t('online.you')}</h2>
          <form
            className="on-name"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) net.rename(name.trim())
            }}
          >
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} aria-label={t('online.yourName')} placeholder={t('online.yourName')} />
            <button className="btn" disabled={!name.trim() || name.trim() === n.name}>
              {t('ui.save')}
            </button>
          </form>
          {watching.length > 0 && (
            <p className="small muted">{t('online.watchingList', { list: watching.map((m) => m.name + (m.online ? '' : t('online.offlineTail'))).join(', ') })}</p>
          )}

          {!salem && (
            <div className="on-options">
              {room.turnTimer && <TurnTimerPicker room={room} />}
              <SpectatorChat room={room} />
            </div>
          )}

          {salem && (
            <div className="on-options">
              <h2>{t('salem.roleList')}</h2>
              <RoleListPicker
                mode={room.options.mode}
                custom={room.options.custom}
                readOnly={!isHost}
                onMode={(mode) => net.send({ t: 'options', options: { mode } })}
                onCustom={(custom) => net.send({ t: 'options', options: { custom } })}
              />
              <label className="field">
                {t('salem.pace')}
                <select value={room.options.pace} disabled={!isHost} onChange={(e) => net.send({ t: 'options', options: { pace: e.target.value } })}>
                  {Object.keys(PACES).map((k) => (
                    <option key={k} value={k}>
                      {N.pace(k)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint">{t('online.shuffled', { mode: N.mode(room.options.mode) })}</p>
            </div>
          )}

          {isHost ? (
            <button className="btn primary big wide" onClick={() => net.send({ t: 'start' })}>
              {t('online.start')}
            </button>
          ) : (
            <p className="on-wait">{t('online.waiting', { p: host?.name ?? t('online.theHost') })}</p>
          )}
        </section>
      </div>
    </div>
  )
}

// ---------- in game ----------

// What a trade offer says, in each game's terms.
function describe(game, action) {
  if (game === 'cryptopoly') return [tradeSide(action.offer.give), tradeSide(action.offer.get)]
  return [bagText(action.trade.give), bagText(action.trade.get)]
}

function OfferDialog({ room, state }) {
  const o = room.offer
  const pid = room.you.pid
  if (!o || !state || (pid !== o.from && pid !== o.to)) return null
  const from = state.players[o.from]
  const to = state.players[o.to]
  const [give, get] = describe(room.game, o.action)
  if (pid === o.from)
    return (
      <div className="on-toast">
        {o.declined ? (
          t('online.declined', { p: to.name })
        ) : (
          <>
            {tx('online.offerSent', { p: to.name })}{' '}
            <button className="link" onClick={() => net.send({ t: 'offer', cancel: true })}>
              {t('online.cancel')}
            </button>
          </>
        )}
      </div>
    )
  if (o.declined) return null
  return (
    <div className="modal-backdrop">
      <div className="modal on-offer" role="dialog" aria-label={t('online.offerTitle')}>
        <div className="modal-body">
          <span className="eyebrow">{t('online.offerTitle')}</span>
          <h2 className="on-offer-title" style={{ color: from.color }}>
            {t('online.wantsTrade', { token: from.token, p: from.name })}
          </h2>
          <p>
            {tx('online.offerGet', { give })}
            <br />
            {tx('online.offerGive', { get })}
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => net.send({ t: 'offer', accept: true })}>
              {t('online.accept')}
            </button>
            <button className="btn danger" onClick={() => net.send({ t: 'offer', accept: false })}>
              {t('ui.decline')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OnlineBar({ n, isHost }) {
  const room = n.room
  const [open, setOpen] = useState(false)
  const away = room.members.filter((m) => !m.online && m.pid !== null)
  const here = room.members.filter((m) => m.online).length
  return (
    <div className="on-bar">
      <button className="on-bar-chip" onClick={() => setOpen(!open)} title={t('online.room')}>
        🌐 <span className="mono">{room.code}</span> · {t('online.onlineN', { n: here })}
        {away.length > 0 && <span className="tag warn">{t('online.awayN', { n: away.length })}</span>}
        <TimerTag room={room} />
      </button>
      <Status n={n} />
      {open && (
        <div className="panel on-bar-menu">
          <CopyLink code={room.code} />
          {room.you.pid === null && <p className="small muted">{t('online.watchingNote')}</p>}
          {isHost &&
            away.map((m) => (
              <button key={m.id} className="btn tiny wide" onClick={() => net.send({ t: 'takeover', pid: m.pid })}>
                {t('online.botFor', { p: m.name })}
              </button>
            ))}
          {isHost && (
            <button className="btn tiny wide" onClick={() => confirm(t('online.endConfirm')) && net.send({ t: 'lobby' })}>
              {t('online.backLobby')}
            </button>
          )}
          <button className="btn tiny wide danger" onClick={() => confirm(t('online.leaveSeatConfirm')) && net.leave()}>
            {t('online.leaveRoom')}
          </button>
        </div>
      )}
      <ErrorBanner n={n} />
    </div>
  )
}

function Game({ n }) {
  const room = n.room
  const pid = room.you.pid
  const isHost = room.host === net.id
  let state = n.state
  if (state && room.game !== 'salem')
    // Other people's turns look like a bot's turn: their controls stay hidden here.
    state = { ...state, players: state.players.map((p) => (!p.isAI && p.id !== pid ? { ...p, isAI: true, remote: true } : p)) }
  if (state && room.game === 'salem') state = { ...state, chat: n.chat, nextId: (n.chat.at(-1)?.id ?? 0) + 1, clock: n.clock?.clock ?? 0 }
  const props = {
    state,
    send: net.act,
    seat: pid,
    isHost,
    paused: room.paused,
    pause: (on) => net.send({ t: 'pause', on }),
    pace: (pace) => net.send({ t: 'host', action: { type: 'PACE', pace } }),
    // Town of Solana has its own chat, with rooms and rules; the board games share this one.
    chat: room.game !== 'salem' ? <TableTalk talk={n.talk} room={room} players={n.state?.players} /> : null,
    // The host's turn timer, counting down whoever the game is waiting on.
    clock: room.turnTimer?.pid != null ? <TurnClock timer={room.turnTimer} players={n.state?.players} /> : null,
    toLobby: () => {
      if (!isHost) return alert(t('online.hostOnlyNew'))
      if (n.state?.phase === 'gameover' || confirm(t('online.endConfirm'))) net.send({ t: 'lobby' })
    },
  }
  const leave = () => confirm(t('online.leaveSeatConfirm')) && net.leave()
  const App = { cryptopoly: CryptopolyApp, catan: CatanApp, salem: SalemApp }[room.game]
  return (
    <>
      <App net={props} onMenu={leave} />
      <OfferDialog room={room} state={n.state} />
      <OnlineBar n={n} isHost={isHost} />
    </>
  )
}

export default function Online({ n }) {
  return n.room.status === 'lobby' ? <Lobby n={n} /> : <Game n={n} />
}

// The "play with friends" panel on the start menu.
export function OnlinePanel({ n }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState(n.name)
  const saveName = () => name.trim() && name.trim() !== n.name && net.rename(name.trim())
  const host = (game) => {
    saveName()
    net.create(game)
  }
  return (
    <section className="panel on-panel">
      <div>
        <span className="eyebrow">{t('online.playOnline')}</span>
        <h2 className="on-panel-title">{t('online.panelTitle')}</h2>
      </div>
      <label className="field">
        {t('online.yourName')}
        <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} onBlur={saveName} placeholder="Satoshi" />
      </label>
      <div className="on-hosts">
        {GAMES.map((g) => (
          <button key={g.id} className="btn" disabled={!name.trim()} onClick={() => host(g.id)}>
            {t('online.hostGame', { mark: g.mark, name: t(`games.${g.id}.name`) })}
          </button>
        ))}
      </div>
      <form
        className="on-join"
        onSubmit={(e) => {
          e.preventDefault()
          saveName()
          net.join(code)
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} placeholder={t('online.code')} aria-label={t('online.roomCode')} className="mono" />
        <button className="btn primary" disabled={code.length !== 4 || !name.trim()}>
          {t('online.join')}
        </button>
      </form>
      <Status n={n} />
      <ErrorBanner n={n} />
    </section>
  )
}
