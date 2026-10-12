import { useState } from 'react'
import { BOARD, GROUPS, houseCost, mortgageValue, unmortgageCost, spaceVars } from '../data/board.js'
import {
  actingPlayer, canBuild, canSell, canMortgage, canUnmortgage, money, netWorth, ownedBy, ownsGroup,
} from '../engine/game.js'
import Modal from './Modal.jsx'

const BUILD_PHASES = ['preroll', 'postroll', 'buy']
const RAISE_PHASES = [...BUILD_PHASES, 'debt']

function ActionBtn({ check, onClick, children, enabled }) {
  const ok = enabled && check.ok
  return (
    <button className="btn tiny" disabled={!ok} title={enabled ? check.reason || '' : 'Not right now'} onClick={onClick}>
      {children}
    </button>
  )
}

export default function PortfolioModal({ state, act, onClose }) {
  const actorId = actingPlayer(state)
  // Default to whoever can act; during a bot's turn, show the first human instead.
  const [viewId, setViewId] = useState(() =>
    state.players[actorId].isAI ? (state.players.find((x) => !x.isAI && !x.bankrupt)?.id ?? actorId) : actorId,
  )
  const p = state.players[viewId]
  const mine = viewId === actorId && !p.isAI
  const canBuildNow = mine && BUILD_PHASES.includes(state.phase)
  const canRaiseNow = mine && RAISE_PHASES.includes(state.phase)
  const props = ownedBy(state, viewId)

  // Group by color set (streets) then networks and utilities.
  const groups = {}
  for (const id of props) {
    const key = BOARD[id].group ?? BOARD[id].type
    ;(groups[key] ??= []).push(id)
  }

  return (
    <Modal title="Portfolio" onClose={onClose} wide>
      <div className="tabs">
        {state.players
          .filter((x) => !x.bankrupt)
          .map((x) => (
            <button key={x.id} className={`tab ${x.id === viewId ? 'on' : ''}`} style={{ '--c': x.color }} onClick={() => setViewId(x.id)}>
              {x.token} {x.name}
            </button>
          ))}
      </div>

      <div className="portfolio-summary">
        <div>
          <span className="muted small">Cash</span>
          <span className="mono big-num">{money(p.money)}</span>
        </div>
        <div>
          <span className="muted small">Liquidation value</span>
          <span className="mono big-num">{money(netWorth(state, viewId))}</span>
        </div>
        <div>
          <span className="muted small">Free cards</span>
          <span className="mono big-num">{p.cards.length}</span>
        </div>
      </div>

      {state.phase === 'debt' && mine && (
        <div className="notice">
          Raise <b className="mono">{money(state.debts[0].amount)}</b> — you have {money(p.money)}. Sell nodes or mortgage, then pay from the board.
        </div>
      )}
      {!mine && viewId === actorId && <div className="notice">Bots manage their own portfolio.</div>}
      {mine && !canRaiseNow && <div className="notice">You can manage assets on your turn.</div>}

      {props.length === 0 && <p className="muted center-text">No properties yet. Go buy some bags.</p>}

      <div className="portfolio">
        {Object.entries(groups).map(([key, ids]) => {
          const isSet = GROUPS[key] && ownsGroup(state, viewId, key)
          return (
            <div className="pf-group" key={key}>
              <div className="pf-group-head" style={spaceVars(ids[0])}>
                <span className="swatch" />
                {GROUPS[key]?.name ?? (key === 'rail' ? 'Networks' : 'Mining')}
                {isSet && <span className="badge">FULL SET</span>}
              </div>
              {ids.map((id) => {
                const sp = BOARD[id]
                const pr = state.props[id]
                return (
                  <div className={`pf-row ${pr.mortgaged ? 'mortgaged' : ''}`} key={id}>
                    <div className="pf-name">
                      {sp.name}
                      <span className="pf-buildings">
                        {pr.houses === 5 ? '🏢 data center' : pr.houses ? '🟩'.repeat(pr.houses) : ''}
                        {pr.mortgaged && <span className="neg"> mortgaged</span>}
                      </span>
                    </div>
                    <div className="pf-actions">
                      {sp.type === 'street' && (
                        <>
                          <ActionBtn enabled={canBuildNow} check={canBuild(state, viewId, id)} onClick={() => act({ type: 'BUILD', id })}>
                            + {pr.houses === 4 ? 'DC' : 'Node'} {money(houseCost(id))}
                          </ActionBtn>
                          <ActionBtn enabled={canRaiseNow} check={canSell(state, viewId, id)} onClick={() => act({ type: 'SELL', id })}>
                            − Sell +{money(houseCost(id) / 2)}
                          </ActionBtn>
                        </>
                      )}
                      {pr.mortgaged ? (
                        <ActionBtn enabled={canBuildNow} check={canUnmortgage(state, viewId, id)} onClick={() => act({ type: 'UNMORTGAGE', id })}>
                          Unmortgage −{money(unmortgageCost(id))}
                        </ActionBtn>
                      ) : (
                        <ActionBtn enabled={canRaiseNow} check={canMortgage(state, viewId, id)} onClick={() => act({ type: 'MORTGAGE', id })}>
                          Mortgage +{money(mortgageValue(id))}
                        </ActionBtn>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
      <p className="muted small center-text">
        Bank supply: {state.bank.houses} nodes · {state.bank.hotels} data centers
      </p>
    </Modal>
  )
}
