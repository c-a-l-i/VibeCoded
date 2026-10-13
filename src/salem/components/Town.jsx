import { tally, nightInfo, votesNeeded, grave, fullMoon } from '../rules.js'
import { knownRole } from '../view.js'
import { msgText, willText, cardText } from '../text.js'
import { t, tx, N } from '../../i18n/index.js'
import { RoleName, Who, Clock } from './bits.jsx'

// Seats spaced evenly by distance along the ring (equal angles would bunch them up at the narrow ends).
// Returns [x%, y%] for each seat on an ellipse inside the ring's 1.6:1 box, starting at the top.
const seatCache = {}
function seats(n) {
  if (seatCache[n]) return seatCache[n]
  const [rx, ry, aspect, steps] = [44, 41, 1.6, 720]
  const pts = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i / steps) * 2 * Math.PI - Math.PI / 2
    return [50 + rx * Math.cos(angle), 50 + ry * Math.sin(angle)]
  })
  const len = [0]
  for (let i = 1; i <= steps; i++) len.push(len[i - 1] + Math.hypot((pts[i][0] - pts[i - 1][0]) * aspect, pts[i][1] - pts[i - 1][1]))
  const total = len[steps]
  const out = []
  for (let k = 0, i = 0; k < n; k++) {
    while (len[i] < (k / n) * total) i++
    out.push(pts[i])
  }
  return (seatCache[n] = out)
}

// What clicking a house does for the acting human right now.
function clickMode(s, actor) {
  if (actor === null) return null
  const A = s.players[actor]
  if (s.phase === 'voting' && A.alive) return { kind: 'vote', ok: (id) => id !== actor && s.players[id].alive }
  if (s.phase === 'night' && !s.done[actor]) {
    const info = nightInfo(s, actor)
    if (info.can && info.slots === 1) return { kind: 'night', ok: (id) => info.targets[0].includes(id) }
  }
  return null
}

