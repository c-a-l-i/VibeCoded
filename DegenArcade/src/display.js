// Display settings (color-vision palette and shape cues), saved per browser and applied to <html>
// as data-cvd / data-cues so src/theme.css can swap every color token at once.
import { useSyncExternalStore } from 'react'

const KEY = 'degen-arcade-display'

export const VISION = [
  { id: 'std', name: 'Standard', note: 'Full-color palette' },
  { id: 'deutan', name: 'Deuteranopia', note: 'Red–green · the most common' },
  { id: 'protan', name: 'Protanopia', note: 'Red–green · reds look dark' },
  { id: 'tritan', name: 'Tritanopia', note: 'Blue–yellow' },
]

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY))
    return { cvd: VISION.some((m) => m.id === v?.cvd) ? v.cvd : 'std', cues: !!v?.cues }
  } catch {
    return { cvd: 'std', cues: false }
  }
}

let snap = read()
const subs = new Set()

function apply() {
  const el = document.documentElement
  el.dataset.cvd = snap.cvd
  if (snap.cues) el.dataset.cues = ''
  else delete el.dataset.cues
}
apply()

export function setDisplay(patch) {
  snap = { ...snap, ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    /* storage unavailable — the setting lasts until reload */
  }
  apply()
  subs.forEach((f) => f())
}

export const useDisplay = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => snap,
  )

// Games saved before colors became theme tokens stored raw neon hex values; map them onto the seat tokens.
const LEGACY = [
  ['#00f0ff'], ['#ff3df2'], ['#ffd23f'], ['#3dff8f'], ['#ff7a3d', '#ff8a3d'], ['#a78bfa', '#9d7bff'], ['#ff4d6d'], ['#4dd2ff'],
  ['#c6ff3d'], ['#ff9de2'], ['#a0a8ff'], ['#3dffd8'], ['#ffb86b'], ['#e07bff'], ['#9dffb0'],
]
const LEGACY_MAP = new Map(LEGACY.flatMap((hexes, i) => hexes.map((h) => [h, `var(--p${i + 1})`])))

export function upgradeColors(state) {
  if (!state?.players?.some((p) => LEGACY_MAP.has(p.color?.toLowerCase()))) return state
  return { ...state, players: state.players.map((p) => ({ ...p, color: LEGACY_MAP.get(p.color?.toLowerCase()) ?? p.color })) }
}
