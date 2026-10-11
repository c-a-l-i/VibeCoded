import { useState } from 'react'
import { net, inviteLink } from './net.js'
import { GAMES } from '../games.js'
import { BOARD } from '../data/board.js'
import { money } from '../engine/game.js'
import { resList } from '../catan/engine.js'
import { MODES } from '../salem/roles.js'
import { PACES } from '../salem/engine.js'
import RoleListPicker from '../salem/components/RoleListPicker.jsx'
import CryptopolyApp from '../CryptopolyApp.jsx'
import CatanApp from '../catan/CatanApp.jsx'
import SalemApp from '../salem/SalemApp.jsx'
import './online.css'

function Status({ n }) {
  if (n.status === 'online' || n.status === 'offline') return null
  return <span className="on-status">{n.status === 'reconnecting' ? '🔌 Reconnecting…' : '⏳ Connecting…'}</span>
}

function ErrorBanner({ n }) {
  if (!n.error) return null
  return (
    <div className="on-error notice neg" role="alert">
      {n.error}
      <button className="icon-btn" onClick={net.clearError} aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}

function CopyLink({ code }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(code))
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      prompt('Copy this invite link:', inviteLink(code))
    }
  }
  return (
    <button className="btn" onClick={copy}>
      {copied ? '✅ Copied' : '📋 Copy invite link'}
    </button>
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

  const leave = () => confirm('Leave this room?') && net.leave()

  return (
    <div className="setup on-lobby">
      <button className="btn ghost back-btn" onClick={leave}>
        ← Leave room
      </button>
      <div className="setup-hero">
        <div className="logo-mark big">{game.mark}</div>
        <h1 className="logo on-title">{game.title}</h1>
        <p className="tagline">Online lobby</p>
      </div>

      <div className="panel on-code">
        <div>
          <span className="eyebrow">Room code</span>
          <div className="on-code-text mono">{room.code}</div>
        </div>
        <p className="muted small">Friends open this site and enter the code, or use your invite link.</p>
        <CopyLink code={room.code} />
        <Status n={n} />
      </div>
      <ErrorBanner n={n} />

      <div className="on-grid">
        <section className="panel on-col">
          <div className="panel-head">
            <h2>
              Seats · {room.seats.length}
              {!fixed && <span className="muted"> ({room.min}–{room.max})</span>}
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
                    {m ? m.name : s.bot ? `🤖 ${s.name}` : <span className="muted">Open seat</span>}
                    {m && m.id === room.host && <span title="Host"> 👑</span>}
                    {mine && <span className="tag">YOU</span>}
                    {m && !m.online && <span className="tag warn">OFFLINE</span>}
                  </span>
                  <span className="on-seat-actions">
                    {!s.client && !s.bot && room.you.seat !== i && (
                      <button className="btn tiny primary" onClick={() => net.send({ t: 'sit', seat: i })}>
                        Sit here
                      </button>
                    )}
                    {mine && (
                      <button className="btn tiny ghost" onClick={() => net.send({ t: 'stand' })}>
                        Stand up
                      </button>
                    )}
                    {isHost && !s.client && (
                      <button className="btn tiny ghost" onClick={() => net.send({ t: 'botSeat', seat: i })} title={s.bot ? 'Save this seat for a friend' : 'Let a bot play this seat'}>
                        {s.bot ? '🙋 Open' : '🤖 Bot'}
                      </button>
                    )}
                    {isHost && s.bot && room.you.seat < 0 && (
                      <button className="btn tiny ghost" onClick={() => net.send({ t: 'sit', seat: i })}>
                        Take
                      </button>
                    )}
                    {isHost && !fixed && !s.client && room.seats.length > room.min && (
                      <button className="icon-btn" onClick={() => net.send({ t: 'seat', seat: i, remove: true })} title="Remove seat">
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
              + Add seat
            </button>
          )}
          <p className="hint">Open seats nobody takes are played by bots.</p>
        </section>

        <section className="panel on-col">
          <h2>You</h2>
          <form
            className="on-name"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) net.rename(name.trim())
            }}
          >
            <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} aria-label="Your name" placeholder="Your name" />
            <button className="btn" disabled={!name.trim() || name.trim() === n.name}>
              Save
            </button>
          </form>
          {watching.length > 0 && (
            <p className="small muted">
              👀 Watching: {watching.map((m) => m.name + (m.online ? '' : ' (offline)')).join(', ')}
            </p>
          )}

          {salem && (
            <div className="on-options">
              <h2>Role list</h2>
              <RoleListPicker
                mode={room.options.mode}
                custom={room.options.custom}
                readOnly={!isHost}
                onMode={(mode) => net.send({ t: 'options', options: { mode } })}
                onCustom={(custom) => net.send({ t: 'options', options: { custom } })}
              />
              <label className="field">
                Pace
                <select value={room.options.pace} disabled={!isHost} onChange={(e) => net.send({ t: 'options', options: { pace: e.target.value } })}>
                  {Object.entries(PACES).map(([k, p]) => (
                    <option key={k} value={k}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="hint">{MODES[room.options.mode].name} · seats and roles are shuffled when the game starts.</p>
            </div>
          )}

          {isHost ? (
            <button className="btn primary big wide" onClick={() => net.send({ t: 'start' })}>
              Start game 🚀
            </button>
          ) : (
            <p className="on-wait">⏳ Waiting for {host?.name ?? 'the host'} to start…</p>
          )}
        </section>
      </div>
    </div>
  )
}

// ---------- in game ----------

// What a trade offer says, in each game's terms.
function describe(game, state, action) {
  if (game === 'cryptopoly') {
    const side = (x) =>
      [...x.props.map((id) => BOARD[id].name), x.cash ? money(x.cash) : null, x.cards ? `${x.cards} free card(s)` : null].filter(Boolean).join(', ') ||
      'nothing'
    return [side(action.offer.give), side(action.offer.get)]
  }
  return [resList(action.trade.give), resList(action.trade.get)]
}

function OfferDialog({ room, state }) {
  const o = room.offer
  const pid = room.you.pid
  if (!o || !state || (pid !== o.from && pid !== o.to)) return null
  const from = state.players[o.from]
  const to = state.players[o.to]
  const [give, get] = describe(room.game, state, o.action)
  if (pid === o.from)
    return (
      <div className="on-toast">
        {o.declined ? (
          <>❌ {to.name} declined your offer.</>
        ) : (
          <>
            📨 Offer sent to <b>{to.name}</b>…{' '}
            <button className="link" onClick={() => net.send({ t: 'offer', cancel: true })}>
              cancel
            </button>
          </>
        )}
      </div>
    )
  if (o.declined) return null
  return (
    <div className="modal-backdrop">
      <div className="modal on-offer" role="dialog" aria-label="Trade offer">
        <div className="modal-body">
          <span className="eyebrow">Trade offer</span>
          <h2 className="on-offer-title" style={{ color: from.color }}>
            {from.token} {from.name} wants to trade
          </h2>
          <p>
            You get <b>{give}</b>
            <br />
            and give <b>{get}</b>.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => net.send({ t: 'offer', accept: true })}>
              ✅ Accept
            </button>
            <button className="btn danger" onClick={() => net.send({ t: 'offer', accept: false })}>
              ❌ Decline
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
      <button className="on-bar-chip" onClick={() => setOpen(!open)} title="Room">
        🌐 <span className="mono">{room.code}</span> · {here} online
        {away.length > 0 && <span className="tag warn">{away.length} away</span>}
      </button>
      <Status n={n} />
      {open && (
        <div className="panel on-bar-menu">
          <CopyLink code={room.code} />
          {room.you.pid === null && <p className="small muted">You’re watching. Roles stay hidden until the end.</p>}
          {isHost &&
            away.map((m) => (
              <button key={m.id} className="btn tiny wide" onClick={() => net.send({ t: 'takeover', pid: m.pid })}>
                🤖 Let a bot play for {m.name}
              </button>
            ))}
          {isHost && (
            <button className="btn tiny wide" onClick={() => confirm('End this game for everyone and go back to the lobby?') && net.send({ t: 'lobby' })}>
              ⏮ Back to lobby
            </button>
          )}
          <button className="btn tiny wide danger" onClick={() => confirm('Leave this room? A bot takes your seat.') && net.leave()}>
            🚪 Leave room
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
    toLobby: () => {
      if (!isHost) return alert('Only the host can start a new game.')
      if (n.state?.phase === 'gameover' || confirm('End this game for everyone and go back to the lobby?')) net.send({ t: 'lobby' })
    },
  }
  const leave = () => confirm('Leave this room? A bot takes your seat.') && net.leave()
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
        <span className="eyebrow">🌐 Play online</span>
        <h2 className="on-panel-title">Host a room or join your friends</h2>
      </div>
      <label className="field">
        Your name
        <input value={name} maxLength={14} onChange={(e) => setName(e.target.value)} onBlur={saveName} placeholder="Satoshi" />
      </label>
      <div className="on-hosts">
        {GAMES.map((g) => (
          <button key={g.id} className="btn" disabled={!name.trim()} onClick={() => host(g.id)}>
            {g.mark} Host {g.name}
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
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} placeholder="CODE" aria-label="Room code" className="mono" />
        <button className="btn primary" disabled={code.length !== 4 || !name.trim()}>
          Join room
        </button>
      </form>
      <Status n={n} />
      <ErrorBanner n={n} />
    </section>
  )
}
