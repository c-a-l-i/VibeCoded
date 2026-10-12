import { useCallback, useEffect, useReducer, useState } from 'react'
import { GEO } from './data.js'
import { reducer, rollDice, actingPlayer, legalNodes, legalChannels, legalUpgrades, canPlaceChannel } from './engine.js'
import { aiAction } from './ai.js'
import Setup from './components/Setup.jsx'
import HexBoard from './components/HexBoard.jsx'
import Console from './components/Console.jsx'
import Sidebar from './components/Sidebar.jsx'
import TradeModal from './components/TradeModal.jsx'
import DevModal from './components/DevModal.jsx'
import GameOver from './components/GameOver.jsx'
import './catan.css'
import { upgradeColors } from '../display.js'

export const SAVE_KEY = 'satoshi-settlers-save-v1'

function loadSave() {
  try {
    return upgradeColors(JSON.parse(localStorage.getItem(SAVE_KEY)))
  } catch {
    return null
  }
}

// Which spots on the board the acting human can tap right now.
function boardTargets(state, mode, act) {
  const pid = actingPlayer(state)
  if (state.players[pid].isAI) return null
  switch (state.phase) {
    case 'setup':
      if (state.setup.node === null)
        return { kind: 'vertex', ids: legalNodes(state, pid, { setup: true }), onPick: (v) => act({ type: 'SETUP_NODE', v }) }
      return {
        kind: 'edge',
        ids: GEO.vertices[state.setup.node].edges.filter((e) => canPlaceChannel(state, pid, e, { from: state.setup.node }).ok),
        onPick: (e) => act({ type: 'SETUP_CHANNEL', e }),
      }
    case 'hacker':
      return {
        kind: 'hex',
        ids: GEO.hexes.map((h) => h.id).filter((h) => h !== state.board.hacker),
        onPick: (hex) => act({ type: 'MOVE_HACKER', hex }),
      }
    case 'rollup':
      return { kind: 'edge', ids: legalChannels(state, pid), onPick: (e) => act({ type: 'BUILD_CHANNEL', e }) }
    case 'main':
      if (mode === 'channel') return { kind: 'edge', ids: legalChannels(state, pid), onPick: (e) => act({ type: 'BUILD_CHANNEL', e }) }
      if (mode === 'node') return { kind: 'vertex', ids: legalNodes(state, pid), onPick: (v) => act({ type: 'BUILD_NODE', v }) }
      if (mode === 'dc') return { kind: 'upgrade', ids: legalUpgrades(state, pid), onPick: (v) => act({ type: 'BUILD_DC', v }) }
      return null
    default:
      return null
  }
}

// `net` is set for online games: the server owns the state and runs the bots.
export default function CatanApp({ onMenu, net = null }) {
  const [local, localDispatch] = useReducer(reducer, null, () => (net ? null : loadSave()))
  const state = net ? net.state : local
  const dispatch = net ? net.send : localDispatch
  const [rolling, setRolling] = useState(false)
  const [mode, setMode] = useState(null) // 'channel' | 'node' | 'dc' while picking a build spot
  const [modal, setModal] = useState(null) // { type: 'trade' } | { type: 'dev' }

  useEffect(() => {
    if (net) return
    try {
      if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state))
      else localStorage.removeItem(SAVE_KEY)
    } catch {
      /* storage unavailable — game just won't persist */
    }
  }, [state, net])

  const act = useCallback((action) => {
    if (action.type === 'ROLL') {
      setRolling(true)
      setTimeout(() => {
        dispatch({ type: 'ROLL', dice: rollDice() })
        setRolling(false)
      }, 750)
      return
    }
    if (action.type.startsWith('BUILD_') || action.type === 'END_TURN') setMode(null)
    dispatch(action)
  }, [dispatch])

  // Bots take their actions with a little human-like delay.
  const actor = state && state.phase !== 'gameover' ? state.players[actingPlayer(state)] : null
  useEffect(() => {
    if (net || !state || !actor?.isAI || rolling || state.phase === 'gameover') return
    const delay = { setup: 650, preroll: 800, hacker: 1000, steal: 700, discard: 900 }[state.phase] ?? 750
    const t = setTimeout(() => {
      const a = aiAction(state)
      if (a) act(a)
    }, delay)
    return () => clearTimeout(t)
  }, [state, actor, rolling, act, net])

  if (!state && net) return <p className="setup tagline">Loading the game…</p>
  if (!state) return <Setup onStart={(players) => dispatch({ type: 'NEW_GAME', players })} onBack={onMenu} />

  const quit = () => {
    if (net) return net.toLobby()
    if (state.phase === 'gameover' || confirm('Abandon this game and start a new one?')) {
      setModal(null)
      setMode(null)
      dispatch({ type: 'QUIT' })
    }
  }

  // Hot-seat: show the wallet of whichever human is acting, else the current or first human.
  const humans = state.players.filter((p) => !p.isAI)
  const viewer = actor && !actor.isAI ? actor.id : !state.players[state.current].isAI ? state.current : (humans[0]?.id ?? null)
  const activeMode = state.phase === 'main' && !actor?.isAI ? mode : null
  const sum = state.dice[0] + state.dice[1]
  const hot = !rolling && state.phase !== 'setup' && state.phase !== 'preroll' && sum !== 7 ? sum : null

  return (
    <div className="app">
      <main className="layout st-layout">
        <div className="st-main">
          <section className="st-board">
            <HexBoard state={state} targets={boardTargets(state, activeMode, act)} hotNumber={hot} />
          </section>
          <Console state={state} rolling={rolling} act={act} mode={activeMode} setMode={setMode} openModal={setModal} />
        </div>
        <Sidebar state={state} viewer={viewer} onQuit={quit} onMenu={onMenu} />
      </main>

      {modal?.type === 'trade' && state.phase === 'main' && <TradeModal state={state} act={act} onClose={() => setModal(null)} />}
      {modal?.type === 'dev' && <DevModal state={state} act={act} onClose={() => setModal(null)} />}
      {state.phase === 'gameover' && <GameOver state={state} onNew={quit} onMenu={onMenu} />}
    </div>
  )
}
