// Chance -> "FOMO", Community Chest -> "DAO Treasury".
// Same 16 effects per deck as the classic game.

export const DECKS = {
  chance: {
    name: 'FOMO',
    cards: [
      { text: 'Bull run! Advance to Bitcoin Boardwalk.', effect: { type: 'advance', to: 39 } },
      { text: 'Halving season. Advance to Genesis Block and collect $200.', effect: { type: 'advance', to: 0 } },
      { text: 'Your bags pumped. Advance to Layer 2 Lane. If you pass Genesis Block, collect $200.', effect: { type: 'advance', to: 24 } },
      { text: 'Ape in! Advance to Meme Coin Plaza. If you pass Genesis Block, collect $200.', effect: { type: 'advance', to: 11 } },
      { text: 'Bridge hopping! Advance to the nearest Network. If owned, pay the owner twice the rent.', effect: { type: 'nearest', kind: 'rail' } },
      { text: 'Arbitrage opportunity! Advance to the nearest Network. If owned, pay the owner twice the rent.', effect: { type: 'nearest', kind: 'rail' } },
      { text: 'Mining frenzy! Advance to the nearest Mining utility. If owned, roll the dice and pay the owner 10× the roll.', effect: { type: 'nearest', kind: 'utility' } },
      { text: 'Staking rewards hit your wallet. Collect $50.', effect: { type: 'money', amount: 50 } },
      { text: 'Get Out of Custody Free. Keep this card until needed, or trade it.', effect: { type: 'goojf' } },
      { text: 'Fat-fingered a transaction. Go back 3 spaces.', effect: { type: 'back', n: 3 } },
      { text: 'Wash trading detected! Go directly to SEC Custody. Do not pass Genesis Block, do not collect $200.', effect: { type: 'jail' } },
      { text: 'Node maintenance: pay $25 per node and $100 per data center.', effect: { type: 'repairs', house: 25, hotel: 100 } },
      { text: 'Failed transaction — gas still spent. Pay $15.', effect: { type: 'money', amount: -15 } },
      { text: 'Ride the Lightning Network. If you pass Genesis Block, collect $200.', effect: { type: 'advance', to: 5 } },
      { text: 'You were elected DAO chair. Pay each player $50.', effect: { type: 'each', amount: -50 } },
      { text: 'Your token vesting cliff unlocked. Collect $150.', effect: { type: 'money', amount: 150 } },
    ],
  },
  chest: {
    name: 'DAO Treasury',
    cards: [
      { text: 'Advance to Genesis Block. Collect $200.', effect: { type: 'advance', to: 0 } },
      { text: 'Smart contract bug in your favor. Collect $200.', effect: { type: 'money', amount: 200 } },
      { text: 'Your hardware wallet broke. Pay $50.', effect: { type: 'money', amount: -50 } },
      { text: 'Flipped an NFT for profit. Collect $50.', effect: { type: 'money', amount: 50 } },
      { text: 'Get Out of Custody Free. Keep this card until needed, or trade it.', effect: { type: 'goojf' } },
      { text: 'KYC violation! Go directly to SEC Custody. Do not pass Genesis Block, do not collect $200.', effect: { type: 'jail' } },
      { text: 'Governance token airdrop. Collect $100.', effect: { type: 'money', amount: 100 } },
      { text: 'Gas refund. Collect $20.', effect: { type: 'money', amount: 20 } },
      { text: "It's your wallet's birthday! Collect $10 from every player.", effect: { type: 'each', amount: 10 } },
      { text: 'Insurance fund payout. Collect $100.', effect: { type: 'money', amount: 100 } },
      { text: 'Got liquidated on leverage. Pay $100.', effect: { type: 'money', amount: -100 } },
      { text: 'Bought a "learn to trade" course. Pay $50.', effect: { type: 'money', amount: -50 } },
      { text: 'Paid for auditing a smart contract. Collect $25.', effect: { type: 'money', amount: 25 } },
      { text: 'Hard fork upgrade: pay $40 per node and $115 per data center.', effect: { type: 'repairs', house: 40, hotel: 115 } },
      { text: 'Second place in a meme contest. Collect $10.', effect: { type: 'money', amount: 10 } },
      { text: 'Found an old seed phrase in a drawer. Collect $100.', effect: { type: 'money', amount: 100 } },
    ],
  },
}

export function shuffled(n) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
