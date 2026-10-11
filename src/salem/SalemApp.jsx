import { useEffect, useReducer, useRef, useState } from 'react'
import { reducer, nightHumans } from './engine.js'
import Setup from './components/Setup.jsx'
import TopBar from './components/TopBar.jsx'
import Town from './components/Town.jsx'
import Chat from './components/Chat.jsx'
import YouPanel from './components/YouPanel.jsx'
import Side from './components/Side.jsx'
import GameOver from './components/GameOver.jsx'
import Curtain from './components/Curtain.jsx'
import RoleGuide from './components/RoleGuide.jsx'
import DeadModal from './components/DeadModal.jsx'
import './salem.css'

export const SAVE_KEY = 'town-of-solana-save-v1'

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY))
  } catch {
    return null
  }
}

function save(state) {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    /* storage unavailable — game just won't persist */
  }
}

// `net` is set for online games: the server runs the clock and bots, and sends only what this seat may see.
export default function SalemApp({ onMenu, net = null }) {
  const [local, localDispatch] = useReducer(reducer, null, () => (net ? null : loadSave()))
  const state = net ? net.state : local
  const dispatch = net ? net.send : localDispatch
  const [localPaused, setLocalPaused] = useState(false)
  const paused = net ? net.paused : localPaused
  const setPaused = net ? (net.isHost ? net.pause : null) : setLocalPaused
  // Hot-seat views are tied to the phase they were opened in, so they close on their own when it changes.
  const [opened, setOpened] = useState(null) // { pid, key }: whose private view is open
  const [passing, setPassing] = useState(null) // { pid, key }: who the device is being handed to
  const [modal, setModal] = useState(null) // { type: 'guide' | 'dead', ... }
  const [overClosed, setOverClosed] = useState(false)
  const [peek, setPeek] = useState(false)

  // Autosave: on every phase change, and every few seconds otherwise.
  const latest = useRef(state)
  const phaseKey = state ? `${state.day}:${state.phase}` : 'none'
  useEffect(() => {
    latest.current = state
  }, [state])
  useEffect(() => {
    if (!net) save(latest.current)
  }, [phaseKey, net])
  useEffect(() => {
    if (net) return
    let last = null
    const id = setInterval(() => {
      if (latest.current !== last) save((last = latest.current))
    }, 4000)
    const flush = () => save(latest.current)
    window.addEventListener('beforeunload', flush)
    return () => {
      clearInterval(id)
      window.removeEventListener('beforeunload', flush)
    }
  }, [net])

  const humans = state ? state.players.filter((p) => !p.isAI) : []
  const solo = net ? net.seat : humans.length === 1 ? humans[0].id : null
  const multi = !net && humans.length > 1
  const viewer = multi && opened?.key === phaseKey ? opened.pid : null
  // At night the device goes round every human who hasn't finished yet.
  const nextUp = multi && state?.phase === 'night' && viewer === null ? (nightHumans(state).find((p) => !state.done[p.id])?.id ?? null) : null
  const curtain = multi ? (passing?.key === phaseKey ? passing.pid : nextUp) : null

  // The game clock. Uses real elapsed time so a background tab doesn't slow the game down.
  const running = !net && !!state && state.phase !== 'gameover' && !paused && curtain === null
  useEffect(() => {
    if (!running) return
    let last = performance.now()
    const id = setInterval(() => {
      const now = performance.now()
      localDispatch({ type: 'TICK', dt: Math.min(1000, now - last) })
      last = now
    }, 250)
    return () => clearInterval(id)
  }, [running])

  const me = !state ? null : net ? solo : humans.length === 0 ? 'all' : solo !== null ? solo : viewer
  const actor = typeof me === 'number' ? me : null
  const act = (type, payload = {}) => actor !== null && dispatch({ type, pid: actor, ...payload })

  if (!state && net) return <p className="setup tagline">Loading the game…</p>
  if (!state)
    return (
      <Setup
        onStart={(config) => {
          setPeek(false)
          setLocalPaused(false)
          setOverClosed(false)
          dispatch({ type: 'NEW_GAME', config })
        }}
        onBack={onMenu}
      />
    )

  const quit = () => {
    if (net) return net.toLobby()
    if (state.phase === 'gameover' || confirm('Abandon this game and start a new one?')) {
      setModal(null)
      setOpened(null)
      setPassing(null)
      dispatch({ type: 'QUIT' })
    }
  }
  const meDead = typeof me === 'number' && !state.players[me].alive
  const seeAll = me === 'all' || state.phase === 'gameover' || (peek && (meDead || humans.every((p) => !p.alive)))
  const view = seeAll ? 'all' : me

  const hide = () => {
    if (state.phase === 'night' && actor !== null && !state.done[actor]) act('DONE')
    setOpened(null)
  }

  return (
    <div className={`app ts-app ts-${state.phase === 'night' ? 'night' : 'day'}`}>
      <TopBar
        state={state}
        me={me}
        paused={paused}
        setPaused={setPaused}
        act={act}
        onPace={net ? (net.isHost ? net.pace : null) : (pace) => dispatch({ type: 'PACE', pace })}
        onGuide={() => setModal({ type: 'guide' })}
        onQuit={quit}
        onMenu={onMenu}
        peek={peek}
        setPeek={!net && (meDead || humans.every((p) => !p.alive)) ? setPeek : null}
      />
      <main className="ts-layout">
        <YouPanel state={state} me={me} view={view} act={act} multi={multi} online={!!net} onReveal={(pid) => setPassing({ pid, key: phaseKey })} onHide={hide} />
        <section className="ts-center">
          <Town state={state} me={me} view={view} act={act} onDead={(pid) => setModal({ type: 'dead', pid })} />
          <Chat state={state} me={me} view={view} act={act} />
        </section>
        <Side state={state} view={view} onDead={(pid) => setModal({ type: 'dead', pid })} onGuide={(role) => setModal({ type: 'guide', role })} />
      </main>

      {curtain !== null && (
        <Curtain
          state={state}
          pid={curtain}
          onReveal={() => {
            setOpened({ pid: curtain, key: phaseKey })
            setPassing(null)
          }}
          onCancel={() => setPassing(null)}
        />
      )}
      {modal?.type === 'guide' && <RoleGuide focus={modal.role} onClose={() => setModal(null)} />}
      {modal?.type === 'dead' && <DeadModal state={state} pid={modal.pid} onClose={() => setModal(null)} />}
      {state.phase === 'gameover' && !overClosed && !modal && <GameOver state={state} onNew={quit} onMenu={onMenu} onClose={() => setOverClosed(true)} />}
    </div>
  )
}
