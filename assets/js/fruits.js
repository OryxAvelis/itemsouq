/*
 * Blox Fruits reference catalogue.
 * Names, rarity, type, Beli value, permanent Robux value, and cached artwork are sourced only
 * from https://blox-fruits.fandom.com/wiki/Blox_Fruits
 */
window.ITEMSOUQ_FRUIT_SOURCE = {
  label: 'Blox Fruits Wiki · Fandom',
  url: 'https://blox-fruits.fandom.com/wiki/Blox_Fruits',
  imageApi: 'https://blox-fruits.fandom.com/api.php',
  localImageDirectory: 'assets/images/fruits',
  reviewedAt: '2026-08-30'
};

window.ITEMSOUQ_FRUITS = [
  { id: 'rocket', name: 'Rocket', rarity: 'Common', type: 'Natural', beli: 5000, robux: 50 },
  { id: 'spin', name: 'Spin', rarity: 'Common', type: 'Natural', beli: 7500, robux: 75 },
  { id: 'blade', name: 'Blade', rarity: 'Common', type: 'Natural', beli: 30000, robux: 100 },
  { id: 'spring', name: 'Spring', rarity: 'Common', type: 'Natural', beli: 60000, robux: 180 },
  { id: 'bomb', name: 'Bomb', rarity: 'Common', type: 'Natural', beli: 80000, robux: 220 },
  { id: 'smoke', name: 'Smoke', rarity: 'Common', type: 'Elemental', beli: 100000, robux: 250 },
  { id: 'spike', name: 'Spike', rarity: 'Common', type: 'Natural', beli: 180000, robux: 380 },

  { id: 'flame', name: 'Flame', rarity: 'Uncommon', type: 'Elemental', beli: 250000, robux: 550 },
  { id: 'ice', name: 'Ice', rarity: 'Uncommon', type: 'Elemental', beli: 350000, robux: 750 },
  { id: 'sand', name: 'Sand', rarity: 'Uncommon', type: 'Elemental', beli: 420000, robux: 850 },
  { id: 'dark', name: 'Dark', rarity: 'Uncommon', type: 'Elemental', beli: 500000, robux: 950 },
  { id: 'eagle', name: 'Eagle', rarity: 'Uncommon', type: 'Beast', beli: 550000, robux: 975 },
  { id: 'diamond', name: 'Diamond', rarity: 'Uncommon', type: 'Natural', beli: 600000, robux: 1000 },

  { id: 'light', name: 'Light', rarity: 'Rare', type: 'Elemental', beli: 650000, robux: 1100 },
  { id: 'rubber', name: 'Rubber', rarity: 'Rare', type: 'Natural', beli: 750000, robux: 1200 },
  { id: 'ghost', name: 'Ghost', rarity: 'Rare', type: 'Natural', beli: 940000, robux: 1275 },
  { id: 'magma', name: 'Magma', rarity: 'Rare', type: 'Elemental', beli: 960000, robux: 1300 },

  { id: 'quake', name: 'Quake', rarity: 'Legendary', type: 'Natural', beli: 1000000, robux: 1500 },
  { id: 'buddha', name: 'Buddha', rarity: 'Legendary', type: 'Beast', beli: 1200000, robux: 1650 },
  { id: 'love', name: 'Love', rarity: 'Legendary', type: 'Natural', beli: 1300000, robux: 1700 },
  { id: 'creation', name: 'Creation', rarity: 'Legendary', type: 'Natural', beli: 1400000, robux: 1750 },
  { id: 'spider', name: 'Spider', rarity: 'Legendary', type: 'Natural', beli: 1500000, robux: 1800 },
  { id: 'sound', name: 'Sound', rarity: 'Legendary', type: 'Natural', beli: 1700000, robux: 1900 },
  { id: 'phoenix', name: 'Phoenix', rarity: 'Legendary', type: 'Beast', beli: 1800000, robux: 2000 },
  { id: 'portal', name: 'Portal', rarity: 'Legendary', type: 'Natural', beli: 1900000, robux: 2000 },
  { id: 'lightning', name: 'Lightning', rarity: 'Legendary', type: 'Elemental', beli: 2100000, robux: 2100 },
  { id: 'pain', name: 'Pain', rarity: 'Legendary', type: 'Natural', beli: 2300000, robux: 2200 },
  { id: 'blizzard', name: 'Blizzard', rarity: 'Legendary', type: 'Elemental', beli: 2400000, robux: 2250 },

  { id: 'gravity', name: 'Gravity', rarity: 'Mythical', type: 'Natural', beli: 2500000, robux: 2300 },
  { id: 'mammoth', name: 'Mammoth', rarity: 'Mythical', type: 'Beast', beli: 2700000, robux: 2350 },
  { id: 't-rex', name: 'T-Rex', rarity: 'Mythical', type: 'Beast', beli: 2700000, robux: 2350 },
  { id: 'dough', name: 'Dough', rarity: 'Mythical', type: 'Elemental', beli: 2800000, robux: 2400 },
  { id: 'shadow', name: 'Shadow', rarity: 'Mythical', type: 'Natural', beli: 2900000, robux: 2425 },
  { id: 'venom', name: 'Venom', rarity: 'Mythical', type: 'Natural', beli: 3000000, robux: 2450 },
  { id: 'gas', name: 'Gas', rarity: 'Mythical', type: 'Elemental', beli: 3200000, robux: 2500 },
  { id: 'spirit', name: 'Spirit', rarity: 'Mythical', type: 'Natural', beli: 3400000, robux: 2550 },
  { id: 'tiger', name: 'Tiger', rarity: 'Mythical', type: 'Beast', beli: 5000000, robux: 3000 },
  { id: 'yeti', name: 'Yeti', rarity: 'Mythical', type: 'Beast', beli: 5000000, robux: 3000 },
  { id: 'kitsune', name: 'Kitsune', rarity: 'Mythical', type: 'Beast', beli: 8000000, robux: 4000 },
  { id: 'control', name: 'Control', rarity: 'Mythical', type: 'Natural', beli: 9000000, robux: 4000 },
  { id: 'dragon', name: 'Dragon', rarity: 'Mythical', type: 'Beast', beli: 15000000, robux: 5000 }
];
