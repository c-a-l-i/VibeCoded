# Cryptopoly ◈

A Monopoly clone in React with the standard rules, re-skinned with crypto names.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

## Name map

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

## Rules implemented

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

## Code layout

- `src/data/` — board spaces and card decks
- `src/engine/game.js` — pure reducer with all game rules
- `src/engine/ai.js` — bot decisions (buy, bid, build, raise funds, evaluate trades)
- `src/components/` — board, center console, sidebar, modals
