'use strict';
// Offscreen README screenshot generator. Loads the real renderer HTML with a mock
// preload (synthetic data), switches views, and saves PNGs to .github/assets/preview/.
// Run: npx electron scripts/capture/capture.js
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const RENDERER = path.join(__dirname, '..', '..', 'src', 'electron', 'renderer');
const OUT = path.join(__dirname, '..', '..', '.github', 'assets', 'preview');
const PRELOAD = path.join(__dirname, 'mock-preload.js');

const BACKDROP = `html,body{background:linear-gradient(135deg,#0f2233 0%,#1a1430 55%,#2a1640 100%) !important;}
body{padding:18px !important;box-sizing:border-box !important;}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function makeWindow(file, width, height) {
  const win = new BrowserWindow({
    width, height, show: true, frame: false, transparent: false, backgroundColor: '#0f2233',
    webPreferences: { preload: PRELOAD, contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  await win.loadFile(path.join(RENDERER, file));
  await win.webContents.insertCSS(BACKDROP);
  await sleep(1800);
  return win;
}

async function shot(win, name) {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, `${name}.png`), img.toPNG());
  console.log('saved', name);
}

async function run(win, js) {
  await win.webContents.executeJavaScript(js, true).catch((e) => console.log('js err', e.message));
  await sleep(700);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // --- Widget (popover) shots ---
  const w = await makeWindow('index.html', 460, 720);
  await shot(w, 'widget-main'); // default: today + tool view + top tab bar + cost meta

  await run(w, `document.querySelector('.view-tab[data-view="session"]')?.click();`);
  await shot(w, 'sessions-view'); // project + AI title rows

  await run(w, `state.settings.modelSortByCost = true; (typeof setBreakdown==='function'&&setBreakdown('model')); (typeof render==='function'&&render());`);
  await shot(w, 'models-view'); // cost-ranked model view

  await run(w, `document.querySelector('.view-tab[data-view="device"]')?.click();`);
  await shot(w, 'devices-view');
  w.close();

  // --- Dashboard shots ---
  const d = await makeWindow('dashboard.html', 920, 600);
  await shot(d, 'dashboard-overview'); // default Overview tab (heatmap + cards)

  await run(d, `document.getElementById('trendsTab')?.click();`);
  await sleep(600);
  await shot(d, 'dashboard-trends');

  await run(d, `document.getElementById('rateTab')?.click();`);
  await sleep(800);
  await shot(d, 'dashboard-rate'); // usage rate graph
  d.close();

  console.log('DONE ->', OUT);
  app.quit();
}

app.whenReady().then(main).catch((e) => { console.error(e); app.quit(); });
