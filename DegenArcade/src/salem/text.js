// Town of Solana's engine messages and chat lines, rendered in the viewer's language.
import { fmt, fmtParts } from '../i18n/index.js'

const ctx = (s) => ({ ns: 'salem.msg', players: s.players })

// One engine message ({ k, v }) as text.
export const msgText = (s, m) => fmt(m, ctx(s))
// A chat line: message parts (bots and quick-chat), an engine message, or a player's own text.
export const lineText = (s, m) => (m.tr ? fmtParts(m.tr, ctx(s)) : m.k ? fmt(m, ctx(s)) : (m.text ?? ''))
// A dead man's switch: a bot's message lines, or a player's own text.
export const willText = (s, x) => (x.willTr ? x.willTr.map((p) => fmt(p, ctx(s))).join('\n') : (x.will ?? ''))
// A calling card: a player's text, or a bot's line from its pool.
export const cardText = (s, c) => (typeof c === 'string' ? c : fmt(c, ctx(s)))
// Why a night ability can't be used.
export const whyText = (s, reason) => fmt(reason, { ns: 'salem.why', players: s.players })
