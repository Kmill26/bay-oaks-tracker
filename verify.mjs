import {readFileSync} from 'fs';

const html = readFileSync('index.html','utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/load\(\); render\(\);[\s\S]*$/, ''); // skip boot

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
check('fatigue alert: triggers on 2+ back-9 left pulls', els['fatigueAlert'].style.display==='block' && els['fatigueAlert'].innerHTML.includes('Back-9 Fatigue Alert'), els['fatigueAlert'].innerHTML);

// Case 9: Trends History Baseline (v13)
check('trends: 5 historical rounds stored', HISTORICAL_ROUNDS.length===5, HISTORICAL_ROUNDS.length);
check('trends: 2026-08-19 round present in history', HISTORICAL_ROUNDS.some(r=>r.date==='2026-08-19'&&r.score===43), 'missing 08-19');

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

console.log(fails ? 'RESULT: FAIL ('+fails+')' : 'RESULT: ALL PASS');
process.exit(fails?1:0);




