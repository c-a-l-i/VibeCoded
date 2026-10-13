import { useState } from 'react'
import { COSTS, DEV, bagSize } from '../data.js'
import { actingPlayer, canBuild, handSize, playableDev, victimsAt } from '../engine.js'
import Dice from '../../components/Dice.jsx'
import { Who, Thinking, Cost, ResPicker } from './bits.jsx'
import { t, tx, fmt } from '../../i18n/index.js'

const BUILDS = [
  ['channel', '⚡', 'catan.channel'],
  ['node', '🟩', 'catan.node'],
  ['dc', '🏢', 'catan.dataCenter'],
]
const why = (state, check) => (check.reason ? fmt(check.reason, { ns: 'catan.why', players: state.players }) : undefined)

function Discard({ state, act, pid }) {
  const p = state.players[pid]
  const need = state.discards[pid]
  const [pick, setPick] = useState({})
  return (
    <div className="actions">
      <div className="status">{tx('catan.overLeveraged', { p: <Who p={p} />, n: handSize(p), k: need })}</div>
      <ResPicker value={pick} onChange={setPick} max={p.hand} />
      <button className="btn primary" disabled={bagSize(pick) !== need} onClick={() => act({ type: 'DISCARD', cards: pick })}>
        {t('catan.liquidate', { a: bagSize(pick), b: need })}
      </button>
    </div>
  )
}

function Panel({ state, act, mode, setMode, openModal }) {
  const pid = actingPlayer(state)
  const actor = state.players[pid]
  const p = state.players[state.current]
  if (actor.isAI) return <Thinking p={actor} />

  switch (state.phase) {
    case 'setup':
      return (
        <div className="status">
          {tx(
            state.setup.node !== null ? 'catan.setupChannel' : state.setup.step >= state.players.length ? 'catan.setupNode2' : 'catan.setupNode',
            { p: <Who p={actor} />, n: state.setup.step < state.players.length ? 1 : 2 },
          )}
        </div>
      )

    case 'preroll': {
      const canHack = playableDev(state, pid).includes('knight')
      return (
        <div className="actions">
          <div className="status">{tx('catan.mineNext', { p: <Who p={p} /> })}</div>
          <div className="row">
            <button className="btn primary big" onClick={() => act({ type: 'ROLL' })}>
              {t('ui.rollDice')}
            </button>
            {canHack && (
              <button className="btn" onClick={() => act({ type: 'PLAY_DEV', card: 'knight' })}>
                {t('catan.hackerFirst')}
              </button>
            )}
          </div>
        </div>
      )
    }

    case 'discard':
      return <Discard key={pid} state={state} act={act} pid={pid} />

    case 'hacker':
      return (
        <div className="status">{tx('catan.moveHacker', { p: <Who p={p} /> })}</div>
      )

    case 'steal':
      return (
        <div className="actions">
          <div className="status">{t('catan.whoDrained')}</div>
          <div className="row">
            {victimsAt(state, state.board.hacker, p.id).map((o) => (
              <button key={o} className="btn" style={{ '--c': state.players[o].color }} onClick={() => act({ type: 'STEAL', pid: o })}>
                {t('catan.victim', { token: state.players[o].token, name: state.players[o].name, n: handSize(state.players[o]) })}
              </button>
            ))}
          </div>
        </div>
      )

    case 'rollup':
      return (
        <div className="actions">
          <div className="status">{tx('catan.rollup', { n: state.freeChannels })}</div>
          <button className="btn ghost" onClick={() => act({ type: 'END_ROLLUP' })}>
            {t('ui.done')}
          </button>
        </div>
      )

    case 'main': {
      const devs = playableDev(state, pid)
      return (
        <div className="actions">
          <div className="status small">
            {tx('catan.buildTrade', { p: <Who p={p} /> })}
            {mode && <span className="muted">{t('catan.tapSpot')}</span>}
          </div>
          <div className="st-builds">
            {BUILDS.map(([kind, icon, label]) => {
              const check = canBuild(state, pid, kind)
              return (
                <button
                  key={kind}
                  className={`btn st-build ${mode === kind ? 'on' : ''}`}
                  disabled={!check.ok}
                  title={why(state, check)}
                  onClick={() => setMode(mode === kind ? null : kind)}
                >
                  <span>
                    {icon} {t(label)}
                  </span>
                  <Cost cost={COSTS[kind]} />
                </button>
              )
            })}
            <button
              className="btn st-build"
              disabled={!canBuild(state, pid, 'dev').ok}
              title={why(state, canBuild(state, pid, 'dev'))}
              onClick={() => act({ type: 'BUY_DEV' })}
            >
              <span>{t('catan.smartContract')}</span>
              <Cost cost={COSTS.dev} />
            </button>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => openModal({ type: 'trade' })}>
              {t('ui.trade')}
            </button>
            <button className="btn ghost" disabled={!devs.length} onClick={() => openModal({ type: 'dev' })}>
              {t('catan.execute')}
              {devs.length ? ` (${devs.map((d) => DEV[d].icon).join('')})` : ''}
            </button>
            <button className="btn primary" onClick={() => act({ type: 'END_TURN' })}>
              {t('catan.endTurn')}
            </button>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

export default function Console({ state, rolling, act, mode, setMode, openModal }) {
  const sum = state.dice[0] + state.dice[1]
  const showDice = state.phase !== 'setup'
  return (
    <section className="panel st-console">
      {showDice && (
        <div className="st-dice">
          <Dice dice={state.dice} rolling={rolling} />
          {!rolling && state.phase !== 'preroll' && <span className={`st-roll mono ${sum === 7 ? 'neg' : ''}`}>{sum}</span>}
        </div>
      )}
      <div className="st-console-body">
        {rolling ? <div className="status">{t('catan.mining')}</div> : <Panel state={state} act={act} mode={mode} setMode={setMode} openModal={openModal} />}
      </div>
    </section>
  )
}
