// Translations. Each language is a dictionary of nested keys; English (en.js) is the source and the fallback
// for anything a language leaves out. Names and rules text of the games themselves (board spaces, cards,
// resources, roles…) stay in each game's data files as the English source, and languages override them
// under `data.*`.
//
// The engines and the online server never build sentences. They record a message as a key plus params
// ({ k, v }), and each screen renders it in its own language, so friends in one online game can each read it
// in theirs.
import { createElement, Fragment, isValidElement, useSyncExternalStore } from 'react'
import en from './en.js'
import { BOARD, GROUPS } from '../data/board.js'
import { DECKS } from '../data/cards.js'
import { RES, TERRAIN, DEV } from '../catan/data.js'
import { ROLES, CATS, FACTIONS, LEVELS, TEAM_NAMES, SLOTS, MODES, TERMS, INV_GROUPS } from '../salem/roles.js'
import { CAUSES } from '../salem/rules.js'
import { PACES } from '../salem/engine.js'

// `html` is the <html lang> value, which also picks the right CJK glyphs.
export const LANGS = [
  { id: 'en', name: 'English', html: 'en' },
  { id: 'es', name: 'Español', html: 'es' },
  { id: 'fr', name: 'Français', html: 'fr' },
  { id: 'de', name: 'Deutsch', html: 'de' },
  { id: 'pt', name: 'Português', html: 'pt' },
  { id: 'zh', name: '简体中文', html: 'zh-Hans' },
  { id: 'ja', name: '日本語', html: 'ja' },
  { id: 'ko', name: '한국어', html: 'ko' },
]

// Every language but English loads on demand, so players only download their own.
const LOADERS = {
  es: () => import('./es.js'),
  fr: () => import('./fr.js'),
  de: () => import('./de.js'),
  pt: () => import('./pt.js'),
  zh: () => import('./zh.js'),
  ja: () => import('./ja.js'),
  ko: () => import('./ko.js'),
}

const KEY = 'degen-arcade-lang'
const dicts = { en }
const cache = { en: new Map() }
let lang = 'en'
const subs = new Set()

const known = (id) => LANGS.some((l) => l.id === id)

// The saved choice, else the browser's preferred languages (zh-TW and zh-HK still get Chinese).
function detect() {
  try {
    const saved = localStorage.getItem(KEY)
    if (known(saved)) return saved
  } catch {
    /* storage unavailable */
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const base = String(tag).toLowerCase().split('-')[0]
    if (known(base)) return base
  }
  return 'en'
}

async function load(id) {
  if (dicts[id] || !LOADERS[id]) return
  dicts[id] = (await LOADERS[id]()).default
  cache[id] = new Map()
}

function apply() {
  document.documentElement.lang = LANGS.find((l) => l.id === lang).html
}

// Call once before the first render so the page never flashes in the wrong language.
export async function initLang() {
  const id = detect()
  try {
    await load(id)
    lang = id
  } catch {
    lang = 'en'
  }
  apply()
}

export async function setLang(id) {
  if (!known(id)) return
  await load(id)
  lang = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* storage unavailable — the choice lasts until reload */
  }
  apply()
  subs.forEach((f) => f())
}

export const getLang = () => lang
export const useLang = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => lang,
  )

// ---------- lookup ----------

function walk(dict, path) {
  let x = dict
  for (const part of path.split('.')) {
    if (x === null || typeof x !== 'object') return undefined
    x = x[part]
  }
  return x
}

// The raw entry for a key in the current language, falling back to English.
export function look(key) {
  const c = cache[lang]
  if (c.has(key)) return c.get(key)
  let v = walk(dicts[lang], key)
  if (v === undefined && lang !== 'en') v = walk(en, key)
  c.set(key, v)
  return v
}

const isNode = (x) => isValidElement(x) || (Array.isArray(x) && x.some(isValidElement))
const fill = (tpl, v) => tpl.replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined || v[k] === null ? m : String(v[k])))

function template(key, v, i) {
  let e = look(key)
  if (Array.isArray(e)) e = e[(i ?? 0) % e.length]
  if (typeof e === 'function') e = e(v)
  return typeof e === 'string' ? e : key
}

