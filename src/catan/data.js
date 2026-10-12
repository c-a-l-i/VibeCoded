// Static data for Settlers of Satoshi: the standard Catan base game, re-skinned with crypto names.
// Board geometry (hexes, vertices, edges, harbors) is fixed; terrain and numbers are shuffled per game.

export const RESOURCES = ['chips', 'fiber', 'memes', 'stake', 'hash']

// Colors are CSS tokens (src/theme.css) so the Display settings can swap them for color-blind palettes.
export const RES = {
  chips: { name: 'Chips', icon: '💾', classic: 'Brick', color: 'var(--r-chips)' },
  fiber: { name: 'Fiber', icon: '🔌', classic: 'Lumber', color: 'var(--r-fiber)' },
  memes: { name: 'Memes', icon: '🐸', classic: 'Wool', color: 'var(--r-memes)' },
  stake: { name: 'Stake', icon: '🥩', classic: 'Grain', color: 'var(--r-stake)' },
  hash: { name: 'Hash', icon: '⛏️', classic: 'Ore', color: 'var(--r-hash)' },
}

// Each tile is tinted with its glow color; the board mixes the fill from it.
export const TERRAIN = {
  chips: { name: 'Fab Lab', glow: RES.chips.color },
  fiber: { name: 'Fiber Forest', glow: RES.fiber.color },
  memes: { name: 'Meme Farm', glow: RES.memes.color },
  stake: { name: 'Staking Fields', glow: RES.stake.color },
  hash: { name: 'Mining Peaks', glow: RES.hash.color },
  desert: { name: 'Bear Market', glow: 'var(--desert)', icon: '🐻' },
}

export const COSTS = {
  channel: { chips: 1, fiber: 1 },
  node: { chips: 1, fiber: 1, memes: 1, stake: 1 },
  dc: { stake: 2, hash: 3 },
  dev: { memes: 1, stake: 1, hash: 1 },
}

export const PIECES = { channel: 15, node: 5, dc: 4 }
export const BANK_SIZE = 19
export const WIN_VP = 10

export const DEV = {
  knight: { name: 'Hacker', icon: '🥷', classic: 'Knight', text: 'Move the Hacker and steal 1 resource. Counts toward Largest Botnet.' },
  road: { name: 'Layer 2 Rollup', icon: '🛣️', classic: 'Road Building', text: 'Deploy 2 channels for free.' },
  plenty: { name: 'Airdrop', icon: '🪂', classic: 'Year of Plenty', text: 'Claim any 2 resources from the bank.' },
  monopoly: { name: 'Rug Pull', icon: '🧹', classic: 'Monopoly', text: 'Name a resource. Every player sends you all of theirs.' },
  vp: { name: 'Rare NFT', icon: '🖼️', classic: 'Victory Point', text: '+1 VP. Stays hidden until you win.' },
}

export const NFT_NAMES = ['CryptoPunk #7804', 'Bored Ape #8817', 'Rare Pepe', 'Genesis Ordinal', 'Pudgy Penguin #6873']

export const DEV_DECK = [
  ...Array(14).fill('knight'),
  ...Array(5).fill('vp'),
  ...Array(2).fill('road'),
  ...Array(2).fill('plenty'),
  ...Array(2).fill('monopoly'),
]

const TERRAIN_BAG = [
  ...Array(4).fill('fiber'),
  ...Array(4).fill('memes'),
  ...Array(4).fill('stake'),
  ...Array(3).fill('chips'),
  ...Array(3).fill('hash'),
  'desert',
]
const NUMBER_BAG = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
const PORT_BAG = ['any', 'any', 'any', 'any', ...RESOURCES]

// Odds of rolling each number on 2d6, as pips (out of 36).
export const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 }

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ---------- geometry ----------
// Pointy-top hexes in axial coordinates, radius 2 (19 tiles). Unit hex size = 1.

const SQRT3 = Math.sqrt(3)
const AXIAL = []
for (let q = -2; q <= 2; q++)
  for (let r = -2; r <= 2; r++) if (Math.abs(q + r) <= 2) AXIAL.push([q, r])
// Order rows top-to-bottom, left-to-right so ids read naturally.
AXIAL.sort((a, b) => a[1] - b[1] || a[0] - b[0])

