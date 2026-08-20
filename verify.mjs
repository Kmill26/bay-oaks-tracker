import {readFileSync} from 'fs';

// v17.1: the app is split into classic scripts. Concatenate them in load order -- that is
// exactly what the browser does with four <script src> tags, so the oracle tests the same
// global scope the app actually runs in.
const SRC_FILES = ['js/seed.js','js/stats.js','js/course.js','js/player.js','js/app.js'];
const html = readFileSync('index.html','utf8');
const appSrc = SRC_FILES.map(f => readFileSync(f,'utf8')).join('\n');
const js = appSrc.replace(/load\(\); render\(\);[\s\S]*$/, ''); // skip boot

// Minimal DOM/browser stubs
const els = {};
const el = id => els[id] || (els[id] = {textContent:'', innerHTML:'', value:'', style:{display:''}, className:'', appendChild(){}, classList:{add(){},remove(){},toggle(){return false;}}});
global.document = {getElementById: el, createElement:()=>({classList:{add(){},remove(){},toggle(){return false;}},appendChild(){}}), body:{appendChild(){},removeChild(){},classList:{add(){},remove(){},toggle(){return false;}}}};
global.localStorage = {getItem:()=>null, setItem(){}};
Object.defineProperty(global,"navigator",{value:{},configurable:true});
global.confirm = () => true;

(0,eval)(js);

// July 10 round, H16/H17 unscored (S:?)
const d = [
 {p:4,s:4,fir:'r',gir:true, ss:null,chip:null,putts:2,a:1,m:1,pen:0},
 {p:4,s:7,fir:'r',gir:false,ss:false,chip:'out',putts:3,a:1,m:0,pen:1},
 {p:3,s:3,fir:null,gir:true, ss:null,chip:null,putts:1,a:0,m:0,pen:0},
 {p:4,s:4,fir:'y',gir:true, ss:null,chip:null,putts:2,a:1,m:1,pen:0},
 {p:5,s:8,fir:'r',gir:false,ss:true, chip:'out',putts:2,a:1,m:1,pen:1},
 {p:4,s:4,fir:'y',gir:false,ss:true, chip:'in', putts:1,a:1,m:1,pen:0},
 {p:5,s:6,fir:'l',gir:false,ss:true, chip:'out',putts:2,a:1,m:1,pen:0},
 {p:3,s:3,fir:null,gir:true, ss:null,chip:null,putts:2,a:1,m:1,pen:0},
 {p:4,s:6,fir:'l',gir:false,ss:false,chip:'out',putts:3,a:1,m:1,pen:0},
 {p:4,s:4,fir:'y',gir:true, ss:null,chip:null,putts:2,a:1,m:1,pen:0},
 {p:5,s:5,fir:'y',gir:false,ss:true, chip:'in', putts:1,a:1,m:1,pen:0},
 {p:3,s:6,fir:null,gir:false,ss:false,chip:'out',putts:2,a:1,m:1,pen:1},
 {p:4,s:8,fir:'r',gir:false,ss:false,chip:'na', putts:3,a:2,m:1,pen:1},
 {p:3,s:4,fir:null,gir:false,ss:false,chip:'out',putts:2,a:1,m:1,pen:0},
 {p:4,s:5,fir:'y',gir:true, ss:null,chip:null,putts:3,a:2,m:1,pen:0},
 {p:5,s:null,fir:'y',gir:true, ss:null,chip:null,putts:2,a:1,m:1,pen:0},
 {p:4,s:null,fir:'l',gir:false,ss:true, chip:'out',putts:2,a:1,m:1,pen:0},
 {p:4,s:7,fir:'y',gir:false,ss:false,chip:'out',putts:3,a:2,m:1,pen:1},
];
globalThis.state = {date:'2026-07-10', holes:[], history:[], dirty:false};
globalThis.holes = globalThis.state.holes;
d.forEach(x=>globalThis.holes.push({fir:x.fir,score:x.s,gir:x.gir,ss:x.ss,chip:x.chip,putts:x.putts,sixAtt:x.a,sixMade:x.m,pen:x.pen,notes:''}));
globalThis.holes[0].notes='Driver left side fairway, 158 to center';

let fails = 0;
const check = (name, cond, got) => { if(!cond){fails++; console.log('FAIL '+name+' -> '+got);} else console.log('PASS '+name); };

// Case 1: partial round must be flagged, never silently totaled
buildSummary();
let out = els['exportText'].textContent;
let tot = out.split('\n').find(l=>l.startsWith('TOT'));
check('partial: starred total',        tot.includes('S:84*'), tot);
check('partial: PARTIAL 16/18',        tot.includes('PARTIAL 16/18'), tot);
check('partial: names unscored holes', tot.includes('UNSCORED:H16,H17'), tot);
check('partial: warn stat rendered',   els['stats'].innerHTML.includes('Unscored holes'), '');
check('note line emitted',             out.includes('H01 NOTE: Driver left side fairway, 158 to center'), '');
check('guardPartial detects',          unscoredHoles().join(',')==='16,17', unscoredHoles().join(','));

