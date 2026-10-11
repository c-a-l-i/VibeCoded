import { ROLES, ROLE_KEYS, MODES, SLOTS, FACTIONS, slotName, slotFaction } from '../roles.js'

const SLOT_COLORS = { town: FACTIONS.town.color, cabal: FACTIONS.cabal.color, neutral: FACTIONS.neutral.color, any: 'var(--gold)' }
const SLOT_OPTIONS = [
  ['Categories', Object.keys(SLOTS)],
  ['Town', ROLE_KEYS.filter((k) => ROLES[k].faction === 'town')],
  ['Cabal', ROLE_KEYS.filter((k) => ROLES[k].faction === 'cabal')],
  ['Neutral', ROLE_KEYS.filter((k) => ROLES[k].faction === 'neutral')],
]

// Game mode tabs plus the role list, editable slot by slot in Custom mode.
export default function RoleListPicker({ mode, custom, onMode, onCustom, readOnly = false }) {
  const list = mode === 'custom' ? custom : MODES[mode].list
  const editable = mode === 'custom' && !readOnly
  return (
    <>
      <div className="tabs">
        {Object.entries(MODES).map(([id, m]) => (
          <button key={id} className={`tab ${mode === id ? 'on' : ''}`} style={{ '--c': 'var(--violet)' }} disabled={readOnly && mode !== id} onClick={() => onMode(id)}>
            {m.name}
          </button>
        ))}
      </div>
      <p className="muted small">{MODES[mode].blurb}</p>
      <ul className="ts-rolelist ts-setup-list">
        {list.map((slot, i) => (
          <li key={i}>
            {editable ? (
              <div className="ts-slot-edit" style={{ '--sc': SLOT_COLORS[slotFaction(slot)] }}>
                <select value={slot} onChange={(e) => onCustom(custom.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Slot ${i + 1}`}>
                  {SLOT_OPTIONS.map(([label, keys]) => (
                    <optgroup key={label} label={label}>
                      {keys.map((k) => (
                        <option key={k} value={k}>
                          {ROLES[k] ? `${ROLES[k].icon} ${ROLES[k].name} (${ROLES[k].classic})` : slotName(k)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button className="icon-btn" disabled={custom.length <= 7} onClick={() => onCustom(custom.filter((_, j) => j !== i))} title="Remove slot">
                  ✕
                </button>
              </div>
            ) : (
              <span className="ts-slot" style={{ '--sc': SLOT_COLORS[slotFaction(slot)] }}>
                {ROLES[slot] ? `${ROLES[slot].icon} ${ROLES[slot].name}` : slotName(slot)}
                {ROLES[slot] && <span className="muted"> · {ROLES[slot].classic}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
      {editable && custom.length < 15 && (
        <button className="btn ghost wide" onClick={() => onCustom([...custom, 'RT'])}>
          + Add slot
        </button>
      )}
    </>
  )
}
