import Modal from '../../components/Modal.jsx'
import { grave, deathLine } from '../rules.js'
import { RoleName } from './bits.jsx'

export default function DeadModal({ state: s, pid, onClose }) {
  const g = grave(s, pid)
  const p = s.players[pid]
  return (
    <Modal title={`🪦 ${p.name}`} onClose={onClose}>
      {g ? (
        <>
          <p>
            {deathLine(s, g)} <span className="muted">({g.when === 'day' ? `Day ${g.day}` : `Night ${g.day}`})</span>
          </p>
          <RoleName role={g.role ?? 'cleaned'} />
          <div className="ts-will">
            <h2>📜 Dead man’s switch</h2>
            <pre className={`ts-will-text ${g.will ? '' : 'muted'}`}>{g.cleaned ? 'Laundered — nothing left to read.' : g.will || 'They left nothing behind.'}</pre>
          </div>
          {g.cards.map((c) => (
            <p key={c} className="ts-card-snip">
              🃏 Calling card: “{c}”
            </p>
          ))}
        </>
      ) : (
        <p className="muted">They’re not dead (anymore).</p>
      )}
    </Modal>
  )
}
