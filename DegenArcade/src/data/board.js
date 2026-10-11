// The 40 board spaces, laid out exactly like the classic board (index 0 = GO),
// re-skinned with crypto names. Prices, rents and house costs are the originals.

export const GROUPS = {
  brown: { name: 'Shitcoins', color: '#c2895b', houseCost: 50 },
  lightblue: { name: 'Testnets', color: '#5ad8ff', houseCost: 50 },
  pink: { name: 'Memes', color: '#ff4fd8', houseCost: 100 },
  orange: { name: 'Farms', color: '#ff9a3c', houseCost: 100 },
  red: { name: 'DeFi', color: '#ff4d6d', houseCost: 150 },
  yellow: { name: 'Protocols', color: '#ffe14d', houseCost: 150 },
  green: { name: 'Layer 1s', color: '#3dffa0', houseCost: 200 },
  darkblue: { name: 'Blue Chips', color: '#6b7bff', houseCost: 200 },
}

const street = (name, group, price, rent) => ({ type: 'street', name, group, price, rent })
const rail = (name, icon) => ({ type: 'rail', name, price: 200, icon })
const utility = (name, icon) => ({ type: 'utility', name, price: 150, icon })

export const BOARD = [
  { type: 'go', name: 'Genesis Block', icon: '⛓️' },
  street('Shitcoin Alley', 'brown', 60, [2, 10, 30, 90, 160, 250]),
  { type: 'chest', name: 'DAO Treasury', icon: '🏛️' },
  street('Rug Pull Row', 'brown', 60, [4, 20, 60, 180, 320, 450]),
  { type: 'tax', name: 'Gas Fees', amount: 200, icon: '⛽' },
  rail('Lightning Network', '⚡'),
  street('Faucet Lane', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  { type: 'chance', name: 'FOMO', icon: '📈' },
  street('Testnet Terrace', 'lightblue', 100, [6, 30, 90, 270, 400, 550]),
  street('Whitelist Way', 'lightblue', 120, [8, 40, 100, 300, 450, 600]),
  { type: 'jail', name: 'SEC Custody', icon: '🔒' },
  street('Meme Coin Plaza', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  utility('GPU Mining Farm', '🖥️'),
  street('NFT Gallery', 'pink', 140, [10, 50, 150, 450, 625, 750]),
  street('Pump & Dump Pkwy', 'pink', 160, [12, 60, 180, 500, 700, 900]),
  rail('Cross-Chain Bridge', '🌉'),
  street('Airdrop Avenue', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  { type: 'chest', name: 'DAO Treasury', icon: '🏛️' },
  street('Yield Farm Road', 'orange', 180, [14, 70, 200, 550, 750, 950]),
  street('Liquidity Pool', 'orange', 200, [16, 80, 220, 600, 800, 1000]),
  { type: 'parking', name: 'HODL Zone', icon: '💎' },
  street('DeFi Drive', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  { type: 'chance', name: 'FOMO', icon: '📉' },
  street('DAO Square', 'red', 220, [18, 90, 250, 700, 875, 1050]),
  street('Layer 2 Lane', 'red', 240, [20, 100, 300, 750, 925, 1100]),
  rail('Mempool Express', '🚄'),
  street('Smart Contract Ct', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  street('Oracle Heights', 'yellow', 260, [22, 110, 330, 800, 975, 1150]),
  utility('Hash Power Co.', '⛏️'),
  street('Zero-Knowledge Way', 'yellow', 280, [24, 120, 360, 850, 1025, 1200]),
  { type: 'gotojail', name: 'SEC Raid!', icon: '🚨' },
  street('Ethereum Estates', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  street('Solana Springs', 'green', 300, [26, 130, 390, 900, 1100, 1275]),
  { type: 'chest', name: 'DAO Treasury', icon: '🏛️' },
  street('Cold Wallet Commons', 'green', 320, [28, 150, 450, 1000, 1200, 1400]),
  rail('Hash Rail', '🛤️'),
  { type: 'chance', name: 'FOMO', icon: '🎰' },
  street('Satoshi Place', 'darkblue', 350, [35, 175, 500, 1100, 1300, 1500]),
  { type: 'tax', name: 'Whale Tax', amount: 100, icon: '🐋' },
  street('Bitcoin Boardwalk', 'darkblue', 400, [50, 200, 600, 1400, 1700, 2000]),
].map((s, i) => ({ ...s, id: i }))

export const OWNABLE = BOARD.filter((s) => s.price).map((s) => s.id)
export const RAIL_RENT = [25, 50, 100, 200]
export const JAIL = 10
export const GO_SALARY = 200
export const JAIL_FINE = 50
export const STARTING_CASH = 1500
export const TOTAL_HOUSES = 32
export const TOTAL_HOTELS = 12

export const groupMembers = (group) => BOARD.filter((s) => s.group === group).map((s) => s.id)

export const houseCost = (id) => GROUPS[BOARD[id].group]?.houseCost ?? 0
export const mortgageValue = (id) => BOARD[id].price / 2
export const unmortgageCost = (id) => Math.ceil(mortgageValue(id) * 1.1)

export const spaceColor = (id) => {
  const s = BOARD[id]
  if (s.type === 'street') return GROUPS[s.group].color
  if (s.type === 'rail') return '#b8c2d9'
  if (s.type === 'utility') return '#9aa4bf'
  return '#ffffff'
}

export const TOKENS = ['🚀', '🐋', '🦍', '💎', '🌕', '🐸', '🐂', '🐻']
export const PLAYER_COLORS = ['#00f0ff', '#ff3df2', '#ffd23f', '#3dff8f', '#ff7a3d', '#a78bfa']
export const DEFAULT_NAMES = ['Satoshi', 'Vitalik', 'Degen', 'Whale', 'Ape', 'Paperhands']
