import { useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from './Modal.jsx'
import { GROUPS, groupVars } from '../data/board.js'
import { VISION, useDisplay, setDisplay } from '../display.js'

const SWATCHES = ['--p1', '--p2', '--p3', '--p4', '--p5', '--p6']

function DisplayModal({ onClose }) {
  const { cvd, cues } = useDisplay()
  // Picking a color-blind palette also turns on shape cues; they can be switched off separately.
  const pick = (id) => setDisplay(id !== 'std' && cvd === 'std' ? { cvd: id, cues: true } : { cvd: id })

  return (
    <Modal title="Display" onClose={onClose}>
      <section className="ds-section">
        <h3 className="eyebrow">Color vision</h3>
        <div className="ds-modes" role="radiogroup" aria-label="Color vision">
          {VISION.map((m) => (
            <button key={m.id} role="radio" aria-checked={cvd === m.id} className={`ds-mode ${cvd === m.id ? 'on' : ''}`} onClick={() => pick(m.id)}>
              <span className="ds-mode-text">
                <b>{m.name}</b>
                <span className="muted small">{m.note}</span>
              </span>
              {/* Each preview renders in its own palette, whatever the current mode is. */}
              <span className="ds-swatches" data-cvd={m.id} aria-hidden="true">
                {SWATCHES.map((v) => (
                  <i key={v} style={{ background: `var(${v})` }} />
                ))}
                <i className="ds-pair" style={{ background: 'var(--good)' }} />
                <i style={{ background: 'var(--bad)' }} />
              </span>
            </button>
          ))}
        </div>
        <p className="hint">Player, property-set and resource colors are re-picked so they stay distinct for that type of color vision. Good/bad colors (the last pair) change too.</p>
      </section>

      <section className="ds-section">
        <label className="ds-toggle">
          <input type="checkbox" checked={cues} onChange={(e) => setDisplay({ cues: e.target.checked })} />
          <span>
            <b>Shape cues</b>
            <span className="muted small">Patterns on Cryptopoly sets, owner tokens on owned spaces, and line styles plus tokens on Settlers pieces.</span>
          </span>
        </label>
        <div className="ds-legend" aria-hidden="true">
          {Object.entries(GROUPS).map(([k, g]) => (
            <span key={k} className="ds-legend-item">
              <i className="pat" style={{ ...groupVars(k), backgroundColor: 'var(--group)' }} />
              {g.name}
            </span>
          ))}
        </div>
      </section>
    </Modal>
  )
}

// Opens the Display settings. `icon` renders a compact button for toolbars.
export default function DisplayButton({ className = '', icon = false }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className={`btn ghost ${icon ? 'ds-icon' : ''} ${className}`} onClick={() => setOpen(true)} title="Display & color-blind settings" aria-label="Display settings">
        🎨{icon ? '' : ' Display'}
      </button>
      {/* Portaled to <body>: toolbars sit inside blurred panels, which would otherwise trap the fixed modal under later panels. */}
      {open && createPortal(<DisplayModal onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
