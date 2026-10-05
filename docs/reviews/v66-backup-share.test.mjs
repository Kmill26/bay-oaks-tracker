// v66: Backup JSON must never fail silently. Drives the real backupJSON() from js/*.js with
// a stubbed browser for each path Chrome on Android can take.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'fs';

const root = new URL('../../', import.meta.url);
const src = ['js/seed.js','js/stats.js','js/course.js','js/player.js','js/app.js']
  .map(f => readFileSync(new URL(f, root), 'utf8')).join('\n').replace(/load\(\); render\(\);[\s\S]*$/, '');

const els = {};
const el = id => els[id] || (els[id] = {textContent:'', innerHTML:'', value:'', style:{display:''}, className:'', appendChild(){}, classList:{add(){},remove(){},toggle(){return false;}}});
let downloads = [];
global.document = {getElementById: el, createElement: () => ({value:'', select(){}, click(){ downloads.push(this.download); }, remove(){}, classList:{add(){},remove(){},toggle(){return false;}}, appendChild(){}}), body:{appendChild(){},removeChild(){},classList:{add(){},remove(){},toggle(){return false;}}}};
const disk = {};
global.localStorage = {getItem: k => disk[k] ?? null, setItem: (k,v) => { disk[k] = String(v); }, removeItem: k => { delete disk[k]; }};
global.File = class { constructor(parts, name, o) { this.text = parts.join(''); this.name = name; this.type = o.type; } };
global.confirm = () => true; global.window = global;
global.setTimeout = () => 0; // the status line must still be there when we read it
let nav = {};
Object.defineProperty(global, 'navigator', {get: () => nav, configurable: true});
(0, eval)(src);
load();

function reset(n) { downloads = []; els['copiedMsg'] = undefined; nav = n; }
const msg = () => el('copiedMsg').textContent;
const err = name => Object.assign(new Error(name), {name});

test('Chrome refuses .json but takes .txt as text/plain: shares the .txt and says so', async () => {
  let shared = null, clip = null;
  reset({canShare: o => o.files[0].name.endsWith('.txt') && o.files[0].type === 'text/plain',
         share: o => { shared = o.files[0]; return Promise.resolve(); },
         clipboard: {writeText: t => { clip = t; return Promise.resolve(); }}});
  await backupJSON();
  assert.match(shared.name, /^bay-oaks-backup-\d{4}-\d{2}-\d{2}\.txt$/);
  assert.equal(shared.type, 'text/plain');
  const body = JSON.parse(shared.text);
  assert.equal(body.kind, 'backup'); assert.equal(body.app, 'bay-oaks-tracker');
  assert.match(msg(), /^Shared bay-oaks-backup-.*\.txt\./);
  assert.match(msg(), /close and reopen the app/);
  assert.equal(downloads.length, 0);
});

test('a browser that takes the .json name gets the .json name', async () => {
  let shared = null;
  reset({canShare: () => true, share: o => { shared = o.files[0]; return Promise.resolve(); }});
  await backupJSON();
  assert.match(shared.name, /\.json$/); assert.equal(shared.type, 'text/plain');
});

test('canShare says no to both names: download + clipboard, and the reason is shown', async () => {
  let clip = null;
  reset({canShare: () => false, share: () => { throw new Error('must not share'); },
         clipboard: {writeText: t => { clip = t; return Promise.resolve(); }}});
  await backupJSON();
  assert.equal(downloads.length, 1); assert.match(downloads[0], /\.json$/);
  assert.equal(JSON.parse(clip).kind, 'backup');
  assert.match(msg(), /would not share the file/);
  assert.match(msg(), /Saved to Downloads as bay-oaks-backup-/);
  assert.match(msg(), /Copied to clipboard\./);
});

test('share rejects with a real error: falls back and shows that error', async () => {
  let clip = null;
  reset({canShare: () => true, share: () => Promise.reject(err('NotAllowedError')),
         clipboard: {writeText: t => { clip = t; return Promise.resolve(); }}});
  await backupJSON();
  assert.equal(downloads.length, 1); assert.ok(clip);
  assert.match(msg(), /Share failed \(NotAllowedError\)/);
  assert.match(msg(), /Copied to clipboard\./);
});

test('user cancels the share sheet: no download, no clipboard, says cancelled', async () => {
  let clip = null;
  reset({canShare: () => true, share: () => Promise.reject(err('AbortError')),
         clipboard: {writeText: t => { clip = t; return Promise.resolve(); }}});
  await backupJSON();
  assert.equal(downloads.length, 0); assert.equal(clip, null);
  assert.match(msg(), /^Share cancelled/);
});

test('no Web Share and the clipboard refuses: still a visible line with the real error', async () => {
  reset({clipboard: {writeText: () => Promise.reject(err('NotAllowedError'))}});
  await backupJSON();
  assert.equal(downloads.length, 1);
  assert.match(msg(), /Sharing is not available here\./);
  assert.match(msg(), /Clipboard copy failed \(NotAllowedError\)/);
});

test('no Web Share, no clipboard API: download, and it says the clipboard is unavailable', async () => {
  reset({});
  await backupJSON();
  assert.equal(downloads.length, 1);
  assert.match(msg(), /Clipboard not available/);
});
