// Static data for Town of Solana: roles, role lists and lobby flavor.
// The rules follow Town of Salem (base game, no Coven); only the names are crypto.

// Faction colors are CSS tokens (src/theme.css) so the Display settings can swap them for color-blind palettes.
export const FACTIONS = {
  town: { name: 'Town', color: 'var(--town)', goal: 'Slash every criminal and evildoer.' },
  cabal: { name: 'Cabal', color: 'var(--cabal)', goal: 'Rug everyone who won’t submit to the Cabal.' },
  neutral: { name: 'Neutral', color: 'var(--neutral)' },
}

export const CATS = {
  TI: { name: 'Town Investigative', faction: 'town' },
  TK: { name: 'Town Killing', faction: 'town' },
  TP: { name: 'Town Protective', faction: 'town' },
  TS: { name: 'Town Support', faction: 'town' },
  CK: { name: 'Cabal Killing', faction: 'cabal' },
  CD: { name: 'Cabal Deception', faction: 'cabal' },
  CS: { name: 'Cabal Support', faction: 'cabal' },
  NB: { name: 'Neutral Benign', faction: 'neutral' },
  NE: { name: 'Neutral Evil', faction: 'neutral' },
  NK: { name: 'Neutral Killing', faction: 'neutral' },
  NC: { name: 'Neutral Chaos', faction: 'neutral' },
}

// Attack / defense levels: 0 none, 1 basic, 2 powerful, 3 unstoppable / invincible.
export const LEVELS = ['None', 'Basic', 'Powerful', 'Unstoppable']

const CABAL_NOTE = 'If no Cabal killer is alive, you become the Rug Puller.'

