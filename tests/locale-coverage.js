/* Verify that every public UI translation key exists in French and Darija. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const localePath = path.join(root, 'assets', 'js', 'locale.js');
const localeSource = fs.readFileSync(localePath, 'utf8');
const frenchStart = localeSource.indexOf('    fr: {');
const darijaStart = localeSource.indexOf('    ary: {');
const dictionaryEnd = localeSource.indexOf('\n    }\n  };', darijaStart);

if (frenchStart < 0 || darijaStart < 0 || dictionaryEnd < 0) {
  throw new Error('Could not locate both locale dictionaries.');
}

function keysIn(source) {
  return new Set([...source.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]));
}

const frenchKeys = keysIn(localeSource.slice(frenchStart, darijaStart));
const darijaKeys = keysIn(localeSource.slice(darijaStart, dictionaryEnd));
const usedKeys = new Set();
const publicFiles = [
  'index.html',
  'trading.html',
  'calculator.html',
  'assets/js/app.js',
  'assets/js/trading.js',
  'assets/js/calculator.js'
];

for (const relativePath of publicFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const match of source.matchAll(/\bl\(\s*['"]([^'"]+)['"]/g)) usedKeys.add(match[1]);
  for (const match of source.matchAll(/data-(?:i18n(?:-html|-placeholder|-aria|-title|-content|-alt|-whatsapp)?|whatsapp-i18n)=["']([^"']+)["']/g)) {
    usedKeys.add(match[1]);
  }
}

const missingFrench = [...usedKeys].filter((key) => !frenchKeys.has(key)).sort();
const missingDarija = [...usedKeys].filter((key) => !darijaKeys.has(key)).sort();

if (missingFrench.length || missingDarija.length) {
  if (missingFrench.length) console.error(`Missing French keys (${missingFrench.length}):\n${missingFrench.join('\n')}`);
  if (missingDarija.length) console.error(`Missing Darija keys (${missingDarija.length}):\n${missingDarija.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Locale coverage passed: ${usedKeys.size} public keys exist in French and Darija.`);
}
