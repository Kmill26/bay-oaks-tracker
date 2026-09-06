// Analysis layer: round store, migration, derived statistics. No DOM.
// ---- v36: ONE validity policy for a hole's observations -------------------------------
// F4: roundStats() was taught in v28 that a recorded observation is real data whether or
// not the score has been tapped in, and that a CHIP6 sitting next to GIR=Yes is stale data
// from a correction. The hotspot, segment and lag consumers never learned either rule, so
// the same round answered the same question three different ways. The rules now live here
// once and every consumer calls them.
//
// The policy, stated plainly:
//   * Score-derived figures -- strokes, over-par, the nine split, "holes played" -- exist
//     only where a score exists. There is no stroke to attribute without one.
//   * A recorded observation -- fairway, green, short-side, chip, putts, penalty, lag,
//     3-6 ft putts -- counts from the moment it is recorded. Kenny enters a hole in that
//     order, so gating these on the score discards live data.
//   * CHIP6 is the first greenside shot after MISSING the green. It exists only where
//     GIR is explicitly No; a chip left behind by a GIR correction is not a chip attempt.
//   * SS retains the existing missed-green denominator. Unknown-answer coverage is
//     a separate, deferred policy decision; this fix does not change historical SS.
//   * A fairway is only in play on a par 4 or 5.
//   * Lag needs a first putt: a hole holed out from off the green has none.
function countsScore(h){ return !!h && h.score!=null; }
function countsFir(h,c){ return !!h && !!c && c.par>3 && !!h.fir; }
function countsGir(h){ return !!h && h.gir!=null; }
function countsSs(h){ return !!h && h.gir===false; }
function countsChip6(h){ return countsSs(h) && (h.chip==='in' || h.chip==='out'); }
function countsPutts(h){ return !!h && h.putts!=null; }
function hasFirstPutt(h){ return countsPutts(h) && h.putts>0; }
function threePutt(h){ return countsPutts(h) && h.putts>=3; }

// ---- v17: per-hole and segment analytics, all derived from rounds[] ------------------
// Sample sizes are tiny (n<=5 per hole), so every figure ships with its n and the UI
// suppresses holes with n<2. Showing a confident average built on one round is the same
// failure as the hardcoded dashboard -- a number that looks like evidence but isn't.
function holeStats(rounds){
  var out=COURSE.map(function(c,i){return {hole:i+1,par:c.par,hcp:c.hcp,n:0,strokes:0,overPar:0,
    gir:{n:0,d:0},chip6:{n:0,d:0},threePutts:0,pen:0,firL:0,firR:0,firY:0};});
  (rounds||[]).forEach(function(r){
    var hs=r.holes; if(!hs)return;
    hs.forEach(function(h,i){
      var o=out[i], c=COURSE[i]; if(!h||!o||!c)return;
      if(countsScore(h)){o.n++; o.strokes+=h.score; o.overPar+=(h.score-c.par);}
      if(countsGir(h)){o.gir.d++; if(h.gir)o.gir.n++;}
      if(countsChip6(h)){o.chip6.d++; if(h.chip==='in')o.chip6.n++;}
      if(threePutt(h))o.threePutts++;
      o.pen+=h.pen||0;
      if(countsFir(h,c)){if(h.fir==='l')o.firL++; else if(h.fir==='r')o.firR++; else if(h.fir==='y')o.firY++;}
    });
  });
  out.forEach(function(o){o.avg=o.n?o.strokes/o.n:null; o.avgOver=o.n?o.overPar/o.n:null;});
  return out;
}

