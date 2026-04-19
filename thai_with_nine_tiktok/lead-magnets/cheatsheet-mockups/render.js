#!/usr/bin/env node
/**
 * Render classifier cheat sheet mockups to PDF via Puppeteer.
 * Usage: node render.js
 * Outputs: concept-<x>.pdf
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const DATA = JSON.parse(fs.readFileSync(path.join(DIR, 'data.json'), 'utf8'));
const CONCEPTS = ['concept-d'];
const IMAGES_DIR = path.join(DIR, 'images');
const EXAMPLES_DIR = path.join(IMAGES_DIR, 'examples');
const LOGO_PATH = '/Users/olivertopping/src/thai-nine/Immersion Thai with nine logo.png';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Build base64 map for per-classifier hero images (original set in images/)
function buildImageMap() {
  const map = {};
  if (!fs.existsSync(IMAGES_DIR)) return map;
  for (const file of fs.readdirSync(IMAGES_DIR)) {
    const fullPath = path.join(IMAGES_DIR, file);
    if (!fs.statSync(fullPath).isFile()) continue;
    if (!file.endsWith('.png')) continue;
    const key = file.replace('.png', '');
    const data = fs.readFileSync(fullPath);
    map[key] = `data:image/png;base64,${data.toString('base64')}`;
  }
  return map;
}

// Build base64 map for per-example icons (images/examples/<slug>.{svg,png})
function buildExampleIconMap() {
  const map = {};
  if (!fs.existsSync(EXAMPLES_DIR)) return map;
  for (const file of fs.readdirSync(EXAMPLES_DIR)) {
    const fullPath = path.join(EXAMPLES_DIR, file);
    if (!fs.statSync(fullPath).isFile()) continue;
    const ext = path.extname(file).toLowerCase();
    const key = file.slice(0, -ext.length);
    const data = fs.readFileSync(fullPath);
    const mime = ext === '.svg' ? 'image/svg+xml' : 'image/png';
    map[key] = `data:${mime};base64,${data.toString('base64')}`;
  }
  return map;
}

// Embed the Immersion Thai with Nine logo
function loadLogo() {
  if (!fs.existsSync(LOGO_PATH)) {
    console.warn(`  ! Logo not found at ${LOGO_PATH}`);
    return '';
  }
  const data = fs.readFileSync(LOGO_PATH);
  return `data:image/png;base64,${data.toString('base64')}`;
}

async function renderPDF(concept) {
  let html = fs.readFileSync(path.join(DIR, `${concept}.html`), 'utf8');

  html = html.replace('CLASSIFIER_DATA', JSON.stringify(DATA));
  html = html.replace('IMAGE_MAP_DATA', JSON.stringify(buildImageMap()));
  html = html.replace('EXAMPLE_ICON_MAP_DATA', JSON.stringify(buildExampleIconMap()));
  html = html.replace('"LOGO_DATA"', JSON.stringify(loadLogo()));

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
  });
  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  const outPath = path.join(DIR, `${concept}.pdf`);
  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  console.log(`  ✓ ${concept}.pdf`);
  return outPath;
}

async function main() {
  console.log('Rendering classifier cheat sheet mockups...\n');

  for (const concept of CONCEPTS) {
    await renderPDF(concept);
  }

  console.log('\nDone! PDFs saved to:');
  CONCEPTS.forEach(c => console.log(`  ${path.join(DIR, c + '.pdf')}`));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
