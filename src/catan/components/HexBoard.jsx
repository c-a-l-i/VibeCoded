import { GEO, RES, TERRAIN, PIPS } from '../data.js'
import { useDisplay } from '../../display.js'
import { t, N } from '../../i18n/index.js'

const S = 60 // hex size in SVG units
const pt = (v) => [GEO.vertices[v].x * S, GEO.vertices[v].y * S]
const lerp = (a, b, t) => a + (b - a) * t

// Sea: a flat-topped hexagon framing the island.
const SEA = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i
  return `${Math.cos(a) * 330},${Math.sin(a) * 330}`
}).join(' ')

function hexPoints(h, scale = 0.95) {
  return h.vertices
    .map((v) => {
      const [x, y] = pt(v)
      return `${lerp(h.x * S, x, scale)},${lerp(h.y * S, y, scale)}`
    })
    .join(' ')
}

function Tile({ h, tile, hacker, hot }) {
  const terr = TERRAIN[tile.res]
  const cx = h.x * S
  const cy = h.y * S
  const red = tile.num === 6 || tile.num === 8
  return (
    <g className={`st-tile ${hot ? 'hot' : ''}`} style={{ '--glow': terr.glow }}>
      <polygon points={hexPoints(h)} fill={`url(#st-fill-${tile.res})`} className="st-tile-hex" />
      <polygon points={hexPoints(h, 0.78)} className="st-tile-inner" />
      <text x={cx} y={cy - 17} className="st-tile-icon">
        {tile.res === 'desert' ? terr.icon : RES[tile.res].icon}
      </text>
      <text x={cx} y={cy + 39} className="st-tile-name">
        {N.terrain(tile.res)}
      </text>
      {tile.num && (
        <g className={`st-num ${red ? 'red' : ''}`}>
          <circle cx={cx} cy={cy + 13} r={15} />
          <text x={cx} y={cy + 14}>
            {tile.num}
          </text>
          {Array.from({ length: PIPS[tile.num] }, (_, i) => (
            <circle key={i} className="st-pip" cx={cx + (i - (PIPS[tile.num] - 1) / 2) * 4} cy={cy + 23} r={1.3} />
          ))}
        </g>
      )}
      {hacker && (
        <g className="st-hacker">
          <circle cx={cx} cy={cy - 17} r={17} />
          <text x={cx} y={cy - 16}>
            🥷
          </text>
        </g>
      )}
    </g>
  )
}

function Port({ port }) {
  const [ax, ay] = pt(port.vertices[0])
  const [bx, by] = pt(port.vertices[1])
  const px = port.x * S + port.nx * 34
  const py = port.y * S + port.ny * 34
  const generic = port.type === 'any'
  return (
    <g className={`st-port ${generic ? 'any' : ''}`} style={{ '--pc': generic ? 'var(--cyan)' : RES[port.type].color }}>
      <line x1={ax} y1={ay} x2={px} y2={py} />
      <line x1={bx} y1={by} x2={px} y2={py} />
      <circle cx={px} cy={py} r={17} />
      {generic ? (
        <text x={px} y={py + 1} className="st-port-rate">
          3:1
        </text>
      ) : (
        <>
          <text x={px} y={py - 4} className="st-port-icon">
            {RES[port.type].icon}
          </text>
          <text x={px} y={py + 10} className="st-port-rate small">
            2:1
          </text>
        </>
      )}
    </g>
  )
}

// `seat` picks a line style and `token` is drawn on buildings, so pieces read without color when shape cues are on.
function Channel({ e, color, seat, target, onClick }) {
  const { a, b } = GEO.edges[e]
  const [ax, ay] = pt(a)
  const [bx, by] = pt(b)
  const p = (t) => [lerp(ax, bx, t), lerp(ay, by, t)]
  const [x1, y1] = p(0.14)
  const [x2, y2] = p(0.86)
  if (target)
    return (
      <g className="st-target-edge" onClick={onClick}>
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="st-target-line" />
        <line x1={ax} y1={ay} x2={bx} y2={by} className="st-hit" />
      </g>
    )
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={`st-channel seat-${seat}`} style={{ '--c': color }} />
}

