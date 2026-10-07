// Focused state-level regression checks for round setup. Zero dependencies.
// Run: node --test docs/reviews/round-settings-regression.test.mjs
// This supplements (and never replaces or relaxes) npm test's oracle + ship gate.
// DOM stubs cover event wiring and state transitions, not visual browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import vm from 'node:vm';

const root = fileURLToPath(new URL('../../', import.meta.url));
const sources = ['js/seed.js', 'js/stats.js', 'js/course.js', 'js/player.js', 'js/app.js'];
const source = sources.map(f => readFileSync(resolve(root, f), 'utf8')).join('\n');
assert.match(source, /load\(\);\s*render\(\);/, 'app still exposes its classic-script boot');
const withoutBoot = source.replace(/load\(\);\s*render\(\);[\s\S]*$/, '');
const plain = value => JSON.parse(JSON.stringify(value));

function element() {
  let html = '';
  const classes = new Set();
  const el = {
    textContent:'', value:'', className:'', style:{display:''}, children:[], attributes:{},
    hidden:false, disabled:false,
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter(c => c !== child); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] ?? null; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener() {}, focus() {}, select() {},
    classList: {
      add(value) { classes.add(value); }, remove(value) { classes.delete(value); },
      contains(value) { return classes.has(value); },
      toggle(value, force) {
        const on = force ?? !classes.has(value);
        if (on) classes.add(value); else classes.delete(value);
        return on;
      }
    }
  };
  Object.defineProperty(el, 'innerHTML', {
    get:() => html,
    set(value) { html = String(value); el.children = []; }
  });
  return el;
}

function harness() {
  const entries = new Map();
  const writes = [];
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const storage = {
    get length() { return entries.size; },
    key(index) { return [...entries.keys()][index] ?? null; },
    getItem(key) { return entries.get(key) ?? null; },
    setItem(key, value) { entries.set(key, String(value)); writes.push(key); },
    removeItem(key) { entries.delete(key); }
  };
  const context = vm.createContext({
    console, navigator:{onLine:true}, localStorage:storage,
    document:{getElementById:get, createElement:element, body:element(),
      querySelector:() => null, querySelectorAll:() => [], addEventListener() {}},
    confirm:() => true, alert() {}, setTimeout:() => 0, clearTimeout() {}
  });
  vm.runInContext(withoutBoot, context, {filename:'bay-oaks-classic-scripts.js'});
  context.state = {date:context.today(), holes:context.mk(), rounds:[], schemaVersion:2,
    mode:'full', tee:'blue', pin:'?', dirty:false, exported:false, rev:0,
    roundId:'test-round'};
  context.holes = context.state.holes;
  context.cur = 0;
  assert.equal(context.save(), true);
  context.render();
  return {app:context, storage, entries, writes, get};
}

function choosePin(h, letter) {
  h.app.pinSeg();
  const button = h.get('pinBtns').children.find(b => b.textContent === letter);
  assert.ok(button, 'pin button ' + letter + ' is rendered');
  button.onclick();
}

function stored(h) { return JSON.parse(h.storage.getItem(h.app.STORE)); }

// A default is inheritance. An explicit tee remains an override even if it equals
// the old default; legacy storage cannot reveal whether that equality was deliberate.
test('round default changes inherited holes without materializing per-hole overrides', () => {
  const {app:a} = harness();
  a.setGlobalTee('tips');
  assert.equal(a.state.tee, 'tips');
  assert.ok(a.holes.every(h => h.tee == null));
  assert.ok(a.holes.every((_, i) => a.holeTee(i) === 'tips'));
  assert.equal(a.getTeeProfile().yds, 7026);
  a.setGlobalTee('blue');
  assert.equal(a.getTeeProfile().yds, 6594);
  assert.equal(a.getTeeProfile().label, 'Blue');
  a.setGlobalTee('white');
  assert.equal(a.getTeeProfile().yds, 6092);
  assert.equal(a.getTeeProfile().label, 'White');
  assert.equal(a.roundHasData(), false, 'setup must not invent played holes');
});

