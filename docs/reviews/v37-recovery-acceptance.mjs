// Independent acceptance probe for the v37 recovery rework.
// Every case below states an OUTCOME Kenny needs on the course. They were written
// before reading js/app.js's v37 recovery implementation; the only thing taken from the
// source first was the list of function names to drive. It shares no code with verify.mjs
// on purpose -- 401 green checks are evidence about what that oracle covers, not proof.
//
//   node v37-recovery-acceptance.mjs /path/to/bay-oaks-tracker-v10
import {readFileSync} from 'fs';
import {resolve} from 'path';
import vm from 'vm';

const REPO = resolve(process.argv[2] || '.');
const SRC = ['js/seed.js','js/stats.js','js/course.js','js/player.js','js/app.js'];
const source = SRC.map(f => readFileSync(REPO+'/'+f,'utf8')).join('\n')
  .replace(/load\(\); render\(\);[\s\S]*$/, '');
const STORE_KEY = 'bayoaks-rounds-v6';

// ---- a storage that behaves like localStorage, and can be made to misbehave ------------
function makeStore(opts={}){
  const data = new Map();
  const s = {
    fail: null,          // 'read' | 'write' | null
    failKeyMatch: null,  // only fail for keys matching this
    cap: opts.cap || Infinity,
    bytes(){ let n=0; for(const [k,v] of data) n+=k.length+v.length; return n; },
    keys(){ return [...data.keys()]; },
    raw(k){ return data.has(k)?data.get(k):null; },
    snapshot(){ return new Map(data); },
    getItem(k){
      if(s.fail==='read' && (!s.failKeyMatch || k.includes(s.failKeyMatch))) throw new Error('injected read failure');
      return data.has(k) ? data.get(k) : null;
    },
    setItem(k,v){
      if(s.fail==='write' && (!s.failKeyMatch || k.includes(s.failKeyMatch))) throw new Error('injected QuotaExceededError');
      const projected = s.bytes() - (data.has(k)?k.length+data.get(k).length:0) + k.length + String(v).length;
      if(projected > s.cap){ const e=new Error('QuotaExceededError'); e.name='QuotaExceededError'; throw e; }
      data.set(k,String(v));
    },
    removeItem(k){ data.delete(k); },
    key(i){ return [...data.keys()][i]; },
    get length(){ return data.size; },
  };
  return s;
}

// ---- one independent "tab": its own global scope, sharing a storage ---------------------
let tabN = 0;
function openTab(store){
  const els = {};
  const el = id => els[id] || (els[id] = {textContent:'',innerHTML:'',value:'',style:{display:''},
    className:'',appendChild(){},classList:{add(){},remove(){},toggle(){return false;}}});
  const ctx = {
    console,
    document:{getElementById: el,
      createElement:()=>({value:'',select(){},classList:{add(){},remove(){},toggle(){return false;}},appendChild(){}}),
      body:{appendChild(){},removeChild(){},classList:{add(){},remove(){},toggle(){return false;}}},
      addEventListener(){}},
    window:{addEventListener(){}},
    localStorage: store,
    navigator: {},
    confirm: () => true,
    alert(){}, setTimeout, clearTimeout, Date, Math, JSON, String, Number, Object, Array,
  };
  ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx, {filename:'app-tab'+(++tabN)+'.js'});
  ctx.__els = els;
  return ctx;
}
const blank = () => ({score:null,fir:null,gir:null,ss:null,chip:null,putts:null,lag:null,
  sixAtt:0,sixMade:0,pen:0,notes:'',tee:null});
function seat(tab, over={}){
  tab.state = Object.assign({date:tab.today(),holes:Array.from({length:18},blank),rounds:[],
    mode:'full',tee:'blue',pin:'?',dirty:false,exported:true,rev:0}, over);
  tab.holes = tab.state.holes; tab.cur = 0;
  return tab;
}
// make every further save() refuse, the way a second device or tab would
function blockSaves(tab, store){
  const cur = JSON.parse(store.raw(STORE_KEY));
  cur.rev += 5; cur.writer = 'other-tab';
  store.setItem(STORE_KEY, JSON.stringify(cur));
}