// Case 2: complete round must match the corrected July 10 file byte-for-byte on TOT
globalThis.holes[15].score=5; globalThis.holes[16].score=5;
buildSummary();
out = els['exportText'].textContent;
tot = out.split('\n').find(l=>l.startsWith('TOT'));
const oracle = 'TOT S:94 (+22) FIR:7/14 (L:3 R:4) GIR:7/18 PUTTS:38 CHIP6:2/10 SS:5/11 P36:16/20 PEN:5 OUT:45 IN:49';
check('complete: TOT matches corrected-file oracle', tot===oracle, tot);
check('complete: no star, no warn', !tot.includes('*') && !els['stats'].innerHTML.includes('Unscored'), tot);

// Case 3: stale-date auto-refresh
globalThis.state = {date:'2026-07-10', holes:[], history:[], dirty:false};
globalThis.holes = globalThis.state.holes;
for(let i=0;i<18;i++) globalThis.holes.push(blank());
ensureDate();
check('stale date on pristine round refreshes to today', globalThis.state.date===today(), globalThis.state.date);
globalThis.state.date='2026-07-10'; globalThis.holes[3].score=5;
ensureDate();
check('date frozen once round has data', globalThis.state.date==='2026-07-10', globalThis.state.date);

// Case 4: PuttView caddy-book layer (v11)
check('PV: 18 entries', typeof PV!=='undefined' && PV.length===18, typeof PV==='undefined'?'PV missing':PV.length);
check('PV: all green depths present (20-50 yds)', PV.every(p=>typeof p.gd==='number'&&p.gd>20&&p.gd<50), PV.map(p=>p.gd).join(','));
check('PV: pars align with book (par sum 72)', COURSE.reduce((a,c)=>a+c.par,0)===72, COURSE.reduce((a,c)=>a+c.par,0));
check('PV: H18 deepest at 42.7', PV[17].gd===42.7, PV[17].gd);
check('PV: H1 book yardage 402', PV[0].by===402, PV[0].by);
check('meta: H10 renders GD 37.6', pvMeta(9).includes('GD 37.6'), pvMeta(9));
check('meta: H18 renders GD 42.7', pvMeta(17).includes('GD 42.7'), pvMeta(17));
check('tip: no refs line anywhere (pulled v11.1 — numbers without spatial anchor fail ROI)', COURSE.every((c,i)=>!pvTip(i).includes('To-green refs')), 'refs line present');
check('tip: PV rem data retained for analysis/v12', PV[4].rem.length===6 && PV[4].rem[0]===235, PV[4].rem.join(','));
check('tip: H8 carries Book caddy note', pvTip(7).includes('Book: Diagonal ridge'), pvTip(7));
check('tip: H17 carries calm-pocket note', pvTip(16).includes('calm pocket right-mid'), pvTip(16));

// Case 5: pin-position layer (v12)
check('PINS: 18 entries, all letters valid F/M/B', typeof PINS!=='undefined' && PINS.length===18 && PINS.every(r=>['A','B','C','D','E'].every(k=>['F','M','B'].includes(r[k]))), typeof PINS==='undefined'?'PINS missing':'bad cell');
check('PINS: H12 Kenny-confirmed (D=front, C/A=back)', PINS[11].D==='F'&&PINS[11].C==='B'&&PINS[11].A==='B', JSON.stringify(PINS[11]));
check('PINS: H6 Kenny-confirmed (D,C = back)', PINS[5].D==='B'&&PINS[5].C==='B', JSON.stringify(PINS[5]));
check('pin: default ? shows no pin text', (globalThis.state.pin='?', !pvMeta(17).includes('Pin')&&!pvTip(17).includes('Pin ')), pvMeta(17));
check('pin: legacy state without pin field is safe', (delete globalThis.state.pin, !pvMeta(0).includes('Pin')), pvMeta(0));
globalThis.state.pin='C';
check('meta: H18 pin C renders front bucket', pvMeta(17).includes('Pin C\u2192front'), pvMeta(17));
check('tip: H18 pin C = play the front number', pvTip(17).includes('front third of a 42.7-yd green -- play the front number'), pvTip(17));
globalThis.state.pin='D';
check('tip: H18 pin D = back, club UP', pvTip(17).includes('back third of a 42.7-yd green -- club UP'), pvTip(17));
globalThis.state.pin='B';
check('tip: H18 pin B = middle number', pvTip(17).includes('middle number is the shot'), pvTip(17));
globalThis.state.pin='E';
check('tip: H1 (27.6, under deep threshold) pin line ends plain', pvTip(0).includes('back third of a 27.6-yd green.')&&!pvTip(0).includes('club UP'), pvTip(0));
globalThis.state.pin='C';
buildSummary();
check('export: header carries PIN:C', els['exportText'].textContent.split('\n')[0]==='BAY OAKS '+globalThis.state.date+' PIN:C', els['exportText'].textContent.split('\n')[0]);
globalThis.state.pin='?';
buildSummary();
check('export: pin ? omits PIN tag', !els['exportText'].textContent.split('\n')[0].includes('PIN'), els['exportText'].textContent.split('\n')[0]);

