// Review-only reproductions. No production records, files, or network are modified.
// Run from any directory: node /absolute/path/to/this/file.mjs
// REPRODUCED means the defect remains; NOT REPRODUCED requires follow-up verification.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const source = ['seed', 'stats', 'course', 'player', 'app']
  .map(name => readFileSync(new URL(`js/${name}.js`, root), 'utf8')).join('\n')
  .replace(/load\(\); render\(\);[\s\S]*$/, '');

function session(storage = new Map()) {
  const elements = {};
  const context = {
    console, Date, JSON, Math, setTimeout: () => 0,
    navigator: {}, window: {}, confirmations: [],
    confirm(message) { context.confirmations.push(message); return true; },
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
  vm.createContext(context);
  vm.runInContext(source, context);
  context.load();
  context.state.rounds = []; // Only synthetic history inside this VM.
  context.render();
  return { c: context, elements, storage, run: code => vm.runInContext(code, context) };
}

const results = [];
function record(id, reproduced, evidence) {
  results.push({ id, status: reproduced ? 'REPRODUCED' : 'NOT REPRODUCED', evidence });
}

// Positive check: navigation really persists into a fresh VM.
let s = session();
s.run("setMode('back');move(4)");
let resumed = session(s.storage);
results.push({ id: 'FIX-back-nine-resume', status: resumed.c.cur === 13 ? 'PASS' : 'FAIL', hole: resumed.c.cur + 1 });

// Positive check: fallback failure no longer claims an export.
s = session();
s.run('copyExport(true)');
results.push({ id: 'FIX-copy-false', status: s.c.state.exported === false ? 'PASS' : 'FAIL' });

// F1: an old session replaces the newer round on navigation alone.
const shared = new Map();
const first = session(shared);
first.run('holes[0].score=4;touch()');
const second = session(shared);
first.run('holes[1].score=5;touch()');
second.run('move(1)');
const persisted = JSON.parse(shared.get(first.c.STORE));
record('F1-stale-tab-overwrite', persisted.holes[1].score === null,
  { expectedHole2: 5, actualHole2: persisted.holes[1].score });

// F2: data without a score is neither protected by confirmation nor archived.
s = session();
s.run("holes[0].notes='test tee shot';holes[0].putts=3;touch();newRound()");
record('F2-stat-only-round-erased', s.c.confirmations.length === 0 && s.c.state.rounds.length === 0 && s.c.holes[0].notes === '',
  { confirmations: s.c.confirmations.length, archivedRounds: s.c.state.rounds.length, notes: s.c.holes[0].notes });

// F3: the summary masks one nine; the archive includes both.
s = session();
s.run("holes[0].score=4;holes[9].score=5;setMode('front');buildSummary()");
const total = s.elements.exportText.textContent.split('\n').at(-1);
s.c.newRound();
const archived = s.c.roundStats(s.c.state.rounds[0]);
record('F3-mode-archive-mismatch', total.includes('S:4*') && archived.score === 9,
  { exportTotal: total, archiveScore: archived.score, archivedMode: s.c.state.rounds[0].mode });

// F4: one calculation path was fixed; hotspot calculations retain the stale chip.
s = session();
s.run("holes[0].score=4;holes[0].gir=true;holes[0].chip='in'");
const roundChip = s.c.roundStats({ holes: s.c.holes }).chip6;
const hotspotChip = s.c.holeStats([{ holes: s.c.holes }])[0].chip6;
record('F4-hotspot-stale-chip', roundChip.d === 0 && hotspotChip.d === 1,
  { roundChip, hotspotChip });

// F5: a delayed successful copy marks newer, unexported edits as exported.
s = session();
let resolveCopy;
s.c.navigator.clipboard = { writeText: () => new Promise(resolve => { resolveCopy = resolve; }) };
s.run('holes[0].score=4;buildSummary();copyExport(true);holes[0].score=5;touch()');
resolveCopy();
await Promise.resolve();
record('F5-export-revision-race', s.c.state.exported === true,
  { copiedScore: 4, currentScore: s.c.holes[0].score, exported: s.c.state.exported });

// F6: delayed speech completion follows the cursor instead of the original hole.
s = session();
s.c.window.SpeechRecognition = function () { this.start = () => {}; this.stop = () => {}; };
s.run("toggleVoice();move(1);recognizer.onresult({results:[[{transcript:'test hole-one note'}]]})");
record('F6-dictation-wrong-hole', s.c.holes[0].notes === '' && s.c.holes[1].notes === 'test hole-one note',
  { hole1: s.c.holes[0].notes, hole2: s.c.holes[1].notes });

console.log(JSON.stringify(results, null, 2));