// Segment split tests the fatigue hypothesis against real history instead of a fixed
// threshold: does his tee-miss pattern actually shift late in the round?
function segmentStats(rounds){
  var seg=[{label:'H1-6',from:0,to:6},{label:'H7-12',from:6,to:12},{label:'H13-18',from:12,to:18}];
  return seg.map(function(s){
    var o={label:s.label,n:0,strokes:0,overPar:0,l:0,r:0,y:0,firD:0,pen:0,threePutts:0};
    (rounds||[]).forEach(function(r){
      var hs=r.holes; if(!hs)return;
      for(var i=s.from;i<s.to;i++){
        var h=hs[i], c=COURSE[i]; if(!h||!c)continue;
        if(countsScore(h)){o.n++; o.strokes+=h.score; o.overPar+=(h.score-c.par);}
        o.pen+=h.pen||0;
        if(threePutt(h))o.threePutts++;
        if(countsFir(h,c)){o.firD++; if(h.fir==='l')o.l++; else if(h.fir==='r')o.r++; else if(h.fir==='y')o.y++;}
      }
    });
    o.leftRate=o.firD?o.l/o.firD:null;
    o.avgOver=o.n?o.overPar/o.n:null;
    return o;
  });
}

function nineSplit(rounds){
  var out={front:{n:0,over:0},back:{n:0,over:0}};
  (rounds||[]).forEach(function(r){
    var hs=r.holes; if(!hs)return;
    hs.forEach(function(h,i){
      if(!countsScore(h))return;
      var k=i<9?'front':'back';
      out[k].n++; out[k].over+=(h.score-COURSE[i].par);
    });
  });
  return out;
}

// v19: first-putt distance buckets. Standing prescription #2 says the 3-putts come from
// 40-60 ft first putts on 27-43 yd greens, not from the stroke -- but until now that was an
// inference from round-level data. This makes it directly measurable: 3-putt rate BY first-
// putt distance separates "bad approach/chip" from "bad lag" for the first time.
var LAGLABEL={a:'0-6 ft',b:'7-15 ft',c:'16-30 ft',d:'30+ ft'};
var LAGORDER=['a','b','c','d'];

function lagStats(rounds){
  var out={}; LAGORDER.forEach(function(k){out[k]={label:LAGLABEL[k],n:0,threePutts:0,putts:0};});
  var missing=0, withPutts=0;
  (rounds||[]).forEach(function(r){
    var hs=r.holes; if(!hs)return;
    hs.forEach(function(h){
      if(!hasFirstPutt(h))return;
      withPutts++;
      if(!h.lag||!out[h.lag]){missing++; return;}
      var b=out[h.lag];
      b.n++; b.putts+=h.putts; if(threePutt(h))b.threePutts++;
    });
  });
  return {buckets:out, missing:missing, withPutts:withPutts,
    coverage:withPutts?(withPutts-missing)/withPutts:0};
}

// ---- v16b: canonical round store ------------------------------------------------
// Every trend, metric and history line reads state.rounds. A round either carries a full
// holes[] (logged in-app) or a summary (seeded/hand-transcribed). roundStats() normalises
// both shapes so no caller has to branch on provenance -- and so a stat is never invented
// for a round that didn't record it: absent denominators stay 0 and render as em-dash.
var SCHEMA=1;

function parseFrac(s){var p=String(s==null?'':s).split('/'); return {n:+p[0]||0,d:+p[1]||0};}

function seedToRound(r){
  var hs=decodeSeedHoles(SEED_HOLES[r.date]);
  return {id:'seed-'+r.date, date:r.date, mode:(r.holes===18?'full':(r.holes===9?'front':'partial')),
    tee:String(r.tee||'blue').toLowerCase(), source:hs?'backfilled':'manual', suspect:false,
    pin:SEED_PINS[r.date]||null, label:r.type, holes:hs,
    // With hole data present the summary is dropped so roundStats() derives from holes --
    // one computation path, no chance of the two drifting.
    summary:hs?null:{score:r.score,par:r.par,played:r.holes,fir:parseFrac(r.fir),gir:parseFrac(r.gir),
      putts:r.putts,chip6:parseFrac(r.chip6),ss:parseFrac(r.ss),p36:parseFrac(r.p36),
      pen:r.pen,out:r.out,inn:r.in,type:r.type}};
}

function legacyToRound(h){
  return {id:'log-'+h.date, date:h.date, mode:h.mode||'full', tee:h.tee||'blue',
    source:'logged', suspect:false, pin:h.pin||null, holes:h.holes||null, summary:null};
}

