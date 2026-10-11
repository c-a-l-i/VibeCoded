import { ROLES, slotName, slotFaction, FACTIONS, SLOTS } from '../roles.js'
import { CAUSES } from '../rules.js'
import { knownRole } from '../view.js'
import { RoleName, Who } from './bits.jsx'

const SLOT_COLORS = { town: FACTIONS.town.color, cabal: FACTIONS.cabal.color, neutral: FACTIONS.neutral.color, any: 'var(--gold)' }
const CAUSE_ICON = {
  cabal: '🔪', sk: '💀', vigi: '🎩', vh: '🗡️', vet: '🍯', bg: '🛡️', jail: '⚖️', arso: '🕳️', ww: '🌕', vamp: '🧛', haunt: '🤡', guilt: '😔', lynch: '🔨',
}

function Claims({ s }) {
  const rows = s.players.filter((p) => p.alive && s.claims[p.id])
  if (!rows.length) return <p className="muted small">Nobody has claimed yet.</p>
  // Highlight claims that can't all be true: two living players on a one-of-a-kind role.
  const count = {}
  for (const p of rows) count[s.claims[p.id].role] = (count[s.claims[p.id].role] ?? 0) + 1
  return (
    <ul className="ts-claims">
      {rows.map((p) => {
        const role = s.claims[p.id].role
        const clash = ROLES[role].unique && count[role] > 1
        return (
          <li key={p.id} className={clash ? 'clash' : ''}>
            <Who p={p} />
            <span>
              {p.revealed ? '🐋 ' : ''}
              <RoleName role={role} short />
              {clash && <span className="tag neg">CLASH</span>}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function Side({ state: s, view, onDead, onGuide }) {
  return (
    <aside className="ts-side">
      <div className="panel">
        <div className="panel-head">
          <h2>Role list</h2>
          <span className="muted small">{s.list.length} players</span>
        </div>
        <ul className="ts-rolelist">
          {s.list.map((slot, i) => (
            <li key={i}>
              <button
                className="ts-slot"
                style={{ '--sc': SLOT_COLORS[slotFaction(slot)] }}
                onClick={() => onGuide(ROLES[slot] ? slot : null)}
                title={ROLES[slot] ? `${ROLES[slot].name} = ${ROLES[slot].classic}` : SLOTS[slot].roles().map((r) => ROLES[r].name).join(', ')}
              >
                {ROLES[slot] ? `${ROLES[slot].icon} ` : ''}
                {slotName(slot)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>🔥 Burn Address</h2>
          <span className="muted small">{s.graveyard.length} dead</span>
        </div>
        {s.graveyard.length ? (
          <ul className="ts-grave">
            {s.graveyard.map((g) => {
              const p = s.players[g.pid]
              return (
                <li key={g.pid}>
                  <button onClick={() => onDead(g.pid)} title={g.causes.map((c) => CAUSES[c]).join(', ')}>
                    <span className="ts-grave-when mono">{g.when === 'day' ? `D${g.day}` : `N${g.day}`}</span>
                    <Who p={p} />
                    <span className="ts-grave-role">
                      <RoleName role={knownRole(s, view, g.pid) ?? 'cleaned'} short />
                    </span>
                    <span>{g.causes.map((c) => CAUSE_ICON[c]).join('')}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="muted small">Empty. For now.</p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>🪪 Claims</h2>
        </div>
        <Claims s={s} />
      </div>
    </aside>
  )
}
