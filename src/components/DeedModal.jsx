import { BOARD, GROUPS, RAIL_RENT, houseCost, mortgageValue, spaceVars } from '../data/board.js'
import { DECKS } from '../data/cards.js'
import { money } from '../engine/game.js'
import Modal from './Modal.jsx'

const RENT_LABELS = ['Rent', 'With 1 node', 'With 2 nodes', 'With 3 nodes', 'With 4 nodes', 'With data center']

export function DeedCard({ state, id, compact }) {
  const sp = BOARD[id]
  const pr = state.props[id]
  const owner = pr && pr.owner !== null ? state.players[pr.owner] : null

  let rows = []
  if (sp.type === 'street') rows = sp.rent.map((r, i) => [RENT_LABELS[i], money(r), pr.houses === i && owner])
  if (sp.type === 'rail') rows = RAIL_RENT.map((r, i) => [`${i + 1} network${i ? 's' : ''} owned`, money(r)])
  if (sp.type === 'utility')
    rows = [
      ['1 mining utility', '4 × dice'],
      ['Both utilities', '10 × dice'],
    ]

  return (
    <div className={`deed ${compact ? 'compact' : ''} ${pr?.mortgaged ? 'mortgaged' : ''}`} style={spaceVars(id)}>
      <div className="deed-head">
        <span className="eyebrow">{sp.type === 'street' ? `${GROUPS[sp.group].name} · title deed` : sp.type === 'rail' ? 'Network' : 'Mining utility'}</span>
        <strong>
          {sp.icon ? `${sp.icon} ` : ''}
          {sp.name}
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
          {sp.type === 'street' && <p>Own the whole set and unbuilt rent doubles.</p>}
          <div className="deed-meta">
            <span>Price <b className="mono">{money(sp.price)}</b></span>
            {sp.type === 'street' && <span>Node cost <b className="mono">{money(houseCost(id))}</b></span>}
            <span>Mortgage <b className="mono">{money(mortgageValue(id))}</b></span>
          </div>
        </div>
      )}
      <div className="deed-owner">
        {owner ? (
          <span style={{ color: owner.color }}>
            {owner.token} Owned by {owner.name}
            {pr.mortgaged ? ' · mortgaged' : ''}
          </span>
        ) : (
          <span className="muted">Unowned · list price {money(sp.price)}</span>
        )}
      </div>
    </div>
  )
}

const INFO = {
  go: 'Collect $200 every time you pass or land on the Genesis Block.',
  jail: 'SEC Custody. If you are just visiting, relax. If you are in custody: roll doubles, post $50 bail, or use a Get Out of Custody Free card. After 3 failed attempts you must pay $50 and move.',
  parking: 'HODL Zone. Nothing happens here — just diamond hands.',
  gotojail: 'SEC Raid! Go directly to custody. Do not pass Genesis Block, do not collect $200.',
  chance: `Draw a ${DECKS.chance.name} card.`,
  chest: `Draw a ${DECKS.chest.name} card.`,
}

export default function DeedModal({ state, id, onClose }) {
  const sp = BOARD[id]
  const here = state.players.filter((p) => !p.bankrupt && p.pos === id)
  return (
    <Modal title={sp.name} onClose={onClose}>
      {sp.price ? (
        <DeedCard state={state} id={id} />
      ) : (
        <div className="info-space">
          <div className="info-icon">{sp.icon}</div>
          <p>{sp.type === 'tax' ? `Pay ${money(sp.amount)} to the bank.` : INFO[sp.type]}</p>
        </div>
      )}
      {here.length > 0 && (
        <p className="muted small center-text">
          Here now: {here.map((p) => `${p.token} ${p.name}`).join(', ')}
        </p>
      )}
    </Modal>
  )
}
