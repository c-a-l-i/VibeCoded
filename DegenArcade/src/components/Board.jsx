import { BOARD, groupVars } from '../data/board.js'
import { t, look, N, money } from '../i18n/index.js'

// Map a board index to its cell in the 11×11 grid, going counter-clockwise from GO (bottom-right).
function placement(i) {
  if (i <= 10) return { row: 11, col: 11 - i, side: 'bottom' }
  if (i < 20) return { row: 21 - i, col: 1, side: 'left' }
  if (i <= 30) return { row: 1, col: i - 19, side: 'top' }
  return { row: i - 29, col: 11, side: 'right' }
}

function Buildings({ n }) {
  if (n === 5) return <span className="dc" title={t('mono.dataCenter')} />
  return Array.from({ length: n }, (_, i) => <span className="node" key={i} title={t('mono.node')} />)
}

function Space({ sp, state, onClick }) {
  const { row, col, side } = placement(sp.id)
  const pr = state.props[sp.id]
  const owner = pr && pr.owner !== null ? state.players[pr.owner] : null
  const here = state.players.filter((p) => !p.bankrupt && p.pos === sp.id)
  const current = state.players[state.current]
  const isCorner = sp.id % 10 === 0
  const name = N.space(sp.id)
  const style = {
    gridRow: row,
    gridColumn: col,
    ...(sp.group && groupVars(sp.group)),
    '--owner': owner?.color,
  }
  const cls = [
    'space',
    `side-${side}`,
    `type-${sp.type}`,
    isCorner && 'corner',
    pr?.mortgaged && 'mortgaged',
    current.pos === sp.id && 'here',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={cls} style={{ ...style, '--here': current.color }} onClick={() => onClick(sp.id)} title={name}>
      <div className="space-inner">
        {isCorner ? (
          <div className="corner-body">
            <span className="corner-icon">{sp.icon}</span>
            <span className="corner-title">{look(`mono.corners.${sp.type}`)[0]}</span>
            <span className="corner-sub">{look(`mono.corners.${sp.type}`)[1]}</span>
            {sp.type === 'go' && <span className="corner-arrow">◀</span>}
          </div>
        ) : (
          <>
            {sp.type === 'street' && (
              <div className="band">
                <Buildings n={pr.houses} />
              </div>
            )}
            <div className="space-name">{name}</div>
            {sp.icon && <div className="space-icon">{sp.icon}</div>}
            {sp.price && <div className="space-price">{money(sp.price)}</div>}
            {sp.type === 'tax' && <div className="space-price">{t('mono.payTax', { m: money(sp.amount) })}</div>}
            {owner && <div className="owner-strip" />}
            {owner && (
              <span className="owner-token" title={t('mono.ownedBy', { p: owner.name })}>
                {owner.token}
              </span>
            )}
            {pr?.mortgaged && <div className="stamp">{t('mono.mortgagedStamp')}</div>}
          </>
        )}
      </div>
      {here.length > 0 && (
        <div className="tokens">
          {here.map((p) => (
            <span
              key={`${p.id}-${p.pos}`}
              className={`token ${p.id === state.current ? 'active' : ''} ${p.inJail ? 'jailed' : ''}`}
              style={{ '--c': p.color }}
              title={p.name}
            >
              {p.token}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

export default function Board({ state, onSpaceClick, children }) {
  return (
    <div className="board">
      {BOARD.map((sp) => (
        <Space key={sp.id} sp={sp} state={state} onClick={onSpaceClick} />
      ))}
      <div className="board-center">{children}</div>
    </div>
  )
}
