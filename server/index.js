// Degen Arcade online server: serves the built app from dist/ and hosts rooms over a WebSocket at /ws.
// Every game runs here; clients send actions and get back only what their seat is allowed to see.
//
//   npm run host           build the app and start the server (PORT, default 8787)
//   npm run server         start the server only (pair it with `npm run dev` while developing)
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, normalize, extname, sep } from 'node:path'
import { networkInterfaces } from 'node:os'
import { WebSocketServer } from 'ws'
import { GAMES } from './games.js'

const PORT = Number(process.env.PORT ?? 8787)
const DIST = join(import.meta.dirname, '..', 'dist')
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MAX_ROOMS = 500
const ROOM_TTL = 60 * 60 * 1000 // rooms with nobody connected are dropped after an hour
const TALK_KEEP = 100 // chat lines a room remembers for people who join or reconnect
const TALK_BURST = 5 // chat lines one person can send…
const TALK_WINDOW = 10 * 1000 // …in this many milliseconds

// ---------- static files ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')
  let file = normalize(join(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST)) return res.writeHead(403).end()
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html')
  } catch {
    file = join(DIST, 'index.html') // client-side routes and ?room= links
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(body)
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end(existsSync(DIST) ? 'Not found' : 'No build yet — run `npm run host`.')
  }
})

// ---------- rooms ----------

const rooms = new Map() // code -> room
const sockets = new Map() // client id -> ws

const send = (ws, msg) => ws && ws.readyState === 1 && ws.send(JSON.stringify(msg))
// Errors carry a code the client translates (online.err.*), plus English text for older clients.
const fail = (ws, code, msg, v) => send(ws, { t: 'error', code, msg, ...(v ? { v } : {}) })
const problem = (code, msg) => Object.assign(new Error(msg), { code })
const cleanName = (n) => String(n ?? '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Anon'
const cleanText = (x) => String(x ?? '').replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 280)

function newCode() {
  for (;;) {
    const code = Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    if (!rooms.has(code)) return code
  }
}

function botName(room) {
  const used = new Set(room.seats.map((s) => s.name.toLowerCase()))
  return GAMES[room.game].names.find((n) => !used.has(n.toLowerCase())) ?? `Bot ${room.seats.length + 1}`
}

const memberOf = (room, id) => room.members.get(id)
const seatOf = (room, id) => room.seats.findIndex((s) => s.client === id)
const online = (room) => [...room.members.values()].filter((m) => sockets.has(m.id) && sockets.get(m.id).room === room.code)

// Player id controlled by a client in the running game, or null.
function playerOf(room, id) {
  for (const [pid, cid] of room.owners) if (cid === id) return pid
  return null
}

function roomInfo(room, id) {
  const g = GAMES[room.game]
  return {
    code: room.code,
    game: room.game,
    host: room.host,
    status: room.status,
    paused: room.paused,
    min: g.min,
    max: g.max,
    options: room.options,
    seats: room.seats,
    members: [...room.members.values()].map((m) => ({
      id: m.id,
      name: m.name,
      online: sockets.get(m.id)?.room === room.code,
      seat: seatOf(room, m.id),
      pid: playerOf(room, m.id),
    })),
    offer: room.offer,
    chat: { spectators: room.chatSpectators, muted: [...room.muted] },
    you: { id, seat: seatOf(room, id), pid: playerOf(room, id) },
  }
}

function sendRoom(room) {
  for (const m of room.members.values()) send(sockets.get(m.id)?.room === room.code ? sockets.get(m.id) : null, { t: 'room', room: roomInfo(room, m.id) })
}

// Send each player their view of the game, but only when it actually changed.
function sendState(room, { force = false } = {}) {
  if (!room.state) return
  const g = GAMES[room.game]
  for (const m of room.members.values()) {
    const ws = sockets.get(m.id)
    if (!ws || ws.room !== room.code) continue
    const pid = playerOf(room, m.id)
    const last = room.sent.get(m.id) ?? { json: null, chat: 0 }
    const json = JSON.stringify(g.view(room.state, pid))
    if (force || json !== last.json) ws.send(`{"t":"state","state":${json}}`)
    if (g.chat) {
      const reset = force || (room.state.phase === 'gameover' && !last.over)
      const msgs = g.chat(room.state, pid, reset ? 0 : last.chat)
      if (msgs.length || reset) send(ws, { t: 'chat', msgs, reset })
      last.chat = room.state.chat.at(-1)?.id ?? 0
      last.over = room.state.phase === 'gameover'
      send(ws, { t: 'clock', clock: room.state.clock, dur: room.state.dur })
    }
    room.sent.set(m.id, { ...last, json })
  }
}