// Case 6: Quick Presets (rewritten v16a -- the v13/v14 presets fabricated FIR, CHIP6 and P36,
// and the old oracle asserted that fabrication as correct. These checks now assert the opposite:
// a preset may only set what its label claims. Diagnostic stats stay null unless observed.
globalThis.cur = 0; // H1 Par 4
const freshH1 = () => { globalThis.holes[0] = {score:null,fir:null,gir:null,ss:null,chip:null,putts:null,sixAtt:0,sixMade:0,pen:0,notes:''}; };

freshH1(); applyPreset('gir_par');
check('preset gir_par: score=4, gir=true, putts=2', globalThis.holes[0].score===4 && globalThis.holes[0].gir===true && globalThis.holes[0].putts===2, JSON.stringify(globalThis.holes[0]));
check('preset gir_par: does NOT fabricate FIR', globalThis.holes[0].fir===null, 'fir='+globalThis.holes[0].fir);
check('preset gir_par: does NOT fabricate CHIP6', globalThis.holes[0].chip===null, 'chip='+globalThis.holes[0].chip);

freshH1(); applyPreset('gir_birdie');
check('preset gir_birdie: score=3, putts=1, gir=true, no FIR', globalThis.holes[0].score===3 && globalThis.holes[0].putts===1 && globalThis.holes[0].gir===true && globalThis.holes[0].fir===null, JSON.stringify(globalThis.holes[0]));

freshH1(); applyPreset('updown_par');
check('preset updown_par: missed GIR, chip in (label-asserted), 1 putt, ss', globalThis.holes[0].score===4 && globalThis.holes[0].gir===false && globalThis.holes[0].chip==='in' && globalThis.holes[0].putts===1 && globalThis.holes[0].ss===true, JSON.stringify(globalThis.holes[0]));
check('preset updown_par: does NOT fabricate FIR', globalThis.holes[0].fir===null, 'fir='+globalThis.holes[0].fir);

freshH1(); applyPreset('threeputt_bogey');
check('preset threeputt_bogey: GIR + 3 putts = bogey', globalThis.holes[0].score===5 && globalThis.holes[0].gir===true && globalThis.holes[0].putts===3, JSON.stringify(globalThis.holes[0]));

freshH1(); applyPreset('miss_bogey_l');
check('preset miss_bogey_l: score=5, fir=l (label-asserted), gir=false, ss=false', globalThis.holes[0].score===5 && globalThis.holes[0].fir==='l' && globalThis.holes[0].gir===false && globalThis.holes[0].ss===false, JSON.stringify(globalThis.holes[0]));
check('preset miss_bogey_l: does NOT guess CHIP6', globalThis.holes[0].chip===null, 'chip='+globalThis.holes[0].chip);

freshH1(); applyPreset('miss_bogey_r');
check('preset miss_bogey_r: fir=r, no CHIP6 guess', globalThis.holes[0].fir==='r' && globalThis.holes[0].chip===null, JSON.stringify(globalThis.holes[0]));

// The load-bearing invariant: NO preset may ever contribute a P36 attempt.
// P36 is Kenny's strongest stat and the sole basis for "don't prescribe putting drills" --
// a fabricated make would corrupt that conclusion invisibly.
check('presets: none fabricate P36 attempts', ['gir_par','gir_birdie','updown_par','threeputt_bogey','miss_bogey_l','miss_bogey_r'].every(p=>{freshH1(); applyPreset(p); return globalThis.holes[0].sixAtt===0 && globalThis.holes[0].sixMade===0;}), 'a preset set sixAtt/sixMade');

// Case 6b: dirty vs exported semantics (v16a) -- copying is not saving.
globalThis.state.exported=true; globalThis.state.dirty=false;
globalThis.cur=0; freshH1(); applyPreset('gir_par');
check('export state: editing a hole clears exported', globalThis.state.exported===false && globalThis.state.dirty===true, 'exported='+globalThis.state.exported+' dirty='+globalThis.state.dirty);

