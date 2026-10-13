import { memo, useEffect, useRef, useState } from 'react'
import { ROLES, ROLE_KEYS, CATS } from '../roles.js'
import { canSee, rooms, blackmailed, living } from '../rules.js'
import { claimMessage } from '../ai.js'
import { lineText, willText } from '../text.js'
import { t, N, useLang } from '../../i18n/index.js'
import { Who } from './bits.jsx'

const FILTERS = ['all', 'town', 'night', 'private']

function matches(m, filter) {
  if (filter === 'all') return true
  if (filter === 'town') return m.room === 'town' || m.room === 'system'
  if (filter === 'private') return m.room === 'private' || m.room === 'whisper'
  return ['cabal', 'vamp', 'jail', 'dead', 'seance'].includes(m.room)
}

// An anonymous speaker is shown by role: the Custodian, a Maxi, the Oracle.
function Anon({ role }) {
  // Older online servers sent a ready-made label instead of a role.
  return <span className="ts-anon">{ROLES[role] ? `${ROLES[role].icon} ${N.role(role)}` : role}</span>
}

// Who a line appears to come from, hiding identities the viewer isn't allowed to know.
function speaker(s, m, view) {
  if (m.anon) return <Anon role={m.anon} /> // already anonymized by the online server
  const from = s.players[m.from]
  if (!from) return null
  if (view !== 'all') {
    if (m.room === 'jail' && m.from === m.jailor && view !== m.jailor) return <Anon role="jailor" />
    if (m.room === 'vamp' && typeof view === 'number' && s.players[view].role === 'vampireHunter') return <Anon role="vampire" />
    if ((m.room === 'dead' || m.room === 'seance') && from.alive && from.role === 'medium' && view !== m.from) return <Anon role="medium" />
  }
  return <Who p={from} />
}

function LineView({ s, m, view }) {
  if (m.room === 'system' || ((m.from === null || m.from === undefined) && !m.anon && m.room !== 'private')) {
    if (m.kind === 'will')
      return (
        <li className="ts-msg ts-will-msg">
          <span className="eyebrow">{t('salem.switchOf', { p: s.players[m.pid].name })}</span>
          <pre>{willText(s, { will: m.text, willTr: m.tr })}</pre>
        </li>
      )
    if (m.kind === 'card') return <li className="ts-msg ts-card-msg">{t('salem.callingCard', { c: lineText(s, m) })}</li>
    return (
      <li className={`ts-msg ts-sys ${m.tone ?? ''} ${m.room !== 'system' ? `room-${m.room}` : ''}`}>
        {m.room !== 'system' && <span className="ts-room">{t(`salem.rooms.${m.room}`)}</span>}
        {lineText(s, m)}
      </li>
    )
  }
  if (m.room === 'private')
    return (
      <li className={`ts-msg ts-private ${m.tone ?? ''}`}>
        <span className="ts-room">{m.night ? t('salem.night', { n: m.day }) : t('salem.onlyYou')}</span>
        {lineText(s, m)}
      </li>
    )
  const from = s.players[m.from]
  return (
    <li className={`ts-msg room-${m.room}`} style={{ '--c': from?.color ?? 'var(--text-2)' }}>
      {m.room !== 'town' && (
        <span className="ts-room">{m.room === 'whisper' ? t('salem.whisperTo', { p: s.players[m.to].name }) : t(`salem.rooms.${m.room}`)}</span>
      )}
      {speaker(s, m, view)}
      <span className="ts-text">{lineText(s, m)}</span>
    </li>
  )
}

// Messages never change once posted, so a line only re-renders when the viewer or the language changes.
const Line = memo(LineView, (a, b) => a.m.id === b.m.id && a.view === b.view && a.lang === b.lang)