// `act` describes the night ability: pick is who can be targeted.
//   other: a living player but not yourself · any: any living player · team: a living player outside your team
//   self: a button that targets yourself · dead / deadTown: someone in the Burn Address · two / disguise: two targets
export const ROLES = {
  // ---------- Town ----------
  sheriff: {
    name: 'Auditor', classic: 'Sheriff', icon: '🔎', cat: 'TI',
    ability: 'Audit one player each night for red flags.',
    notes: [
      'You learn whether your target is Suspicious.',
      'The VC and the Drainer pass audits. A Lunatic only fails on full moons.',
      'Anyone the FUDster has framed fails until someone investigates them.',
    ],
    act: { verb: 'Audit', pick: 'other' },
  },
  investigator: {
    name: 'Sleuth', classic: 'Investigator', icon: '🕵️', cat: 'TI',
    ability: 'Trace one player’s on-chain history each night.',
    notes: [
      'You get a short list of roles your target could be.',
      'FUDded targets show the FUDster’s list. A Sock Puppet disguise fools you.',
    ],
    act: { verb: 'Trace', pick: 'other' },
  },
  lookout: {
    name: 'Block Explorer', classic: 'Lookout', icon: '👁️', cat: 'TI',
    ability: 'Watch one player’s wallet at night to see who interacts with it.',
    notes: ['You learn everyone who visited your target.', 'A Sock Puppet disguise shows the wrong name.'],
    act: { verb: 'Watch', pick: 'other' },
  },
  spy: {
    name: 'Packet Sniffer', classic: 'Spy', icon: '🎧', cat: 'TI',
    ability: 'Bug one player’s house at night.',
    notes: [
      'You see every player the Cabal visits.',
      'You read every whisper.',
      'Your bug tells you what happened to your target.',
    ],
    act: { verb: 'Bug', pick: 'other' },
  },
  jailor: {
    name: 'Custodian', classic: 'Jailor', icon: '🔐', cat: 'TK', unique: true, attack: 3, rbImmune: true, controlImmune: true,
    ability: 'Lock one player in Cold Storage each day. At night you may liquidate them.',
    notes: [
      'Your prisoner can’t act and can’t be visited. You talk to them anonymously.',
      '3 liquidations. Liquidating a Town member forfeits the rest.',
      'No liquidations on Night 1.',
    ],
    act: { verb: 'Lock up', pick: 'jail' },
    uses: { executions: 3 },
  },
  vampireHunter: {
    name: 'Maxi Hunter', classic: 'Vampire Hunter', icon: '🗡️', cat: 'TK', attack: 1,
    ability: 'Check one player each night for laser eyes.',
    notes: [
      'If your target is a Maxi, you stake them.',
      'Maxis who visit you get staked. You can hear the Maxis talk.',
      'Once every Maxi is dead you become a White Hat with 1 bullet.',
    ],
    act: { verb: 'Check', pick: 'other' },
  },
  veteran: {
    name: 'Honeypot', classic: 'Veteran', icon: '🍯', cat: 'TK', unique: true, attack: 2, rbImmune: true, controlImmune: true,
    ability: 'Arm your honeypot at night.',
    notes: ['3 uses. While armed you have Basic defense and attack everyone who visits you.', 'You can’t be distracted.'],
    act: { verb: 'Arm honeypot', pick: 'self' },
    uses: { alerts: 3 },
  },
  vigilante: {
    name: 'White Hat', classic: 'Vigilante', icon: '🎩', cat: 'TK', attack: 1,
    ability: 'Hack back one player at night.',
    notes: ['3 bullets. You can’t shoot on Night 1.', 'If you kill a Town member, you die of guilt the next night.'],
    act: { verb: 'Hack back', pick: 'other', from: 2 },
    uses: { bullets: 3 },
  },
  bodyguard: {
    name: 'Firewall', classic: 'Bodyguard', icon: '🛡️', cat: 'TP', attack: 2,
    ability: 'Guard one player each night.',
    notes: [
      'If your target is attacked, you fight the attacker. You kill them and die yourself.',
      'Once, you can guard yourself for Basic defense.',
    ],
    act: { verb: 'Guard', pick: 'any' },
    uses: { vest: 1 },
  },
  doctor: {
    name: 'Core Dev', classic: 'Doctor', icon: '🩹', cat: 'TP',
    ability: 'Patch one player each night, giving them Powerful defense.',
    notes: ['You learn if your target was attacked.', 'You can patch yourself once.', 'A revealed Whale can’t be patched.'],
    act: { verb: 'Patch', pick: 'any' },
    uses: { selfHeal: 1 },
  },
  escort: {
    name: 'Influencer', classic: 'Escort', icon: '🤳', cat: 'TS', rbImmune: true,
    ability: 'Distract one player each night so they can’t act.',
    notes: ['You can’t be distracted.', 'Distract a Black Hat and they attack you instead.'],
    act: { verb: 'Distract', pick: 'other' },
  },
  mayor: {
    name: 'Whale', classic: 'Mayor', icon: '🐋', cat: 'TS', unique: true, controlImmune: true,
    ability: 'Reveal yourself as the Whale during the day.',
    notes: ['Once revealed, your vote counts 3 times.', 'Core Devs can’t patch you after you reveal.'],
    act: { verb: 'Reveal', pick: 'reveal' },
  },
  medium: {
    name: 'Oracle', classic: 'Medium', icon: '🔮', cat: 'TS', controlImmune: true,
    ability: 'Hear the dead at night and relay what they know.',
    notes: ['You talk with the dead anonymously at night.', 'Once, while dead, you can hold a séance with a living player.'],
    act: { verb: 'Séance', pick: 'seance' },
    uses: { seance: 1 },
  },
  retributionist: {
    name: 'Hard Forker', classic: 'Retributionist', icon: '🍴', cat: 'TS', unique: true, controlImmune: true,
    ability: 'Hard-fork the chain to bring one dead Town member back.',
    notes: ['1 use.', 'Laundered players can’t be revived.'],
    act: { verb: 'Revive', pick: 'deadTown' },
    uses: { revive: 1 },
  },
  transporter: {
    name: 'Mixer', classic: 'Transporter', icon: '🌀', cat: 'TS', rbImmune: true, controlImmune: true,
    ability: 'Mix two players at night, swapping their places.',
    notes: [
      'Everything aimed at one goes to the other instead.',
      'You can include yourself. You can’t be distracted or phished.',
    ],
    act: { verb: 'Mix', pick: 'two' },
  },

  // ---------- Cabal ----------
  godfather: {
    name: 'VC', classic: 'Godfather', icon: '💼', cat: 'CK', unique: true, attack: 1, defense: 1, detectImmune: true,
    ability: 'Decide who the Cabal rugs each night.',
    notes: [
      'Basic defense. You pass audits.',
      'If the Rug Puller is alive, they carry out your order. Otherwise you do it yourself.',
    ],
    act: { verb: 'Rug', pick: 'team' },
  },
  mafioso: {
    name: 'Rug Puller', classic: 'Mafioso', icon: '🔪', cat: 'CK', unique: true, attack: 1,
    ability: 'Carry out the VC’s orders.',
    notes: ['The VC’s choice overrides yours.', 'If the VC dies, you become the VC.'],
    act: { verb: 'Rug', pick: 'team' },
  },
  blackmailer: {
    name: 'Doxxer', classic: 'Blackmailer', icon: '📸', cat: 'CS',
    ability: 'Dox one player each night so they can’t talk the next day.',
    notes: ['You can read every whisper.', CABAL_NOTE],
    act: { verb: 'Dox', pick: 'team' },
  },
  consigliere: {
    name: 'Insider', classic: 'Consigliere', icon: '🤫', cat: 'CS',
    ability: 'Learn one player’s exact role each night.',
    notes: [CABAL_NOTE],
    act: { verb: 'Snoop', pick: 'team' },
  },
  consort: {
    name: 'Paid Shill', classic: 'Consort', icon: '📢', cat: 'CS', rbImmune: true,
    ability: 'Distract one player each night so they can’t act.',
    notes: ['You can’t be distracted.', 'Distract a Black Hat and they attack you instead.', CABAL_NOTE],
    act: { verb: 'Distract', pick: 'team' },
  },
  disguiser: {
    name: 'Sock Puppet', classic: 'Disguiser', icon: '🧦', cat: 'CD',
    ability: 'Dress a Cabal member up as another player for the night.',
    notes: [
      'Block Explorers see your target’s name instead of the Cabal member’s.',
      'Sleuths tracing the Cabal member see your target’s role list.',
      CABAL_NOTE,
    ],
    act: { verb: 'Disguise', pick: 'disguise' },
  },
  forger: {
    name: 'Spoofer', classic: 'Forger', icon: '✍️', cat: 'CD',
    ability: 'Spoof one player’s role and dead man’s switch.',
    notes: ['3 uses, spent only when your target dies that night.', 'The town sees the role and switch you wrote.', CABAL_NOTE],
    act: { verb: 'Spoof', pick: 'team' },
    uses: { forges: 3 },
  },
  framer: {
    name: 'FUDster', classic: 'Framer', icon: '🗞️', cat: 'CD',
    ability: 'Spread FUD about one player each night.',
    notes: ['Your target fails audits and shows your list to Sleuths until someone investigates them.', CABAL_NOTE],
    act: { verb: 'FUD', pick: 'team' },
  },
  janitor: {
    name: 'Launderer', classic: 'Janitor', icon: '🧼', cat: 'CD',
    ability: 'Launder one player’s death.',
    notes: [
      '3 uses, spent only when your target dies that night.',
      'The town can’t see their role or switch. You learn both.',
      CABAL_NOTE,
    ],
    act: { verb: 'Launder', pick: 'team' },
    uses: { cleans: 3 },
  },

  // ---------- Neutral ----------
  amnesiac: {
    name: 'Copy Trader', classic: 'Amnesiac', icon: '📋', cat: 'NB', controlImmune: true,
    ability: 'Copy the role of someone in the Burn Address.',
    goal: 'Copy a role, then win with its team.',
    notes: ['1 use. Everyone hears which role you copied.', 'You can’t copy a unique role.'],
    act: { verb: 'Copy', pick: 'dead' },
    uses: { remember: 1 },
  },
  survivor: {
    name: 'HODLer', classic: 'Survivor', icon: '💎', cat: 'NB', controlImmune: true,
    ability: 'Move into a cold wallet at night for Basic defense.',
    goal: 'Still be alive when the game ends.',
    notes: ['4 cold wallets.'],
    act: { verb: 'Cold wallet', pick: 'self' },
    uses: { vests: 4 },
  },
  executioner: {
    name: 'Short Seller', classic: 'Executioner', icon: '📉', cat: 'NE', defense: 1,
    ability: 'Trick the town into slashing your target.',
    goal: 'Get your target slashed. You win even if you die afterwards.',
    notes: ['Basic defense.', 'If your target dies at night, you become a Shitposter.'],
  },
  jester: {
    name: 'Shitposter', classic: 'Jester', icon: '🤡', cat: 'NE',
    ability: 'Trick the town into slashing you.',
    goal: 'Get yourself slashed.',
    notes: ['If you’re slashed, the next night you haunt one player who voted guilty or abstained (Unstoppable).'],
    act: { verb: 'Haunt', pick: 'haunt' },
  },
  witch: {
    name: 'Phisher', classic: 'Witch', icon: '🎣', cat: 'NE', controlImmune: true,
    ability: 'Phish one player each night, forcing them to use their ability on a target you choose.',
    goal: 'Survive to see the Town lose.',
    notes: ['You learn your victim’s role.', 'A one-time Basic-defense barrier breaks after the first attack.'],
    act: { verb: 'Phish', pick: 'two' },
  },
  arsonist: {
    name: 'Drainer', classic: 'Arsonist', icon: '🕳️', cat: 'NK', attack: 3, defense: 1, detectImmune: true,
    ability: 'Plant a malicious approval on a player, or drain every approved wallet.',
    goal: 'Drain everyone who could stop you.',
    notes: ['Draining is an Unstoppable attack.', 'Basic defense. You pass audits.'],
    act: { verb: 'Approve', pick: 'other', self: 'Drain everyone' },
  },
  serialKiller: {
    name: 'Black Hat', classic: 'Serial Killer', icon: '💀', cat: 'NK', attack: 1, defense: 1,
    ability: 'Exploit one player each night.',
    goal: 'Exploit everyone who could stop you.',
    notes: ['Basic defense.', 'If someone distracts you, you attack them instead of your target.'],
    act: { verb: 'Exploit', pick: 'other' },
  },
  werewolf: {
    name: 'Lunatic', classic: 'Werewolf', icon: '🌕', cat: 'NK', unique: true, attack: 2, defense: 1,
    ability: 'On full-moon nights (even nights), rampage at a player’s house.',
    goal: 'Maul everyone who could stop you.',
    notes: [
      'You attack your target and everyone who visits them. Pick yourself to stay home and attack your visitors.',
      'Basic defense. You pass audits except on full moons.',
    ],
    act: { verb: 'Rampage', pick: 'any', fullMoon: true },
  },
  vampire: {
    name: 'Maxi', classic: 'Vampire', icon: '🧛', cat: 'NC',
    ability: 'Orange-pill a player each night to turn them into a Maxi.',
    goal: 'Orange-pill or kill everyone who would oppose you.',
    notes: [
      'Maxis vote together; the youngest one visits.',
      'Cabal members and anyone with defense are attacked instead. At 4+ Maxis every bite is an attack.',
    ],
    act: { verb: 'Orange-pill', pick: 'team' },
  },
}