// Case 7: Club Recommender (v13)
globalThis.state.pin = 'B';
let c105 = recommendClub(105, 0);
check('recommender 105y: Gap Wedge 80%', c105.club.includes('Gap Wedge') && c105.swing.includes('80%'), JSON.stringify(c105));
let c135 = recommendClub(135, 0);
check('recommender 135y: Pitching Wedge', c135.club.includes('Pitching Wedge'), JSON.stringify(c135));
let c75 = recommendClub(75, 0);
check('recommender 75y: 58° Wedge', c75.club.includes('58°'), JSON.stringify(c75));

// Case 8: Fatigue Alert (v13)
globalThis.cur = 15; // H16 on back 9
globalThis.holes[12].fir = 'l'; // H13 pull left
globalThis.holes[14].fir = 'l'; // H15 pull left
checkFatigue();
check('fatigue alert: triggers on 2+ back-9 left pulls', els['fatigueAlert'].style.display==='block' && els['fatigueAlert'].innerHTML.includes('Left-Miss Alert'), els['fatigueAlert'].innerHTML);
check('fatigue alert: admits when history is too thin to judge (v17)', els['fatigueAlert'].innerHTML.includes('Not enough history'), els['fatigueAlert'].innerHTML);
// with history loaded it must cite Kenny's own segment baseline rather than a fixed threshold
globalThis.state.rounds = SEED_ROUNDS.map(seedToRound);
checkFatigue();
check('fatigue alert: cites personal segment baseline once history exists', /% left on H13-18 vs \d+% on H1-12/.test(els['fatigueAlert'].innerHTML), els['fatigueAlert'].innerHTML);
check('fatigue alert: distinguishes real shift from normal dispersion', /late shift is real|matches your normal rate/.test(els['fatigueAlert'].innerHTML), els['fatigueAlert'].innerHTML);
globalThis.state.rounds = [];

// Case 9 (v13, rewritten v16b): seed data integrity. These once asserted against
// HISTORICAL_ROUNDS as a live read path; that array is now seed-only, so they assert
// the seed itself is intact. The live-read contract is tested in Case 12 below.
check('seed: 5 historical rounds present', SEED_ROUNDS.length===5, SEED_ROUNDS.length);
check('seed: 2026-08-19 round present', SEED_ROUNDS.some(r=>r.date==='2026-08-19'&&r.score===43), 'missing 08-19');

// Case 10: Quick 9 Mode — Front 9 (v13.1)
setMode('front');
check('mode front: range is 9 holes', targetHolesRange().count===9 && targetHolesRange().start===0, JSON.stringify(targetHolesRange()));
globalThis.cur = 8; move(1);
check('mode front: navigation wraps 1-9 (cur=0 on +1 from H9)', globalThis.cur===0, globalThis.cur);
for(let i=0; i<9; i++) { globalThis.holes[i].score = 4; }
buildSummary();
let f9out = els['exportText'].textContent;
check('mode front: header carries [FRONT 9]', f9out.split('\n')[0].includes('[FRONT 9]'), f9out.split('\n')[0]);
check('mode front: complete front 9 has no asterisk or unscored warning', !f9out.includes('*') && !els['stats'].innerHTML.includes('Unscored'), f9out);

// Case 11: Quick 9 Mode — Back 9 (v13.1)
setMode('back');
check('mode back: range starts at H10', targetHolesRange().count===9 && targetHolesRange().start===9, JSON.stringify(targetHolesRange()));
check('mode back: cur jumps to back 9', globalThis.cur>=9, globalThis.cur);
globalThis.cur = 17; move(1);
check('mode back: navigation wraps 10-18 (cur=9 on +1 from H18)', globalThis.cur===9, globalThis.cur);

// Case 12: Tee Selection (Blue, Tips, Combo) (v14.1)
setMode('full');
setGlobalTee('tips');
check('tee global tips: H1 yardage is 402y', holeYardage(0)==='402' || holeYardage(0)===402, holeYardage(0));
check('tee global tips: H1 meta shows Tips', pvMeta(0).includes('402 yds (Tips)'), pvMeta(0));
check('tee global tips: H1 tip switches to tips strategy', pvTip(0).includes('TIPS: 402y'), pvTip(0));
check('tee profile: tips total yardage is 7,026y', getTeeProfile().yds===7026 && getTeeProfile().label==='Tips', JSON.stringify(getTeeProfile()));

setGlobalTee('blue');
check('tee global blue: H1 yardage is 387y', holeYardage(0)===387, holeYardage(0));
check('tee profile: blue total yardage is 6,594y', getTeeProfile().yds===6594 && getTeeProfile().label==='Blue', JSON.stringify(getTeeProfile()));

// Combo: Hole 1 from Tips, Hole 2 from Blue
setHoleTee('tips'); // H1
globalThis.cur = 1; setHoleTee('blue'); // H2
let comboProf = getTeeProfile();
check('tee combo: detects mixed tees', comboProf.label.includes('Combo'), comboProf.label);

