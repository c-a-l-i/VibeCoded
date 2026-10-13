// Connection to the Degen Arcade server. One shared WebSocket for the whole app, with automatic reconnects,
// exposed to React through useNet(). The server runs the games; this just mirrors what it sends.
import { useSyncExternalStore } from 'react'
import { upgradeColors } from '../display.js'

const ID_KEY = 'degen-arcade-client'
const NAME_KEY = 'degen-arcade-name'
const ROOM_KEY = 'degen-arcade-room'

function stored(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function store(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

// Each browser gets a stable id so a refresh puts you back in your seat.
const clientId = (() => {
  let id = stored(ID_KEY)
  if (!id) {
    id = `c-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
    store(ID_KEY, id)
  }
  return id
})()

let snap = {
  status: 'offline', // offline | connecting | online | reconnecting
  room: null,
  state: null,
  chat: [],
  talk: [], // room chat for the board games; Town of Solana's in-game chat is `chat`
  clock: null,
  error: null,
  // A playful default so you can host right away; change it any time.
  name: stored(NAME_KEY) ?? `${['Anon', 'Degen', 'Ser', 'Fren', 'Ape', 'Wagmi'][Math.floor(Math.random() * 6)]}${10 + Math.floor(Math.random() * 90)}`,
}
const listeners = new Set()
const set = (patch) => {
  snap = { ...snap, ...patch }
  for (const l of listeners) l()
}

let ws = null
let wanted = stored(ROOM_KEY) // room code we want to be in, if any
let pending = [] // messages queued while connecting
let retry = 0
let retryTimer = null

// An error to show: { code, v } for the client to translate (online.err.*), or the server's own text.
const problem = (m) => (m.code ? { code: m.code, v: m.v, msg: m.msg } : m.msg ? { msg: m.msg } : null)

const url = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`

function connect() {
  if (ws && ws.readyState <= 1) return
  clearTimeout(retryTimer)
  set({ status: snap.room ? 'reconnecting' : 'connecting' })
  ws = new WebSocket(url())
  let opened = false
  ws.onopen = () => {
    opened = true
    retry = 0
    ws.send(JSON.stringify({ t: 'hello', id: clientId, name: snap.name || 'Anon' }))
    if (wanted && !pending.some((m) => m.t === 'create' || m.t === 'join')) ws.send(JSON.stringify({ t: 'join', code: wanted }))
    for (const m of pending) ws.send(JSON.stringify(m))
    pending = []
    set({ status: 'online', error: null })
  }
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    switch (m.t) {
      case 'room':
        wanted = m.room.code
        store(ROOM_KEY, wanted)
        set({ room: m.room })
        break
      case 'state':
        set({ state: upgradeColors(m.state) })
        break
      case 'chat':
        set({ chat: m.reset ? m.msgs : [...snap.chat, ...m.msgs] })
        break
      case 'talk':
        set({ talk: m.reset ? m.msgs : [...snap.talk, ...m.msgs].slice(-100) })
        break
      case 'clock':
        set({ clock: { clock: m.clock, dur: m.dur } })
        break
      case 'gone':
        wanted = null
        store(ROOM_KEY, null)
        set({ room: null, state: null, chat: [], talk: [], clock: null, error: problem(m) })
        break
      case 'error':
        set({ error: problem(m) })
        break
      default:
        break
    }
  }
  ws.onclose = () => {
    ws = null
    if (!wanted) {
      pending = []
      return set({ status: 'offline', error: opened ? null : { code: 'unreachable' } })
    }
    set({ status: 'reconnecting' })
    retryTimer = setTimeout(connect, Math.min(8000, 500 * 2 ** retry++))
  }
}

function send(msg) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(msg))
  else {
    pending.push(msg)
    connect()
  }
}

export const net = {
  id: clientId,
  create(game) {
    set({ error: null })
    send({ t: 'create', game })
  },
  join(code) {
    wanted = String(code).trim().toUpperCase()
    set({ error: null })
    send({ t: 'join', code: wanted })
  },
  leave() {
    wanted = null
    store(ROOM_KEY, null)
    send({ t: 'leave' })
    set({ room: null, state: null, chat: [], talk: [], clock: null })
  },
  rename(name) {
    store(NAME_KEY, name)
    set({ name })
    if (ws?.readyState === 1) ws.send(JSON.stringify({ t: 'rename', name }))
  },
  send,
  act: (action) => send({ t: 'act', action }),
  talk: (text) => send({ t: 'talk', text }),
  clearError: () => set({ error: null }),
  // Rejoin the last room after a refresh.
  resume() {
    if (wanted) connect()
  },
}

export function useNet() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => snap,
  )
}

// A ?room=CODE invite link in the address bar.
export function inviteCode() {
  const code = new URLSearchParams(location.search).get('room')
  return code && /^[A-Za-z]{4}$/.test(code) ? code.toUpperCase() : null
}

export const inviteLink = (code) => `${location.origin}${location.pathname}?room=${code}`