function Stage({ s }) {
  const left = s.dur - s.clock
  const P = s.players
  const acc = s.trial ? P[s.trial.accused] : null
  switch (s.phase) {
    case 'day1':
      return (
        <div className="ts-stage">
          <div className="ts-stage-icon">☀️</div>
          <strong>{t('salem.day', { n: 1 })}</strong>
          <p className="muted small">{t('salem.day1Note')}</p>
          <span className="ts-stage-clock">{tx('salem.nightIn', { t: <Clock ms={left} /> })}</span>
        </div>
      )
    case 'morning': {
      const deaths = s.morning?.deaths ?? []
      if (!deaths.length)
        return (
          <div className="ts-stage">
            <div className="ts-stage-icon">📈</div>
            <strong>{t('salem.day', { n: s.day })}</strong>
            <p className="muted small">{t('salem.quietNight')}</p>
            {(s.morning?.news ?? []).map((n) => (
              <p key={JSON.stringify(n)} className="small">
                {msgText(s, n)}
              </p>
            ))}
          </div>
        )
      const idx = Math.min(deaths.length - 1, Math.floor(s.clock / (s.dur / deaths.length)))
      const g = deaths[idx]
      const p = P[g.pid]
      const will = willText(s, g)
      return (
        <div className="ts-stage ts-death" key={g.pid}>
          <span className="eyebrow">{t('salem.foundDead', { n: s.day, i: idx + 1, k: deaths.length })}</span>
          <div className="ts-stage-icon">{p.avatar}</div>
          <strong>
            <Who p={p} />
          </strong>
          <p className="small">{msgText(s, { k: 'deathShort', v: { causes: g.causes } })}</p>
          <RoleName role={g.role ?? 'cleaned'} />
          {will && <pre className="ts-will-snip">{will.split('\n').slice(0, 4).join('\n')}</pre>}
          {g.cards.map((c) => (
            <p key={JSON.stringify(c)} className="ts-card-snip">
              🃏 “{cardText(s, c)}”
            </p>
          ))}
        </div>
      )
    }
    case 'discussion':
      return (
        <div className="ts-stage">
          <div className="ts-stage-icon">💬</div>
          <strong>{t('salem.discussion')}</strong>
          <p className="muted small">{t('salem.discussNote')}</p>
          <span className="ts-stage-clock">{tx('salem.votingIn', { t: <Clock ms={left} /> })}</span>
        </div>
      )
    case 'voting': {
      const votes = tally(s)
      const top = Object.entries(votes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
      const need = votesNeeded(s)
      return (
        <div className="ts-stage">
          <div className="ts-stage-icon">🗳️</div>
          <strong>{t('salem.voting')}</strong>
          <p className="muted small">{t('salem.votingNote', { n: need, k: s.trials + 1 })}</p>
          <div className="ts-tally">
            {top.map(([pid, n]) => (
              <div key={pid} className="ts-tally-row" style={{ '--c': P[pid].color }}>
                <span>{P[pid].name}</span>
                <span className="ts-tally-bar">
                  <span style={{ width: `${Math.min(100, (n / need) * 100)}%` }} />
                </span>
                <b className="mono">
                  {n}/{need}
                </b>
              </div>
            ))}
          </div>
          <span className="ts-stage-clock">{tx('salem.left', { t: <Clock ms={left} /> })}</span>
        </div>
      )
    }
    case 'defense':
    case 'judgement':
    case 'lastwords':
      return (
        <div className="ts-stage ts-trial">
          <span className="eyebrow">{t(s.phase === 'defense' ? 'salem.onTrial' : s.phase === 'judgement' ? 'salem.judgement' : 'salem.lastWords')}</span>
          <div className="ts-stage-icon">{acc.avatar}</div>
          <strong>
            <Who p={acc} />
          </strong>
          <p className="muted small">
            {s.phase === 'defense'
              ? t('salem.defendNote')
              : s.phase === 'judgement'
                ? t('salem.judgeNote', { n: Object.keys(s.judge).length })
                : t('salem.lastNote')}
          </p>
          <span className="ts-stage-clock">
            <Clock ms={left} />
          </span>
        </div>
      )
    case 'verdict':
      return (
        <div className={`ts-stage ts-verdict ${s.trial.convicted ? 'bad' : 'good'}`}>
          <div className="ts-stage-icon">{s.trial.convicted ? '🔨' : '😇'}</div>
          <strong>{t(s.trial.convicted ? 'salem.guiltyBig' : 'salem.innocentBig')}</strong>
          <p className="mono">
            {s.trial.g} – {s.trial.i}
          </p>
          <p className="muted small">{acc.name}</p>
        </div>
      )
    case 'night':
      return (
        <div className="ts-stage ts-moon">
          <div className="ts-stage-icon">{fullMoon(s) ? '🌕' : '🌙'}</div>
          <strong>{t('salem.night', { n: s.day })}</strong>
          <p className="muted small">{t(fullMoon(s) ? 'salem.moonNote' : 'salem.sleepNote')}</p>
          <span className="ts-stage-clock">{tx('salem.dawnIn', { t: <Clock ms={left} /> })}</span>
        </div>
      )
    default:
      return (
        <div className="ts-stage">
          <div className="ts-stage-icon">🏁</div>
          <strong>{t('salem.gameOver')}</strong>
        </div>
      )
  }
}

export default function Town({ state: s, me, view, act, onDead }) {
  const actor = typeof me === 'number' ? me : null
  const mode = clickMode(s, actor)
  const votes = s.phase === 'voting' ? tally(s) : {}
  const mine = actor !== null ? (s.phase === 'night' ? (s.actions[actor]?.t ?? []) : [s.votes[actor]]) : []
  const spots = seats(s.players.length)
  const V = actor !== null ? s.players[actor] : null

  const click = (p) => {
    if (!p.alive) return onDead(p.id)
    if (!mode?.ok(p.id)) return
    if (mode.kind === 'vote') act('VOTE', { target: s.votes[actor] === p.id ? null : p.id })
    else if (mine[0] === p.id) act('NIGHT', { clear: true })
    else act('NIGHT', { t: [p.id] })
  }

  return (
    <div className="panel ts-town">
      <div className="ts-ring">
        <Stage s={s} />
        {s.players.map((p, i) => {
          const [x, y] = spots[i]
          const role = knownRole(s, view, p.id)
          const claim = s.claims[p.id]?.role
          const ok = p.alive && mode?.ok(p.id)
          const jailed = s.jail?.prisoner === p.id && (view === 'all' || s.jail.jailor === actor || s.jail.prisoner === actor)
          const badges = []
          if (p.revealed) badges.push(['🐋', t('salem.badge.whale')])
          if (jailed) badges.push(['🧊', t('salem.badge.jailed')])
          if (V?.role === 'executioner' && V.target === p.id) badges.push(['🎯', t('salem.badge.target')])
          if ((V?.role === 'arsonist' || view === 'all') && s.doused[p.id] && p.alive) badges.push(['🕳️', t('salem.badge.doused')])
          if (s.phase === 'night' && V?.role === 'jailor' && s.jailPick === p.id) badges.push(['🧊', t('salem.badge.locking')])
          if (p.alive && s.blackmailed[p.id] === s.day && s.phase !== 'night') badges.push(['📸', t('salem.badge.blackmailed')])
          if (!p.isAI) badges.push(['👤', t('salem.badge.human')])
          return (
            <button
              key={p.id}
              className={[
                'ts-house',
                p.alive ? '' : 'dead',
                ok ? 'valid' : '',
                mine.includes(p.id) ? 'sel' : '',
                p.id === actor ? 'me' : '',
                s.trial?.accused === p.id && ['defense', 'judgement', 'verdict', 'lastwords'].includes(s.phase) ? 'trial' : '',
              ].join(' ')}
              style={{ '--x': `${x}%`, '--y': `${y}%`, '--c': p.color }}
              onClick={() => click(p)}
              title={p.alive ? (ok ? t(mode.kind === 'vote' ? 'salem.voteAgainst' : 'salem.targetP', { p: p.name }) : p.name) : t('salem.readSwitch', { p: p.name })}
            >
              <span className="ts-num mono">{p.num}</span>
              {votes[p.id] ? <span className="ts-votes mono">{votes[p.id]}</span> : null}
              <span className="ts-avatar">{p.alive ? p.avatar : '🪦'}</span>
              <span className="ts-name">
                {p.name}
                {p.id === actor && <span className="ts-me-tag">{t('salem.youTag')}</span>}
              </span>
              <span className="ts-tagline">
                {role ? (
                  <RoleName role={role} short />
                ) : claim ? (
                  <span className="muted">{t('salem.says', { role: N.role(claim) })}</span>
                ) : (
                  <span className="muted">?</span>
                )}
              </span>
              {badges.length > 0 && (
                <span className="ts-badges">
                  {badges.map(([b, title]) => (
                    <span key={title} title={title}>
                      {b}
                    </span>
                  ))}
                </span>
              )}
              {!p.alive && grave(s, p.id) && <span className="ts-dead-day mono">{grave(s, p.id).when === 'day' ? '⚖️ ' : '🔪 '}{t(grave(s, p.id).when === 'day' ? 'salem.dayShort' : 'salem.nightShort', { n: grave(s, p.id).day })}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