const results = [];
function outcome(id, statement, held, detail){
  results.push({id, held});
  console.log((held ? 'HOLDS     ' : 'VIOLATED  ') + id + ': ' + statement);
  console.log('    ' + detail);
}

// =========================================================================================
// A. A long stretch of refused saves must not turn the recovery store into the thing that
//    fills the phone's storage -- and the newest data must still be the data offered back.
// =========================================================================================
(() => {
  const store = makeStore();
  const t = openTab(store);
  seat(t); t.save();
  blockSaves(t, store);
  // one real hole of entry is roughly six writes: score, putts, FIR, GIR, chip, note
  for(let h=0; h<18; h++){
    t.cur = h;
    t.holes[h].score = 4; t.touch();
    t.holes[h].putts = 2; t.touch();
    t.holes[h].fir = 'y'; t.touch();
    t.holes[h].gir = true; t.touch();
    t.holes[h].pen = 0;   t.touch();
    t.holes[h].notes = 'hole '+(h+1)+' note'; t.touch();
  }
  const draftKeys = store.keys().filter(k => k.startsWith('bayoaks-draft'));
  const kb = Math.round(store.bytes()/1024);
  const after = openTab(store);                     // ask the way Kenny does: reopen the app
  after.load();
  const offered = after.loadRecovery() || [];
  const newest = offered.length && offered[0].holes && offered[0].holes[17]
    && offered[0].holes[17].notes === 'hole 18 note';
  outcome('A1','a round of refused saves does not fill storage with backups',
    kb < 512 && draftKeys.length <= 4, store.keys().length+' keys, '+draftKeys.length+' of them drafts, '+kb+' KB total');
  outcome('A2','reopening the app offers the newest entry first',
    !!newest, offered.length+' draft(s) offered; first one carries the hole-18 note: '+!!newest);
  outcome('A3','the recovery list stays readable rather than one entry per keystroke',
    offered.length <= 5, offered.length+' drafts offered to choose between');
})();

// =========================================================================================
// B. The recovery mechanism must not be what exhausts the quota. Give it a 5 MB origin
//    that already holds other data, and play a round with every save refused.
// =========================================================================================
(() => {
  const store = makeStore({cap: 5*1024*1024});
  store.setItem('unrelated-app-data','x'.repeat(4*1024*1024));   // 4 MB already spoken for
  const t = openTab(store);
  seat(t); t.save();
  blockSaves(t, store);
  let stashFailedAt = null;
  for(let h=0; h<18 && stashFailedAt===null; h++){
    t.cur = h;
    for(const f of [['score',4],['putts',2],['fir','y'],['gir',true],['notes','n'+h]]){
      t.holes[h][f[0]] = f[1];
      t.touch();
      if(t.stashFailed){ stashFailedAt = 'H'+(h+1)+' / '+f[0]; break; }
    }
  }
  const stored = store.keys().filter(k => k.startsWith('bayoaks-draft-v3:'));
  const deepest = stored.map(k => JSON.parse(store.raw(k)))
    .map(d => (d.holes||[]).filter(h => h && h.score !== null).length)
    .reduce((a,b) => Math.max(a,b), 0);
  outcome('B1','a round survives on an origin that is already mostly full',
    stashFailedAt === null, stashFailedAt ? 'backup writes began failing at '+stashFailedAt : 'no stash failure through 18 holes');
  outcome('B2','and the whole round is still held in a backup at the end of it',
    deepest === 18, stored.length+' backup(s) held; deepest carries '+deepest+' of 18 scored holes');
})();

// =========================================================================================
// C. If the app cannot READ its own backups, it must not behave as though there are none.
//    Existing backups must still be there byte-for-byte afterwards.
// =========================================================================================
(() => {
  const store = makeStore();
  const t = openTab(store); seat(t); t.save();
  blockSaves(t, store);
  t.holes[0].score = 5; t.touch();                       // one good backup exists
  const before = store.snapshot();
  const beforeDrafts = [...before.keys()].filter(k => k.startsWith('bayoaks-draft'));
  store.fail = 'read'; store.failKeyMatch = 'bayoaks-draft';
  t.holes[1].score = 6;
  const said = t.touch();
  const reportedFailure = !!(t.stashFailed || t.saveUnreadable || t.saveConflict);
  store.fail = null;
  let intact = true, detail = [];
  for(const k of beforeDrafts){
    if(store.raw(k) !== before.get(k)){ intact = false; detail.push(k+' changed'); }
  }
  outcome('C1','an unreadable backup store never destroys the backups already there',
    intact, intact ? beforeDrafts.length+' pre-existing draft key(s) byte-identical' : detail.join('; '));
  outcome('C2','and the failure is reported rather than reported as success',
    said === false && reportedFailure, 'touch() returned '+said+', flags reported: '+reportedFailure);
})();