test('round default preserves explicit overrides including an override equal to the old default', () => {
  const {app:a} = harness();
  a.setHoleTee('blue');
  a.cur = 1; a.setHoleTee('white');
  a.holes[0].score = 4; a.holes[0].notes = 'keep this observation';
  a.holes[1].putts = 2;
  const explicit = plain(a.holes.slice(0, 2));
  a.setGlobalTee('tips');
  assert.deepEqual(plain(a.holes.slice(0, 2)), explicit);
  assert.equal(a.holeTee(0), 'blue');
  assert.equal(a.holeTee(1), 'white');
  assert.equal(a.holeTee(2), 'tips');
  assert.equal(a.getTeeProfile().label, 'Combo (16 Tips / 1 Blue / 1 White)');
});

test('primary tee buttons update the round default, keep overrides, and expose the round selection', () => {
  const h = harness(), a = h.app;
  a.setHoleTee('blue');
  const tips = h.get('holeTeeBtns').children.find(button => /^Tips/.test(button.textContent));
  assert.ok(tips, 'Tips is offered as a round choice');
  tips.onclick();
  assert.equal(a.state.tee, 'tips');
  assert.equal(a.holeTee(0), 'blue');
  assert.equal(a.holeTee(1), 'tips');
  assert.ok(h.get('holeTeeBtns').children.find(button => /^Tips/.test(button.textContent)).ariaPressed === 'true');
  assert.ok(h.get('holeTeeBtns').children.find(button => /^Blue/.test(button.textContent)).ariaPressed === 'false');
  a.move(1);
  assert.ok(h.get('holeTeeBtns').children.find(button => /^Tips/.test(button.textContent)).ariaPressed === 'true');
  assert.equal(a.roundHasData(), false);
});

test('Round override control clears only the current override and restores default inheritance', () => {
  const h = harness(), a = h.app;
  a.setGlobalTee('tips');
  const choose = name => {
    const button = h.get('holeTeeOverrideBtns').children.find(button => button.textContent === name);
    assert.ok(button, name + ' is offered as a per-hole choice');
    button.onclick();
  };
  choose('White');
  assert.equal(a.holes[0].tee, 'white');
  assert.match(h.get('holeTeeOverrideLabel').textContent, /Hole 1.*White/);
  a.move(1); choose('Blue');
  assert.equal(a.holes[1].tee, 'blue');
  a.move(-1); choose('Round');
  assert.equal(a.holes[0].tee, null);
  assert.equal(a.holeTee(0), 'tips');
  assert.equal(a.holes[1].tee, 'blue');
  assert.equal(a.state.tee, 'tips');
  assert.ok(h.get('holeTeeOverrideBtns').children.find(button => button.textContent === 'Round').ariaPressed === 'true');
  a.setGlobalTee('white');
  assert.equal(a.holeTee(0), 'white');
  assert.equal(a.holeTee(1), 'blue');
});

test('missing legacy hole tee fields inherit safely without changing recorded data or archives', () => {
  const h = harness(), a = h.app;
  const legacy = stored(h);
  legacy.holes.forEach(hole => { delete hole.tee; });
  legacy.tee = 'white'; legacy.pin = 'D'; legacy.holes[4].score = 5;
  legacy.rounds = [{id:'archive', date:'2026-08-01', tee:'blue', mode:'full',
    holes:plain(legacy.holes), summary:null}];
  h.storage.setItem(a.STORE, JSON.stringify(legacy));
  a.load();
  const archive = plain(a.state.rounds);
  assert.equal(a.holeTee(4), 'white');
  assert.equal(a.holes[4].score, 5);
  a.setGlobalTee('tips');
  assert.equal(a.holeTee(4), 'tips');
  assert.equal(a.holes[4].score, 5);
  assert.deepEqual(plain(a.state.rounds), archive);
});

test('legacy fully stamped tee choices stay explicit on load and subsequent default change', () => {
  const h = harness(), a = h.app;
  const legacy = stored(h);
  legacy.holes.forEach((hole, i) => { hole.tee = i === 7 ? 'white' : 'blue'; });
  legacy.holes[7].score = 4;
  h.storage.setItem(a.STORE, JSON.stringify(legacy));
  a.load();
  const oldHoles = plain(a.holes);
  a.setGlobalTee('tips');
  assert.deepEqual(plain(a.holes), oldHoles);
  assert.equal(a.getTeeProfile().label, 'Combo (17 Blue / 1 White)');
});

