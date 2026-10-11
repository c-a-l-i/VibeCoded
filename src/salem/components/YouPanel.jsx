import { useState } from 'react'
import { ROLES, CATS, FACTIONS, LEVELS, ROLE_KEYS } from '../roles.js'
import { nightInfo, living, fullMoon } from '../rules.js'
import { willFor } from '../ai.js'
import { factionColor } from '../view.js'
import { RoleName, Who } from './bits.jsx'

const USES = {
  bullets: ['🔫', 'bullet', 'bullets'],
  alerts: ['🍯', 'honeypot left', 'honeypots left'],
  vests: ['🧊', 'cold wallet', 'cold wallets'],
  vest: ['🛡️', 'self-guard', 'self-guards'],
  selfHeal: ['🩹', 'self-patch', 'self-patches'],
  executions: ['⚖️', 'liquidation', 'liquidations'],
  cleans: ['🧼', 'launder', 'launders'],
  forges: ['✍️', 'spoof', 'spoofs'],
  revive: ['🍴', 'revive', 'revives'],
  remember: ['📋', 'copy', 'copies'],
  seance: ['🔮', 'séance', 'séances'],
}
const KILLERS = new Set(['godfather', 'mafioso', 'serialKiller', 'arsonist', 'werewolf'])
const DAY_PHASES = ['day1', 'morning', 'discussion', 'voting', 'defense', 'judgement', 'verdict', 'lastwords']

function Uses({ p }) {
  const list = Object.entries(p.uses).filter(([k]) => USES[k])
  if (!list.length) return null
  return (
    <div className="ts-uses">
      {list.map(([k, n]) => (
        <span key={k} className={`chip ${n ? '' : 'spent'}`}>
          {USES[k][0]} {n} {n === 1 ? USES[k][1] : USES[k][2]}
        </span>
      ))}
    </div>
  )
}

