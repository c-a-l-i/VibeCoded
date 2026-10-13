import { BOARD, RAIL_RENT, houseCost, mortgageValue, spaceVars } from '../data/board.js'
import { t, look, N, money } from '../i18n/index.js'
import Modal from './Modal.jsx'

export function DeedCard({ state, id, compact }) {
  const sp = BOARD[id]
  const pr = state.props[id]
  const owner = pr && pr.owner !== null ? state.players[pr.owner] : null

  let rows = []
  if (sp.type === 'street') rows = sp.rent.map((r, i) => [look('mono.rent')[i], money(r), pr.houses === i && owner])
  if (sp.type === 'rail') rows = RAIL_RENT.map((r, i) => [t('mono.railsOwned', { n: i + 1 }), money(r)])
  if (sp.type === 'utility')
    rows = [
      [t('mono.oneUtility'), t('mono.timesDice', { n: 4 })],
      [t('mono.bothUtilities'), t('mono.timesDice', { n: 10 })],
    ]

  return (
    <div className={`deed ${compact ? 'compact' : ''} ${pr?.mortgaged ? 'mortgaged' : ''}`} style={spaceVars(id)}>
      <div className="deed-head">
        <span className="eyebrow">
          {sp.type === 'street' ? t('mono.titleDeed', { grp: N.group(sp.group) }) : sp.type === 'rail' ? t('mono.network') : t('mono.utility')}
        </span>
        <strong>
          {sp.icon ? `${sp.icon} ` : ''}
          {N.space(id)}
        </strong>
      </div>
      <table className="deed-table">
        <tbody>
          {rows.map(([label, val, active]) => (
            <tr key={label} className={active ? 'active' : ''}>
              <td>{label}</td>
              <td className="mono">{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!compact && (
        <div className="deed-foot">
          {sp.type === 'street' && <p>{t('mono.setDoubles')}</p>}
          <div className="deed-meta">
            <span>
              {t('mono.price')} <b className="mono">{money(sp.price)}</b>
            </span>
            {sp.type === 'street' && (
              <span>
                {t('mono.nodeCost')} <b className="mono">{money(houseCost(id))}</b>
              </span>
            )}
            <span>
              {t('mono.mortgage')} <b className="mono">{money(mortgageValue(id))}</b>
            </span>
          </div>
        </div>
      )}
      <div className="deed-owner">
        {owner ? (
          <span style={{ color: owner.color }}>
            {t('mono.ownedTag', { token: owner.token, p: owner.name })}
            {pr.mortgaged ? t('mono.mortgagedTail') : ''}
          </span>
        ) : (
          <span className="muted">{t('mono.unowned', { m: money(sp.price) })}</span>
        )}
      </div>
    </div>
  )
}

function info(sp) {
  if (sp.type === 'tax') return t('mono.info.tax', { m: money(sp.amount) })
  if (sp.type === 'chance' || sp.type === 'chest') return t('mono.info.draw', { deck: N.deck(sp.type) })
  return t(`mono.info.${sp.type}`)
}

export default function DeedModal({ state, id, onClose }) {
  const sp = BOARD[id]
  const here = state.players.filter((p) => !p.bankrupt && p.pos === id)
  return (
    <Modal title={N.space(id)} onClose={onClose}>
      {sp.price ? (
        <DeedCard state={state} id={id} />
      ) : (
        <div className="info-space">
          <div className="info-icon">{sp.icon}</div>
          <p>{info(sp)}</p>
        </div>
      )}
      {here.length > 0 && (
        <p className="muted small center-text">{t('mono.hereNow', { list: here.map((p) => `${p.token} ${p.name}`).join(', ') })}</p>
      )}
    </Modal>
  )
}
