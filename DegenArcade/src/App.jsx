import { useEffect, useState } from 'react'
import Menu from './Menu.jsx'
import Online from './net/Online.jsx'
import { net, useNet, inviteCode } from './net/net.js'
import CryptopolyApp, { SAVE_KEY as CRYPTOPOLY_SAVE } from './CryptopolyApp.jsx'
import CatanApp, { SAVE_KEY as CATAN_SAVE } from './catan/CatanApp.jsx'
import SalemApp, { SAVE_KEY as SALEM_SAVE } from './salem/SalemApp.jsx'
import { t, useLang } from './i18n/index.js'

const GAME_KEY = 'degen-arcade-game'
const SAVES = { cryptopoly: CRYPTOPOLY_SAVE, catan: CATAN_SAVE, salem: SALEM_SAVE }

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

// Start menu that launches any of the games. Remembers which game is open so a refresh resumes it.
export default function App() {
  // Subscribing here re-renders the whole app when the language changes.
  useLang()
  const n = useNet()
  const [game, setGame] = useState(() => (SAVES[read(GAME_KEY)] ? read(GAME_KEY) : null))

  useEffect(() => write(GAME_KEY, game), [game])

  // Open an invite link (?room=CODE), or rejoin the room this browser was in before a refresh.
  useEffect(() => {
    const code = inviteCode()
    if (code) {
      net.join(code)
      history.replaceState(null, '', location.pathname)
    } else net.resume()
  }, [])

  const play = (id, { fresh }) => {
    if (fresh && read(SAVES[id]) && !confirm(t('menu.replace'))) return
    if (fresh) write(SAVES[id], null)
    setGame(id)
  }
  const menu = () => setGame(null)

  if (n.room) return <Online n={n} />
  if (game === 'cryptopoly') return <CryptopolyApp onMenu={menu} />
  if (game === 'catan') return <CatanApp onMenu={menu} />
  if (game === 'salem') return <SalemApp onMenu={menu} />
  const saves = Object.fromEntries(Object.entries(SAVES).map(([id, key]) => [id, !!read(key)]))
  return <Menu saves={saves} onPlay={play} n={n} />
}
