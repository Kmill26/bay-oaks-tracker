// v67: backup.html is the way out of a stale cached shell. These checks hold it to that:
// never cached by the SW, self-contained, read-only, same store key, and its payload is the
// same backup envelope the native importer reads. Plus the tap-only update banner.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'fs';

const root = new URL('../../', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const html = read('backup.html');
const sw = read('sw.js');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('backup.html is not in the SW ASSETS list and the fetch handler lets it hit the network', () => {
  const assets = sw.match(/const ASSETS=\[([\s\S]*?)\];/)[1];
  assert.ok(!/backup/.test(assets), assets);
  assert.match(sw, /pathname\.endsWith\('\/backup\.html'\)\)return;/);
});

test('backup.html loads nothing: no external script, stylesheet, or import', () => {
  assert.ok(!/<script[^>]+src=/i.test(html));
  assert.ok(!/<link[^>]+stylesheet/i.test(html));
  assert.ok(!/\bimport\s*[\(\{'"]/.test(script));
});

test('backup.html never writes localStorage and uses the same STORE key as the app', () => {
  assert.ok(!/localStorage\.(setItem|removeItem|clear)/.test(html));
  const appStore = read('js/seed.js').match(/var STORE='([^']+)'/)[1];
  assert.match(script, new RegExp("var STORE='" + appStore + "'"));
});

function runPage(stored) {
  const els = {};
  const mk = id => els[id] || (els[id] = {id, textContent:'', innerHTML:'', className:'', value:'', style:{}, children:[],
    appendChild(c){ this.children.push(c); }, focus(){}, select(){}, onclick:null});
  const writes = [];
  const g = {
    document: {getElementById: mk, createElement: () => ({textContent:''}), execCommand: () => false},
    localStorage: {getItem: k => stored[k] ?? null, setItem: () => writes.push('set'), removeItem: () => writes.push('rm'), clear: () => writes.push('clear')},
    navigator: {}, File: class { constructor(p, n, o) { this.text = p.join(''); this.name = n; this.type = o.type; } },
    window: {},
  };
  new Function('document','localStorage','navigator','File','window', script)(g.document, g.localStorage, g.navigator, g.File, g.window);
  return {els, writes, api: g.window.__bayOaksBackup, g};
}

// A store shaped like the one js/app.js saves (rounds + the round on screen); no outside files.
const hole = (score) => ({score, fir:null, gir:null, ss:null, chip:null, putts:null, sixAtt:null, sixMade:null, pen:null, notes:''});
const backup = {store: read('js/seed.js').match(/var STORE='([^']+)'/)[1], data: {
  date: '2026-10-05', holes: Array.from({length:18}, (_, i) => hole(i < 3 ? 4 : null)), dirty: false, mode: 'full', tee: 'blue',
  rounds: ['2026-07-15','2026-08-19','2026-08-01'].map((date, k) => ({id:'r'+k, date, tee:'blue', holes: Array.from({length:18}, () => hole(5))}))}};
const stored = {[backup.store]: JSON.stringify(backup.data)};

test('backup.html shows round count, newest date, and builds the importer envelope', () => {
  const {els, writes, api} = runPage(stored);
  const facts = els.facts.children.map(c => c.textContent);
  assert.equal(facts[0], backup.data.rounds.length + ' saved rounds');
  const newest = backup.data.rounds.map(r => r.date).sort().pop();
  assert.equal(facts[1], 'Newest saved round: ' + newest);
  const p = JSON.parse(api.buildPayload(backup.data));
  assert.equal(p.kind, 'backup'); assert.equal(p.app, 'bay-oaks-tracker'); assert.equal(p.format, 1);
  assert.deepEqual(p.data, backup.data);
  assert.match(api.fileName(), /^bay-oaks-backup-\d{4}-\d{2}-\d{2}\.txt$/);
  assert.deepEqual(writes, []);
});

test('backup.html share: text/plain .txt, and every outcome writes a visible result line', async () => {
  let shared = null;
  const r = runPage(stored);
  r.g.navigator.canShare = () => true;
  r.g.navigator.share = o => { shared = o.files[0]; return Promise.resolve(); };
  r.els.shareBtn.onclick(); await new Promise(s => setImmediate(s));
  assert.equal(shared.type, 'text/plain'); assert.match(shared.name, /\.txt$/);
  assert.match(r.els.result.textContent, /^Shared bay-oaks-backup-/);
  r.g.navigator.canShare = () => false;
  r.els.shareBtn.onclick();
  assert.match(r.els.result.textContent, /would not share the file/);
  r.g.navigator.canShare = () => true;
  r.g.navigator.share = () => Promise.reject(Object.assign(new Error('x'), {name:'AbortError'}));
  r.els.shareBtn.onclick(); await new Promise(s => setImmediate(s));
  assert.match(r.els.result.textContent, /^Share cancelled/);
});

test('backup.html copy and show: clipboard, refused clipboard, and the selectable textarea', async () => {
  const r = runPage(stored);
  let clip = null;
  r.g.navigator.clipboard = {writeText: t => { clip = t; return Promise.resolve(); }};
  r.els.copyBtn.onclick(); await new Promise(s => setImmediate(s));
  assert.equal(JSON.parse(clip).kind, 'backup');
  assert.match(r.els.result.textContent, /^Copied to clipboard/);
  r.g.navigator.clipboard = {writeText: () => Promise.reject(Object.assign(new Error('x'), {name:'NotAllowedError'}))};
  r.els.copyBtn.onclick(); await new Promise(s => setImmediate(s));
  assert.match(r.els.result.textContent, /Clipboard refused \(NotAllowedError\).*long-press/);
  r.els.showBtn.onclick();
  assert.equal(JSON.parse(r.els.text.value).kind, 'backup');
  assert.equal(r.els.text.style.display, 'block');
});

test('backup.html with nothing saved says so instead of going blank', () => {
  const r = runPage({});
  assert.match(r.els.facts.textContent, /No saved rounds found/);
  r.els.copyBtn.onclick();
  assert.match(r.els.result.textContent, /^Nothing to copy/);
});

test('version label matches the SW cache generation', () => {
  const v = read('js/app.js').match(/var APP_VERSION='(v\d+)'/)[1];
  assert.equal('bayoaks-' + v, sw.match(/const C='([^']+)'/)[1]);
  assert.match(read('index.html'), /id="appVersion"/);
});

// Update banner: drive the real applyUpdate() from js/*.js.
const src = ['js/seed.js','js/stats.js','js/course.js','js/player.js','js/app.js']
  .map(f => read(f)).join('\n').replace(/load\(\); render\(\);[\s\S]*$/, '');
const els = {};
const el = id => els[id] || (els[id] = {textContent:'', innerHTML:'', value:'', hidden:true, style:{display:''}, className:'', appendChild(){}, classList:{add(){},remove(){},toggle(){return false;}}});
global.document = {getElementById: el, createElement: () => ({classList:{add(){},remove(){},toggle(){return false;}}, appendChild(){}}), body:{appendChild(){},removeChild(){},classList:{add(){},remove(){},toggle(){return false;}}}};
const disk = {};
global.localStorage = {getItem: k => disk[k] ?? null, setItem: (k,v) => { disk[k] = String(v); }, removeItem: k => { delete disk[k]; }};
global.confirm = () => true; global.window = global;
Object.defineProperty(global, 'navigator', {value: {}, configurable: true});
(0, eval)(src);
load();

test('update banner: shows when a worker is waiting, and the tap never activates or reloads', () => {
  showUpdateBanner();
  assert.equal(el('updateBanner').hidden, false);
  assert.equal(applyUpdate(), false);
  assert.match(el('updateBanner').textContent, /swipe Bay Oaks away in Recents/);
  const app = read('js/app.js');
  assert.ok(!/skipWaiting|location\.reload\(/.test(app));
  assert.equal(sw.indexOf('skipWaiting'), -1);
});
