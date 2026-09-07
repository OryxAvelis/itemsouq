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
  return new Set([...source.matchAll(/^\s*(?:'([^']+)'|([A-Za-z][A-Za-z0-9]*))\s*:/gm)].map((match) => match[1] || match[2]));
}

function embeddedDictionary(source, label) {
  const french = source.indexOf('\n    fr: {');
  const darija = source.indexOf('\n    ary: {', french + 1);
  const end = source.indexOf('\n    }\n  };', darija + 1);
  if (french < 0 || darija < 0 || end < 0) throw new Error(`Could not locate the ${label} dictionaries.`);
  return {
    french: keysIn(source.slice(french, darija)),
    darija: keysIn(source.slice(darija, end))
  };
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
  const embeddedPages = [
    {
      label: 'Game Passes',
      html: 'gamepasses.html',
      script: 'assets/js/gamepasses.js',
      attribute: /data-gp-i18n(?:-html|-placeholder|-aria|-content)?=["']([^"']+)["']/g,
      lookup: /\bl\(\s*['"]([^'"]+)['"]/g
    },
    {
      label: 'Services',
      html: 'services.html',
      script: 'assets/js/services.js',
      attribute: /data-services-i18n(?:-aria)?=["']([^"']+)["']/g,
      lookup: /\bt\(\s*['"]([^'"]+)['"]/g
    }
  ];
  let embeddedUsedCount = 0;
  const embeddedFailures = [];
  for (const page of embeddedPages) {
    const htmlSource = fs.readFileSync(path.join(root, page.html), 'utf8');
    const scriptSource = fs.readFileSync(path.join(root, page.script), 'utf8');
    const dictionaries = embeddedDictionary(scriptSource, page.label);
    const pageKeys = new Set();
    for (const match of htmlSource.matchAll(page.attribute)) pageKeys.add(match[1]);
    for (const match of scriptSource.matchAll(page.lookup)) pageKeys.add(match[1]);
    embeddedUsedCount += pageKeys.size;
    for (const key of pageKeys) {
      if (!dictionaries.french.has(key)) embeddedFailures.push(`${page.label} French: ${key}`);
      if (!dictionaries.darija.has(key)) embeddedFailures.push(`${page.label} Darija: ${key}`);
    }
  }
  if (embeddedFailures.length) {
    console.error(`Missing embedded page translations (${embeddedFailures.length}):\n${embeddedFailures.sort().join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Locale coverage passed: ${usedKeys.size} shared and ${embeddedUsedCount} page-specific keys exist in French and Darija.`);
  }
}
