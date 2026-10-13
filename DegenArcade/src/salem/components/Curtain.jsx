import { t } from '../../i18n/index.js'

// Hot-seat privacy screen: hides everything until the right person has the device.
export default function Curtain({ state, pid, onReveal, onCancel }) {
  const p = state.players[pid]
  return (
    <div className="ts-curtain">
      <div className="ts-curtain-card" style={{ '--c': p.color }}>
        <div className="ts-curtain-avatar">{p.avatar}</div>
        <span className="eyebrow">{state.phase === 'night' ? t('salem.night', { n: state.day }) : t('salem.privateView')}</span>
        <h1>{t('salem.passTo', { p: p.name })}</h1>
        <p className="muted">{t('salem.lookAway')}</p>
        <button className="btn primary big" onClick={onReveal}>
          {t('salem.showMe', { p: p.name })}
        </button>
        {state.phase !== 'night' && (
          <button className="btn ghost" onClick={onCancel}>
            {t('ui.cancel')}
          </button>
        )}
      </div>
    </div>
  )
}