for (const [key, r] of Object.entries(ROLES)) {
  r.key = key
  r.faction = CATS[r.cat].faction
  r.attack ??= 0
  r.defense ??= 0
}

export const ROLE_KEYS = Object.keys(ROLES)
export const rolesIn = (cat) => ROLE_KEYS.filter((k) => ROLES[k].cat === cat)

// Teams that fight to be the last one standing. Everyone else wins on their own terms.
export function teamOf(role) {
  const r = ROLES[role]
  if (r.faction === 'town') return 'town'
  if (r.faction === 'cabal') return 'cabal'
  if (r.cat === 'NK') return role
  if (role === 'vampire') return 'vampire'
  return null
}

export const TEAM_NAMES = {
  town: 'The Town',
  cabal: 'The Cabal',
  vampire: 'The Maxis',
  serialKiller: 'The Black Hat',
  arsonist: 'The Drainer',
  werewolf: 'The Lunatic',
}

export const isEvil = (role) => {
  const r = ROLES[role]
  return r.faction === 'cabal' || r.cat === 'NK' || r.cat === 'NC' || r.cat === 'NE'
}

// Sleuth (Investigator) result lists.
export const INV_GROUPS = [
  ['vigilante', 'veteran', 'mafioso'],
  ['medium', 'janitor', 'retributionist'],
  ['survivor', 'vampireHunter', 'amnesiac'],
  ['spy', 'blackmailer', 'jailor'],
  ['sheriff', 'executioner', 'werewolf'],
  ['framer', 'vampire', 'jester'],
  ['lookout', 'forger', 'witch'],
  ['escort', 'transporter', 'consort'],
  ['doctor', 'disguiser', 'serialKiller'],
  ['investigator', 'consigliere', 'mayor'],
  ['bodyguard', 'godfather', 'arsonist'],
]
export const invGroup = (role) => INV_GROUPS.findIndex((g) => g.includes(role))
export const groupText = (g) => INV_GROUPS[g].map((r) => ROLES[r].name).join(', ')