test('pin selection follows all holes; navigation writes only the cursor', () => {
  const h = harness(), a = h.app;
  choosePin(h, 'C');
  a.setCur(17); a.render();
  assert.match(a.pvMeta(17), /Pin C→front/);
  assert.match(a.pvTip(17), /play the front number/);
  const raw = h.storage.getItem(a.STORE), writeAt = h.writes.length;
  a.move(1);
  assert.equal(a.cur, 0);
  a.move(-1);
  assert.equal(a.cur, 17);
  assert.equal(a.state.pin, 'C');
  assert.equal(h.storage.getItem(a.STORE), raw);
  assert.ok(h.writes.slice(writeAt).every(k => k === a.CURKEY));
  a.load();
  assert.equal(a.cur, 17);
  assert.equal(a.state.pin, 'C');
});

test('Back 9 keeps setup and cursor through reload and both navigation wraps', () => {
  const h = harness(), a = h.app;
  a.setMode('back'); a.setGlobalTee('tips'); choosePin(h, 'D');
  assert.equal(a.cur, 9);
  a.setHoleTee('white'); a.setCur(17); a.render();
  a.load();
  assert.equal(a.state.mode, 'back'); assert.equal(a.cur, 17);
  assert.equal(a.state.pin, 'D'); assert.equal(a.state.tee, 'tips');
  assert.equal(a.holeTee(9), 'white'); assert.equal(a.holeTee(10), 'tips');
  a.move(1); assert.equal(a.cur, 9);
  a.move(-1); assert.equal(a.cur, 17);
  assert.deepEqual(plain(a.includedHoles()), [9,10,11,12,13,14,15,16,17]);
  assert.equal(a.getTeeProfile().label, 'Combo (8 Tips / 1 White)');
});

test('unknown pin clears pin guidance and PIN export tag without affecting tee choices', () => {
  const h = harness(), a = h.app;
  a.setGlobalTee('tips'); choosePin(h, 'D'); choosePin(h, '?');
  assert.equal(a.state.pin, '?');
  assert.doesNotMatch(a.pvMeta(17), /Pin/);
  assert.doesNotMatch(a.pvTip(17), /Pin [A-E]:/);
  assert.doesNotMatch(h.get('exportText').textContent.split('\n')[0], /PIN:/);
  assert.equal(a.state.tee, 'tips');
});

test('canceling New Round preserves round, setup, scores, cursor, and persisted bytes', () => {
  const h = harness(), a = h.app;
  a.setMode('back'); a.setGlobalTee('tips'); choosePin(h, 'B');
  a.setHoleTee('white'); a.bump('score', 1); a.setCur(15);
  const before = plain(a.state), raw = h.storage.getItem(a.STORE);
  a.confirm = () => false;
  a.newRound();
  assert.deepEqual(plain(a.state), before);
  assert.equal(a.cur, 15);
  assert.equal(h.storage.getItem(a.STORE), raw);
});

test('New Round archives combination tees and pin; next round inherits default but resets pin and overrides', () => {
  const h = harness(), a = h.app;
  a.setMode('back'); a.setGlobalTee('tips'); choosePin(h, 'B');
  a.setHoleTee('white'); a.bump('score', 1); a.setCur(15);
  const previousId = a.state.roundId;
  assert.equal(a.newRound(), true);
  assert.notEqual(a.state.roundId, previousId);
  assert.equal(a.state.mode, 'back'); assert.equal(a.cur, 9);
  assert.equal(a.state.tee, 'tips'); assert.equal(a.state.pin, '?');
  assert.ok(a.holes.every(hole => hole.tee == null));
  assert.equal(a.roundHasData(), false);
  const archive = a.state.rounds.at(-1);
  assert.equal(archive.tee, 'tips'); assert.equal(archive.pin, 'B');
  assert.equal(archive.holes[9].tee, 'white');
  assert.equal(archive.holes[9].score, 1);
  assert.ok(archive.holes.slice(0,9).every(hole => hole === null));
});

test('refused New Round restores current pin, default, overrides, data, and cursor', () => {
  const h = harness(), a = h.app;
  a.setMode('back'); a.setGlobalTee('tips'); choosePin(h, 'C');
  a.setHoleTee('white'); a.bump('score', 1); a.setCur(16);
  const before = plain(a.state);
  const newer = stored(h);
  newer.rev += 1; newer.writer = 'another-tab'; newer.holes[10].score = 5;
  const raw = JSON.stringify(newer);
  h.storage.setItem(a.STORE, raw);
  assert.equal(a.newRound(), false);
  assert.deepEqual(plain(a.state), before);
  assert.equal(a.cur, 16);
  assert.equal(a.holeTee(9), 'white');
  assert.equal(h.storage.getItem(a.STORE), raw);
});

