import { useState } from 'react'
import { BOARD, GROUPS, houseCost, mortgageValue, unmortgageCost, spaceVars } from '../data/board.js'
import {
  actingPlayer, canBuild, canSell, canMortgage, canUnmortgage, netWorth, ownedBy, ownsGroup,
} from '../engine/game.js'
import Modal from './Modal.jsx'
import { t, tx, N, fmt, money } from '../i18n/index.js'

const BUILD_PHASES = ['preroll', 'postroll', 'buy']
const RAISE_PHASES = [...BUILD_PHASES, 'debt']

function ActionBtn({ check, onClick, children, enabled, players }) {
  const ok = enabled && check.ok
  const why = check.reason ? fmt(check.reason, { ns: 'mono.why', players }) : ''
  return (
    <button className="btn tiny" disabled={!ok} title={enabled ? why : t('mono.notNow')} onClick={onClick}>
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
    <Modal title={t('mono.portfolioTitle')} onClose={onClose} wide>
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
          <span className="muted small">{t('mono.cash')}</span>
          <span className="mono big-num">{money(p.money)}</span>
        </div>
        <div>
          <span className="muted small">{t('mono.liquidation')}</span>
          <span className="mono big-num">{money(netWorth(state, viewId))}</span>
        </div>
        <div>
          <span className="muted small">{t('mono.freeCards')}</span>
          <span className="mono big-num">{p.cards.length}</span>
        </div>
      </div>

      {state.phase === 'debt' && mine && (
        <div className="notice">{tx('mono.raise', { m: money(state.debts[0].amount), m2: money(p.money) })}</div>
      )}
      {!mine && viewId === actorId && <div className="notice">{t('mono.botsManage')}</div>}
      {mine && !canRaiseNow && <div className="notice">{t('mono.yourTurnOnly')}</div>}

      {props.length === 0 && <p className="muted center-text">{t('mono.noProps')}</p>}

      <div className="portfolio">
        {Object.entries(groups).map(([key, ids]) => {
          const isSet = GROUPS[key] && ownsGroup(state, viewId, key)
          return (
            <div className="pf-group" key={key}>
              <div className="pf-group-head" style={spaceVars(ids[0])}>
                <span className="swatch" />
                {GROUPS[key] ? N.group(key) : key === 'rail' ? t('mono.networks') : t('mono.mining')}
                {isSet && <span className="badge">{t('mono.fullSet')}</span>}
              </div>
              {ids.map((id) => {
                const sp = BOARD[id]
                const pr = state.props[id]
                return (
                  <div className={`pf-row ${pr.mortgaged ? 'mortgaged' : ''}`} key={id}>
                    <div className="pf-name">
                      {N.space(id)}
                      <span className="pf-buildings">
                        {pr.houses === 5 ? t('mono.dcBuilt') : pr.houses ? '🟩'.repeat(pr.houses) : ''}
                        {pr.mortgaged && <span className="neg"> {t('mono.mortgagedWord')}</span>}
                      </span>
                    </div>
                    <div className="pf-actions">
                      {sp.type === 'street' && (
                        <>
                          <ActionBtn players={state.players} enabled={canBuildNow} check={canBuild(state, viewId, id)} onClick={() => act({ type: 'BUILD', id })}>
                            {t(pr.houses === 4 ? 'mono.buildDc' : 'mono.buildNode', { m: money(houseCost(id)) })}
                          </ActionBtn>
                          <ActionBtn players={state.players} enabled={canRaiseNow} check={canSell(state, viewId, id)} onClick={() => act({ type: 'SELL', id })}>
                            {t('mono.sell', { m: money(houseCost(id) / 2) })}
                          </ActionBtn>
                        </>
                      )}
                      {pr.mortgaged ? (
                        <ActionBtn players={state.players} enabled={canBuildNow} check={canUnmortgage(state, viewId, id)} onClick={() => act({ type: 'UNMORTGAGE', id })}>
                          {t('mono.unmortgage', { m: money(unmortgageCost(id)) })}
                        </ActionBtn>
                      ) : (
                        <ActionBtn players={state.players} enabled={canRaiseNow} check={canMortgage(state, viewId, id)} onClick={() => act({ type: 'MORTGAGE', id })}>
                          {t('mono.mortgageFor', { m: money(mortgageValue(id)) })}
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
      <p className="muted small center-text">{t('mono.bankSupply', { h: state.bank.houses, d: state.bank.hotels })}</p>
    </Modal>
  )
}
