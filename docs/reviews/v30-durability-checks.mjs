// Independent review assertions for synchronous v30. Uses synthetic VM storage only.
// Run: node docs/reviews/v30-durability-checks.mjs
// Exits nonzero when outcome requirements fail; a visible warning is not a save.
// If persistence becomes asynchronous, adapt scheduling/awaits without relaxing
// the persistence and recoverability requirements below.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const source = ['seed', 'stats', 'course', 'player', 'app']
  .map(name => readFileSync(new URL(`js/${name}.js`, root), 'utf8')).join('\n')
  .replace(/load\(\); render\(\);[\s\S]*$/, '');

function session(storage = new Map()) {
  const elements = {};
  const c = {
    console, Date, JSON, Math, setTimeout: () => 0, navigator: {}, window: {},
    confirm: () => true, alert() {},
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value)
    },
    document: {
      getElementById: id => elements[id] ||= {
        textContent: '', innerHTML: '', value: '', style: {},
        appendChild() {}, classList: { toggle() {} }
      },
      createElement: () => ({ select() {} }),
      body: { appendChild() {}, removeChild() {}, classList: { toggle() {} } },
      execCommand: () => false
    }
  };
  vm.createContext(c);
  vm.runInContext(source, c);
  c.load();
  if (!storage.has(c.STORE)) c.state.rounds = [];
  c.render();
  return { c, elements, storage, run: code => vm.runInContext(code, c) };
}

let failures = 0;
const check = (name, passes, evidence = '') => {
  if (!passes) failures++;
  console.log(`${passes ? 'PASS' : 'FAIL'} ${name}${evidence ? ': ' + JSON.stringify(evidence) : ''}`);
};

// A1: failure must preserve exactly the state the user can still export.
let s = session();
s.run("holes[0].score=4;state.pin='D';setCur(4);touch()");
const write = s.c.localStorage.setItem;
s.c.localStorage.setItem = (key, value) => {
  if (key === s.c.STORE) throw new Error('injected write failure');
  write(key, value);
};
s.run("holes[0].score=5;holes[0].notes='recoverable v30 note';touch();buildSummary()");
const before = JSON.stringify(s.c.state);
const cursorBefore = s.storage.get(s.c.CURKEY);
const exportBefore = s.elements.exportText.textContent;
const rejected = s.c.newRound();
check('A1 archive reports rejection', rejected === false);
check('A1 rejected archive preserves complete round state', JSON.stringify(s.c.state) === before);
check('A1 rejected archive preserves export', s.elements.exportText.textContent === exportBefore);
check('A1 rejected archive preserves cursor', s.c.cur === 4 && s.storage.get(s.c.CURKEY) === cursorBefore);
s.c.localStorage.setItem = write;
check('A1 retry succeeds', s.c.newRound() === true);
let reloaded = session(s.storage);
check('A1 retry survives reload exactly once', reloaded.c.state.rounds.length === 1 &&
  reloaded.c.state.rounds[0]?.holes[0].score === 5 &&
  reloaded.c.state.rounds[0]?.holes[0].notes === 'recoverable v30 note');

// A1b: rejection due to a newer stored revision must likewise retain the draft.
let shared = new Map();
let a = session(shared);
a.run('holes[0].score=4;touch()');
let b = session(shared);
a.run('holes[1].score=5;touch()');
b.run("holes[2].notes='conflicted draft';touch();buildSummary()");
const draft = JSON.stringify(b.c.state);
const draftExport = b.elements.exportText.textContent;
check('A1b conflicting archive returns false', b.c.newRound() === false);
check('A1b conflicting archive keeps draft and export', JSON.stringify(b.c.state) === draft &&
  b.elements.exportText.textContent === draftExport);

// A3: failed reads and corrupted JSON must not permit replacement writes.
s = session();
s.run('holes[0].score=4;touch()');
const saved = s.storage.get(s.c.STORE);
const read = s.c.localStorage.getItem;
s.c.localStorage.getItem = key => {
  if (key === s.c.STORE) throw new Error('injected read failure');
  return read(key);
};
s.run('holes[0].score=5');
check('A3 failed read rejects save and preserves bytes', s.c.touch() === false && s.storage.get(s.c.STORE) === saved);
s.c.localStorage.getItem = read;
const corrupt = '{broken-json:original-bytes';
s.storage.set(s.c.STORE, corrupt);
check('A3 malformed JSON is retained', s.c.touch() === false && s.storage.get(s.c.STORE) === corrupt);

// Ordinary reloaded writer is not a collision.
s = session();
s.run('holes[0].score=4;touch()');
reloaded = session(s.storage);
check('save after ordinary reload succeeds', reloaded.run('holes[1].score=5;touch()') === true);

// A2: deliberate cross-session scheduling. This is NOT a physical-browser timing test.
// A captures rev 1; B completes its rev 2 save; A completes a different rev 2 save.
shared = new Map();
a = session(shared);
a.run('holes[0].score=4;touch()');
b = session(shared);
const getA = a.c.localStorage.getItem;
let armed = true;
let bAcknowledged;
a.c.localStorage.getItem = key => {
  const snapshot = getA(key);
  if (key === a.c.STORE && armed) {
    armed = false;
    bAcknowledged = b.run("holes[2].score=6;holes[2].notes='B acknowledged note';touch()");
  }
  return snapshot;
};
const aAcknowledged = a.run('holes[1].score=5;touch()');
b.c.onExternalWrite(b.c.STORE);
const banner = b.elements.saveAlert.innerHTML;
reloaded = session(shared); // Equivalent state load after closing/reloading the losing tab.
const durableBScore = reloaded.c.holes[2].score;
const durableBNote = reloaded.c.holes[2].notes;
check('A2 a successful B save survives the competing A save and reload',
  bAcknowledged !== true || (durableBScore === 6 && durableBNote === 'B acknowledged note'), {
    aAcknowledged, bAcknowledged, bConflict: b.c.saveConflict,
    bScoreBeforeReload: b.c.holes[2].score, durableBScore, durableBNote
  });
// This app has no independent persistent draft/recovery store. A reload loses B's
// acknowledged edit, so the unqualified instruction to reload is unsafe in this case.
const lost = bAcknowledged === true && (durableBScore !== 6 || durableBNote !== 'B acknowledged note');
check('A2 collision warning does not falsely claim nothing was overwritten',
  !lost || !banner.includes('Nothing was overwritten.'), banner);
check('A2 collision warning does not direct reload before recovering the lost edit',
  !lost || !banner.includes('Reload this tab to pick up the newer version before entering anything else.'), banner);

console.log(`REVIEW RESULT: ${failures ? failures + ' FAILED' : 'ALL PASS'}`);
process.exitCode = failures ? 1 : 0;