export function RoleCard({ role, p = null }) {
  const r = ROLES[role]
  const cat = CATS[r.cat]
  return (
    <div className="ts-card" style={{ '--rc': factionColor(role) }}>
      <div className="ts-card-head">
        <span className="ts-card-icon">{r.icon}</span>
        <div>
          <strong>{r.name}</strong>
          <span className="muted small"> = {r.classic}</span>
          <div className="ts-card-cat">{cat.name}</div>
        </div>
      </div>
      <p className="ts-card-ability">{r.ability}</p>
      <ul className="ts-card-notes">
        {r.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <p className="small ts-card-goal">
        <b>Goal:</b> {r.goal ?? FACTIONS[r.faction].goal}
      </p>
      <div className="ts-card-stats small muted">
        <span>⚔️ Attack: {LEVELS[r.attack]}</span>
        <span>🛡️ Defense: {r.defense === 3 ? 'Invincible' : LEVELS[r.defense]}</span>
      </div>
      {p && <Uses p={p} />}
    </div>
  )
}

function Chips({ s, ids, sel, onPick }) {
  if (!ids.length) return <p className="muted small">No valid targets.</p>
  return (
    <div className="ts-targets">
      {ids.map((id) => {
        const p = s.players[id]
        return (
          <button key={id} className={`ts-target ${sel.includes(id) ? 'on' : ''}`} style={{ '--c': p.color }} onClick={() => onPick(id)}>
            <span className="mono">{p.num}</span> {p.name}
          </button>
        )
      })}
    </div>
  )
}

function NightAction({ s, pid, act, onDone }) {
  const p = s.players[pid]
  const info = nightInfo(s, pid)
  const cur = s.actions[pid]
  const [first, setFirst] = useState(null)
  const done = !!s.done[pid]
  const r = ROLES[p.role]

  let body
  if (p.role === 'jailor' && p.alive) {
    const j = s.jail?.jailor === pid ? s.jail : null
    body = j ? (
      <>
        <p>
          🧊 <Who p={s.players[j.prisoner]} /> is in Cold Storage. Question them in the chat.
        </p>
        {s.day < 2 ? (
          <p className="muted small">No liquidations on Night 1.</p>
        ) : p.uses.executions > 0 ? (
          <button className={`btn wide ${j.execute ? 'danger' : ''}`} onClick={() => act('EXECUTE', { on: !j.execute })}>
            {j.execute ? `⚖️ Liquidating ${s.players[j.prisoner].name} — tap to spare` : `⚖️ Liquidate ${s.players[j.prisoner].name}`}
          </button>
        ) : (
          <p className="muted small">You have no liquidations left.</p>
        )}
      </>
    ) : (
      <p className="muted small">You didn’t lock anyone up tonight. Pick a prisoner during the day.</p>
    )
  } else if (!info.can) body = <p className="muted small">{info.reason}</p>
  else if (info.slots === 0)
    body = (
      <button className={`btn wide ${cur ? 'primary' : ''}`} onClick={() => act('NIGHT', cur ? { clear: true } : { t: [] })}>
        {cur ? `✓ ${r.act.verb} tonight` : r.act.verb}
      </button>
    )
  else if (info.slots === 1) {
    const sel = cur?.ignite ? [] : (cur?.t ?? [])
    body = (
      <>
        <p className="small muted">
          {p.role === 'jester' ? 'Haunt one of the players who voted guilty or abstained.' : `${r.act.verb}:`}
        </p>
        <Chips s={s} ids={info.targets[0]} sel={sel} onPick={(id) => act('NIGHT', sel[0] === id ? { clear: true } : { t: [id], forgeRole: cur?.forgeRole, forgeWill: cur?.forgeWill })} />
        {p.role === 'arsonist' && (
          <button className={`btn wide ${cur?.ignite ? 'danger' : ''}`} onClick={() => act('NIGHT', cur?.ignite ? { clear: true } : { t: [], ignite: true })}>
            {cur?.ignite ? '🔥 Draining everyone tonight' : '🔥 Drain everyone you’ve approved'}
          </button>
        )}
        {p.role === 'forger' && cur?.t?.length > 0 && (
          <div className="ts-forge">
            <label className="field">
              Spoofed role
              <select value={cur.forgeRole ?? 'jester'} onChange={(e) => act('NIGHT', { ...cur, forgeRole: e.target.value })}>
                {ROLE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ROLES[k].icon} {ROLES[k].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Spoofed switch
              <textarea rows={3} defaultValue={cur.forgeWill ?? ''} onBlur={(e) => act('NIGHT', { ...cur, forgeWill: e.target.value })} />
            </label>
          </div>
        )}
      </>
    )
  } else {
    const sel = cur?.t ?? (first !== null ? [first] : [])
    const labels = p.role === 'disguiser' ? ['Cabal member', 'Disguise them as'] : p.role === 'witch' ? ['Phish', 'Make them target'] : ['Swap', 'with']
    const pickFirst = (id) => {
      setFirst(id)
      if (cur) act('NIGHT', { clear: true })
    }
    body = (
      <>
        <p className="small muted">{labels[0]}:</p>
        <Chips s={s} ids={info.targets[0]} sel={sel.slice(0, 1)} onPick={pickFirst} />
        <p className="small muted">{labels[1]}:</p>
        <Chips
          s={s}
          ids={info.targets[1].filter((id) => p.role !== 'transporter' || id !== sel[0])}
          sel={sel.slice(1)}
          onPick={(id) => sel[0] !== undefined && act('NIGHT', { t: [sel[0], id] })}
        />
      </>
    )
  }

  return (
    <div className="ts-action">
      <h3>
        {fullMoon(s) ? '🌕' : '🌙'} Night {s.day}
      </h3>
      {body}
      <button className={`btn wide ${done ? '' : 'primary'}`} onClick={() => onDone(!done)}>
        {done ? '✓ Done — waiting for dawn' : 'Done for tonight'}
      </button>
    </div>
  )
}

function DayAction({ s, pid, act }) {
  const p = s.players[pid]
  const out = []
  if (!p.alive) {
    if (p.role === 'medium' && p.uses.seance > 0)
      out.push(
        <label key="seance" className="field">
          🔮 Séance tonight with
          <select value={s.seancePick?.target ?? ''} onChange={(e) => act('SEANCE', { target: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">nobody</option>
            {living(s).map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>,
      )
    out.push(
      <p key="dead" className="muted small">
        You’re dead. You can still talk in the dead chat.
      </p>,
    )
    return <div className="ts-action">{out}</div>
  }
  if (s.phase === 'voting') {
    const v = s.votes[pid]
    out.push(
      <p key="vote" className="small">
        🗳️ Tap a house to vote.{' '}
        {v !== undefined && v !== null ? (
          <>
            Your vote: <Who p={s.players[v]} />{' '}
            <button className="link" onClick={() => act('VOTE', { target: null })}>
              cancel
            </button>
          </>
        ) : (
          <span className="muted">No vote yet.</span>
        )}
      </p>,
    )
  }
  if (s.phase === 'judgement' && s.trial.accused !== pid) {
    const v = s.judge[pid]
    out.push(
      <div key="judge" className="ts-judge">
        {[
          ['guilty', '🔨 Guilty'],
          ['innocent', '😇 Innocent'],
          ['abstain', '🤷 Abstain'],
        ].map(([k, label]) => (
          <button key={k} className={`btn ${v === k ? 'primary' : ''}`} onClick={() => act('JUDGE', { verdict: k })}>
            {label}
          </button>
        ))}
      </div>,
    )
  }
  if (['defense', 'lastwords'].includes(s.phase) && s.trial?.accused === pid)
    out.push(
      <p key="trial" className="notice neg">
        ⚖️ You’re on trial. Make your case in the chat!
      </p>,
    )
  if (p.role === 'jailor')
    out.push(
      <label key="jail" className="field">
        🧊 Lock up tonight
        <select value={s.jailPick ?? ''} onChange={(e) => act('JAIL', { target: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">nobody</option>
          {living(s)
            .filter((x) => x.id !== pid)
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.num}. {x.name}
              </option>
            ))}
        </select>
      </label>,
    )
  if (p.role === 'mayor' && !p.revealed)
    out.push(
      <button key="reveal" className="btn wide" onClick={() => confirm('Reveal yourself as the Whale? Your vote counts 3×, but Core Devs can’t patch you anymore.') && act('REVEAL')}>
        🐋 Reveal as the Whale
      </button>,
    )
  return out.length ? <div className="ts-action">{out}</div> : null
}

function Will({ s, pid, act }) {
  const p = s.players[pid]
  const [edit, setEdit] = useState(false)
  const [draft, setDraft] = useState(p.will)
  const [note, setNote] = useState(p.note)
  if (!p.alive) return null
  return (
    <div className="ts-will">
      <div className="panel-head">
        <h2>📜 Dead man’s switch</h2>
        {!edit && (
          <button
            className="link"
            onClick={() => {
              setDraft(p.will)
              setEdit(true)
            }}
          >
            edit
          </button>
        )}
      </div>
      {edit ? (
        <>
          <textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Your role and results. The town reads this when you die." />
          <div className="row end">
            <button className="btn tiny ghost" onClick={() => setDraft(willFor(structuredClone(s), pid).text)} title="Fill in your role and night results">
              ✨ Auto-fill
            </button>
            <button
              className="btn tiny primary"
              onClick={() => {
                act('WILL', { text: draft })
                setEdit(false)
              }}
            >
              Save
            </button>
          </div>
        </>
      ) : (
        <pre className={`ts-will-text ${p.will ? '' : 'muted'}`}>{p.will || 'Empty. Write your role and results so the town learns from your death.'}</pre>
      )}
      {KILLERS.has(p.role) && (
        <label className="field small">
          🃏 Calling card (left on your kills)
          <input value={note} maxLength={160} onChange={(e) => setNote(e.target.value)} onBlur={() => act('NOTE', { text: note })} />
        </label>
      )}
    </div>
  )
}

function LastNight({ s, pid }) {
  const night = s.day - 1
  const msgs = s.chat.filter((m) => m.room === 'private' && m.to === pid && m.night && m.day === night)
  if (night < 1 || !msgs.length) return null
  return (
    <div className="ts-results">
      <h2>Night {night} results</h2>
      <ul>
        {msgs.map((m) => (
          <li key={m.id} className={m.tone ?? ''}>
            {m.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function YouPanel({ state: s, me, act, multi, online, onReveal, onHide }) {
  if (me === 'all')
    return (
      <aside className="panel ts-you">
        <h2>👀 Spectating</h2>
        <p className="muted small">All bots. Every role and chat is visible.</p>
      </aside>
    )
  if (me === null && online)
    return (
      <aside className="panel ts-you">
        <h2>👀 Watching</h2>
        <p className="muted small">You don’t have a seat in this game. Roles and private chats stay hidden until it ends.</p>
      </aside>
    )
  if (me === null) {
    const humans = s.players.filter((p) => !p.isAI)
    return (
      <aside className="panel ts-you">
        <h2>🔒 Private views</h2>
        <p className="muted small">Roles stay hidden on the shared screen. Tap your name, then pass the device back when you’re done.</p>
        <div className="ts-hotseat">
          {humans.map((p) => (
            <button key={p.id} className="btn wide" style={{ '--c': p.color }} onClick={() => onReveal(p.id)} disabled={s.phase === 'gameover'}>
              <Who p={p} /> {!p.alive && '🪦'} {s.phase === 'night' && s.done[p.id] && '✓'}
            </button>
          ))}
        </div>
      </aside>
    )
  }
  const p = s.players[me]
  const isNight = s.phase === 'night'
  const onDone = (on) => {
    act('DONE', { on })
    if (on && multi) onHide()
  }
  return (
    <aside className="panel ts-you" style={{ '--c': p.color }}>
      <div className="panel-head">
        <h2>
          <Who p={p} /> {p.alive ? '' : '🪦'}
        </h2>
        {multi && (
          <button className="btn tiny ghost" onClick={onHide}>
            🙈 Hide
          </button>
        )}
      </div>
      <RoleCard role={p.role} p={p} />
      {p.role === 'executioner' && p.target !== null && (
        <p className="notice small">
          🎯 Your target: <Who p={s.players[p.target]} />
          {p.won ? ' — slashed. You win!' : ''}
        </p>
      )}
      {p.won && p.role === 'jester' && <p className="notice small">🤡 You got slashed. You win!</p>}
      {isNight && <NightAction key={`${s.day}:${p.role}`} s={s} pid={me} act={act} onDone={onDone} />}
      {DAY_PHASES.includes(s.phase) && <DayAction s={s} pid={me} act={act} />}
      {DAY_PHASES.includes(s.phase) && p.alive && (
        <button className={`btn wide ${s.ready[me] ? '' : 'ghost'}`} onClick={() => act('READY', { on: !s.ready[me] })} title="Skip the rest of this phase once every human is ready">
          {s.ready[me] ? '✓ Ready — waiting on others' : '⏭ Ready to move on'}
        </button>
      )}
      <LastNight s={s} pid={me} />
      <Will key={me} s={s} pid={me} act={act} />
      {!p.alive && <RoleName role={p.role} />}
    </aside>
  )
}