const key = (x, y) => `${Math.round(x * 1000)},${Math.round(y * 1000)}`

function buildGeometry() {
  const hexes = AXIAL.map(([q, r], id) => ({ id, q, r, x: SQRT3 * (q + r / 2), y: 1.5 * r, vertices: [], edges: [] }))
  const vertices = []
  const vIndex = new Map()
  const edges = []
  const eIndex = new Map()

  const vertexAt = (x, y) => {
    const k = key(x, y)
    if (!vIndex.has(k)) {
      vIndex.set(k, vertices.length)
      vertices.push({ id: vertices.length, x, y, hexes: [], edges: [], neighbors: [] })
    }
    return vIndex.get(k)
  }

  for (const h of hexes) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 90)
      const v = vertexAt(h.x + Math.cos(a), h.y + Math.sin(a))
      h.vertices.push(v)
      vertices[v].hexes.push(h.id)
    }
    for (let i = 0; i < 6; i++) {
      const a = h.vertices[i]
      const b = h.vertices[(i + 1) % 6]
      const k = a < b ? `${a}-${b}` : `${b}-${a}`
      if (!eIndex.has(k)) {
        eIndex.set(k, edges.length)
        edges.push({ id: edges.length, a: Math.min(a, b), b: Math.max(a, b), hexes: [] })
        vertices[a].edges.push(edges.length - 1)
        vertices[b].edges.push(edges.length - 1)
        vertices[a].neighbors.push(b)
        vertices[b].neighbors.push(a)
      }
      const e = eIndex.get(k)
      edges[e].hexes.push(h.id)
      h.edges.push(e)
    }
  }

  const byAxial = new Map(hexes.map((h) => [`${h.q},${h.r}`, h.id]))
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]
  for (const h of hexes) {
    h.neighbors = DIRS.map(([dq, dr]) => byAxial.get(`${h.q + dq},${h.r + dr}`)).filter((n) => n !== undefined)
  }

  // Harbor slots: 9 coastal edges spaced around the island like the printed board.
  const coast = edges
    .filter((e) => e.hexes.length === 1)
    .map((e) => {
      const mx = (vertices[e.a].x + vertices[e.b].x) / 2
      const my = (vertices[e.a].y + vertices[e.b].y) / 2
      return { ...e, mx, my, angle: Math.atan2(my, mx) }
    })
    .sort((a, b) => a.angle - b.angle)
  const portSlots = [0, 3, 6, 10, 13, 16, 20, 23, 26].map((i) => {
    const e = coast[i]
    const len = Math.hypot(e.mx, e.my)
    return { edge: e.id, vertices: [e.a, e.b], x: e.mx, y: e.my, nx: e.mx / len, ny: e.my / len }
  })

  return { hexes, vertices, edges, portSlots }
}

export const GEO = buildGeometry()

// ---------- random board ----------

export function randomBoard() {
  const terrain = shuffle(TERRAIN_BAG)
  let numbers
  // Re-deal until no two red numbers (6/8) sit next to each other.
  for (let tries = 0; tries < 500; tries++) {
    const deck = shuffle(NUMBER_BAG)
    numbers = terrain.map((t) => (t === 'desert' ? null : deck.pop()))
    const hot = (n) => n === 6 || n === 8
    const clash = GEO.hexes.some((h) => hot(numbers[h.id]) && h.neighbors.some((n) => hot(numbers[n])))
    if (!clash) break
  }
  const ports = shuffle(PORT_BAG)
  return {
    tiles: GEO.hexes.map((h) => ({ res: terrain[h.id], num: numbers[h.id] })),
    ports: GEO.portSlots.map((slot, i) => ({ ...slot, type: ports[i] })),
    hacker: terrain.indexOf('desert'),
  }
}

export const TOKENS = ['🚀', '🐋', '🦍', '💎', '🌕', '🐸', '🐂', '🐻']
export const PLAYER_COLORS = ['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)']
export const DEFAULT_NAMES = ['Satoshi', 'Vitalik', 'Degen', 'Whale']

export const bagSize = (bag) => RESOURCES.reduce((t, r) => t + (bag[r] ?? 0), 0)