// Case 12: canonical rounds[] store + dynamic trends (v16b)
// The v15 bug this replaces: buildTrends rendered a hardcoded HISTORICAL_ROUNDS array while
// archived rounds went to state.history and were never read. A dashboard that looked dynamic
// but wasn't. These checks pin the new contract: rounds[] is the only read path.

// migration from a legacy pre-v16b state (history[], no rounds[], no schemaVersion)
const legacyState = {date:'2026-08-20', holes:[], history:[
  {date:'2026-08-06', mode:'full', tee:'blue', holes:[{score:4,fir:'y',gir:true,ss:null,chip:null,putts:2,sixAtt:1,sixMade:1,pen:0}]}
], dirty:false};
migrateState(legacyState);
check('migrate: schemaVersion stamped', legacyState.schemaVersion===SCHEMA, legacyState.schemaVersion);
check('migrate: rounds[] built from seed + history', Array.isArray(legacyState.rounds) && legacyState.rounds.length===SEED_ROUNDS.length, legacyState.rounds&&legacyState.rounds.length);
check('migrate: legacy history retired but retained as rollback net', legacyState.history===undefined && Array.isArray(legacyState._legacyHistory), 'history='+legacyState.history);
check('migrate: logged round wins over seed row on same date', legacyState.rounds.filter(r=>r.date==='2026-08-06')[0].source==='logged', JSON.stringify(legacyState.rounds.filter(r=>r.date==='2026-08-06')[0].source));
check('migrate: rounds sorted by date ascending', legacyState.rounds.every((r,i,a)=>i===0||a[i-1].date<=r.date), legacyState.rounds.map(r=>r.date).join(','));

// idempotence -- running migration twice must not duplicate or re-seed
const before = JSON.stringify(legacyState.rounds);
migrateState(legacyState);
check('migrate: idempotent on second run', JSON.stringify(legacyState.rounds)===before, 'rounds mutated on re-run');

// roundStats normalises both shapes
const seededRound = seedToRound(SEED_ROUNDS[0]);
const ss1 = roundStats(seededRound);
check('roundStats(summary): 07-15 reads 94 (+22), FIR 7/14', ss1.score===94 && ss1.par===72 && ss1.fir.n===7 && ss1.fir.d===14, JSON.stringify(ss1.fir));
// Built from COURSE rather than reusing globalThis.holes -- earlier cases mutate that array,
// and a stats test that depends on cumulative mutation tests the test order, not the code.
const fixtureHoles = COURSE.map((c,i)=>({score:c.par, fir:(c.par>3?'y':null), gir:true, ss:null,
  chip:(i%3===0?'in':(i%3===1?'out':null)), putts:2, sixAtt:1, sixMade:1, pen:0}));
const expFirD = COURSE.filter(c=>c.par>3).length;
const loggedRound = {date:'2026-08-20', source:'logged', holes:fixtureHoles, summary:null};
const ss2 = roundStats(loggedRound);
check('roundStats(holes): derives from live hole data, not a stored summary', ss2.played===18 && ss2.score===72 && ss2.par===72, JSON.stringify({played:ss2.played,score:ss2.score,par:ss2.par}));
check('roundStats: par 3s excluded from FIR denominator', ss2.fir.d===expFirD && ss2.fir.n===expFirD, 'fir='+ss2.fir.n+'/'+ss2.fir.d+' expected d='+expFirD);
check('roundStats: CHIP6 counts only recorded chips (12 attempts, 6 inside)', ss2.chip6.d===12 && ss2.chip6.n===6, JSON.stringify(ss2.chip6));
check('roundStats: OUT/IN split at the turn', ss2.out+ss2.inn===ss2.score && ss2.out===COURSE.slice(0,9).reduce((a,c)=>a+c.par,0), 'out='+ss2.out+' inn='+ss2.inn);

// trends compute from rounds[], never from SEED_ROUNDS directly
globalThis.state.rounds = SEED_ROUNDS.map(seedToRound);
buildTrends();
check('trends: season low computed from 18-hole rounds only (82)', els['tSeasonLow'].textContent===82 || els['tSeasonLow'].textContent==='82', els['tSeasonLow'].textContent);
check('trends: quick-9 low computed separately (43)', els['tNineLow'].textContent===43 || els['tNineLow'].textContent==='43', els['tNineLow'].textContent);
check('trends: FIR% aggregated across rounds, not hardcoded', els['tFirPct'].textContent==='53%', els['tFirPct'].textContent);
check('trends: CHIP6% aggregated (7/38 = 18%)', els['tChipPct'].textContent==='18%', els['tChipPct'].textContent);
check('trends: leak card pulls the live CHIP6 number', els['tLeakChip'].textContent===els['tChipPct'].textContent, els['tLeakChip'].textContent);
check('trends: history list renders every round', (els['historyList'].innerHTML.match(/border-bottom/g)||[]).length===SEED_ROUNDS.length, 'rows rendered');

