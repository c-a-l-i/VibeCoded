import { useState } from 'react'
import { ROLES, ROLE_KEYS } from '../roles.js'
import { nightInfo, living, fullMoon } from '../rules.js'
import { willFor } from '../ai.js'
import { factionColor } from '../view.js'
import { msgText, whyText, lineText } from '../text.js'
import { t, tx, look, N } from '../../i18n/index.js'
import { RoleName, Who } from './bits.jsx'

// Limited-use abilities, labelled under salem.uses.
const USES = ['bullets', 'alerts', 'vests', 'vest', 'selfHeal', 'executions', 'cleans', 'forges', 'revive', 'remember', 'seance']
const KILLERS = new Set(['godfather', 'mafioso', 'serialKiller', 'arsonist', 'werewolf'])
const DAY_PHASES = ['day1', 'morning', 'discussion', 'voting', 'defense', 'judgement', 'verdict', 'lastwords']

function Uses({ p }) {
  const list = Object.entries(p.uses).filter(([k]) => USES.includes(k))
  if (!list.length) return null
  return (
    <div className="ts-uses">
      {list.map(([k, n]) => (
        <span key={k} className={`chip ${n ? '' : 'spent'}`}>
          {t(`salem.uses.${k}`, { n })}
        </span>
      ))}
    </div>
  )
}