// Apply a new game state, then let bots and timers react to it.
function commit(room, next) {
  room.state = next
  const g = GAMES[room.game]
  if (room.offer && g.offer && !g.offer(next, room.offer.from, room.offer.action)) {
    room.offer = null
    sendRoom(room)
  }
  schedule(room)
  sendState(room)
}

function schedule(room) {
  clearTimeout(room.timer)
  room.timer = null
  const g = GAMES[room.game]
  if (room.status !== 'playing' || !room.state) return
  if (g.tick) {
    const run = room.state.phase !== 'gameover' && !room.paused
    if (run && !room.ticker) {
      let last = Date.now()
      room.ticker = setInterval(() => {
        const now = Date.now()
        room.state = g.tick(room.state, Math.min(1000, now - last))
        last = now
        sendState(room)
        if (room.state.phase === 'gameover') schedule(room)
      }, 250)
    } else if (!run && room.ticker) {
      clearInterval(room.ticker)
      room.ticker = null
    }
    return
  }
  const step = g.next(room.state)
  if (!step) return
  room.timer = setTimeout(() => {
    const action = step.run(room.state)
    const next = action && g.accept(room.state, action)
    if (next) commit(room, next)
  }, step.delay)
}

function stopGame(room) {
  clearTimeout(room.timer)
  clearInterval(room.ticker)
  room.timer = null
  room.ticker = null
}

function createRoom(id, name, game) {
  if (rooms.size >= MAX_ROOMS) throw problem('full', 'The server is full right now.')
  const g = GAMES[game]
  const room = {
    code: newCode(),
    game,
    host: id,
    status: 'lobby',
    paused: false,
    members: new Map([[id, { id, name }]]),
    seats: [{ name, bot: false, client: id }],
    options: { ...g.options },
    state: null,
    owners: new Map(),
    offer: null,
    sent: new Map(),
    talk: [],
    talkId: 0,
    chatSpectators: true, // the host can turn spectator chat off
    muted: new Set(), // client ids the host muted; kept if they leave and come back
    idleSince: null,
  }
  const count = g.listFor ? g.listFor(room.options).length : g.seats
  while (room.seats.length < count) room.seats.push({ name: botName(room), bot: true, client: null })
  rooms.set(room.code, room)
  return room
}

// Resize the lobby to `n` seats, dropping empty or bot seats from the end first.
function resize(room, n) {
  while (room.seats.length < n) room.seats.push({ name: botName(room), bot: true, client: null })
  while (room.seats.length > n) {
    const i = room.seats.findLastIndex((s) => !s.client)
    if (i < 0) return false
    room.seats.splice(i, 1)
  }
  return true
}

function joinRoom(room, id, name) {
  const m = memberOf(room, id)
  if (m) {
    m.name = name
    return
  }
  room.members.set(id, { id, name })
  if (room.status !== 'lobby') return
  // Newcomers take an open seat, or bump a bot.
  let i = room.seats.findIndex((s) => !s.bot && !s.client)
  if (i < 0) i = room.seats.findLastIndex((s) => s.bot)
  if (i >= 0) room.seats[i] = { name, bot: false, client: id }
}

function leaveRoom(room, id) {
  room.members.delete(id)
  room.sent.delete(id)
  const i = seatOf(room, id)
  if (i >= 0) room.seats[i] = { name: botName(room), bot: true, client: null }
  if (room.status === 'playing') {
    const pid = playerOf(room, id)
    if (pid !== null) {
      room.owners.delete(pid)
      takeOver(room, pid)
    }
  }
  if (room.host === id) room.host = online(room)[0]?.id ?? [...room.members.keys()][0] ?? null
  if (!room.members.size) {
    stopGame(room)
    rooms.delete(room.code)
  } else sendRoom(room)
}