// =========================================================================================
// D. Two tabs open on the same round. Neither tab's backup may erase the other's.
// =========================================================================================
(() => {
  const store = makeStore();
  const a = openTab(store); seat(a); a.save();
  const roundId = a.state.roundId;
  const b = openTab(store); seat(b, {roundId, rev:a.state.rev});
  b.state.writer = a.state.writer;
  blockSaves(a, store);
  a.holes[3].score = 7; a.holes[3].notes = 'tab A entered this'; a.touch();
  b.holes[8].score = 3; b.holes[8].notes = 'tab B entered this'; b.touch();
  a.holes[4].score = 5; a.touch();
  const all = JSON.stringify(store.keys().filter(k=>k.startsWith('bayoaks-draft'))
    .map(k=>store.raw(k)));
  outcome('D1','tab A’s entry survives tab B backing up',
    all.includes('tab A entered this'), 'stored backups '+(all.includes('tab A entered this')?'contain':'have lost')+' tab A');
  outcome('D2','tab B’s entry survives tab A backing up again',
    all.includes('tab B entered this'), 'stored backups '+(all.includes('tab B entered this')?'contain':'have lost')+' tab B');
})();

// =========================================================================================
// E. A backup written by an older version is still offered after the upgrade, and the
//    upgrade does not rewrite its bytes.
// =========================================================================================
(() => {
  const store = makeStore();
  const legacyV1 = JSON.stringify({date:'2026-09-01',mode:'full',pin:'C',tee:'blue',
    roundId:'r-2026-09-01-legacy',
    holes:Array.from({length:18},(_,i)=>Object.assign(blank(),i===2?{score:6,notes:'legacy v1 round'}:{}))});
  store.setItem('bayoaks-recovery-v1', legacyV1);
  const t = openTab(store); seat(t); t.save();
  const offered = t.loadRecovery() || [];
  const found = offered.some(d => JSON.stringify(d.holes||'').includes('legacy v1 round'));
  outcome('E1','a backup from the previous version is still offered after upgrading',
    found, offered.length+' draft(s) offered; legacy content present: '+found);
  outcome('E2','and upgrading did not rewrite the old backup',
    store.raw('bayoaks-recovery-v1') === legacyV1,
    store.raw('bayoaks-recovery-v1') === legacyV1 ? 'bytes unchanged' : 'legacy bytes were rewritten');
})();

// =========================================================================================
// F. Restoring a backup when the screen already holds a round must not lose either one.
// =========================================================================================
(() => {
  const store = makeStore();
  const t = openTab(store); seat(t); t.save();
  blockSaves(t, store);
  t.holes[0].score = 4; t.holes[0].notes = 'the backed-up round'; t.touch();
  const draft = (t.loadRecovery()||[])[0];
  seat(t, {roundId: t.state.roundId});
  t.holes[5].score = 9; t.holes[5].notes = 'the round on screen';
  t.recovered = t.loadRecovery();
  const ok = t.recoverDraft(draft && draft.key);
  const nowOffered = JSON.stringify(t.loadRecovery()||[]);
  outcome('F1','restoring a backup puts it on the screen',
    ok && JSON.stringify(t.holes).includes('the backed-up round'),
    'recoverDraft returned '+ok);
  outcome('F2','and the round it displaced is itself recoverable',
    nowOffered.includes('the round on screen'),
    nowOffered.includes('the round on screen') ? 'displaced round is offered' : 'displaced round is gone');
})();

