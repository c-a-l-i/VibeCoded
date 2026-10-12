import { memo, useEffect, useRef, useState } from 'react'
import { ROLES, ROLE_KEYS, CATS } from '../roles.js'
import { canSee, rooms, blackmailed, living } from '../rules.js'
import { claimMessage } from '../ai.js'
import { Who } from './bits.jsx'

const ROOM_NAMES = { town: 'Town', cabal: 'Cabal', vamp: 'Maxis', jail: 'Cold Storage', dead: 'Dead', seance: 'Séance', whisper: 'Whisper' }
const FILTERS = [
  ['all', 'All'],
  ['town', 'Town'],
  ['night', 'Night chats'],
  ['private', 'Just me'],
]

function matches(m, filter) {
  if (filter === 'all') return true
  if (filter === 'town') return m.room === 'town' || m.room === 'system'
  if (filter === 'private') return m.room === 'private' || m.room === 'whisper'
  return ['cabal', 'vamp', 'jail', 'dead', 'seance'].includes(m.room)
}

// Who a line appears to come from, hiding identities the viewer isn't allowed to know.
function speaker(s, m, view) {
  if (m.anon) return <span className="ts-anon">{m.anon}</span> // already anonymized by the online server
  const from = s.players[m.from]
  if (!from) return null
  if (view !== 'all') {
    if (m.room === 'jail' && m.from === m.jailor && view !== m.jailor) return <span className="ts-anon">🔐 Custodian</span>
    if (m.room === 'vamp' && typeof view === 'number' && s.players[view].role === 'vampireHunter') return <span className="ts-anon">🧛 Maxi</span>
    if ((m.room === 'dead' || m.room === 'seance') && from.alive && from.role === 'medium' && view !== m.from) return <span className="ts-anon">🔮 Oracle</span>
  }
  return <Who p={from} />
}

function LineView({ s, m, view }) {
  if (m.room === 'system' || ((m.from === null || m.from === undefined) && !m.anon && m.room !== 'private')) {
    if (m.kind === 'will')
      return (
        <li className="ts-msg ts-will-msg">
          <span className="eyebrow">📜 {s.players[m.pid].name}’s dead man’s switch</span>
          <pre>{m.text}</pre>
        </li>
      )
    if (m.kind === 'card') return <li className="ts-msg ts-card-msg">🃏 Calling card: “{m.text}”</li>
    return (
      <li className={`ts-msg ts-sys ${m.tone ?? ''} ${m.room !== 'system' ? `room-${m.room}` : ''}`}>
        {m.room !== 'system' && <span className="ts-room">{ROOM_NAMES[m.room]}</span>}
        {m.text}
      </li>
    )
  }
  if (m.room === 'private')
    return (
      <li className={`ts-msg ts-private ${m.tone ?? ''}`}>
        <span className="ts-room">{m.night ? `Night ${m.day}` : 'Only you'}</span>
        {m.text}
      </li>
    )
  const from = s.players[m.from]
  return (
    <li className={`ts-msg room-${m.room}`} style={{ '--c': from?.color ?? 'var(--text-2)' }}>
      {m.room !== 'town' && (
        <span className="ts-room">
          {m.room === 'whisper' ? `🤫 to ${s.players[m.to].name}` : ROOM_NAMES[m.room]}
        </span>
      )}
      {speaker(s, m, view)}
      <span className="ts-text">{m.text}</span>
    </li>
  )
}

// Messages never change once posted, so a line only re-renders when the viewer changes.
const Line = memo(LineView, (a, b) => a.m.id === b.m.id && a.view === b.view)