// the load-bearing invariant: no rounds => honest blanks, never stale or invented numbers
globalThis.state.rounds = [];
buildTrends();
check('trends: empty store renders em-dash, not a stale figure', els['tFirPct'].textContent==='\u2014' && els['tSeasonLow'].textContent==='\u2014' && els['tP36Pct'].textContent==='\u2014', els['tFirPct'].textContent+'/'+els['tSeasonLow'].textContent);
check('trends: empty store says so in the history list', els['historyList'].innerHTML.indexOf('No rounds logged yet')>-1, els['historyList'].innerHTML);

// no read path to SEED_ROUNDS outside migrateState
check('SEED_ROUNDS is referenced only by its declaration and migrateState', (appSrc.match(/SEED_ROUNDS/g)||[]).length===3, (appSrc.match(/SEED_ROUNDS/g)||[]).length+' references');
check('HISTORICAL_ROUNDS is gone', appSrc.indexOf('HISTORICAL_ROUNDS')===-1, 'still present');

// Case 13: hole-level backfill (v16c)
// The seed rounds now carry real holes[] parsed from the Drive exports. The load-bearing
// invariant: stats derived from those holes must reproduce the hand-transcribed summary
// in SEED_ROUNDS. If an encode/decode bug crept in, these fail loudly rather than quietly
// shifting Kenny's baseline.
check('backfill: all 5 seed rounds carry hole data', SEED_ROUNDS.every(r=>SEED_HOLES[r.date]), SEED_ROUNDS.filter(r=>!SEED_HOLES[r.date]).map(r=>r.date).join(','));
check('backfill: decode yields 18 slots per round', SEED_ROUNDS.every(r=>decodeSeedHoles(SEED_HOLES[r.date]).length===18), 'wrong length');

SEED_ROUNDS.forEach(r=>{
  const st = roundStats(seedToRound(r));
  const f = s => {const p=String(s).split('/'); return p[0]+'/'+p[1];};
  const got = [st.score, st.fir.n+'/'+st.fir.d, st.gir.n+'/'+st.gir.d, st.putts,
               st.chip6.n+'/'+st.chip6.d, st.ss.n+'/'+st.ss.d, st.p36.n+'/'+st.p36.d, st.pen].join(' ');
  const exp = [r.score, f(r.fir), f(r.gir), r.putts, f(r.chip6), f(r.ss), f(r.p36), r.pen].join(' ');
  check('backfill '+r.date+': derived stats reproduce the transcribed summary', got===exp, got+'  vs  '+exp);
  check('backfill '+r.date+': holes played matches', st.played===r.holes, st.played+' vs '+r.holes);
});

check('backfill: summary dropped once holes exist (single computation path)', seedToRound(SEED_ROUNDS[0]).summary===null && seedToRound(SEED_ROUNDS[0]).holes!==null, 'summary retained alongside holes');
check('backfill: 08-19 carries its pin letter (D)', seedToRound(SEED_ROUNDS[4]).pin==='D', seedToRound(SEED_ROUNDS[4]).pin);
check('backfill: unplayed holes decode as empty, not zero', decodeSeedHoles(SEED_HOLES['2026-08-19'])[9].score===null, JSON.stringify(decodeSeedHoles(SEED_HOLES['2026-08-19'])[9]));

// scrambling semantics: saves / greens MISSED (matches buildSummary and every historical export)
const ssFix = roundStats(seedToRound(SEED_ROUNDS[3]));
check('scramble: denominator is greens missed, not holes where ss was recorded', ssFix.ss.d===12 && ssFix.ss.n===3, ssFix.ss.n+'/'+ssFix.ss.d);

// aggregate must still match the independently-maintained vault trends table
globalThis.state.rounds = SEED_ROUNDS.map(seedToRound);
buildTrends();
check('backfill: aggregate FIR still 53% (30/57, matches vault)', els['tFirPct'].textContent==='53%', els['tFirPct'].textContent);
check('backfill: aggregate CHIP6 still 18% (7/38, matches vault)', els['tChipPct'].textContent==='18%', els['tChipPct'].textContent);
check('backfill: aggregate P36 still 90% (66/73, matches vault)', els['tP36Pct'].textContent==='90%', els['tP36Pct'].textContent);