// Town roles an evil player can claim so a Sleuth's result backs them up.
export const COVERS = {
  godfather: ['bodyguard'],
  mafioso: ['vigilante'],
  janitor: ['medium'],
  blackmailer: ['spy'],
  forger: ['lookout'],
  consort: ['escort', 'transporter'],
  disguiser: ['doctor'],
  consigliere: ['investigator'],
  serialKiller: ['doctor'],
  arsonist: ['bodyguard'],
  werewolf: ['sheriff'],
  witch: ['lookout'],
  executioner: ['sheriff'],
  framer: ['escort', 'doctor', 'lookout', 'medium'],
  vampire: ['lookout', 'doctor', 'escort', 'medium'],
  jester: ['sheriff', 'investigator', 'doctor', 'jailor'],
}

// ---------- role lists ----------

export const SLOTS = {
  RT: { name: 'Random Town', roles: () => ROLE_KEYS.filter((k) => ROLES[k].faction === 'town') },
  TI: { name: 'Town Investigative', roles: () => rolesIn('TI') },
  TK: { name: 'Town Killing', roles: () => rolesIn('TK') },
  TP: { name: 'Town Protective', roles: () => rolesIn('TP') },
  TS: { name: 'Town Support', roles: () => rolesIn('TS') },
  RC: { name: 'Random Cabal', roles: () => ROLE_KEYS.filter((k) => ROLES[k].faction === 'cabal') },
  CK: { name: 'Cabal Killing', roles: () => rolesIn('CK') },
  CD: { name: 'Cabal Deception', roles: () => rolesIn('CD') },
  CS: { name: 'Cabal Support', roles: () => rolesIn('CS') },
  RN: { name: 'Random Neutral', roles: () => ROLE_KEYS.filter((k) => ROLES[k].faction === 'neutral') },
  NB: { name: 'Neutral Benign', roles: () => rolesIn('NB') },
  NE: { name: 'Neutral Evil', roles: () => rolesIn('NE') },
  NK: { name: 'Neutral Killing', roles: () => rolesIn('NK') },
  NC: { name: 'Neutral Chaos', roles: () => rolesIn('NC') },
  ANY: { name: 'Any', roles: () => ROLE_KEYS },
}