export function RoleCard({ role, p = null }) {
  const r = ROLES[role]
  return (
    <div className="ts-card" style={{ '--rc': factionColor(role) }}>
      <div className="ts-card-head">
        <span className="ts-card-icon">{r.icon}</span>
        <div>
          <strong>{N.role(role)}</strong>
          <span className="muted small"> = {N.roleClassic(role)}</span>
          <div className="ts-card-cat">{N.cat(r.cat)}</div>
        </div>
      </div>
      <p className="ts-card-ability">{N.ability(role)}</p>
      <ul className="ts-card-notes">
        {N.notes(role).map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <p className="small ts-card-goal">{tx('salem.goal', { goal: N.goal(role) })}</p>
      <div className="ts-card-stats small muted">
        <span>{t('salem.attack', { lvl: N.level(r.attack) })}</span>
        <span>{t('salem.defense', { lvl: r.defense === 3 ? t('salem.invincible') : N.level(r.defense) })}</span>
      </div>
      {p && <Uses p={p} />}
    </div>
  )
}

function Chips({ s, ids, sel, onPick }) {
  if (!ids.length) return <p className="muted small">{t('salem.noTargets')}</p>
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
  const verb = N.verb(p.role)

  let body
  if (p.role === 'jailor' && p.alive) {
    const j = s.jail?.jailor === pid ? s.jail : null
    body = j ? (
      <>
        <p>{tx('salem.inStorage', { p: <Who p={s.players[j.prisoner]} /> })}</p>
        {s.day < 2 ? (
          <p className="muted small">{t('salem.noExecN1')}</p>
        ) : p.uses.executions > 0 ? (
          <button className={`btn wide ${j.execute ? 'danger' : ''}`} onClick={() => act('EXECUTE', { on: !j.execute })}>
            {t(j.execute ? 'salem.liquidating' : 'salem.liquidateP', { p: s.players[j.prisoner].name })}
          </button>
        ) : (
          <p className="muted small">{t('salem.noExecLeft')}</p>
        )}
      </>
    ) : (
      <p className="muted small">{t('salem.noPrisoner')}</p>
    )
  } else if (!info.can) body = <p className="muted small">{whyText(s, info.reason)}</p>
  else if (info.slots === 0)
    body = (
      <button className={`btn wide ${cur ? 'primary' : ''}`} onClick={() => act('NIGHT', cur ? { clear: true } : { t: [] })}>
        {cur ? t('salem.doneTonight', { verb }) : verb}
      </button>
    )
  else if (info.slots === 1) {
    const sel = cur?.ignite ? [] : (cur?.t ?? [])
    body = (
      <>
        <p className="small muted">
          {p.role === 'jester' ? t('salem.hauntNote') : t('salem.verbColon', { verb })}
        </p>
        <Chips s={s} ids={info.targets[0]} sel={sel} onPick={(id) => act('NIGHT', sel[0] === id ? { clear: true } : { t: [id], forgeRole: cur?.forgeRole, forgeWill: cur?.forgeWill })} />
        {p.role === 'arsonist' && (
          <button className={`btn wide ${cur?.ignite ? 'danger' : ''}`} onClick={() => act('NIGHT', cur?.ignite ? { clear: true } : { t: [], ignite: true })}>
            {cur?.ignite ? t('salem.draining') : t('salem.drain')}
          </button>
        )}
        {p.role === 'forger' && cur?.t?.length > 0 && (
          <div className="ts-forge">
            <label className="field">
              {t('salem.spoofRole')}
              <select value={cur.forgeRole ?? 'jester'} onChange={(e) => act('NIGHT', { ...cur, forgeRole: e.target.value })}>
                {ROLE_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {ROLES[k].icon} {N.role(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('salem.spoofSwitch')}
              <textarea rows={3} defaultValue={cur.forgeWill ?? ''} onBlur={(e) => act('NIGHT', { ...cur, forgeWill: e.target.value })} />
            </label>
          </div>
        )}
      </>
    )
  } else {
    const sel = cur?.t ?? (first !== null ? [first] : [])
    const labels = look(`salem.pickTwo.${p.role === 'disguiser' || p.role === 'witch' ? p.role : 'transporter'}`)
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
        {fullMoon(s) ? '🌕' : '🌙'} {t('salem.night', { n: s.day })}
      </h3>
      {body}
      <button className={`btn wide ${done ? '' : 'primary'}`} onClick={() => onDone(!done)}>
        {done ? t('salem.waitingDawn') : t('salem.doneForNight')}
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
          {t('salem.seanceWith')}
          <select value={s.seancePick?.target ?? ''} onChange={(e) => act('SEANCE', { target: e.target.value === '' ? null : Number(e.target.value) })}>
            <option value="">{t('salem.nobody')}</option>
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
        {t('salem.youreDead')}
      </p>,
    )
    return <div className="ts-action">{out}</div>
  }
  if (s.phase === 'voting') {
    const v = s.votes[pid]
    out.push(
      <p key="vote" className="small">
        {t('salem.tapVote')}{' '}
        {v !== undefined && v !== null ? (
          <>
            {tx('salem.yourVote', { p: <Who p={s.players[v]} /> })}{' '}
            <button className="link" onClick={() => act('VOTE', { target: null })}>
              {t('salem.cancelVote')}
            </button>
          </>
        ) : (
          <span className="muted">{t('salem.noVote')}</span>
        )}
      </p>,
    )
  }
  if (s.phase === 'judgement' && s.trial.accused !== pid) {
    const v = s.judge[pid]
    out.push(
      <div key="judge" className="ts-judge">
        {['guilty', 'innocent', 'abstain'].map((k) => (
          <button key={k} className={`btn ${v === k ? 'primary' : ''}`} onClick={() => act('JUDGE', { verdict: k })}>
            {t(`salem.verdicts.${k}`)}
          </button>
        ))}
      </div>,
    )
  }
  if (['defense', 'lastwords'].includes(s.phase) && s.trial?.accused === pid)
    out.push(
      <p key="trial" className="notice neg">
        {t('salem.youOnTrial')}
      </p>,
    )
  if (p.role === 'jailor')
    out.push(
      <label key="jail" className="field">
        {t('salem.lockUp')}
        <select value={s.jailPick ?? ''} onChange={(e) => act('JAIL', { target: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">{t('salem.nobody')}</option>
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
      <button key="reveal" className="btn wide" onClick={() => confirm(t('salem.revealConfirm')) && act('REVEAL')}>
        {t('salem.revealWhale')}
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
        <h2>{t('salem.switch')}</h2>
        {!edit && (
          <button
            className="link"
            onClick={() => {
              setDraft(p.will)
              setEdit(true)
            }}
          >
            {t('salem.edit')}
          </button>
        )}
      </div>
      {edit ? (
        <>
          <textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('salem.willPlaceholder')} />
          <div className="row end">
            <button
              className="btn tiny ghost"
              onClick={() => setDraft(willFor(structuredClone(s), pid).tr.map((part) => msgText(s, part)).join('\n'))}
              title={t('salem.autofillTip')}
            >
              {t('salem.autofill')}
            </button>
            <button
              className="btn tiny primary"
              onClick={() => {
                act('WILL', { text: draft })
                setEdit(false)
              }}
            >
              {t('ui.save')}
            </button>
          </div>
        </>
      ) : (
        <pre className={`ts-will-text ${p.will ? '' : 'muted'}`}>{p.will || t('salem.willEmpty')}</pre>
      )}
      {KILLERS.has(p.role) && (
        <label className="field small">
          {t('salem.cardField')}
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
      <h2>{t('salem.nightResults', { n: night })}</h2>
      <ul>
        {msgs.map((m) => (
          <li key={m.id} className={m.tone ?? ''}>
            {lineText(s, m)}
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
        <h2>{t('salem.spectatingTitle')}</h2>
        <p className="muted small">{t('salem.spectatingNote')}</p>
      </aside>
    )
  if (me === null && online)
    return (
      <aside className="panel ts-you">
        <h2>{t('salem.watchingTitle')}</h2>
        <p className="muted small">{t('salem.watchingNote')}</p>
      </aside>
    )
  if (me === null) {
    const humans = s.players.filter((p) => !p.isAI)
    return (
      <aside className="panel ts-you">
        <h2>{t('salem.privateTitle')}</h2>
        <p className="muted small">{t('salem.privateNote')}</p>
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
            {t('salem.hide')}
          </button>
        )}
      </div>
      <RoleCard role={p.role} p={p} />
      {p.role === 'executioner' && p.target !== null && (
        <p className="notice small">{tx(p.won ? 'salem.targetWon' : 'salem.yourTarget', { p: <Who p={s.players[p.target]} /> })}</p>
      )}
      {p.won && p.role === 'jester' && <p className="notice small">{t('salem.jesterWon')}</p>}
      {isNight && <NightAction key={`${s.day}:${p.role}`} s={s} pid={me} act={act} onDone={onDone} />}
      {DAY_PHASES.includes(s.phase) && <DayAction s={s} pid={me} act={act} />}
      {DAY_PHASES.includes(s.phase) && p.alive && (
        <button className={`btn wide ${s.ready[me] ? '' : 'ghost'}`} onClick={() => act('READY', { on: !s.ready[me] })} title={t('salem.readyTip')}>
          {s.ready[me] ? t('salem.readyOn') : t('salem.readyOff')}
        </button>
      )}
      <LastNight s={s} pid={me} />
      <Will key={me} s={s} pid={me} act={act} />
      {!p.alive && <RoleName role={p.role} />}
    </aside>
  )
}