// Case 14: per-hole and segment analytics (v17)
const allRounds = SEED_ROUNDS.map(seedToRound);
const hStats = holeStats(allRounds);
check('holeStats: one entry per hole', hStats.length===18, hStats.length);
check('holeStats: H1 played in all 5 rounds', hStats[0].n===5, hStats[0].n);
check('holeStats: back-nine holes reflect the two partial rounds (n=3)', hStats[10].n===3, 'H11 n='+hStats[10].n);
check('holeStats: averages derived, not stored', Math.abs(hStats[0].avg - hStats[0].strokes/hStats[0].n) < 1e-9, hStats[0].avg);
// H3 on 08-06 was a 6 on a par 3 with a penalty -- penalty attribution must land on the right hole
check('holeStats: penalties attributed per hole', hStats[2].pen>=1, 'H3 pen='+hStats[2].pen);
check('holeStats: three-putts counted from putts>=3', hStats.reduce((a,o)=>a+o.threePutts,0)===17, hStats.reduce((a,o)=>a+o.threePutts,0));

const segs = segmentStats(allRounds);
check('segmentStats: three segments', segs.length===3 && segs[0].label==='H1-6', segs.map(s=>s.label).join(','));
check('segmentStats: hole counts sum to total played', segs.reduce((a,s)=>a+s.n,0)===allRounds.reduce((a,r)=>a+roundStats(r).played,0), segs.map(s=>s.n).join('+'));
check('segmentStats: FIR denominator excludes par 3s', segs.every(s=>s.l+s.r+s.y===s.firD), segs.map(s=>s.l+'+'+s.r+'+'+s.y+' vs '+s.firD).join(' | '));

const ns = nineSplit(allRounds);
check('nineSplit: front and back both populated', ns.front.n>0 && ns.back.n>0, JSON.stringify(ns));
check('nineSplit: front holes = 5 rounds x 9 (all rounds reached the turn)', ns.front.n===45, ns.front.n);

// rendering: hotspots must rank by average over par and show n, never rank a single-round hole
globalThis.state.rounds = allRounds;
buildTrends();
check('hotspots: rendered with sample sizes', els['hotspotList'].innerHTML.indexOf('n=')>-1, els['hotspotList'].innerHTML.slice(0,120));
check('hotspots: worst hole listed first', (function(){
  const ranked = hStats.filter(o=>o.n>=2).sort((a,b)=>b.avgOver-a.avgOver);
  return els['hotspotList'].innerHTML.indexOf('H'+ranked[0].hole+'</b>')>-1;
})(), 'top hole missing');
check('segments: rendered with per-hole over-par and n', els['segmentList'].innerHTML.indexOf('H1-6')>-1 && els['segmentList'].innerHTML.indexOf('n=')>-1, els['segmentList'].innerHTML.slice(0,120));
check('segments: front/back comparison rendered', els['segmentList'].innerHTML.indexOf('/hole')>-1, 'missing split line');

// empty store must not fabricate analytics
globalThis.state.rounds = [];
buildTrends();
check('hotspots: empty store says so rather than showing zeros', els['hotspotList'].innerHTML.indexOf('No hole-level data')>-1, els['hotspotList'].innerHTML);
check('segments: empty store says so rather than showing zeros', els['segmentList'].innerHTML.indexOf('No hole-level data')>-1, els['segmentList'].innerHTML);

// Case 15: file split integrity (v17.1)
// These guard the failure modes behavioural tests can't see: a script that never loads,
// or an asset the service worker forgets to precache (which only surfaces offline, on the
// course, with no signal).
import {existsSync} from 'fs';
const swSrc = readFileSync('sw.js','utf8');

SRC_FILES.concat(['styles.css']).forEach(f=>{
  check('split: '+f+' exists on disk', existsSync(f), 'missing');
  check('split: index.html references '+f, html.indexOf(f)>-1, 'not referenced');
  check('split: sw precaches '+f, swSrc.indexOf(f)>-1, 'not precached');
});