function Building({ v, b, color, token, upgradable, onClick }) {
  const [x, y] = pt(v)
  // Pieces grow a little with shape cues on so the owner's token inside stays readable.
  const { cues } = useDisplay()
  const n = cues ? 11 : 8
  const d = cues ? 16 : 13
  return (
    <g
      className={`st-building ${b.dc ? 'dc' : 'node'} ${upgradable ? 'upgradable' : ''}`}
      style={{ '--c': color }}
      transform={`translate(${x} ${y})`}
      onClick={upgradable ? onClick : undefined}
    >
      {b.dc ? (
        <>
          <rect x={-d} y={-d} width={d * 2} height={d * 2} rx={5} />
          <rect x={-5.5} y={-5.5} width={11} height={11} rx={2} className="st-core" />
        </>
      ) : (
        <rect x={-n} y={-n} width={n * 2} height={n * 2} rx={3} transform="rotate(45)" />
      )}
      <text className="st-token" y={1}>
        {token}
      </text>
    </g>
  )
}

// targets: { kind: 'vertex' | 'edge' | 'hex' | 'upgrade', ids: number[], onPick(id) } | null
export default function HexBoard({ state, targets, hotNumber }) {
  const { tiles, ports, hacker } = state.board
  const ids = new Set(targets?.ids ?? [])
  const pick = (id) => () => targets.onPick(id)
  const colorOf = (pid) => state.players[pid].color
  const tokenOf = (pid) => state.players[pid].token

  return (
    <svg className={`st-svg ${targets ? `picking-${targets.kind}` : ''}`} viewBox="-345 -320 690 640" role="img" aria-label={t('catan.boardLabel')}>
      <defs>
        {Object.entries(TERRAIN).map(([k, terr]) => (
          <radialGradient key={k} id={`st-fill-${k}`} cx="50%" cy="40%" r="70%" style={{ '--glow': terr.glow }}>
            <stop offset="0%" className="st-stop-in" />
            <stop offset="100%" className="st-stop-out" />
          </radialGradient>
        ))}
        <pattern id="st-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M 22 0 L 0 0 0 22" className="st-grid-line" />
        </pattern>
      </defs>

      <polygon points={SEA} className="st-sea" />
      <polygon points={SEA} fill="url(#st-grid)" />

      {ports.map((port, i) => (
        <Port key={i} port={port} />
      ))}

      {GEO.hexes.map((h) => (
        <Tile key={h.id} h={h} tile={tiles[h.id]} hacker={hacker === h.id} hot={hotNumber && tiles[h.id].num === hotNumber} />
      ))}

      {targets?.kind === 'hex' &&
        GEO.hexes
          .filter((h) => ids.has(h.id))
          .map((h) => <polygon key={h.id} points={hexPoints(h)} className="st-target-hex" onClick={pick(h.id)} />)}

      {Object.entries(state.channels).map(([e, owner]) => (
        <Channel key={e} e={Number(e)} color={colorOf(owner)} seat={owner} />
      ))}
      {targets?.kind === 'edge' && [...ids].map((e) => <Channel key={`t${e}`} e={e} target onClick={pick(e)} />)}

      {Object.entries(state.buildings).map(([v, b]) => (
        <Building
          key={v}
          v={Number(v)}
          b={b}
          color={colorOf(b.owner)}
          token={tokenOf(b.owner)}
          upgradable={targets?.kind === 'upgrade' && ids.has(Number(v))}
          onClick={pick(Number(v))}
        />
      ))}
      {targets?.kind === 'vertex' &&
        [...ids].map((v) => {
          const [x, y] = pt(v)
          return (
            <g key={`t${v}`} className="st-target-vertex" onClick={pick(v)}>
              <circle cx={x} cy={y} r={14} className="st-hit" />
              <circle cx={x} cy={y} r={8} className="st-target-dot" />
            </g>
          )
        })}
    </svg>
  )
}