// =========================================================================================
// G. Discarding the backup Kenny was offered must not discard the others.
// =========================================================================================
(() => {
  const store = makeStore();
  const a = openTab(store); seat(a); a.save();
  const roundId = a.state.roundId;
  blockSaves(a, store);
  a.holes[0].score = 4; a.holes[0].notes = 'tab A holds this'; a.touch();
  // a second tab holding a genuinely different state of the SAME round -- neither contains
  // the other, so no discard of one may take the other with it
  const b = openTab(store); seat(b, {roundId, rev:a.state.rev}); b.state.writer = a.state.writer;
  b.holes[9].score = 5; b.holes[9].notes = 'tab B holds this'; b.touch();
  // and a pile of superseded snapshots behind tab A's entry
  for(let i=1;i<8;i++){ a.holes[i].score = 4; a.touch(); }
  const reader = openTab(store); reader.load();
  reader.recovered = reader.loadRecovery();
  const before = (reader.recovered||[]).length;
  reader.dismissRecovery();
  const left = JSON.stringify(reader.loadRecovery()||[]);
  const keptOther = left.includes('tab A holds this') || left.includes('tab B holds this');
  outcome('G1','discarding one round’s backup leaves a different in-flight copy alone',
    keptOther, before+' offered before discard, '+((reader.loadRecovery()||[]).length)+' after; a divergent copy survived: '+keptOther);
  outcome('G2','and one tap clears the pile behind the copy it did discard',
    (reader.loadRecovery()||[]).length < before,
    before+' -> '+((reader.loadRecovery()||[]).length));
})();

// =========================================================================================
// H. Cleanup after a good save must remove only the backup of the data actually saved.
//    Two rounds can share identical hole data and still be different rounds.
// =========================================================================================
(() => {
  const store = makeStore();
  const t = openTab(store); seat(t); t.save();
  blockSaves(t, store);
  const sharedHoles = () => { const h = Array.from({length:18},blank); h[0].score = 4; return h; };
  t.state.holes = sharedHoles(); t.holes = t.state.holes;
  t.state.pin = 'A'; t.state.tee = 'blue'; t.state.roundId = 'r-morning';
  t.stashRecovery();
  t.state.holes = sharedHoles(); t.holes = t.state.holes;
  t.state.pin = 'D'; t.state.tee = 'white'; t.state.roundId = 'r-afternoon';
  t.stashRecovery();
  const both = (t.loadRecovery()||[]).length;
  // now let the afternoon round save successfully; cleanup runs for it
  const cur = JSON.parse(store.raw(STORE_KEY));
  cur.rev = t.state.rev; cur.writer = t.state.writer; cur.roundId = t.state.roundId;
  store.setItem(STORE_KEY, JSON.stringify(cur));
  const saved = t.save();
  const left = t.loadRecovery() || [];
  const morningLeft = left.some(d => d.pin === 'A' || d.roundId === 'r-morning');
  outcome('H1','saving one round does not delete a different round that has the same scores',
    morningLeft, both+' backups stashed, save '+(saved?'succeeded':'was refused')+', '+left.length+' left; morning kept: '+morningLeft);
})();

// =========================================================================================
// I. Close the app and open it again: the refused round is offered and reaches the export.
// =========================================================================================
(() => {
  const store = makeStore();
  const t = openTab(store); seat(t); t.save();
  blockSaves(t, store);
  t.holes[6].score = 6; t.holes[6].notes = 'survives a reload'; t.touch();
  const fresh = openTab(store);            // a new page load against the same storage
  fresh.load();
  const offered = fresh.loadRecovery() || [];
  const restored = offered.length ? fresh.recoverDraft(offered[0].key) : false;
  fresh.buildSummary();
  const exportText = fresh.__els['exportText'] ? fresh.__els['exportText'].textContent : '';
  outcome('I1','a refused round is still offered after closing and reopening the app',
    offered.length > 0, offered.length+' draft(s) offered after reload');
  outcome('I2','and restoring it puts the note back in the export',
    restored && exportText.includes('survives a reload'),
    'restore returned '+restored+'; export '+(exportText.includes('survives a reload')?'carries':'is missing')+' the note');
})();

const violated = results.filter(r => !r.held);
console.log('\n'+REPO);
console.log(violated.length
  ? 'VERDICT: '+violated.length+' of '+results.length+' outcomes VIOLATED -> '+violated.map(r=>r.id).join(', ')
  : 'VERDICT: all '+results.length+' outcomes hold');