test('refused save retains tee/pin changes as a recoverable draft without touching newer disk state', () => {
  const h = harness(), a = h.app;
  a.setMode('back'); a.setGlobalTee('tips'); choosePin(h, 'D');
  a.setHoleTee('white'); a.bump('score', 1);
  const newer = stored(h);
  newer.roundId = 'another-round'; newer.rev += 5; newer.writer = 'another-tab';
  newer.mode = 'full'; newer.tee = 'blue'; newer.pin = 'A'; newer.holes = plain(a.mk());
  const raw = JSON.stringify(newer);
  h.storage.setItem(a.STORE, raw);
  a.setGlobalTee('white');
  assert.equal(h.storage.getItem(a.STORE), raw);
  assert.equal(a.saveConflict, 'refused');
  a.load();
  assert.ok(a.recovered?.length);
  assert.equal(a.recoverDraft(), true);
  assert.equal(a.state.mode, 'back'); assert.equal(a.state.tee, 'white');
  assert.equal(a.state.pin, 'D'); assert.equal(a.holes[9].tee, 'white');
  assert.equal(a.holes[9].score, 1);
  assert.equal(h.storage.getItem(a.STORE), raw, 'viewing recovery must not overwrite the newer round');
});

test('merging held entries never relabels an inherited tee under a conflicting round default', () => {
  const h = harness(), a = h.app;
  const newer = stored(h);
  a.holes[4].score = 5;
  assert.equal(a.holeTee(4), 'blue');
  newer.tee = 'tips'; newer.rev += 1; newer.writer = 'another-tab';
  newer.holes[1].score = 4;
  h.storage.setItem(a.STORE, JSON.stringify(newer));
  const beforeDisk = h.storage.getItem(a.STORE);
  const merged = a.mergeHeldEntries();
  if (merged) {
    assert.equal(a.holeTee(4), 'blue', 'a successful merge must preserve the tee originally played');
  } else {
    assert.equal(a.holeTee(4), 'blue');
    assert.equal(a.holes[4].score, 5);
    assert.equal(h.storage.getItem(a.STORE), beforeDisk);
    assert.ok(a.recovered?.length || Object.keys(a.readDrafts() || {}).length,
      'a refused merge must leave a recoverable copy');
  }
});

test('non-conflicting held-entry merge preserves explicit combo tee and newer scores', () => {
  const h = harness(), a = h.app;
  const newer = stored(h);
  a.holes[4].score = 5; a.holes[4].tee = 'white';
  newer.rev += 1; newer.writer = 'another-tab'; newer.holes[1].score = 4;
  h.storage.setItem(a.STORE, JSON.stringify(newer));
  assert.equal(a.mergeHeldEntries(), true);
  assert.equal(a.holeTee(4), 'white'); assert.equal(a.holes[4].score, 5);
  assert.equal(a.holes[1].score, 4);
  assert.equal(stored(h).holes[4].tee, 'white');
});

test('offline entry, setup, overrides, and Back 9 reload do not depend on a connection', () => {
  const h = harness(), a = h.app;
  a.navigator.onLine = false;
  a.setMode('back'); a.setGlobalTee('tips'); choosePin(h, 'E');
  a.setHoleTee('white'); a.bump('score', 1); a.setNote('offline observation');
  a.move(1); a.load();
  assert.equal(a.cur, 10); assert.equal(a.state.mode, 'back');
  assert.equal(a.state.tee, 'tips'); assert.equal(a.state.pin, 'E');
  assert.equal(a.holes[9].tee, 'white'); assert.equal(a.holes[9].notes, 'offline observation');
  assert.equal(a.holes[9].score, 1);
});

test('offline shell still precaches every script and stylesheet used by the app', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8');
  const sw = readFileSync(resolve(root, 'sw.js'), 'utf8');
  for (const file of sources.concat('styles.css')) {
    assert.ok(html.includes(file), file + ' is loaded by the page');
    assert.ok(sw.includes(file), file + ' is cached for offline use');
  }
  assert.doesNotMatch(sw, /skipWaiting/);
  assert.doesNotMatch(source, /controllerchange/);
});