// A plain string: for attributes, confirm() dialogs and anywhere React elements can't go.
// `**bold**` markers are dropped.
export function t(key, v = {}) {
  return fill(template(key, v), v).replace(/\*\*/g, '')
}

// A string or React nodes: params may be elements (<Who p={p} />), and `**bold**` renders in <b>.
export function tx(key, v = {}) {
  return rich(template(key, v), v)
}

function rich(tpl, v) {
  if (!tpl.includes('**') && !Object.values(v).some(isNode)) return fill(tpl, v)
  const out = []
  tpl.split(/(\*\*[^*]+\*\*)/).forEach((seg, i) => {
    if (!seg) return
    const bold = seg.startsWith('**') && seg.endsWith('**') && seg.length > 4
    const parts = (bold ? seg.slice(2, -2) : seg).split(/(\{\w+\})/).map((p, j) => {
      const m = /^\{(\w+)\}$/.exec(p)
      const val = m ? v[m[1]] : p
      return createElement(Fragment, { key: j }, val === undefined || val === null ? p : val)
    })
    out.push(bold ? createElement('b', { key: i }, parts) : createElement(Fragment, { key: i }, parts))
  })
  return out
}

// A list of items in this language: "A, B, C" (or "A、B、C").
export const list = (items) => items.join(look('sep') ?? ', ')
// "A, B and C".
export function and(items) {
  try {
    return new Intl.ListFormat(LANGS.find((l) => l.id === lang).html, { type: 'conjunction' }).format(items)
  } catch {
    return list(items)
  }
}

// ---------- game data, translated ----------

const data = (path, fallback) => look(`data.${path}`) ?? fallback

export const N = {
  // Cryptopoly
  space: (id) => data(`mono.spaces.${id}`, BOARD[id].name),
  group: (g) => data(`mono.groups.${g}`, GROUPS[g].name),
  deck: (k) => data(`mono.decks.${k}`, DECKS[k].name),
  card: (k, i) => data(`mono.cards.${k}.${i}`, DECKS[k].cards[i].text),
  // Settlers of Satoshi
  res: (r) => data(`catan.res.${r}.name`, RES[r].name),
  resClassic: (r) => data(`catan.res.${r}.classic`, RES[r].classic),
  terrain: (k) => data(`catan.terrain.${k}`, TERRAIN[k].name),
  dev: (k) => data(`catan.dev.${k}.name`, DEV[k].name),
  devClassic: (k) => data(`catan.dev.${k}.classic`, DEV[k].classic),
  devText: (k) => data(`catan.dev.${k}.text`, DEV[k].text),
  // Town of Solana
  role: (k) => data(`salem.roles.${k}.name`, ROLES[k].name),
  roleClassic: (k) => data(`salem.roles.${k}.classic`, ROLES[k].classic),
  ability: (k) => data(`salem.roles.${k}.ability`, ROLES[k].ability),
  notes: (k) => data(`salem.roles.${k}.notes`, ROLES[k].notes),
  goal: (k) => data(`salem.roles.${k}.goal`, ROLES[k].goal) ?? data(`salem.goals.${ROLES[k].faction}`, FACTIONS[ROLES[k].faction].goal),
  verb: (k) => data(`salem.roles.${k}.verb`, ROLES[k].act?.verb),
  cat: (k) => data(`salem.cats.${k}`, CATS[k].name),
  faction: (k) => data(`salem.factions.${k}`, FACTIONS[k].name),
  level: (i) => data(`salem.levels.${i}`, LEVELS[i]),
  team: (k) => data(`salem.teams.${k}`, TEAM_NAMES[k]),
  slot: (k) => (ROLES[k] ? N.role(k) : data(`salem.slots.${k}`, SLOTS[k].name)),
  mode: (k) => data(`salem.modes.${k}.name`, MODES[k].name),
  modeBlurb: (k) => data(`salem.modes.${k}.blurb`, MODES[k].blurb),
  terms: () => data('salem.terms', null)?.map((x, i) => [TERMS[i][0], ...x]) ?? TERMS,
  cause: (k) => data(`salem.causes.${k}`, CAUSES[k]),
  pace: (k) => data(`salem.paces.${k}`, PACES[k].name),
  inv: (g) => list(INV_GROUPS[g].map(N.role)),
}

// ---------- messages from the engines ----------