// A bot takes over a player's seat mid-game.
function takeOver(room, pid) {
  if (!room.state) return
  room.state = { ...room.state, players: room.state.players.map((p) => (p.id === pid ? { ...p, isAI: true } : p)) }
  if (room.offer && (room.offer.from === pid || room.offer.to === pid)) room.offer = null
  commit(room, room.state)
}

function startGame(room) {
  const g = GAMES[room.game]
  const seen = new Set()
  const seats = room.seats.map((s) => {
    // Unique names keep chat and votes readable.
    let name = s.client ? (memberOf(room, s.client)?.name ?? s.name) : s.name
    for (let k = 2; seen.has(name.toLowerCase()); k++) name = `${s.name.slice(0, 12)}${k}`
    seen.add(name.toLowerCase())
    return { name, bot: !s.client }
  })
  const state = g.start(seats, room.options)
  if (!state) throw problem('cantDeal', 'That role list can’t be dealt. Try another one.')
  room.owners = new Map()
  room.seats.forEach((s, i) => {
    if (s.client) room.owners.set(g.playerFor(state, i), s.client)
  })
  room.status = 'playing'
  room.paused = false
  room.offer = null
  room.sent = new Map()
  room.state = state
  sendRoom(room)
  schedule(room)
  sendState(room, { force: true })
}

// ---------- messages ----------

