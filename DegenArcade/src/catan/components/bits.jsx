import { RESOURCES, RES } from '../data.js'
import { t, tx, N } from '../../i18n/index.js'

export function Who({ p }) {
  return (
    <span className="who" style={{ '--c': p.color }}>
      <span className="who-token">{p.token}</span>
      {p.name}
    </span>
  )
}

export function Thinking({ p }) {
  return (
    <div className="thinking">
      {tx('ui.thinking', { p: <Who p={p} /> })}
      <span className="dots" />
    </div>
  )
}

export function Cost({ cost }) {
  return (
    <span className="st-cost">
      {RESOURCES.filter((r) => cost[r]).flatMap((r) =>
        Array.from({ length: cost[r] }, (_, i) => (
          <span key={r + i} title={N.res(r)}>
            {RES[r].icon}
          </span>
        )),
      )}
    </span>
  )
}

// A row of +/- pickers, one per resource. `max` caps each resource; `value` is a { res: n } bag.
export function ResPicker({ value, onChange, max, disabled = {} }) {
  const set = (r, n) => onChange({ ...value, [r]: n })
  return (
    <div className="st-picker">
      {RESOURCES.map((r) => {
        const n = value[r] ?? 0
        const cap = max ? max[r] : 99
        return (
          <div key={r} className={`st-pick ${n ? 'on' : ''}`} style={{ '--rc': RES[r].color }}>
            <span className="st-pick-icon" title={N.res(r)}>
              {RES[r].icon}
            </span>
            <span className="mono st-pick-n">{n}</span>
            <div className="st-pick-btns">
              <button className="icon-btn" disabled={n <= 0} onClick={() => set(r, n - 1)} aria-label={t('catan.less', { res: N.res(r) })}>
                −
              </button>
              <button className="icon-btn" disabled={n >= cap || disabled[r]} onClick={() => set(r, n + 1)} aria-label={t('catan.more', { res: N.res(r) })}>
                +
              </button>
            </div>
            {max && <span className="muted st-pick-max">/{cap}</span>}
          </div>
        )
      })}
    </div>
  )
}

