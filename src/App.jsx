import { useCallback, useEffect, useReducer, useState } from 'react'
import { reducer, rollDice, actingPlayer } from './engine/game.js'
import { aiAction } from './engine/ai.js'
import Setup from './components/Setup.jsx'
import Board from './components/Board.jsx'
import Center from './components/Center.jsx'
import Sidebar from './components/Sidebar.jsx'
import DeedModal from './components/DeedModal.jsx'
import PortfolioModal from './components/PortfolioModal.jsx'
import TradeModal from './components/TradeModal.jsx'
import GameOver from './components/GameOver.jsx'

const SAVE_KEY = 'cryptopoly-save-v1'

function loadSave() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY))
  } catch {
    return null
  }
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, loadSave)
  const [rolling, setRolling] = useState(false)
  // { type: 'deed', id } | { type: 'portfolio' } | { type: 'trade' }
  const [modal, setModal] = useState(null)

  useEffect(() => {
    try {
      if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state))
      else localStorage.removeItem(SAVE_KEY)
    } catch {
      /* storage unavailable — game just won't persist */
    }
  }, [state])

  const act = useCallback((action) => {
    if (action.type === 'ROLL') {
      setRolling(true)
      setTimeout(() => {
        dispatch({ type: 'ROLL', dice: rollDice() })
        setRolling(false)
      }, 750)
      return
    }
    dispatch(action)
  }, [])

  // Token movement, one space per tick.
  useEffect(() => {
    if (state?.phase !== 'moving') return
    const t = setTimeout(() => dispatch({ type: 'STEP' }), state.moving.steps > 8 ? 85 : 190)
    return () => clearTimeout(t)
  }, [state])

  // Bots take their actions with a little human-like delay.
  const actor = state && state.phase !== 'gameover' ? state.players[actingPlayer(state)] : null
  useEffect(() => {
    if (!state || !actor?.isAI || rolling || ['moving', 'gameover'].includes(state.phase)) return
    const delay = { card: 1800, auction: 650, buy: 1100 }[state.phase] ?? 850
    const t = setTimeout(() => {
      const a = aiAction(state)
      if (a) act(a)
    }, delay)
    return () => clearTimeout(t)
  }, [state, actor, rolling, act])

  if (!state) return <Setup onStart={(players) => dispatch({ type: 'NEW_GAME', players })} />

  const quit = () => {
    if (state.phase === 'gameover' || confirm('Abandon this game and start a new one?')) {
      setModal(null)
      dispatch({ type: 'QUIT' })
    }
  }

  return (
    <div className="app">
      <main className="layout">
        <Board state={state} onSpaceClick={(id) => setModal({ type: 'deed', id })}>
          <Center state={state} rolling={rolling} act={act} openModal={setModal} />
        </Board>
        <Sidebar state={state} openModal={setModal} onQuit={quit} />
      </main>

      {modal?.type === 'deed' && <DeedModal state={state} id={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === 'portfolio' && <PortfolioModal state={state} act={act} onClose={() => setModal(null)} />}
      {modal?.type === 'trade' && <TradeModal state={state} act={act} onClose={() => setModal(null)} />}
      {state.phase === 'gameover' && <GameOver state={state} onNew={quit} />}
    </div>
  )
}
