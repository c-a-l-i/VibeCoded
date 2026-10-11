# Degen Arcade ◈

Two classic board games in React, re-skinned with crypto names. The start menu lets you create a game of either:

- **Cryptopoly**: Monopoly with the standard rules
- **Settlers of Satoshi**: Catan (base game) with the standard rules, described [below](#settlers-of-satoshi-)

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Cryptopoly name map

| Cryptopoly | Classic |
| --- | --- |
| Genesis Block | GO |
| SEC Custody / SEC Raid! | Jail / Go to Jail |
| HODL Zone | Free Parking |
| FOMO | Chance |
| DAO Treasury | Community Chest |
| Gas Fees / Whale Tax | Income Tax / Luxury Tax |
| Networks (Lightning, Bridge, Mempool, Hash Rail) | Railroads |
| GPU Mining Farm / Hash Power Co. | Electric Company / Water Works |
| Nodes / Data Centers | Houses / Hotels |
| Shitcoin Alley … Bitcoin Boardwalk | Mediterranean … Boardwalk |

## Cryptopoly rules implemented

- $1,500 start, $200 for passing GO; prices and rent tables match the original board
- Doubles roll again; three doubles in a row sends you to custody
- Custody: roll doubles, pay $50, or use a Get Out of Custody Free card; pay automatically after the third failed roll
- Unbought property goes to auction among all players
- Full color set doubles unbuilt rent; build and sell evenly; limited supply of 32 nodes and 12 data centers
- Mortgage for half price, unmortgage for that plus 10%; no mortgaging while the set has buildings
- 16 FOMO and 16 DAO Treasury cards with the original effects (nearest Network pays 2×, nearest utility pays 10× dice, repairs, pay or collect from each player, and so on)
- Trades of properties, cash and free cards (receiving a mortgaged property costs a 10% fee)
- Debt: raise funds by selling or mortgaging, or go bankrupt. Assets go to the creditor, or back to the bank if you owe the bank.

## Players

2 to 6 players. Any mix of humans (hot-seat on one screen) and bots. The game autosaves to `localStorage`, so a refresh resumes it.

## Settlers of Satoshi ⬡

### Name map

| Settlers of Satoshi | Catan |
| --- | --- |
| Chips 💾 / Fab Lab | Brick / Hills |
| Fiber 🔌 / Fiber Forest | Lumber / Forest |
| Memes 🐸 / Meme Farm | Wool / Pasture |
| Stake 🥩 / Staking Fields | Grain / Fields |
| Hash ⛏️ / Mining Peaks | Ore / Mountains |
| Bear Market | Desert |
| Channel / Node / Data Center | Road / Settlement / City |
| The Hacker 🥷 | Robber |
| Smart Contracts 📜 | Development cards |
| Hacker · Layer 2 Rollup · Airdrop · Rug Pull · Rare NFT | Knight · Road Building · Year of Plenty · Monopoly · Victory Point |
| Longest Chain ⛓️ / Largest Botnet 🤖 | Longest Road / Largest Army |
| DEX 3:1 / CEX 2:1 | Generic / special harbors |
| Liquidated | Discard on a 7 |

### Rules implemented

- Random 19-tile board with the standard terrain and number mix (6s and 8s are never adjacent) and 9 harbors
- Genesis round: snake-order placement of 2 nodes and 2 channels each; the second node pays out its neighboring resources
- Distance rule; nodes must connect to your channels; opponents' buildings block channel connections
- Piece limits (15 channels, 5 nodes, 4 data centers) and a bank of 19 per resource, with the shortage rule
- Rolling a 7: anyone holding more than 7 cards discards half, then the Hacker moves and steals 1 random resource
- 25 smart contracts (14 Hacker, 5 Rare NFT, 2 each of the rest). One per turn, never on the turn bought; a Hacker may be played before rolling
- Longest Chain (5+, broken by opponents' nodes, ties keep the holder) and Largest Botnet (3+) are worth 2 VP each
- Market swaps at 4:1, or better with harbors; OTC trades with other players (bots answer instantly; humans accept on the shared screen)
- First to 10 VP on their own turn wins

3 to 4 players, any mix of humans (hot-seat) and bots, autosaved to `localStorage`.

## Code layout

- `src/App.jsx`, `src/Menu.jsx`: start menu that launches either game
- `src/catan/`: Settlers of Satoshi (`data.js` board + geometry, `engine.js` rules reducer, `ai.js` bots, `components/`)
- `src/data/` — board spaces and card decks
- `src/engine/game.js` — pure reducer with all game rules
- `src/engine/ai.js` — bot decisions (buy, bid, build, raise funds, evaluate trades)
- `src/components/` — board, center console, sidebar, modals