// Cryptopoly dollars in this language's style: $1,500 · 1 500 $ · 1.500 $.
export const money = (n) => t('money', { n: Number(n).toLocaleString(LANGS.find((l) => l.id === lang).html) })
// A turn timer length: "30 seconds", "2 min", or "Off" for none.
export const timerLength = (secs) =>
  !secs ? t('online.timerOff') : secs % 60 ? t('online.timerSec', { n: secs }) : t('online.timerMin', { n: secs / 60 })
const resBag = (bag) =>
  Object.keys(RES)
    .filter((r) => bag?.[r])
    .map((r) => `${bag[r]} ${RES[r].icon}`)
    .join(' ') || t('ui.nothing')

// How each named param turns into text, per game. Anything else is shown as is.
const name = (c, id) => c.players?.[id]?.name ?? '?'
const SHARED = {
  p: (x, c) => name(c, x),
  q: (x, c) => name(c, x),
  x: (x, c) => name(c, x),
  y: (x, c) => name(c, x),
  ps: (ids, c) => list(ids.map((id) => name(c, id))),
  m: money,
  m2: money,
}
const RESOLVE = {
  mono: {
    sp: (id) => N.space(id),
    grp: (g) => N.group(g),
    deck: (k) => N.deck(k),
    card: ([k, i]) => N.card(k, i),
  },
  catan: {
    res: (r) => N.res(r),
    ico: (r) => RES[r].icon,
    ico2: (r) => RES[r].icon,
    bag: resBag,
    bag2: resBag,
    dev: (k) => `${DEV[k].icon} ${N.dev(k)}`,
    icons: (rs) => rs.map((r) => RES[r].icon).join(' '),
  },
  salem: {
    role: (k) => N.role(k),
    role2: (k) => N.role(k),
    roleIcon: (k) => `${ROLES[k].icon} ${N.role(k)}`,
    ability: (k) => N.ability(k),
    team: (k) => N.team(k),
    inv: (g) => N.inv(g),
    causes: (cs) => and(cs.map(N.cause)),
    chain: (ids, c) => ids.map((id) => name(c, id)).join(' → '),
    // Trial voters, with a revealed Whale's vote marked ×3.
    guilty: (ids, c, raw) => voters(ids, c, raw),
    inno: (ids, c, raw) => voters(ids, c, raw),
    abst: (ids, c, raw) => voters(ids, c, raw),
  },
}
const voters = (ids, c, raw) => (ids.length ? list(ids.map((id) => name(c, id) + (raw.x3?.includes(id) ? ' (×3)' : ''))) : '—')

const isMsg = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && typeof x.k === 'string'

function params(v, c) {
  const out = {}
  const game = RESOLVE[c.ns.split('.')[0]] ?? {}
  for (const [k, x] of Object.entries(v ?? {})) {
    const r = game[k] ?? SHARED[k]
    if (isMsg(x)) out[k] = fmt(x, c)
    else if (Array.isArray(x) && x.length && x.every(isMsg)) out[k] = list(x.map((y) => fmt(y, c)))
    else if (r && x !== null && x !== undefined) out[k] = r(x, c, v)
    else out[k] = x
  }
  return out
}

// One engine message ({ k, v, i }) as text. `c` is { ns: 'mono.log', players }. Strings from older saves pass through.
export function fmt(m, c) {
  if (m === null || m === undefined) return ''
  if (typeof m === 'string') return m
  if (!isMsg(m)) return ''
  const v = params(m.v, c)
  return fill(template(`${c.ns}.${m.k}`, v, m.i), v).replace(/\*\*/g, '')
}

// A spoken line made of parts: the first part, then the rest joined with " · " (a claim followed by results).
export function fmtParts(parts, c) {
  const [head, ...rest] = parts.map((p) => fmt(p, c))
  return rest.length ? `${head} ${rest.join(' · ')}` : head
}

// ---------- trade summaries ----------

// One side of a Cryptopoly trade ("Rug Pull Row, $50, 1 free card") or a Settlers resource bag ("2 💾 1 🔌").
export const tradeSide = (x) =>
  list([...x.props.map(N.space), x.cash ? money(x.cash) : null, x.cards ? t('mono.freeCardsN', { n: x.cards }) : null].filter(Boolean)) ||
  t('ui.nothing')
export const bagText = resBag