// v28: THE single per-round calculation. buildSummary() used to run its own copy of this
// loop with different rules, so the on-screen summary, the export text and the archived
// round could disagree about the same holes. Two divergences were confirmed and are both
// closed here; buildSummary now calls this function instead of recomputing.
function roundStats(r){
  if(r&&r.summary){var s=r.summary;
    // Seeded summaries predate per-hole capture and carry no miss direction.
    var sf=s.fir&&{n:s.fir.n,d:s.fir.d,l:s.fir.l||0,r:s.fir.r||0};
    return {score:s.score,par:s.par,played:s.played,fir:sf,gir:s.gir,putts:s.putts,
      chip6:s.chip6,ss:s.ss,p36:s.p36,pen:s.pen,out:s.out,inn:s.inn,
      type:s.type||(s.played+' Holes')};}
  var hs=(r&&r.holes)||[], score=0,par=0,played=0,putts=0,pen=0,out=0,inn=0;
  var fir={n:0,d:0,l:0,r:0},gir={n:0,d:0},chip6={n:0,d:0},ss={n:0,d:0},p36={n:0,d:0};
  hs.forEach(function(h,i){
    var c=COURSE[i]; if(!c||!h)return;
    // Score, par and the nine-splits are scored-holes-only: a hole with no score has no
    // stroke to attribute. Everything below is different -- a recorded stat is real data
    // whether or not the score has been tapped in yet, which is the order Kenny actually
    // enters a hole. roundStats used to skip the whole hole on a missing score while
    // buildSummary counted it, so a round mid-entry reported two different putt totals.
    if(countsScore(h)){
      played++; score+=h.score; par+=c.par;
      if(i<9)out+=h.score; else inn+=h.score;
    }
    putts+=h.putts||0; pen+=h.pen||0;
    if(countsFir(h,c)){fir.d++; if(h.fir==='y')fir.n++; else if(h.fir==='l')fir.l++; else if(h.fir==='r')fir.r++;}
    if(countsGir(h)){gir.d++; if(h.gir)gir.n++;}
    // CHIP6 is the first greenside shot after MISSING the green -- the UI only enables the
    // row when GIR is No. A chip sitting next to GIR=Yes is stale data from a correction,
    // and counting it inflated the archived rate while the summary correctly dropped it.
    if(countsChip6(h)){chip6.d++; if(h.chip==='in')chip6.n++;}
    // SS is SHORT-SIDED -- did the miss finish on the side the pin is on. It is not sand
    // saves and it is not scrambling; the comment that used to sit here said otherwise and
    // misled three separate readers (see the 2026-08-25 review). The denominator is every
    // missed green. Unknown-answer coverage remains a separate policy decision.
    if(countsSs(h)){ss.d++; if(h.ss===true)ss.n++;}
    p36.n+=h.sixMade||0; p36.d+=h.sixAtt||0;
  });
  return {score:score,par:par,played:played,fir:fir,gir:gir,putts:putts,chip6:chip6,
    ss:ss,p36:p36,pen:pen,out:out,inn:inn,type:played+' Holes'};
}

// One-way migration. Legacy state.history is converted, then retained as _legacyHistory
// for one version as a rollback net (v17 deletes it). Logged rounds win over seed rows on
// the same date -- they carry holes[] and are therefore strictly richer.
function migrateState(st){
  if(!st)return st;
  if(st.schemaVersion===SCHEMA&&Array.isArray(st.rounds))return st;
  if(!Array.isArray(st.rounds)){
    var byDate={};
    SEED_ROUNDS.forEach(function(r){byDate[r.date]=seedToRound(r);});
    (st.history||[]).forEach(function(h){if(h&&h.date)byDate[h.date]=legacyToRound(h);});
    st.rounds=Object.keys(byDate).sort().map(function(k){return byDate[k];});
    if(st.history&&st.history.length)st._legacyHistory=st.history;
    delete st.history;
  }
  st.schemaVersion=SCHEMA;
  return st;
}