function handle(ws, msg) {
  if (msg.t === 'hello') {
    if (typeof msg.id !== 'string' || !/^[\w-]{6,40}$/.test(msg.id)) return fail(ws, 'badId', 'Bad client id')
    const old = sockets.get(msg.id)
    if (old && old !== ws) {
      old.replaced = true
      old.close()
    }
    ws.id = msg.id
    ws.name = cleanName(msg.name)
    sockets.set(ws.id, ws)
    return send(ws, { t: 'welcome', id: ws.id })
  }
  if (!ws.id) return fail(ws, 'hello', 'Say hello first')
  const id = ws.id
  const room = ws.room ? rooms.get(ws.room) : null

  switch (msg.t) {
    case 'create': {
      if (!GAMES[msg.game]) return fail(ws, 'unknownGame', 'Unknown game')
      if (room) leaveRoom(room, id)
      const r = createRoom(id, ws.name, msg.game)
      ws.room = r.code
      send(ws, { t: 'talk', msgs: [], reset: true })
      return sendRoom(r)
    }
    case 'join': {
      const r = rooms.get(String(msg.code ?? '').toUpperCase())
      if (!r) {
        const code = String(msg.code ?? '').toUpperCase().slice(0, 8)
        return send(ws, { t: 'gone', code: 'gone', v: { code }, msg: `Room ${code} doesn’t exist (anymore).` })
      }
      if (room && room !== r) leaveRoom(room, id)
      ws.room = r.code
      joinRoom(r, id, ws.name)
      r.idleSince = null
      send(ws, { t: 'talk', msgs: r.talk, reset: true })
      sendRoom(r)
      return sendState(r, { force: true })
    }
    case 'leave':
      if (room) leaveRoom(room, id)
      ws.room = null
      return send(ws, { t: 'gone' })
    case 'rename': {
      ws.name = cleanName(msg.name)
      if (!room) return
      memberOf(room, id).name = ws.name
      const i = seatOf(room, id)
      if (i >= 0 && room.status === 'lobby') room.seats[i].name = ws.name
      return sendRoom(room)
    }
    default:
      break
  }
  if (!room) return fail(ws, 'notInRoom', 'You’re not in a room')
  // If the host has dropped off, whoever reaches for a host control takes over. Chatting doesn't count,
  // and someone the host muted can't take over and unmute themselves.
  if (room.host !== id && sockets.get(room.host)?.room !== room.code && msg.t !== 'talk' && !room.muted.has(id)) room.host = id
  const isHost = room.host === id
  const g = GAMES[room.game]
  const hostOnly = () => (isHost ? true : (fail(ws, 'hostOnly', 'Only the host can do that.'), false))

  switch (msg.t) {
    case 'sit': {
      const s = room.seats[msg.seat]
      if (room.status !== 'lobby' || !s || s.client || (s.bot && !isHost)) return
      const i = seatOf(room, id)
      if (i >= 0) room.seats[i] = { name: botName(room), bot: false, client: null }
      room.seats[msg.seat] = { name: ws.name, bot: false, client: id }
      return sendRoom(room)
    }
    case 'stand': {
      const i = seatOf(room, id)
      if (room.status !== 'lobby' || i < 0) return
      room.seats[i] = { name: ws.name, bot: false, client: null }
      return sendRoom(room)
    }
    case 'seat': {
      // Host adds, removes or renames a bot seat: { add } | { seat, remove } | { seat, name }.
      if (room.status !== 'lobby' || !hostOnly() || g.listFor) return
      if (msg.add && room.seats.length < g.max) room.seats.push({ name: botName(room), bot: true, client: null })
      const s = room.seats[msg.seat]
      if (s && msg.remove && room.seats.length > g.min && !s.client) room.seats.splice(msg.seat, 1)
      else if (s && typeof msg.name === 'string' && s.bot) s.name = cleanName(msg.name)
      return sendRoom(room)
    }
    case 'options': {
      if (room.status !== 'lobby' || !hostOnly() || !g.sanitize) return
      const next = g.sanitize(msg.options, room.options)
      if (!resize(room, g.listFor(next).length)) return fail(ws, 'tooMany', 'Too many people are seated for that list.')
      room.options = next
      return sendRoom(room)
    }
    case 'botSeat': {
      // Host lets a bot (or an open seat) be filled, or turns an open seat into a bot.
      const s = room.seats[msg.seat]
      if (room.status !== 'lobby' || !hostOnly() || !s || s.client) return
      s.bot = !s.bot
      if (s.bot) s.name = botName(room)
      return sendRoom(room)
    }
    case 'start':
      if (room.status !== 'lobby' || !hostOnly()) return
      try {
        startGame(room)
      } catch (e) {
        fail(ws, e.code ?? 'server', e.message)
      }
      return
    case 'lobby':
      if (!hostOnly()) return
      stopGame(room)
      room.status = 'lobby'
      room.state = null
      room.owners = new Map()
      room.offer = null
      room.paused = false
      for (const s of room.seats) if (s.client && !room.members.has(s.client)) Object.assign(s, { client: null, bot: true, name: botName(room) })
      sendRoom(room)
      for (const m of room.members.values()) send(sockets.get(m.id), { t: 'state', state: null })
      return
    case 'act': {
      if (room.status !== 'playing' || !room.state) return
      const pid = playerOf(room, id)
      if (pid === null) return fail(ws, 'watching', 'You’re watching this game.')
      const action = msg.action
      if (action?.type === 'OFFER') {
        const o = g.offer?.(room.state, pid, action.action)
        if (!o) return fail(ws, 'tradeNow', 'That trade isn’t possible right now.')
        room.offer = { id: Date.now(), from: o.from, to: o.to, action: action.action, declined: false }
        return sendRoom(room)
      }
      const next = g.act(room.state, pid, action)
      if (next) commit(room, next)
      return
    }
    case 'offer': {
      const o = room.offer
      const pid = playerOf(room, id)
      if (!o || pid === null) return
      if (msg.cancel && pid === o.from) room.offer = null
      else if (pid === o.to && !o.declined) {
        if (msg.accept) {
          room.offer = null
          const next = g.accept(room.state, o.action)
          if (next) commit(room, next)
          else fail(ws, 'tradeGone', 'That trade isn’t possible anymore.')
        } else {
          room.offer = { ...o, declined: true }
          setTimeout(() => {
            if (room.offer?.id === o.id) {
              room.offer = null
              sendRoom(room)
            }
          }, 5000)
        }
      }
      return sendRoom(room)
    }
    case 'pause':
      if (room.status !== 'playing' || !hostOnly() || !g.tick) return
      room.paused = !!msg.on
      schedule(room)
      return sendRoom(room)
    case 'host': {
      // Host-only game actions, like changing the pace.
      if (room.status !== 'playing' || !hostOnly() || !g.hostAct) return
      const next = g.hostAct(room.state, msg.action)
      if (next) commit(room, next)
      return
    }
    case 'talk': {
      // Room chat for everyone, seated or watching, within the host's rules: whether spectators may talk, and who's
      // muted. The host can always talk. Town of Solana's own chat has rules (night rooms, the dead), so while it's
      // being played this channel stays shut.
      if (g.chat && room.status === 'playing') return
      const text = cleanText(msg.text)
      const m = memberOf(room, id)
      if (!text || !m) return
      const watching = room.status === 'playing' ? playerOf(room, id) === null : seatOf(room, id) < 0
      if (room.muted.has(id) && !isHost) return fail(ws, 'muted', 'The host muted you.')
      if (watching && !isHost && !room.chatSpectators) return fail(ws, 'quiet', 'Only players can chat right now.')
      const now = Date.now()
      m.said = (m.said ?? []).filter((at) => now - at < TALK_WINDOW)
      if (m.said.length >= TALK_BURST) return fail(ws, 'slow', 'Slow down a little.')
      m.said.push(now)
      const pid = room.status === 'playing' ? playerOf(room, id) : null
      const p = pid !== null ? room.state?.players[pid] : null
      // `spectator` lines are hidden while spectator chat is off.
      const line = { id: ++room.talkId, from: id, name: p?.name ?? m.name, token: p?.token ?? null, color: p?.color ?? null, spectator: watching && !isHost, text }
      room.talk = [...room.talk.slice(1 - TALK_KEEP), line]
      for (const x of online(room)) send(sockets.get(x.id), { t: 'talk', msgs: [line] })
      return
    }
    case 'chatRules':
      // Host lets spectators chat, or not. Their lines are hidden while it's off.
      if (!hostOnly()) return
      room.chatSpectators = !!msg.spectators
      return sendRoom(room)
    case 'mute': {
      // Host mutes or unmutes someone in the room. A muted person's lines are hidden for everyone.
      if (!hostOnly() || typeof msg.id !== 'string' || msg.id === id || !room.members.has(msg.id)) return
      if (msg.on) room.muted.add(msg.id)
      else room.muted.delete(msg.id)
      return sendRoom(room)
    }
    case 'takeover': {
      // Host hands a disconnected player's seat to a bot.
      if (room.status !== 'playing' || !hostOnly()) return
      const cid = room.owners.get(msg.pid)
      if (cid === undefined || cid === id) return
      room.owners.delete(msg.pid)
      takeOver(room, msg.pid)
      return sendRoom(room)
    }
    default:
      return fail(ws, 'unknown', `Unknown message ${msg.t}`, { t: String(msg.t).slice(0, 20) })
  }
}

