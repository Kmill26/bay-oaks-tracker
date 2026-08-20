// Analysis layer: round store, migration, derived statistics. No DOM.
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
      if(!h||h.score==null||!out[i])return;
      var o=out[i];
      o.n++; o.strokes+=h.score; o.overPar+=(h.score-COURSE[i].par);
      if(h.gir!=null){o.gir.d++; if(h.gir)o.gir.n++;}
      if(h.chip==='in'||h.chip==='out'){o.chip6.d++; if(h.chip==='in')o.chip6.n++;}
      if((h.putts||0)>=3)o.threePutts++;
      o.pen+=h.pen||0;
      if(h.fir==='l')o.firL++; else if(h.fir==='r')o.firR++; else if(h.fir==='y')o.firY++;
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
        var h=hs[i]; if(!h||h.score==null)continue;
        o.n++; o.strokes+=h.score; o.overPar+=(h.score-COURSE[i].par);
        o.pen+=h.pen||0; if((h.putts||0)>=3)o.threePutts++;
        if(COURSE[i].par>3&&h.fir){o.firD++; if(h.fir==='l')o.l++; else if(h.fir==='r')o.r++; else if(h.fir==='y')o.y++;}
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
      if(!h||h.score==null)return;
      var k=i<9?'front':'back';
      out[k].n++; out[k].over+=(h.score-COURSE[i].par);
    });
  });
  return out;
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

function roundStats(r){
  if(r&&r.summary){var s=r.summary;
    return {score:s.score,par:s.par,played:s.played,fir:s.fir,gir:s.gir,putts:s.putts,
      chip6:s.chip6,ss:s.ss,p36:s.p36,pen:s.pen,out:s.out,inn:s.inn,
      type:s.type||(s.played+' Holes')};}
  var hs=(r&&r.holes)||[], score=0,par=0,played=0,putts=0,pen=0,out=0,inn=0;
  var fir={n:0,d:0},gir={n:0,d:0},chip6={n:0,d:0},ss={n:0,d:0},p36={n:0,d:0};
  hs.forEach(function(h,i){
    var c=COURSE[i]; if(!c||!h||h.score==null)return;
    played++; score+=h.score; par+=c.par;
    if(i<9)out+=h.score; else inn+=h.score;
    putts+=h.putts||0; pen+=h.pen||0;
    if(c.par>3&&h.fir){fir.d++; if(h.fir==='y')fir.n++;}
    if(h.gir!=null){gir.d++; if(h.gir)gir.n++;}
    if(h.chip==='in'||h.chip==='out'){chip6.d++; if(h.chip==='in')chip6.n++;}
    // Scrambling is saves / greens MISSED (standard definition, and what buildSummary's
    // export has always written). Counting only holes where ss was recorded would shrink
    // the denominator on unrecorded holes and silently inflate the rate.
    if(h.gir===false){ss.d++; if(h.ss===true)ss.n++;}
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
