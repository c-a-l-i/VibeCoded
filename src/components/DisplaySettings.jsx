import { useState } from 'react'
import { createPortal } from 'react-dom'
import Modal from './Modal.jsx'
import { GROUPS, groupVars } from '../data/board.js'
import { VISION, useDisplay, setDisplay } from '../display.js'
import { t, look, N } from '../i18n/index.js'

const SWATCHES = ['--p1', '--p2', '--p3', '--p4', '--p5', '--p6']

function DisplayModal({ onClose }) {
  const { cvd, cues } = useDisplay()
  // Picking a color-blind palette also turns on shape cues; they can be switched off separately.
  const pick = (id) => setDisplay(id !== 'std' && cvd === 'std' ? { cvd: id, cues: true } : { cvd: id })

  return (
    <Modal title={t('display.title')} onClose={onClose}>
      <section className="ds-section">
        <h3 className="eyebrow">{t('display.vision')}</h3>
        <div className="ds-modes" role="radiogroup" aria-label={t('display.vision')}>
          {VISION.map((m) => (
            <button key={m.id} role="radio" aria-checked={cvd === m.id} className={`ds-mode ${cvd === m.id ? 'on' : ''}`} onClick={() => pick(m.id)}>
              <span className="ds-mode-text">
                <b>{look(`display.modes.${m.id}`)[0]}</b>
                <span className="muted small">{look(`display.modes.${m.id}`)[1]}</span>
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
        <p className="hint">{t('display.visionHint')}</p>
      </section>

      <section className="ds-section">
        <label className="ds-toggle">
          <input type="checkbox" checked={cues} onChange={(e) => setDisplay({ cues: e.target.checked })} />
          <span>
            <b>{t('display.cues')}</b>
            <span className="muted small">{t('display.cuesNote')}</span>
          </span>
        </label>
        <div className="ds-legend" aria-hidden="true">
          {Object.keys(GROUPS).map((k) => (
            <span key={k} className="ds-legend-item">
              <i className="pat" style={{ ...groupVars(k), backgroundColor: 'var(--group)' }} />
              {N.group(k)}
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
      <button className={`btn ghost ${icon ? 'ds-icon' : ''} ${className}`} onClick={() => setOpen(true)} title={t('display.tip')} aria-label={t('display.tip')}>
        {icon ? '🎨' : t('display.button')}
      </button>
      {/* Portaled to <body>: toolbars sit inside blurred panels, which would otherwise trap the fixed modal under later panels. */}
      {open && createPortal(<DisplayModal onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}
