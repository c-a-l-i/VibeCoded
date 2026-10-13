import { useEffect, useRef } from 'react'
import Modal from '../../components/Modal.jsx'
import { ROLES, ROLE_KEYS, CATS, FACTIONS } from '../roles.js'
import { t, N } from '../../i18n/index.js'
import { RoleCard } from './YouPanel.jsx'

export default function RoleGuide({ focus, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    if (focus) ref.current?.querySelector(`[data-role="${focus}"]`)?.scrollIntoView({ block: 'center' })
  }, [focus])
  return (
    <Modal title={t('salem.guideTitle')} onClose={onClose} wide>
      <div ref={ref} className="ts-guide">
        <p className="muted small">{t('salem.guideNote')}</p>
        <div className="ts-terms">
          {N.terms().map(([icon, name, classic]) => (
            <span key={icon} className="chip">
              {icon} <b>{name}</b> = {classic}
            </span>
          ))}
        </div>
        {Object.entries(CATS).map(([cat, c]) => (
          <section key={cat}>
            <h3 style={{ color: FACTIONS[c.faction].color }}>{N.cat(cat)}</h3>
            <div className="ts-guide-grid">
              {ROLE_KEYS.filter((k) => ROLES[k].cat === cat).map((k) => (
                <div key={k} data-role={k} className={focus === k ? 'ts-focus' : ''}>
                  <RoleCard role={k} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}
