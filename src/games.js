// The games on the arcade menu, shared by the start menu and the online lobby.
// Their names, taglines and chips are in the translations under games.<id>.
export const GAMES = [
  { id: 'cryptopoly', mark: '◈' },
  { id: 'catan', mark: '⬡' },
  { id: 'salem', mark: '⚖️' },
]

// Turn timer lengths in seconds the host can pick for online Cryptopoly and Settlers. 0 means no timer, the default.
export const TURN_TIMES = [0, 30, 60, 90, 120, 180, 300]
