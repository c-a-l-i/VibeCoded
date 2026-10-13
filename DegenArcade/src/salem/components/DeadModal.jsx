import Modal from '../../components/Modal.jsx'
import { grave, deathLine } from '../rules.js'
import { msgText, willText, cardText } from '../text.js'
import { t } from '../../i18n/index.js'
import { RoleName } from './bits.jsx'

export default function DeadModal({ state: s, pid, onClose }) {
  const g = grave(s, pid)
  const p = s.players[pid]
  const will = g ? willText(s, g) : ''
  return (
    <Modal title={`🪦 ${p.name}`} onClose={onClose}>
      {g ? (
        <>
          <p>
            {msgText(s, deathLine(g))} <span className="muted">{t(g.when === 'day' ? 'salem.diedDay' : 'salem.diedNight', { n: g.day })}</span>
          </p>
          <RoleName role={g.role ?? 'cleaned'} />
          <div className="ts-will">
            <h2>{t('salem.switch')}</h2>
            <pre className={`ts-will-text ${will ? '' : 'muted'}`}>{g.cleaned ? t('salem.launderedNothing') : will || t('salem.leftNothing')}</pre>
          </div>
          {g.cards.map((c) => (
            <p key={JSON.stringify(c)} className="ts-card-snip">
              {t('salem.callingCard', { c: cardText(s, c) })}
            </p>
          ))}
        </>
      ) : (
        <p className="muted">{t('salem.notDead')}</p>
      )}
    </Modal>
  )
}