check('split: scripts load in dependency order (seed -> stats -> course -> app)', (function(){
  const pos = SRC_FILES.map(f=>html.indexOf(f));
  return pos.every((p,i)=>p>-1 && (i===0 || p>pos[i-1]));
})(), SRC_FILES.map(f=>html.indexOf(f)).join(','));
check('split: classic scripts, not modules (29 inline onclick handlers need globals)', html.indexOf('type="module"')===-1, 'module script found');
check('split: no inline <script> block left behind', !/<script>[\s\S]*?var /.test(html), 'inline code remains');
check('split: no inline <style> block left behind', html.indexOf('<style>')===-1, 'inline styles remain');
check('split: boot call survives in app.js', /load\(\);\s*render\(\);/.test(readFileSync('js/app.js','utf8')), 'boot missing');
check('split: every icon in the manifest is precached', (function(){
  const man = JSON.parse(readFileSync('manifest.json','utf8'));
  return (man.icons||[]).every(i=>swSrc.indexOf(i.src.replace(/^\.?\//,''))>-1);
})(), 'a manifest icon is not precached');
check('split: sw caches only GET requests', swSrc.indexOf("method!=='GET'")>-1, 'GET guard missing');

// Case 16: first-putt distance bucket (v19)
check('lag: new holes carry a lag field', blank().lag===null, JSON.stringify(blank()));
check('lag: legacy holes without lag are safe', lagStats([{holes:[{score:4,putts:2}]}]).withPutts===1, 'crashed or miscounted');

// the five backfilled rounds have no lag data -- the card must say so, not render empty buckets
const lagSeed = lagStats(SEED_ROUNDS.map(seedToRound));
check('lag: seed rounds have putting data but no lag coverage', lagSeed.withPutts>0 && lagSeed.coverage===0, 'withPutts='+lagSeed.withPutts+' coverage='+lagSeed.coverage);
globalThis.state.rounds = SEED_ROUNDS.map(seedToRound);
buildTrends();
check('lag card: states that distance is unrecorded rather than showing zeros', els['lagList'].innerHTML.indexOf('not recorded on any hole')>-1, els['lagList'].innerHTML.slice(0,120));

// with real lag data it must separate long-putt from short-putt three-putts
const lagRound = {date:'2026-08-21', source:'logged', summary:null, holes:COURSE.map((c,i)=>({
  score:c.par, fir:null, gir:true, ss:null, chip:null,
  putts:(i<6?3:2), lag:(i<6?'d':'a'), sixAtt:1, sixMade:1, pen:0, notes:''
}))};
const L2 = lagStats([lagRound]);
check('lag: 30+ ft bucket captures the three-putts', L2.buckets.d.n===6 && L2.buckets.d.threePutts===6, JSON.stringify(L2.buckets.d));
check('lag: 0-6 ft bucket shows none', L2.buckets.a.n===12 && L2.buckets.a.threePutts===0, JSON.stringify(L2.buckets.a));
check('lag: full coverage reported when every hole is tagged', L2.coverage===1, L2.coverage);
globalThis.state.rounds = [lagRound];
buildTrends();
check('lag card: renders a three-putt rate per bucket', /100%<\/b> three-putt/.test(els['lagList'].innerHTML), els['lagList'].innerHTML.slice(0,160));

// export must carry the new field, and omit it cleanly when absent
globalThis.state.rounds = [];
globalThis.holes = mk();
globalThis.state.holes = globalThis.holes;
globalThis.holes[0].score=4; globalThis.holes[0].putts=2; globalThis.holes[0].lag='c';
globalThis.cur=0; buildSummary();
check('export: LAG tag emitted when recorded', els['exportText'].textContent.indexOf('LAG:C')>-1, els['exportText'].textContent.split('\n')[1]);
globalThis.holes[0].lag=null; buildSummary();
check('export: LAG tag omitted when not recorded', els['exportText'].textContent.indexOf('LAG:')===-1, els['exportText'].textContent.split('\n')[1]);

// Case 17: player model extraction (v18)
// A refactor's proof is that behaviour didn't change -- the recommender checks above still
// pass untouched. These add the property the extraction was for: no carry number may live
// in caddy logic any more, so a yardage edit can never leave the advice text disagreeing.
const appJs = readFileSync('js/app.js','utf8');
const recFn = appJs.match(/function recommendClub[\s\S]*?\n}/)[0];
check('bag: recommendClub contains no hardcoded club names', !/58\u00b0|Pitching Wedge|4-Hybrid|Gap Wedge/.test(recFn), recFn.slice(0,200));
check('bag: recommendClub contains no hardcoded yardage thresholds', !/eff<=\d+/.test(recFn), recFn.slice(0,200));
check('bag: every slot has club, carry, upTo and swing', BAG.every(b=>b.club&&b.carry>0&&b.upTo>0&&b.swing), 'incomplete slot');
check('bag: slots ordered ascending by ceiling', BAG.every((b,i)=>i===0||b.upTo>BAG[i-1].upTo), BAG.map(b=>b.upTo).join(','));
check('bag: covers any distance (final slot is open-ended)', recommendClub(400,0)!==null && recommendClub(400,0).club==='Driver', JSON.stringify(recommendClub(400,0)));
check('bag: caddy chips derive from the bag, not a parallel list', bagDistances().every(d=>BAG.some(b=>b.carry===d)), bagDistances().join(','));
check('bag: recommendation reports the effective distance it used', recommendClub(120,0).eff===120, JSON.stringify(recommendClub(120,0)));
// pin-depth adjustment must survive the refactor: back pin on a deep green costs a club
check('bag: back pin on a deep green shifts the recommendation', (function(){
  globalThis.state.pin='D';                       // H18 pin D = back third, gd 42.7
  const back=recommendClub(120,17);
  globalThis.state.pin='C';                       // H18 pin C = front third
  const front=recommendClub(120,17);
  globalThis.state.pin='?';
  return back.eff===127 && front.eff===113;
})(), 'pin adjustment lost');

console.log(fails ? 'RESULT: FAIL ('+fails+')' : 'RESULT: ALL PASS');
process.exit(fails?1:0);




