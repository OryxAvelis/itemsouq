/*
 * Blox Fruits reference catalogue.
 * Official names, rarity, type, shop prices, and cached artwork come from the Blox Fruits Wiki.
 * Community trade values and gameplay ratings are kept separately and come from DarkKitsune.
 */
window.ITEMSOUQ_FRUIT_SOURCE = {
  label: 'Blox Fruits Wiki · Fandom',
  url: 'https://blox-fruits.fandom.com/wiki/Blox_Fruits',
  imageApi: 'https://blox-fruits.fandom.com/api.php',
  localImageDirectory: 'assets/images/fruits',
  reviewedAt: '2026-09-22'
};

window.ITEMSOUQ_FRUIT_TRADE_SOURCE = {
  label: 'DarkKitsune · Fruits Information',
  url: 'https://darkkitsune.com/fruits',
  calculatorUrl: 'https://darkkitsune.com/calculator',
  reviewedAt: '2026-09-25',
  notes: {
    demand: 'DarkKitsune does not publish a separate demand score; its community value is used as the demand-aware market reference.',
    dragon: 'The East Dragon physical value is the ItemSouq baseline. West Dragon is listed separately by DarkKitsune at 3,200,000,000.',
    magnet: 'Magnet was not listed by DarkKitsune when these values were reviewed.'
  }
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
  { id: 'dragon', name: 'Dragon', rarity: 'Mythical', type: 'Beast', beli: 15000000, robux: 5000 },
  { id: 'magnet', name: 'Magnet', rarity: 'Mythical', type: 'Natural', beli: 6000000, robux: 3500 }
];

(() => {
  const darkKitsuneValues = {
    rocket: { physical: 5000, permanent: 2000000, rating: 1, pve: 1, pvp: 2 },
    spin: { physical: 7500, permanent: 2000000, rating: 1, pve: 1, pvp: 2 },
    blade: { physical: 30000, permanent: 3000000, rating: 1, pve: 4, pvp: 4 },
    spring: { physical: 60000, permanent: 2000000, rating: 1, pve: 1, pvp: 2 },
    bomb: { physical: 80000, permanent: 2500000, rating: 1, pve: 1, pvp: 1 },
    smoke: { physical: 100000, permanent: 14000000, rating: 1, pve: 2, pvp: 3 },
    spike: { physical: 180000, permanent: 10000000, rating: 1, pve: 1, pvp: 1 },

    flame: { physical: 300000, permanent: 75000000, rating: 3, pve: 6, pvp: 4 },
    ice: { physical: 600000, permanent: 150000000, rating: 3, pve: 5, pvp: 3 },
    sand: { physical: 420000, permanent: 350000000, rating: 2, pve: 3, pvp: 5 },
    dark: { physical: 500000, permanent: 300000000, rating: 3, pve: 4, pvp: 6 },
    eagle: { physical: 750000, permanent: 350000000, rating: 10, pve: 6, pvp: 4 },
    diamond: { physical: 800000, permanent: 300000000, rating: 7, pve: 4, pvp: 3 },

    light: { physical: 800000, permanent: 550000000, rating: 4, pve: 9, pvp: 4 },
    rubber: { physical: 750000, permanent: 250000000, rating: 2, pve: 3, pvp: 3 },
    ghost: { physical: 800000, permanent: 475000000, rating: 3, pve: 5, pvp: 4 },
    magma: { physical: 1200000, permanent: 500000000, rating: 5, pve: 9, pvp: 4 },

    quake: { physical: 1000000, permanent: 600000000, rating: 2, pve: 4, pvp: 4 },
    buddha: { physical: 10000000, permanent: 760000000, rating: 7, pve: 10, pvp: 6 },
    love: { physical: 1300000, permanent: 575000000, rating: 3, pve: 3, pvp: 4 },
    creation: { physical: 1750000, permanent: 600000000, rating: 10, pve: 4, pvp: 4 },
    spider: { physical: 1400000, permanent: 600000000, rating: 3, pve: 4, pvp: 4 },
    sound: { physical: 3000000, permanent: 800000000, rating: 4, pve: 6, pvp: 7 },
    phoenix: { physical: 2100000, permanent: 930000000, rating: 3, pve: 4, pvp: 3 },
    portal: { physical: 10000000, permanent: 400000000, rating: 7, pve: 5, pvp: 10 },
    lightning: { physical: 90000000, permanent: 400000000, rating: 6, pve: 6, pvp: 9 },
    pain: { physical: 12000000, permanent: 1200000000, rating: 3, pve: 3, pvp: 8 },
    blizzard: { physical: 4000000, permanent: 400000000, rating: 5, pve: 8, pvp: 3 },

    gravity: { physical: 15000000, permanent: 1300000000, rating: 10, pve: 6, pvp: 5 },
    mammoth: { physical: 10000000, permanent: 1200000000, rating: 5, pve: 5, pvp: 3 },
    't-rex': { physical: 25000000, permanent: 1300000000, rating: 6, pve: 6, pvp: 6 },
    dough: { physical: 30000000, permanent: 1450000000, rating: 7, pve: 4, pvp: 7 },
    shadow: { physical: 5000000, permanent: 1000000000, rating: 5, pve: 4, pvp: 4 },
    venom: { physical: 8000000, permanent: 1450000000, rating: 6, pve: 5, pvp: 3 },
    gas: { physical: 75000000, permanent: 1650000000, rating: 10, pve: 6, pvp: 6 },
    spirit: { physical: 11000000, permanent: 1550000000, rating: 6, pve: 5, pvp: 5 },
    tiger: { physical: 165000000, permanent: 4000000000, rating: 10, pve: 5, pvp: 6 },
    yeti: { physical: 160000000, permanent: 1800000000, rating: 10, pve: 5, pvp: 5 },
    kitsune: { physical: 400000000, permanent: 2300000000, rating: 10, pve: 6, pvp: 10 },
    control: { physical: 180000000, permanent: 5630000000, rating: 6, pve: 2, pvp: 3 },
    dragon: {
      physical: 3000000000,
      permanent: 4500000000,
      rating: 10,
      pve: 10,
      pvp: 6,
      variant: 'east-baseline',
      alternatePhysical: 3200000000
    }
  };

  window.ITEMSOUQ_FRUITS = window.ITEMSOUQ_FRUITS.map((fruit) => ({
    ...fruit,
    trade: darkKitsuneValues[fruit.id] || null
  }));
})();
