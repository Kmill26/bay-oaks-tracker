import {readFileSync} from 'fs';

const html = readFileSync('index.html','utf8');
const js = html.match(/<script>([\s\S]*?)<\/script>/)[1]
  .replace(/load\(\); render\(\);[\s\S]*$/, ''); // skip boot

// Minimal DOM/browser stubs
const els = {};
const el = id => els[id] || (els[id] = {textContent:'', innerHTML:'', value:'', style:{display:''}, className:''});
global.document = {getElementById: el, createElement:()=>({}), body:{appendChild(){},removeChild(){}}};
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

console.log(fails ? 'RESULT: FAIL ('+fails+')' : 'RESULT: ALL PASS');
process.exit(fails?1:0);
