import { useState } from 'react'
import { COSTS, DEV, bagSize } from '../data.js'
import { actingPlayer, canBuild, handSize, playableDev, victimsAt } from '../engine.js'
import Dice from '../../components/Dice.jsx'
import { Who, Thinking, Cost, ResPicker } from './bits.jsx'

const BUILDS = [
  ['channel', '⚡', 'Channel'],
  ['node', '🟩', 'Node'],
  ['dc', '🏢', 'Data Center'],
]

function Discard({ state, act, pid }) {
  const p = state.players[pid]
  const need = state.discards[pid]
  const [pick, setPick] = useState({})
  return (
    <div className="actions">
      <div className="status">
        💥 <Who p={p} /> is over-leveraged ({handSize(p)} cards) — liquidate <b>{need}</b>
      </div>
      <ResPicker value={pick} onChange={setPick} max={p.hand} />
      <button className="btn primary" disabled={bagSize(pick) !== need} onClick={() => act({ type: 'DISCARD', cards: pick })}>
        Liquidate {bagSize(pick)}/{need}
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
          <Who p={actor} /> — genesis round {state.setup.step < state.players.length ? 1 : 2}:{' '}
          {state.setup.node === null ? (
            <>
              tap a glowing spot to <b>spin up a node</b>
              {state.setup.step >= state.players.length && ' (it pays out its neighbors)'}
            </>
          ) : (
            <>
              now <b>open a channel</b> from it
            </>
          )}
        </div>
      )

    case 'preroll': {
      const canHack = playableDev(state, pid).includes('knight')
      return (
        <div className="actions">
          <div className="status">
            <Who p={p} /> — mine the next block
          </div>
          <div className="row">
            <button className="btn primary big" onClick={() => act({ type: 'ROLL' })}>
              🎲 Roll dice
            </button>
            {canHack && (
              <button className="btn" onClick={() => act({ type: 'PLAY_DEV', card: 'knight' })}>
                🥷 Deploy Hacker first
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
        <div className="status">
          🥷 <Who p={p} /> — tap a tile to send <b>the Hacker</b>. It blocks mining there and drains a neighbor.
        </div>
      )

    case 'steal':
      return (
        <div className="actions">
          <div className="status">Who gets drained?</div>
          <div className="row">
            {victimsAt(state, state.board.hacker, p.id).map((o) => (
              <button key={o} className="btn" style={{ '--c': state.players[o].color }} onClick={() => act({ type: 'STEAL', pid: o })}>
                {state.players[o].token} {state.players[o].name} · {handSize(state.players[o])} cards
              </button>
            ))}
          </div>
        </div>
      )

    case 'rollup':
      return (
        <div className="actions">
          <div className="status">
            🛣️ Layer 2 Rollup — tap to open <b>{state.freeChannels}</b> more free channel{state.freeChannels > 1 ? 's' : ''}
          </div>
          <button className="btn ghost" onClick={() => act({ type: 'END_ROLLUP' })}>
            Done
          </button>
        </div>
      )

    case 'main': {
      const devs = playableDev(state, pid)
      return (
        <div className="actions">
          <div className="status small">
            <Who p={p} /> — build, trade, then end your turn
            {mode && <span className="muted"> · tap a glowing spot (or pick again to cancel)</span>}
          </div>
          <div className="st-builds">
            {BUILDS.map(([kind, icon, label]) => {
              const check = canBuild(state, pid, kind)
              return (
                <button
                  key={kind}
                  className={`btn st-build ${mode === kind ? 'on' : ''}`}
                  disabled={!check.ok}
                  title={check.reason}
                  onClick={() => setMode(mode === kind ? null : kind)}
                >
                  <span>
                    {icon} {label}
                  </span>
                  <Cost cost={COSTS[kind]} />
                </button>
              )
            })}
            <button
              className="btn st-build"
              disabled={!canBuild(state, pid, 'dev').ok}
              title={canBuild(state, pid, 'dev').reason}
              onClick={() => act({ type: 'BUY_DEV' })}
            >
              <span>📜 Smart Contract</span>
              <Cost cost={COSTS.dev} />
            </button>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => openModal({ type: 'trade' })}>
              🤝 Trade
            </button>
            <button className="btn ghost" disabled={!devs.length} onClick={() => openModal({ type: 'dev' })}>
              📜 Execute contract{devs.length ? ` (${devs.map((d) => DEV[d].icon).join('')})` : ''}
            </button>
            <button className="btn primary" onClick={() => act({ type: 'END_TURN' })}>
              End turn ⏭
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
        {rolling ? <div className="status">Mining…</div> : <Panel state={state} act={act} mode={mode} setMode={setMode} openModal={openModal} />}
      </div>
    </section>
  )
}