export const slotName = (slot) => (ROLES[slot] ? ROLES[slot].name : SLOTS[slot].name)
export const slotFaction = (slot) => {
  if (ROLES[slot]) return ROLES[slot].faction
  if (slot === 'ANY') return 'any'
  if (slot === 'RT' || slot === 'RC' || slot === 'RN') return { RT: 'town', RC: 'cabal', RN: 'neutral' }[slot]
  return CATS[slot].faction
}

export const MODES = {
  classic: {
    name: 'Classic',
    blurb: 'The original fixed list: one Black Hat, a Short Seller and a Shitposter.',
    list: ['sheriff', 'doctor', 'investigator', 'investigator', 'jailor', 'medium', 'godfather', 'framer', 'executioner', 'escort', 'mafioso', 'lookout', 'serialKiller', 'TK', 'jester'],
  },
  ranked: {
    name: 'Ranked Practice',
    blurb: 'The competitive list: mostly categories, plus one wildcard Any.',
    list: ['jailor', 'TI', 'TI', 'TS', 'TS', 'TP', 'TK', 'RT', 'RT', 'godfather', 'mafioso', 'RC', 'NE', 'NK', 'ANY'],
  },
  allAny: {
    name: 'All Any',
    blurb: 'Fifteen wildcards. Anything can happen.',
    list: Array(15).fill('ANY'),
  },
  custom: {
    name: 'Custom',
    blurb: 'Build your own list of 7 to 15 slots.',
    list: ['jailor', 'sheriff', 'doctor', 'investigator', 'RT', 'godfather', 'mafioso', 'jester'],
  },
}