// ---------- sockets ----------

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 })

wss.on('connection', (ws) => {
  ws.alive = true
  ws.on('pong', () => (ws.alive = true))
  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(data)
    } catch {
      return
    }
    if (!msg || typeof msg.t !== 'string') return
    try {
      handle(ws, msg)
    } catch (e) {
      if (e.code) return fail(ws, e.code, e.message)
      console.error('message failed', msg.t, e)
      fail(ws, 'server', 'Something went wrong on the server.')
    }
  })
  ws.on('close', () => {
    if (!ws.id || sockets.get(ws.id) !== ws) return
    sockets.delete(ws.id)
    const room = ws.room && rooms.get(ws.room)
    if (!room) return
    if (!online(room).length) room.idleSince = Date.now()
    sendRoom(room)
  })
})

// Drop dead connections and abandoned rooms.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate()
    else {
      ws.alive = false
      ws.ping()
    }
  }
  for (const room of rooms.values())
    if (room.idleSince && Date.now() - room.idleSince > ROOM_TTL) {
      stopGame(room)
      rooms.delete(room.code)
    }
}, 30000)

server.listen(PORT, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => `http://${a.address}:${PORT}`)
  console.log(`Degen Arcade server on http://localhost:${PORT}`)
  if (lan.length) console.log(`Friends on your network can open: ${lan.join('  ')}`)
  if (!existsSync(DIST)) console.log('No dist/ build found. Run `npm run host` to build and serve the app.')
})
