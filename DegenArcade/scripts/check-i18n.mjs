// Checks every translation against English (src/i18n/en.js): missing or extra keys, {placeholders} that don't
// match, and game data (board spaces, cards, roles…) that isn't fully translated. Run with `npm run i18n`.
// Exits with an error if anything is off, so a new string or a new game can't ship half-translated.
import en from '../src/i18n/en.js'
import { BOARD, GROUPS } from '../src/data/board.js'
import { DECKS } from '../src/data/cards.js'
import { RES, TERRAIN, DEV } from '../src/catan/data.js'
import { ROLES, CATS, FACTIONS, LEVELS, TEAM_NAMES, SLOTS, MODES, TERMS } from '../src/salem/roles.js'
import { CAUSES } from '../src/salem/rules.js'
import { PACES } from '../src/salem/engine.js'

const LANGS = ['es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko']
// Arrays whose entries line up one to one with English (everything else that's an array is a line pool).
const FIXED = /(^|\.)(chips|rent|legend|corners\.\w+|modes\.\w+|pickTwo\.\w+)$/

const placeholders = (x) => new Set([...String(x).matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
// Plural functions are sampled with a singular and a plural count.
const sample = (x) => (typeof x === 'function' ? `${x({ n: 1, k: 1 })} ${x({ n: 2, k: 2 })}` : x)
const same = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))

function compare(e, l, path, problems) {
  if (l === undefined) return problems.push(`missing ${path}`)
  if (Array.isArray(e)) {
    if (!Array.isArray(l)) return problems.push(`not a list: ${path}`)
    if (FIXED.test(path)) {
      if (e.length !== l.length) problems.push(`${path} has ${l.length} entries, English has ${e.length}`)
      return e.forEach((x, i) => compare(x, l[i], `${path}.${i}`, problems))
    }
    const allowed = new Set(e.flatMap((x) => [...placeholders(x)]))
    l.forEach((x, i) => [...placeholders(x)].forEach((p) => allowed.has(p) || problems.push(`unknown {${p}} in ${path}.${i}`)))
    return
  }
  if (e && typeof e === 'object') {
    for (const k of Object.keys(e)) compare(e[k], l?.[k], path ? `${path}.${k}` : k, problems)
    for (const k of Object.keys(l ?? {})) if (!(k in e) && !(path === '' && k === 'data')) problems.push(`extra ${path}.${k}`)
    return
  }
  const a = placeholders(sample(e))
  const b = placeholders(sample(l))
  if (!same(a, b)) problems.push(`${path} uses {${[...b]}}, English uses {${[...a]}}`)
}

function checkData(d = {}, problems) {
  const need = (ok, what) => ok || problems.push(`untranslated data.${what}`)
  need(d.mono?.spaces?.length === BOARD.length, 'mono.spaces')
  for (const g of Object.keys(GROUPS)) need(d.mono?.groups?.[g], `mono.groups.${g}`)
  for (const k of Object.keys(DECKS)) {
    need(d.mono?.decks?.[k], `mono.decks.${k}`)
    need(d.mono?.cards?.[k]?.length === DECKS[k].cards.length, `mono.cards.${k}`)
  }
  for (const r of Object.keys(RES)) need(d.catan?.res?.[r]?.name && d.catan.res[r].classic, `catan.res.${r}`)
  for (const k of Object.keys(TERRAIN)) need(d.catan?.terrain?.[k], `catan.terrain.${k}`)
  for (const k of Object.keys(DEV)) need(d.catan?.dev?.[k]?.name && d.catan.dev[k].classic && d.catan.dev[k].text, `catan.dev.${k}`)
  for (const [k, r] of Object.entries(ROLES)) {
    const x = d.salem?.roles?.[k]
    need(x?.name && x.classic && x.ability, `salem.roles.${k}`)
    need(x?.notes?.length === r.notes.length, `salem.roles.${k}.notes`)
    need(!r.goal || x?.goal, `salem.roles.${k}.goal`)
    need(!r.act?.verb || x?.verb, `salem.roles.${k}.verb`)
  }
  for (const k of Object.keys(CATS)) need(d.salem?.cats?.[k], `salem.cats.${k}`)
  for (const k of Object.keys(FACTIONS)) need(d.salem?.factions?.[k], `salem.factions.${k}`)
  for (const k of ['town', 'cabal']) need(d.salem?.goals?.[k], `salem.goals.${k}`)
  need(d.salem?.levels?.length === LEVELS.length, 'salem.levels')
  for (const k of Object.keys(TEAM_NAMES)) need(d.salem?.teams?.[k], `salem.teams.${k}`)
  for (const k of Object.keys(SLOTS)) need(d.salem?.slots?.[k], `salem.slots.${k}`)
  for (const k of Object.keys(MODES)) need(d.salem?.modes?.[k]?.name && d.salem.modes[k].blurb, `salem.modes.${k}`)
  need(d.salem?.terms?.length === TERMS.length, 'salem.terms')
  for (const k of Object.keys(CAUSES)) need(d.salem?.causes?.[k], `salem.causes.${k}`)
  for (const k of Object.keys(PACES)) need(d.salem?.paces?.[k], `salem.paces.${k}`)
}

let failed = false
for (const lang of LANGS) {
  const dict = (await import(`../src/i18n/${lang}.js`)).default
  const problems = []
  compare(en, dict, '', problems)
  checkData(dict.data, problems)
  if (problems.length) failed = true
  console.log(problems.length ? `${lang}: ${problems.length} problems\n  ${problems.join('\n  ')}` : `${lang}: complete`)
}
process.exit(failed ? 1 : 0)