const specificity = (slot) => {
  if (ROLES[slot]) return 0
  if (CATS[slot]) return 1
  if (slot === 'ANY') return 3
  return 2
}

const randOf = (arr) => arr[Math.floor(Math.random() * arr.length)]

// Rolls an actual role for each slot. Fixed roles claim their unique spots first, then categories, then wildcards.
export function rollRoles(list) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const order = list.map((slot, i) => ({ slot, i })).sort((a, b) => specificity(a.slot) - specificity(b.slot))
    const out = Array(list.length)
    const used = new Set()
    let ok = true
    for (const { slot, i } of order) {
      if (ROLES[slot]) {
        if (ROLES[slot].unique && used.has(slot)) {
          ok = false
          break
        }
        out[i] = slot
        used.add(slot)
        continue
      }
      const options = SLOTS[slot].roles().filter((r) => !(ROLES[r].unique && used.has(r)) && !(r === 'vampire' && used.has(r)))
      if (!options.length) {
        ok = false
        break
      }
      out[i] = randOf(options)
      used.add(out[i])
    }
    if (!ok) continue
    // A Maxi Hunter only spawns when there's a Maxi to hunt.
    if (out.includes('vampireHunter') && !out.includes('vampire')) continue
    const teams = new Set(out.map(teamOf).filter(Boolean))
    if (teams.size < 2 || !teams.has('town')) continue
    return out
  }
  return null
}

// ---------- lobby flavor ----------

export const NAMES = [
  'Satoshi', 'Hal', 'Gwei', 'Ape', 'Paperhands', 'Ser', 'Fren', 'Wojak', 'Pepe', 'Chad', 'Normie', 'Jeet',
  'Moonboy', 'Bagholder', 'Lambo', 'Gigabrain', 'Kek', 'Wagmi', 'Anon', 'Rekt', 'Doge', 'Nakamoto',
]
export const AVATARS = ['🐸', '🦍', '🐶', '🦊', '🐼', '🐵', '🦄', '🐙', '🦖', '👽', '🤖', '🧙', '🐲', '🦉', '🐧', '🐻', '🦈', '🐱']
export const COLORS = Array.from({ length: 15 }, (_, i) => `var(--p${i + 1})`)

export const TERMS = [
  ['🔪', 'Rugged', 'Killed at night'],
  ['⚖️', 'Slashed', 'Lynched'],
  ['🔥', 'Burn Address', 'Graveyard'],
  ['📜', 'Dead man’s switch', 'Last will'],
  ['🃏', 'Calling card', 'Death note'],
  ['🧊', 'Cold Storage', 'Jail'],
  ['💬', 'Cabal group chat', 'Mafia chat'],
]