export default function Chat({ state: s, me, view, act }) {
  const actor = typeof me === 'number' ? me : null
  const [filter, setFilter] = useState('all')
  const [text, setText] = useState('')
  const [room, setRoom] = useState('town')
  const [to, setTo] = useState(null)
  const logRef = useRef(null)
  const stick = useRef(true)

  const P = actor !== null ? s.players[actor] : null
  const open = actor !== null ? rooms(s, actor) : []
  const canWhisper = P && P.alive && !['night', 'gameover'].includes(s.phase) && !blackmailed(s, actor)
  const options = canWhisper ? [...open, 'whisper'] : open
  const current = options.includes(room) ? room : options[0]

  const visible = s.chat.filter((m) => canSee(s, m, view) && matches(m, filter))
  const lastId = visible.at(-1)?.id

  useEffect(() => {
    const el = logRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [lastId, filter])

  const send = (msg = text, data = null, r = current) => {
    if (!msg.trim() || actor === null || !r) return
    if (r === 'whisper') {
      if (to === null) return
      act('SAY', { room: 'whisper', to, text: msg })
    } else act('SAY', { room: r, text: msg, data })
    if (msg === text) setText('')
  }
  const quick = (msg, data) => send(msg, data, open.includes('town') ? 'town' : current)
  const others = living(s).filter((p) => p.id !== actor)
  const hasResults = P && P.memo.results.some((r) => r.kind !== 'failed')

  const hint =
    actor === null
      ? 'Spectating'
      : !options.length
        ? s.phase === 'night'
          ? 'Town chat is closed at night.'
          : s.phase === 'defense' || s.phase === 'lastwords'
            ? 'Only the accused may speak right now.'
            : 'You can’t talk right now.'
        : current === 'whisper'
          ? to === null
            ? 'Pick who to whisper to →'
            : `Whisper to ${s.players[to].name}…`
          : `Message ${ROOM_NAMES[current]}…`

  return (
    <div className="panel ts-chat">
      <div className="panel-head">
        <h2>Chat</h2>
        <div className="tabs">
          {FILTERS.map(([id, label]) => (
            <button key={id} className={`tab ${filter === id ? 'on' : ''}`} style={{ '--c': 'var(--violet)' }} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul
        className="ts-log"
        ref={logRef}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
        }}
      >
        {visible.map((m) => (
          <Line key={m.id} s={s} m={m} view={view} />
        ))}
      </ul>
      {actor !== null && s.phase !== 'gameover' && (
        <div className="ts-compose">
          {open.includes('town') && P.alive && (
            <div className="ts-quick">
              <select
                className="ts-pick"
                value=""
                onChange={(e) => e.target.value && quick(`I’m the ${ROLES[e.target.value].name}.`, { claim: e.target.value })}
                aria-label="Claim a role"
              >
                <option value="">🪪 Claim…</option>
                {Object.entries(CATS).map(([cat, c]) => (
                  <optgroup key={cat} label={c.name}>
                    {ROLE_KEYS.filter((k) => ROLES[k].cat === cat).map((k) => (
                      <option key={k} value={k}>
                        {ROLES[k].icon} {ROLES[k].name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {hasResults && (
                <button
                  className="btn tiny"
                  title="Claim your role and post your night results"
                  onClick={() => {
                    const draft = structuredClone(s)
                    const msg = claimMessage(draft, actor, { all: true })
                    quick(msg.text, msg.data)
                  }}
                >
                  📊 Share results
                </button>
              )}
              {[
                ['accuse', '🚩 Accuse…', (p) => [`${p.name} is sus`, { reports: [{ kind: 'accuse', target: p.id }] }]],
                ['vouch', '✅ Vouch…', (p) => [`${p.name} seems town`, { reports: [{ kind: 'vouch', target: p.id }] }]],
                ['ask', '❓ Ask to claim…', (p) => [`${p.name}, claim?`, { asks: [p.id] }]],
              ].map(([id, label, make]) => (
                <select
                  key={id}
                  className="ts-pick"
                  value=""
                  onChange={(e) => {
                    const p = s.players[Number(e.target.value)]
                    if (p) quick(...make(p))
                  }}
                  aria-label={label}
                >
                  <option value="">{label}</option>
                  {others.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.num}. {p.name}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          )}
          <form
            className="ts-input-row"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            {options.length > 1 && (
              <select className="ts-room-pick" value={current} onChange={(e) => setRoom(e.target.value)} aria-label="Chat room">
                {options.map((r) => (
                  <option key={r} value={r}>
                    {ROOM_NAMES[r]}
                  </option>
                ))}
              </select>
            )}
            {current === 'whisper' && (
              <select className="ts-room-pick" value={to ?? ''} onChange={(e) => setTo(e.target.value === '' ? null : Number(e.target.value))} aria-label="Whisper to">
                <option value="">to…</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={hint} disabled={!options.length} maxLength={280} aria-label="Message" />
            <button className="btn primary" disabled={!options.length || !text.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
