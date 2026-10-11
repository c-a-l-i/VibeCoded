# Degen Arcade ◈

Three classic games in React, re-skinned with crypto names. The start menu lets you create a game of any of them:

- **Cryptopoly**: Monopoly with the standard rules
- **Settlers of Satoshi**: Catan (base game) with the standard rules, described [below](#settlers-of-satoshi-)
- **Town of Solana**: Town of Salem (base game, all 33 roles) with the standard rules, described [below](#town-of-solana-️)

```bash
npm install
npm run dev      # http://localhost:5173 (local play)
npm run host     # build, then serve the app and the online server on http://localhost:8787
```

## Playing online with friends 🌐

`npm run host` builds the app and starts one Node server (`server/index.js`) that serves it and hosts game rooms over a WebSocket at `/ws`. Set `PORT` to change the port from 8787. On startup it prints the address friends on your Wi-Fi can open.

1. Open the site, enter your name and click **Host** under a game.
2. Send friends the 4-letter room code, or the invite link (📋 in the lobby).
3. Friends take open seats; any seat nobody takes is played by a bot. The host picks the seats (and, for Town of Solana, the role list and pace), then starts the game.

The games run on the server, not in anyone's browser:

- Each player only receives what their seat may see. In Town of Solana that means no one else's role, night action, dead man's switch or private chat. In Settlers of Satoshi, nobody else's smart contracts. Dice and card decks stay on the server.
- Actions are checked against whose turn it is, and players can't act for someone else's seat.
- Bots act on the server, and trades between two humans arrive as an offer the other player accepts or declines on their own screen.
- Refreshing or dropping out puts you back in your seat when you return. The host can let a bot play for someone who left, end the game and return everyone to the lobby, or (in Town of Solana) pause and change the pace. If the host drops, whoever next uses a host control becomes host.

Rooms live in the server's memory, so restarting the server ends them. A room with nobody connected is cleared after an hour.

Ways to let friends reach your server:

- **Same network:** share the `http://192.168.x.x:8787` address the server prints.
- **Over the internet, no setup:** a tunnel such as `cloudflared tunnel --url http://localhost:8787` or Tailscale Funnel gives you a public https URL. WebSockets work through both.
- **Always on:** deploy the repo to a Node host. On Railway, connect the GitHub repo and it runs `npm run build` then `npm start` on its own, setting `PORT` for you. On other hosts (Fly.io, Render, a VPS), use `npm run build` to build and `npm start` to run.

While developing, run `npm run server` next to `npm run dev`. Vite forwards `/ws` to the server on port 8787.

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

2 to 6 players. Any mix of humans (hot-seat on one screen, or online) and bots. The game autosaves to `localStorage`, so a refresh resumes it.

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

## Town of Solana ⚖️

### Name map

| Town of Solana | Town of Salem |
| --- | --- |
| Auditor 🔎 · Sleuth 🕵️ · Block Explorer 👁️ · Packet Sniffer 🎧 | Sheriff · Investigator · Lookout · Spy |
| Custodian 🔐 · Maxi Hunter 🗡️ · Honeypot 🍯 · White Hat 🎩 | Jailor · Vampire Hunter · Veteran · Vigilante |
| Firewall 🛡️ · Core Dev 🩹 | Bodyguard · Doctor |
| Influencer 🤳 · Whale 🐋 · Oracle 🔮 · Hard Forker 🍴 · Mixer 🌀 | Escort · Mayor · Medium · Retributionist · Transporter |
| **The Cabal**: VC 💼 · Rug Puller 🔪 | **The Mafia**: Godfather · Mafioso |
| Doxxer 📸 · Insider 🤫 · Paid Shill 📢 | Blackmailer · Consigliere · Consort |
| Sock Puppet 🧦 · Spoofer ✍️ · FUDster 🗞️ · Launderer 🧼 | Disguiser · Forger · Framer · Janitor |
| Copy Trader 📋 · HODLer 💎 | Amnesiac · Survivor |
| Short Seller 📉 · Shitposter 🤡 · Phisher 🎣 | Executioner · Jester · Witch |
| Drainer 🕳️ · Black Hat 💀 · Lunatic 🌕 | Arsonist · Serial Killer · Werewolf |
| Maxi 🧛 (orange-pills people) | Vampire (bites people) |
| Rugged / Slashed | Killed at night / Lynched |
| Burn Address · Dead man’s switch · Calling card | Graveyard · Last will · Death note |
| Cold Storage / Liquidate | Jail / Execute |

### Rules implemented

- Role lists: Classic, Ranked Practice, All Any, and Custom (7–15 slots of roles or categories). Unique roles stay unique, and a Maxi Hunter only spawns alongside a Maxi
- Day 1 is discussion only. After that, each day runs morning reveals, discussion, voting (a majority puts someone on trial), defense, judgement (guilty must beat innocent), and last words. Up to 3 trials a day
- Night actions resolve in Town of Salem’s order: Cold Storage, mixes, phishing, distractions, protection, deception, investigations, then attacks
- Attack and defense levels (Basic, Powerful, Unstoppable). Core Dev and Firewall protection, Firewall counter-attacks, honeypots hitting every visitor, Lunatic rampages, Drainer approvals and drains, Black Hats killing whoever distracts them
- Investigations: Auditor (suspicious or not; the VC and Drainer pass, a FUDded target fails), Sleuth (the 11 original result lists), Block Explorer visitor lists, Packet Sniffer Cabal visits, bugs and whispers, Insider exact roles
- Cabal succession: the Rug Puller is promoted when the VC dies, and anyone in the Cabal becomes the Rug Puller when no killer is left
- Neutrals: Short Sellers become Shitposters if their target dies at night, slashed Shitposters haunt a guilty or abstaining voter, Copy Traders copy a dead role, Maxis convert (or attack at 4+), Phishers win if the Town loses, HODLers win by surviving
- The Whale’s reveal (3 votes), Custodian chat and liquidations, the White Hat’s guilt, the Hard Forker’s revive, Oracle séances, dead chat, Doxxer silencing
- The Sock Puppet uses the later Town of Salem version: it disguises a Cabal member as another player for Block Explorers and Sleuths, instead of swapping identities when its target dies
- Win checks after every death. If nobody dies for four days, the game is a draw

### Players and bots

7 to 15 seats (15 for the preset modes), with any mix of humans and bots. With one human you play against the bots. With several, a pass-the-device screen hides each player’s role, night action and private chats. With no humans you can watch the bots play with every role visible.

Bots claim roles, share results, fake-claim (evil bots choose covers that fit a Sleuth result), counter-claim fakes, write dead man’s switches, vote and judge. They act on an opinion of every player built from claims, role-list math, reported results, wills and vote history. They also read human chat: “I’m the Auditor”, “Gwei is sus”, “vote 5” or “Hal claim?” all register. Phase timers have four paces plus pause, and a “Ready” button skips the rest of a phase once every human is ready.

## Code layout

- `src/App.jsx`, `src/Menu.jsx`, `src/games.js`: start menu that launches each game
- `server/`: online server (`index.js` rooms, lobby and WebSocket protocol; `games.js` per-game rules for turns, bots and what each seat sees)
- `src/net/`: online client (`net.js` connection with reconnects, `Online.jsx` lobby, room bar and trade offers)
- `src/catan/`: Settlers of Satoshi (`data.js` board + geometry, `engine.js` rules reducer, `ai.js` bots, `components/`)
- `src/salem/`: Town of Solana (`roles.js` roles and role lists, `rules.js` night resolution and win checks, `engine.js` phase clock and reducer, `ai.js` bots, `redact.js` per-seat view for online play, `components/`)
- `src/data/` — board spaces and card decks
- `src/engine/game.js` — pure reducer with all game rules
- `src/engine/ai.js` — bot decisions (buy, bid, build, raise funds, evaluate trades)
- `src/components/` — board, center console, sidebar, modals
