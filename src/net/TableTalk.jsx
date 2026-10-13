import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { net } from './net.js'
import Modal from '../components/Modal.jsx'
import { t } from '../i18n/index.js'

// The host's switch for whether spectators may chat, in the lobby and in the chat's moderation section.
export function SpectatorChat({ room }) {
  return (
    <label className="ds-toggle">
      <input
        type="checkbox"
        checked={room.chat?.spectators ?? true}
        disabled={room.host !== net.id}
        onChange={(e) => net.send({ t: 'chatRules', spectators: e.target.checked })}
      />
      <span>
        <b>{t('online.spectatorChat')}</b>
        <span className="muted small">{t('online.spectatorChatNote')}</span>
      </span>
    </label>
  )
}

// Host tools: spectator chat on or off, and muting anyone in the room.
function Moderate({ room, players, muted, onClose }) {
  const others = room.members.filter((m) => m.id !== net.id)
  return (
    <Modal title={t('online.modTitle')} onClose={onClose}>
      <SpectatorChat room={room} />
      <span className="eyebrow">{t('online.modPeople')}</span>
      {others.length ? (
        <ul className="talk-people">
          {others.map((m) => {
            const p = m.pid !== null ? players?.[m.pid] : null
            const off = muted.has(m.id)
            return (
              <li key={m.id}>
                <span className="talk-person">
                  {p ? `${p.token} ${p.name}` : `👀 ${m.name}`}
                  {!m.online && <span className="muted">{t('online.offlineTail')}</span>}
                </span>
                {off && <span className="tag neg">{t('online.mutedTag')}</span>}
                <button className={`btn tiny ${off ? '' : 'ghost'}`} onClick={() => net.send({ t: 'mute', id: m.id, on: !off })}>
                  {off ? t('online.unmute') : t('online.mute')}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="hint">{t('online.modNobody')}</p>
      )}
      <p className="hint">{t('online.muteHint')}</p>
    </Modal>
  )
}

// Room chat for Cryptopoly and Settlers, where nothing is secret: everyone in the room, seated or watching,
// sees every line. What people type goes out as written; only the labels around it are translated.
export default function TableTalk({ talk, room, players }) {
  const [text, setText] = useState('')
  const [moderating, setModerating] = useState(false)
  const panelRef = useRef(null)
  const logRef = useRef(null)
  const stick = useRef(true)

  const isHost = room.host === net.id
  const muted = new Set(room.chat?.muted ?? [])
  const spectators = room.chat?.spectators ?? true
  // Lines from muted people, and from spectators while their chat is off, are hidden for everyone.
  const shown = talk.filter((m) => !muted.has(m.from) && (spectators || !m.spectator))
  // Why this person can't chat right now, shown in place of the message box.
  const blocked = isHost ? null : muted.has(net.id) ? `🔇 ${t('online.chatMuted')}` : room.you.pid === null && !spectators ? `👀 ${t('online.chatPlayersOnly')}` : null

  const last = shown.at(-1)?.id ?? 0
  const lastRef = useRef(last)
  const [seen, setSeen] = useState(last)
  const [away, setAway] = useState(false)

  useEffect(() => {
    lastRef.current = last
    const el = logRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [last])

  // On phones and short windows the chat can be scrolled out of sight, so new lines pop up in a pill instead.
  useEffect(() => {
    const el = panelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => {
        const off = e.intersectionRatio < 0.6
        setAway(off)
        if (off) setSeen(lastRef.current)
      },
      { threshold: [0, 0.6] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const unread = away ? shown.filter((m) => m.id > seen && m.from !== net.id) : []
  const latest = unread.at(-1)

  const send = () => {
    if (!text.trim()) return
    net.talk(text.trim())
    setText('')
    stick.current = true
  }

  return (
    <>
      <div className="panel talk-panel" ref={panelRef}>
        <div className="panel-head">
          <h2>{t('online.chat')}</h2>
          {isHost && (
            <button className="btn tiny ghost" onClick={() => setModerating(true)}>
              {t('online.moderate')}
            </button>
          )}
        </div>
        <ul
          className="log talk-log"
          ref={logRef}
          onScroll={(e) => {
            const el = e.currentTarget
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
          }}
        >
          {shown.length ? (
            shown.map((m) => (
              <li key={m.id} className={m.from === net.id ? 'mine' : ''} style={{ '--c': m.color ?? 'var(--muted)' }}>
                <b className="talk-name">
                  {m.token ?? '👀'} {m.name}
                </b>{' '}
                {m.text}
              </li>
            ))
          ) : (
            <li className="talk-empty">{t('online.chatEmpty')}</li>
          )}
        </ul>
        {blocked ? (
          <p className="talk-blocked">{blocked}</p>
        ) : (
          <form
            className="talk-form"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={280} placeholder={t('online.chatHint')} aria-label={t('online.message')} />
            <button className="btn primary" disabled={!text.trim()}>
              {t('online.send')}
            </button>
          </form>
        )}
      </div>
      {isHost && moderating && createPortal(<Moderate room={room} players={players} muted={muted} onClose={() => setModerating(false)} />, document.body)}
      {latest &&
        createPortal(
          <button className="talk-pill" title={t('online.showChat')} onClick={() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            <span className="talk-pill-text">
              💬 <b style={{ color: latest.color ?? 'inherit' }}>{latest.name}</b> {latest.text}
            </span>
            {unread.length > 1 && <span className="talk-pill-n mono">{unread.length}</span>}
          </button>,
          document.body,
        )}
    </>
  )
}
