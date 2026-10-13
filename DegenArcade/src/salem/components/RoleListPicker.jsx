import { ROLES, ROLE_KEYS, MODES, SLOTS, FACTIONS, slotFaction } from '../roles.js'
import { t, N } from '../../i18n/index.js'

const SLOT_COLORS = { town: FACTIONS.town.color, cabal: FACTIONS.cabal.color, neutral: FACTIONS.neutral.color, any: 'var(--gold)' }
const SLOT_OPTIONS = [
  ['categories', Object.keys(SLOTS)],
  ['town', ROLE_KEYS.filter((k) => ROLES[k].faction === 'town')],
  ['cabal', ROLE_KEYS.filter((k) => ROLES[k].faction === 'cabal')],
  ['neutral', ROLE_KEYS.filter((k) => ROLES[k].faction === 'neutral')],
]

// Game mode tabs plus the role list, editable slot by slot in Custom mode.
export default function RoleListPicker({ mode, custom, onMode, onCustom, readOnly = false }) {
  const list = mode === 'custom' ? custom : MODES[mode].list
  const editable = mode === 'custom' && !readOnly
  return (
    <>
      <div className="tabs">
        {Object.keys(MODES).map((id) => (
          <button key={id} className={`tab ${mode === id ? 'on' : ''}`} style={{ '--c': 'var(--violet)' }} disabled={readOnly && mode !== id} onClick={() => onMode(id)}>
            {N.mode(id)}
          </button>
        ))}
      </div>
      <p className="muted small">{N.modeBlurb(mode)}</p>
      <ul className="ts-rolelist ts-setup-list">
        {list.map((slot, i) => (
          <li key={i}>
            {editable ? (
              <div className="ts-slot-edit" style={{ '--sc': SLOT_COLORS[slotFaction(slot)] }}>
                <select value={slot} onChange={(e) => onCustom(custom.map((x, j) => (j === i ? e.target.value : x)))} aria-label={t('salem.slot', { n: i + 1 })}>
                  {SLOT_OPTIONS.map(([group, keys]) => (
                    <optgroup key={group} label={group === 'categories' ? t('salem.categories') : N.faction(group)}>
                      {keys.map((k) => (
                        <option key={k} value={k}>
                          {ROLES[k] ? `${ROLES[k].icon} ${N.role(k)} (${N.roleClassic(k)})` : N.slot(k)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button className="icon-btn" disabled={custom.length <= 7} onClick={() => onCustom(custom.filter((_, j) => j !== i))} title={t('salem.removeSlot')}>
                  ✕
                </button>
              </div>
            ) : (
              <span className="ts-slot" style={{ '--sc': SLOT_COLORS[slotFaction(slot)] }}>
                {ROLES[slot] ? `${ROLES[slot].icon} ${N.role(slot)}` : N.slot(slot)}
                {ROLES[slot] && <span className="muted"> · {N.roleClassic(slot)}</span>}
              </span>
            )}
          </li>
        ))}
      </ul>
      {editable && custom.length < 15 && (
        <button className="btn ghost wide" onClick={() => onCustom([...custom, 'RT'])}>
          {t('salem.addSlot')}
        </button>
      )}
    </>
  )
}
