const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'assets', 'js', 'fruits.js'), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: 'assets/js/fruits.js' });

const fruits = sandbox.window.ITEMSOUQ_FRUITS;
const tradeSource = sandbox.window.ITEMSOUQ_FRUIT_TRADE_SOURCE;

assert.ok(Array.isArray(fruits), 'Fruit catalogue must be an array.');
assert.equal(fruits.length, 42, 'The catalogue should contain 42 current fruits.');
assert.equal(tradeSource.url, 'https://darkkitsune.com/fruits');
assert.equal(tradeSource.reviewedAt, '2026-09-25');

for (const fruit of fruits) {
  if (fruit.id === 'magnet') {
    assert.equal(fruit.trade, null, 'Magnet must stay unavailable until DarkKitsune publishes a value.');
    continue;
  }

  assert.ok(fruit.trade, `${fruit.name} is missing DarkKitsune trade data.`);
  for (const field of ['physical', 'permanent', 'rating', 'pve', 'pvp']) {
    assert.ok(Number.isFinite(fruit.trade[field]) && fruit.trade[field] > 0, `${fruit.name}.${field} must be a positive number.`);
  }
}

const byId = new Map(fruits.map((fruit) => [fruit.id, fruit]));
assert.equal(byId.get('lightning').beli, 2100000, 'Official shop price must remain separate.');
assert.equal(byId.get('lightning').trade.physical, 90000000, 'Lightning must use its community trade value.');
assert.equal(byId.get('control').trade.permanent, 5630000000);
assert.equal(byId.get('dragon').trade.physical, 3000000000, 'Dragon must use the East baseline.');
assert.equal(byId.get('dragon').trade.alternatePhysical, 3200000000, 'West Dragon value must remain disclosed.');

console.log('Trade value coverage passed: 41 valued fruits, 1 source-pending fruit.');
