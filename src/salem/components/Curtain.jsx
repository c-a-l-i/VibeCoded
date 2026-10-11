// Hot-seat privacy screen: hides everything until the right person has the device.
export default function Curtain({ state, pid, onReveal, onCancel }) {
  const p = state.players[pid]
  return (
    <div className="ts-curtain">
      <div className="ts-curtain-card" style={{ '--c': p.color }}>
        <div className="ts-curtain-avatar">{p.avatar}</div>
        <span className="eyebrow">{state.phase === 'night' ? `Night ${state.day}` : 'Private view'}</span>
        <h1>Pass the device to {p.name}</h1>
        <p className="muted">Everyone else, look away.</p>
        <button className="btn primary big" onClick={onReveal}>
          I’m {p.name} — show me
        </button>
        {state.phase !== 'night' && (
          <button className="btn ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
