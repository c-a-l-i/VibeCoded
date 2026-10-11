import { useEffect, useState } from 'react'
import Menu from './Menu.jsx'
import CryptopolyApp, { SAVE_KEY as CRYPTOPOLY_SAVE } from './CryptopolyApp.jsx'
import CatanApp, { SAVE_KEY as CATAN_SAVE } from './catan/CatanApp.jsx'

const GAME_KEY = 'degen-arcade-game'
const SAVES = { cryptopoly: CRYPTOPOLY_SAVE, catan: CATAN_SAVE }

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

// Start menu that launches either game. Remembers which game is open so a refresh resumes it.
export default function App() {
  const [game, setGame] = useState(() => (SAVES[read(GAME_KEY)] ? read(GAME_KEY) : null))

  useEffect(() => write(GAME_KEY, game), [game])

  const play = (id, { fresh }) => {
    if (fresh && read(SAVES[id]) && !confirm('This replaces the game in progress. Start fresh?')) return
    if (fresh) write(SAVES[id], null)
    setGame(id)
  }
  const menu = () => setGame(null)

  if (game === 'cryptopoly') return <CryptopolyApp onMenu={menu} />
  if (game === 'catan') return <CatanApp onMenu={menu} />
  const saves = Object.fromEntries(Object.entries(SAVES).map(([id, key]) => [id, !!read(key)]))
  return <Menu saves={saves} onPlay={play} />
}