export default function Chat({ state: s, me, view, act }) {
  const lang = useLang()
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

  const send = () => {
    if (!text.trim() || actor === null || !current) return
    if (current === 'whisper') {
      if (to === null) return
      act('SAY', { room: 'whisper', to, text })
    } else act('SAY', { room: current, text })
    setText('')
  }
  // Quick-chat lines go out as message parts, so every player reads them in their own language.
  const quick = (tr, data = null) => actor !== null && act('SAY', { room: open.includes('town') ? 'town' : current, tr, data })
  const others = living(s).filter((p) => p.id !== actor)
  const hasResults = P && P.memo.results.some((r) => r.kind !== 'failed')

  const hint =
    actor === null
      ? t('salem.spectating')
      : !options.length
        ? s.phase === 'night'
          ? t('salem.closedNight')
          : s.phase === 'defense' || s.phase === 'lastwords'
            ? t('salem.onlyAccused')
            : t('salem.cantTalk')
        : current === 'whisper'
          ? to === null
            ? t('salem.pickWhisper')
            : t('salem.whisperDraft', { p: s.players[to].name })
          : t('salem.messageRoom', { room: t(`salem.rooms.${current}`) })

  return (
    <div className="panel ts-chat">
      <div className="panel-head">
        <h2>{t('salem.chat')}</h2>
        <div className="tabs">
          {FILTERS.map((id) => (
            <button key={id} className={`tab ${filter === id ? 'on' : ''}`} style={{ '--c': 'var(--violet)' }} onClick={() => setFilter(id)}>
              {t(`salem.filters.${id}`)}
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
          <Line key={m.id} s={s} m={m} view={view} lang={lang} />
        ))}
      </ul>
      {actor !== null && s.phase !== 'gameover' && (
        <div className="ts-compose">
          {open.includes('town') && P.alive && (
            <div className="ts-quick">
              <select
                className="ts-pick"
                value=""
                onChange={(e) => e.target.value && quick([{ k: 'iAm', v: { role: e.target.value } }], { claim: e.target.value })}
                aria-label={t('salem.claimLabel')}
              >
                <option value="">{t('salem.claimPick')}</option>
                {Object.keys(CATS).map((cat) => (
                  <optgroup key={cat} label={N.cat(cat)}>
                    {ROLE_KEYS.filter((k) => ROLES[k].cat === cat).map((k) => (
                      <option key={k} value={k}>
                        {ROLES[k].icon} {N.role(k)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {hasResults && (
                <button
                  className="btn tiny"
                  title={t('salem.shareTip')}
                  onClick={() => {
                    const draft = structuredClone(s)
                    const msg = claimMessage(draft, actor, { all: true })
                    quick(msg.tr, msg.data)
                  }}
                >
                  {t('salem.share')}
                </button>
              )}
              {[
                ['accuse', t('salem.accusePick'), (p) => [[{ k: 'qAccuse', v: { x: p.id } }], { reports: [{ kind: 'accuse', target: p.id }] }]],
                ['vouch', t('salem.vouchPick'), (p) => [[{ k: 'qVouch', v: { x: p.id } }], { reports: [{ kind: 'vouch', target: p.id }] }]],
                ['ask', t('salem.askPick'), (p) => [[{ k: 'qAsk', v: { x: p.id } }], { asks: [p.id] }]],
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
              <select className="ts-room-pick" value={current} onChange={(e) => setRoom(e.target.value)} aria-label={t('salem.chatRoom')}>
                {options.map((r) => (
                  <option key={r} value={r}>
                    {t(`salem.rooms.${r}`)}
                  </option>
                ))}
              </select>
            )}
            {current === 'whisper' && (
              <select className="ts-room-pick" value={to ?? ''} onChange={(e) => setTo(e.target.value === '' ? null : Number(e.target.value))} aria-label={t('salem.whisperLabel')}>
                <option value="">{t('salem.to')}</option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={hint} disabled={!options.length} maxLength={280} aria-label={t('salem.message')} />
            <button className="btn primary" disabled={!options.length || !text.trim()}>
              {t('salem.send')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
