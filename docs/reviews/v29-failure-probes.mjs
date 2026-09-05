// Review-only fault injection. Synthetic VM data; no disk writes or real records.
// Run: node docs/reviews/v29-failure-probes.mjs
// REPRODUCED identifies remaining failure behavior, not a passing ship check.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const source = ['seed', 'stats', 'course', 'player', 'app']
  .map(name => readFileSync(new URL(`js/${name}.js`, root), 'utf8')).join('\n')
  .replace(/load\(\); render\(\);[\s\S]*$/, '');

function session(storage = new Map()) {
  const elements = {};
  const c = {
    console, Date, JSON, Math, setTimeout: () => 0,
    navigator: {}, window: {}, confirmations: [],
    confirm(message) { c.confirmations.push(message); return true; },
    alert() {},
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
  // Discard seeded history only for a genuinely new synthetic storage area.
  if (!storage.has(c.STORE)) c.state.rounds = [];
  c.render();
  return { c, elements, storage, run: code => vm.runInContext(code, c) };
}

const results = [];
const record = (id, reproduced, evidence) => results.push({
  id, status: reproduced ? 'REPRODUCED' : 'NOT REPRODUCED', evidence
});

// Ordinary save failure: the current round remains visible, as v29 intends.
let s = session();
s.run('holes[0].score=4;touch()');
const write = s.c.localStorage.setItem;
s.c.localStorage.setItem = (key, value) => {
  if (key === s.c.STORE) throw new Error('injected QuotaExceededError');
  write(key, value);
};
s.run("holes[0].score=5;holes[0].notes='unsaved review note';touch();buildSummary()");
results.push({ id: 'FIX-ordinary-save-failure', status:
  s.c.saveFailed && s.c.holes[0].score === 5 &&
  s.elements.exportText.textContent.includes('unsaved review note') ? 'PASS' : 'FAIL'
});

// A1: failed archive then clears the live/exportable round anyway.
s.c.newRound();
s.c.buildSummary();
let disk = JSON.parse(s.storage.get(s.c.STORE));
record('A1-failed-archive-clears-exportable-data', s.c.saveFailed &&
  s.c.holes[0].score === null && !s.elements.exportText.textContent.includes('unsaved review note'), {
    diskScore: disk.holes[0].score,
    currentScore: s.c.holes[0].score,
    archivedOnlyInMemoryScore: s.c.state.rounds.at(-1).holes[0].score,
    currentExportContainsUnsavedNote: s.elements.exportText.textContent.includes('unsaved review note'),
    saveFailed: s.c.saveFailed
  });

// A1b: the same reset occurs when save refuses a stale revision.
let shared = new Map();
let a = session(shared);
a.run('holes[0].score=4;touch()');
let b = session(shared);
a.run('holes[1].score=5;touch()');
b.run("holes[2].notes='unique stale review note';touch();newRound();buildSummary()");
record('A1b-conflict-archive-clears-exportable-data', b.c.saveConflict &&
  !b.elements.exportText.textContent.includes('unique stale review note'), {
    conflict: b.c.saveConflict,
    currentNotes: b.c.holes[2].notes,
    notesOnlyInMemoryArchive: b.c.state.rounds.at(-1).holes[2].notes,
    persistedArchives: JSON.parse(shared.get(b.c.STORE)).rounds.length
  });

// A2: deterministic interleaving, not a measured physical-browser race.
// A reads rev 1; B reads rev 1 and commits rev 2; A then commits its own rev 2.
shared = new Map();
a = session(shared);
a.run('holes[0].score=4;touch()');
b = session(shared);
const readA = a.c.localStorage.getItem;
let interleave = true;
a.c.localStorage.getItem = key => {
  const snapshot = readA(key);
  if (key === a.c.STORE && interleave) {
    interleave = false;
    b.run('holes[2].score=6;touch()');
  }
  return snapshot;
};
a.run('holes[1].score=5;touch()');
a.c.onExternalWrite(a.c.STORE);
b.c.onExternalWrite(b.c.STORE);
disk = JSON.parse(shared.get(a.c.STORE));
record('A2-same-revision-concurrent-write', disk.holes[2].score === null &&
  !a.c.saveConflict && !b.c.saveConflict, {
    aRevision: a.c.state.rev, bRevision: b.c.state.rev, diskRevision: disk.rev,
    diskScores: disk.holes.slice(0, 3).map(h => h.score),
    expectedIndependentScores: [4, 5, 6],
    aConflict: a.c.saveConflict, bConflict: b.c.saveConflict
  });

// A3: inability to read the stored revision must not mean permission to overwrite.
// Fault model: a transient read/parse failure while writes remain available.
shared = new Map();
a = session(shared);
a.run('holes[0].score=4;touch()');
b = session(shared);
a.run('holes[1].score=5;touch()');
const readB = b.c.localStorage.getItem;
b.c.localStorage.getItem = key => {
  if (key === b.c.STORE) throw new Error('injected storage read failure');
  return readB(key);
};
b.run('holes[2].score=6;touch()');
disk = JSON.parse(shared.get(a.c.STORE));
record('A3-read-failure-fails-open', disk.holes[1].score === null &&
  !b.c.saveFailed && !b.c.saveConflict, {
    diskScores: disk.holes.slice(0, 3).map(h => h.score),
    saveFailed: b.c.saveFailed, saveConflict: b.c.saveConflict
  });

// Successful full-round archive must survive a fresh load, not just exist in RAM.
s = session();
s.run("holes.forEach((h,i)=>{h.score=COURSE[i].par;h.putts=2;});touch();newRound()");
let reloaded = session(s.storage);
let archived = reloaded.c.roundStats(reloaded.c.state.rounds[0]);
results.push({ id: 'FIX-full-round-archive-reload', status:
  reloaded.c.state.rounds.length === 1 && archived.score === 72 && archived.putts === 36 &&
  reloaded.c.holes.every(h => h.score === null) ? 'PASS' : 'FAIL' });

s = session();
s.run("holes[0].notes='stats-only review';holes[0].putts=3;touch();newRound()");
reloaded = session(s.storage);
results.push({ id: 'FIX-stat-only-archive-reload', status:
  reloaded.c.state.rounds.length === 1 && reloaded.c.state.rounds[0].holes[0].notes === 'stats-only review' &&
  reloaded.c.state.rounds[0].holes[0].putts === 3 ? 'PASS' : 'FAIL' });

console.log(JSON.stringify(results, null, 2));
