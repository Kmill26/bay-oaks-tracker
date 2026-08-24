// UI + state. Loaded last; depends on seed/stats/course being present.
function pinBucket(i){var p=state&&state.pin; return (p&&p!=='?'&&PINS[i][p])?PINS[i][p]:null;}

function holeTee(i){
  var h=holes&&holes[i];
  if(h&&h.tee)return h.tee;
  return (state&&state.tee)||'blue';
}

function holeYardage(i,t){
  t=t||holeTee(i);
  if(t==='tips')return PV[i].by;
  if(t==='white')return COURSE[i].ry;
  return COURSE[i].cy;
}

function pvMeta(i){
  var c=COURSE[i], t=holeTee(i), yds=holeYardage(i,t);
  var tName=(t==='tips'?'Tips':(t==='white'?'White':'Blue'));
  var m='Par '+c.par+' \u00b7 HCP '+c.hcp+' \u00b7 '+yds+' yds ('+tName+') \u00b7 GD '+PV[i].gd;
  var b=pinBucket(i); if(b)m+=' \u00b7 Pin '+state.pin+'\u2192'+PINWORD[b];
  return m;
}

function pvTip(i){
  var p=PV[i], t=COURSE[i].tip;
  var tee=holeTee(i);
  if(tee==='tips'&&COURSE[i].tipsTip){
    t=COURSE[i].tipsTip;
  }
  if(p.note)t+='\nBook: '+p.note;
  var b=pinBucket(i);
  if(b){
    t+='\nPin '+state.pin+': '+PINWORD[b]+' third of a '+p.gd+'-yd green';
    if(p.gd>=34){
      if(b==='B')t+=' -- club UP vs the middle number.';
      else if(b==='F')t+=' -- play the front number, never chase.';
      else t+=' -- middle number is the shot.';
    } else t+='.';
  }
  return t;
}

var state=null, holes=[], cur=0, selectedDist=null;

function vibe(ms){try{if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(ms||15);}catch(e){}}

function toggleTheme(){
  vibe(20);
  var isSun=document.body.classList.toggle('sunlight');
  try{localStorage.setItem('bayoaks-theme',isSun?'sunlight':'midnight');}catch(e){}
  var btn=document.getElementById('sunToggle');
  if(btn)btn.textContent=isSun?'🌙 Midnight':'☀️ Sunlight';
}
function loadTheme(){
  try{
    var th=localStorage.getItem('bayoaks-theme');
    if(th==='sunlight'){
      document.body.classList.add('sunlight');
      var btn=document.getElementById('sunToggle');
      if(btn)btn.textContent='🌙 Midnight';
    }
  }catch(e){}
}

function targetHolesRange(){
  var m=(state&&state.mode)||'full';
  if(m==='front')return {start:0,end:8,count:9,label:'Front 9'};
  if(m==='back')return {start:9,end:17,count:9,label:'Back 9'};
  return {start:0,end:17,count:18,label:'Full 18'};
}

function setMode(m){
  vibe(15);
  ensureDate();
  state.mode=m;
  if(m==='front'&&cur>8)cur=0;
  if(m==='back'&&cur<9)cur=9;
  touch();
  render();
}

function setHoleTee(t){
  vibe(15);
  ensureDate();
  holes[cur].tee=t;
  touch();
  render();
}

function setGlobalTee(t){
  vibe(20);
  ensureDate();
  state.tee=t;
  holes.forEach(function(h){h.tee=t;});
  touch();
  render();
}

function blank(){return {fir:null,score:null,gir:null,ss:null,chip:null,putts:null,lag:null,sixAtt:0,sixMade:0,pen:0,notes:'',tee:null};}
function mk(){var a=[]; for(var i=0;i<18;i++)a.push(blank()); return a;}
function today(){var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function load(){
  try{state=JSON.parse(localStorage.getItem(STORE));}catch(e){}
  if(!state||!state.holes||state.holes.length!==18){
    state={date:today(),holes:mk(),rounds:(state&&state.rounds)||null,history:(state&&state.history)||[],dirty:false,mode:'full',tee:'blue'};
  }
  if(state.dirty==null)state.dirty=false;
  if(state.exported==null)state.exported=false;
  if(!state.pin)state.pin='?';
  if(!state.mode)state.mode='full';
  if(!state.tee)state.tee='blue';
  migrateState(state);
  state.holes.forEach(function(h){
    if(h.pen==null)h.pen=0;
    if(h.notes==null)h.notes='';
  });
  holes=state.holes;
  ensureDate();
  loadTheme();
}
function save(){try{localStorage.setItem(STORE,JSON.stringify(state));}catch(e){}}
function pristine(){
  return holes.every(function(h){
    return h.score===null&&h.putts===null&&h.fir===null&&h.gir===null&&h.ss===null
      &&h.chip===null&&h.sixAtt===0&&h.sixMade===0&&(h.pen||0)===0&&!(h.notes&&h.notes.trim());
  });
}
function ensureDate(){if(state.date!==today()&&pristine()){state.date=today(); save();}}
// v16a: any new data invalidates a prior export -- dirty (unsaved edits) and exported
// (round data has left the app) are separate facts. Copying no longer means saved.
function touch(){state.dirty=true; state.exported=false; save();}
function newRound(){
  vibe(25);
  var played=holes.some(function(h){return h.score!==null;});
  if(played){
    var msg=!state.exported
      ? 'WARNING: this round has NOT been exported yet. Hit "Export Round" first, or archive it anyway?'
      : 'Archive this round ('+state.date+') and start a new one?';
    if(!confirm(msg))return;
    state.rounds.push({id:'log-'+state.date+'-'+Date.now().toString(36), date:state.date,
      mode:state.mode||'full', tee:state.tee||'blue', source:'logged', suspect:false,
      pin:(state.pin&&state.pin!=='?')?state.pin:null,
      holes:holes.map(function(h){return Object.assign({},h);}), summary:null});
  }
  var prevMode=state.mode||'full';
  var prevTee=state.tee||'blue';
  state.date=today(); state.holes=mk(); holes=state.holes; cur=(prevMode==='back'?9:0); state.dirty=false; state.exported=false; state.pin='?'; state.mode=prevMode; state.tee=prevTee;
  save(); render();
  showView('holeView');
}

// v18: reads the bag rather than hardcoding it. Behaviour is unchanged -- the slot ceilings
// moved into js/player.js verbatim -- but a yardage change is now a one-line data edit and
// the recommendation text can no longer disagree with the number it was derived from.
function recommendClub(dist, holeIdx){
  var d=parseInt(dist,10); if(isNaN(d))return null;
  var b=pinBucket(holeIdx);
  var eff=d;
  // Deep greens shift the effective number: a back pin on a 40-yd green is most of a club.
  if(PV[holeIdx].gd>=34){
    if(b==='B')eff+=7;
    else if(b==='F')eff-=7;
  }
  for(var i=0;i<BAG.length;i++){
    if(eff<=BAG[i].upTo)return {club:BAG[i].club, swing:BAG[i].swing, carry:BAG[i].carry, eff:eff};
  }
  var last=BAG[BAG.length-1];
  return {club:last.club, swing:last.swing, carry:last.carry, eff:eff};
}

function renderCaddySelector(){
  var box=document.getElementById('caddyChips');
  if(!box)return;
  box.innerHTML='';
  var distances=bagDistances();
  distances.forEach(function(yds){
    var chip=document.createElement('button');
    chip.className='clubChip'+(selectedDist===yds?' active':'');
    chip.textContent=yds+'y';
    chip.onclick=function(){
      vibe(15);
      selectedDist=(selectedDist===yds?null:yds);
      renderCaddySelector();
    };
    box.appendChild(chip);
  });
  var recEl=document.getElementById('caddyRecText');
  if(!recEl)return;
  if(selectedDist){
    var rec=recommendClub(selectedDist, cur);
    recEl.innerHTML='<b>'+selectedDist+'y Target:</b> '+rec.club+' &mdash; <i>'+rec.swing+'</i>';
  } else {
    recEl.textContent='Select distance to calculate pin-adjusted club & swing';
  }
}

function renderTeeSelector(){
  var box=document.getElementById('holeTeeBtns');
  if(!box)return;
  box.innerHTML='';
  var activeT=holeTee(cur);
  var tees=[
    {id:'blue', label:'Blue '+COURSE[cur].cy+'y'},
    {id:'tips', label:'Tips '+PV[cur].by+'y'},
    {id:'white', label:'White '+COURSE[cur].ry+'y'}
  ];
  tees.forEach(function(t){
    var btn=document.createElement('button');
    btn.textContent=t.label;
    if(activeT===t.id)btn.className='on';
    btn.onclick=function(){setHoleTee(t.id);};
    box.appendChild(btn);
  });
}

// v17: the alert now cites Kenny's own segment baseline instead of firing on an arbitrary
// count of two. A pull-left tendency that matches his normal rate isn't fatigue -- it's just
// his miss, and calling it fatigue trains him to distrust the alert.
function checkFatigue(){
  var banner=document.getElementById('fatigueAlert');
  if(!banner)return;
  var back9LeftPulls=0, back9Fir=0;
  for(var i=9; i<18; i++){
    if(holes[i]&&COURSE[i].par>3&&holes[i].fir){back9Fir++; if(holes[i].fir==='l')back9LeftPulls++;}
  }
  if(cur>=9&&back9LeftPulls>=2){
    var segs=segmentStats((state&&state.rounds)||[]);
    var late=segs[2], early={l:segs[0].l+segs[1].l, d:segs[0].firD+segs[1].firD};
    var msg='<b>\u26a0\ufe0f Back-9 Left-Miss Alert</b> '+back9LeftPulls+' of '+back9Fir+' tee shots pulled left today.';
    if(late&&late.firD>=8&&early.d>=8){
      var lateP=Math.round(late.leftRate*100), earlyP=Math.round(early.l/early.d*100);
      msg+=' Your history: '+lateP+'% left on H13-18 vs '+earlyP+'% on H1-12 (n='+(late.firD+early.d)+' tee shots).';
      msg+=lateP>earlyP+10 ? ' The late shift is real \u2014 stay connected, let the hips finish.'
                           : ' That matches your normal rate, so this is dispersion, not fatigue.';
    } else {
      msg+=' Not enough history yet to say whether that is fatigue or just your miss.';
    }
    banner.style.display='block';
    banner.innerHTML=msg;
  } else {
    banner.style.display='none';
  }
}

var recognizer=null, isRecording=false;
function toggleVoice(){
  vibe(25);
  var btn=document.getElementById('micBtn');
  var Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Speech){
    alert('Voice dictation not supported in this browser.');
    return;
  }
  if(isRecording&&recognizer){
    recognizer.stop();
    return;
  }
  try{
    recognizer=new Speech();
    recognizer.continuous=false;
    recognizer.interimResults=false;
    recognizer.lang='en-US';
    recognizer.onstart=function(){
      isRecording=true;
      if(btn){btn.className='micBtn listening'; btn.textContent='🔴 Listening...';}
    };
    recognizer.onresult=function(e){
      var transcript=e.results[0][0].transcript;
      var curVal=holes[cur].notes||'';
      var newVal=curVal?(curVal+' / '+transcript):transcript;
      setNote(newVal);
      var nb=document.getElementById('noteBox'); if(nb)nb.value=newVal;
    };
    recognizer.onerror=function(){
      isRecording=false;
      if(btn){btn.className='micBtn'; btn.textContent='🎙️ Dictate';}
    };
    recognizer.onend=function(){
      isRecording=false;
      if(btn){btn.className='micBtn'; btn.textContent='🎙️ Dictate';}
    };
    recognizer.start();
  }catch(e){
    isRecording=false;
    if(btn){btn.className='micBtn'; btn.textContent='🎙️ Dictate';}
  }
}

function seg(id,opts,field){
  var el=document.getElementById(id); if(!el)return; el.innerHTML='';
  opts.forEach(function(o){
    var b=document.createElement('button');
    b.textContent=o.label;
    if(holes[cur][field]===o.val)b.className='on';
    b.onclick=function(){
      vibe(15);
      ensureDate();
      holes[cur][field]=(holes[cur][field]===o.val)?null:o.val;
      touch(); render();
    };
    el.appendChild(b);
  });
}

function pinSeg(){
  var el=document.getElementById('pinBtns'); if(!el)return; el.innerHTML='';
  ['?','A','B','C','D','E'].forEach(function(o){
    var b=document.createElement('button');
    b.textContent=o;
    if((state.pin||'?')===o)b.className='on';
    b.onclick=function(){vibe(15); ensureDate(); state.pin=o; touch(); render();};
    el.appendChild(b);
  });
}

function bump(field,d){
  vibe(15);
  ensureDate();
  var h=holes[cur];
  if(field==='score'){h.score=(h.score===null)?COURSE[cur].par:Math.max(1,h.score+d);}
  else if(field==='sixAtt'){h.sixAtt=Math.max(0,h.sixAtt+d); if(h.sixMade>h.sixAtt)h.sixMade=h.sixAtt;}
  else if(field==='sixMade'){h.sixMade=Math.min(h.sixAtt,Math.max(0,h.sixMade+d));}
  touch(); render();
}

function setNote(v){ensureDate(); holes[cur].notes=v; touch(); buildSummary();}

function move(d){
  vibe(20);
  var r=targetHolesRange();
  if(r.count===9){
    cur=r.start+((cur-r.start+9+d)%9);
  } else {
    cur=(cur+18+d)%18;
  }
  render();
}

function render(){
  var h=holes[cur], c=COURSE[cur];
  var hn=document.getElementById('holeNum'); if(hn)hn.textContent=cur+1;
  var hm=document.getElementById('holeMeta'); if(hm)hm.textContent=pvMeta(cur);
  var tt=document.getElementById('tipText'); if(tt)tt.textContent=pvTip(cur);
  pinSeg();
  renderTeeSelector();

  var m=(state&&state.mode)||'full';
  ['Full','Front','Back'].forEach(function(k){
    var btn=document.getElementById('mode'+k);
    if(btn)btn.className='modeBtn'+(m===k.toLowerCase()?' on':'');
  });

  var r=targetHolesRange();
  var done=0;
  for(var i=r.start; i<=r.end; i++){if(holes[i].score!==null)done++;}
  var dl=document.getElementById('doneLbl');
  if(dl)dl.textContent=state.date+' · '+done+'/'+r.count+' holes ('+r.label+')';

  seg('scoreBtns',[{label:'-1',val:c.par-1},{label:'E',val:c.par},{label:'+1',val:c.par+1},{label:'+2',val:c.par+2}],'score');
  seg('penBtns',[{label:'0',val:0},{label:'1',val:1},{label:'2',val:2},{label:'3',val:3}],'pen');
  seg('puttBtns',[{label:'0',val:0},{label:'1',val:1},{label:'2',val:2},{label:'3',val:3},{label:'4',val:4},{label:'5',val:5}],'putts');
  // v19: first-putt distance bucket. The single datum that separates "bad approach left a
  // 50-footer" from "bad lag putting" -- without it a 3-putt is undiagnosable, and lag
  // putting is standing prescription #2. One tap, only shown when a putt was actually hit.
  seg('lagBtns',[{label:'0-6ft',val:'a'},{label:'7-15',val:'b'},{label:'16-30',val:'c'},{label:'30+',val:'d'}],'lag');
  var lr=document.getElementById('lagRow'); if(lr)lr.className='row'+((h.putts===null||h.putts>0)?'':' disabled');
  var lv=document.getElementById('lagVal'); if(lv)lv.textContent=h.lag?LAGLABEL[h.lag]:'\u2013';
  seg('firBtns',[{label:'Hit',val:'y'},{label:'Miss L',val:'l'},{label:'Miss R',val:'r'}],'fir');
  var fr=document.getElementById('firRow'); if(fr)fr.className='row'+(c.par>3?'':' disabled');
  seg('girBtns',[{label:'Yes',val:true},{label:'No',val:false}],'gir');
  seg('ssBtns',[{label:'Yes',val:true},{label:'No',val:false}],'ss');
  seg('chipBtns',[{label:'≤ 6 ft',val:'in'},{label:'> 6 ft',val:'out'},{label:'n/a',val:'na'}],'chip');
  var sd=h.score===null?null:h.score-c.par;
  var sv=document.getElementById('scoreVal'); if(sv)sv.textContent=h.score===null?'–':h.score+' ('+(sd===0?'E':(sd>0?'+':'')+sd)+')';
  var pv=document.getElementById('puttsVal'); if(pv)pv.textContent=h.putts===null?'–':h.putts;
  var sa=document.getElementById('sixAttVal'); if(sa)sa.textContent=h.sixAtt;
  var sm=document.getElementById('sixMadeVal'); if(sm)sm.textContent=h.sixMade;
  var nb=document.getElementById('noteBox');
  if(nb&&nb.value!==(h.notes||''))nb.value=h.notes||'';
  var missed=(h.gir===false);
  var sr=document.getElementById('ssRow'); if(sr)sr.className='row'+(missed?'':' disabled');
  var cr=document.getElementById('chipRow'); if(cr)cr.className='row'+(missed?'':' disabled');
  renderCaddySelector();
  checkFatigue();
  buildSummary();
  buildTrends();
}

function fmt(v,y,n){return v===null?'?':(v===true?y:(v===false?n:v));}

function unscoredHoles(){
  var r=targetHolesRange();
  var u=[];
  for(var i=r.start; i<=r.end; i++){
    if(holes[i].score===null)u.push(i+1);
  }
  return u;
}

function getTeeProfile(){
  var r=targetHolesRange();
  var tips=0, blue=0, white=0, yds=0;
  for(var i=r.start; i<=r.end; i++){
    var t=holeTee(i);
    if(t==='tips')tips++;
    else if(t==='white')white++;
    else blue++;
    yds+=holeYardage(i,t);
  }
  var label='Blue';
  if(tips===r.count)label='Tips';
  else if(white===r.count)label='White';
  else if(tips>0&&blue>0)label='Combo ('+tips+' Tips / '+blue+' Blue)';
  else if(tips>0)label='Combo ('+tips+' Tips)';
  return {tips:tips, blue:blue, white:white, yds:yds, label:label};
}

function buildSummary(){
  var m=(state&&state.mode)||'full';
  var r=targetHolesRange();
  var tp=getTeeProfile();
  var modeTag=(m==='front'?' [FRONT 9]':(m==='back'?' [BACK 9]':''));
  var teeTag=(tp.label==='Blue'?'':' TEES:'+tp.label.toUpperCase());
  var lines=['BAY OAKS '+state.date+modeTag+teeTag+(state.pin&&state.pin!=='?'?' PIN:'+state.pin:'')];
  var tS=0,tP=0,tPar=0,gir=0,girN=0,missed=0,chipIn=0,chipTried=0,ss=0,att=0,made=0;
  var firHit=0,firL=0,firR=0,firN=0,out9=0,in9=0,tPen=0;

  for(var i=(m==='back'?9:0); i<=(m==='front'?8:17); i++){
    var h=holes[i];
    var n=(i+1<10?'0':'')+(i+1);
    var pn=(h.pen==null?0:h.pen); tPen+=pn;
    lines.push('H'+n+' P'+COURSE[i].par+' S'+(h.score===null?'?':h.score)
      +' FIR:'+(COURSE[i].par>3?(h.fir==='y'?'Y':h.fir==='l'?'L':h.fir==='r'?'R':'?'):'-')
      +' GIR:'+fmt(h.gir,'Y','N')
      +' SS:'+(h.gir===false?fmt(h.ss,'Y','N'):'-')
      +' CHIP6:'+(h.gir===false?(h.chip==='in'?'Y':h.chip==='out'?'N':h.chip==='na'?'NA':'?'):'-')
      +' PUTTS:'+(h.putts===null?'?':h.putts)
      +(h.lag?' LAG:'+h.lag.toUpperCase():'')
      +' P36:'+h.sixMade+'/'+h.sixAtt
      +' PEN:'+pn);
    if(h.notes&&h.notes.trim())lines.push('H'+n+' NOTE: '+h.notes.trim().replace(/\s*\n+\s*/g,' / '));
    if(h.score!==null){
      tS+=h.score; tPar+=COURSE[i].par;
      if(i<9)out9+=h.score; else in9+=h.score;
    }
    if(h.putts!==null)tP+=h.putts;
    if(h.gir===true)gir++; if(h.gir!==null)girN++;
    if(h.gir===false){
      missed++; if(h.ss===true)ss++;
      if(h.chip==='in'){chipIn++;chipTried++;}
      if(h.chip==='out')chipTried++;
    }
    if(COURSE[i].par>3&&h.fir!==null){
      firN++;
      if(h.fir==='y')firHit++;
      if(h.fir==='l')firL++;
      if(h.fir==='r')firR++;
    }
    att+=h.sixAtt; made+=h.sixMade;
  }

  var diff=tS-tPar;
  var un=unscoredHoles();
  var scoredN=r.count-un.length;
  var totLbl;
  if(un.length){
    totLbl='TOT S:'+tS+'* (PARTIAL '+scoredN+'/'+r.count+', '+(diff>=0?'+':'')+diff+' thru scored) UNSCORED:H'+un.join(',H');
  } else {
    totLbl='TOT S:'+tS+' ('+(diff>=0?'+':'')+diff+')'+modeTag;
  }

  var splitScores=(m==='front'?' OUT:'+out9:(m==='back'?' IN:'+in9:' OUT:'+out9+' IN:'+in9));
  lines.push(totLbl+' FIR:'+firHit+'/'+firN+' (L:'+firL+' R:'+firR+') GIR:'+gir+'/'+girN
    +' PUTTS:'+tP+' CHIP6:'+chipIn+'/'+chipTried+' SS:'+ss+'/'+missed
    +' P36:'+made+'/'+att+' PEN:'+tPen+splitScores);
  var et=document.getElementById('exportText'); if(et)et.textContent=lines.join('\n');
  var pct=function(a,b){return b?Math.round(100*a/b)+'%':'–';};
  var st=document.getElementById('stats');
  if(st){
    st.innerHTML=
      (un.length?'<div class="stat"><span class="warn">Unscored '+(r.count===18?'holes':'('+r.label+')')+'</span> <b class="warn">'+un.join(', ')+'</b></div>':'')
      +'<div class="stat">Tees &amp; Total Yardage <b>'+tp.label+' ('+tp.yds.toLocaleString()+' yds)</b></div>'
      +(m==='full'?'<div class="stat">Out / In / Total <b>'+out9+' / '+in9+' / '+tS+(un.length?'*':'')+'</b></div>'
        :(m==='front'?'<div class="stat">Front 9 Score <b>'+tS+' (OUT: '+out9+')</b></div>'
          :'<div class="stat">Back 9 Score <b>'+tS+' (IN: '+in9+')</b></div>'))
      +'<div class="stat">Score vs Par <b>'+tS+' ('+(diff>=0?'+':'')+diff+')</b></div>'
      +'<div class="stat">Fairways <b>'+firHit+'/'+firN+' (L:'+firL+' R:'+firR+')</b></div>'
      +'<div class="stat">GIR <b>'+gir+'/'+girN+'</b></div>'
      +'<div class="stat">First chip inside 6 ft <b>'+chipIn+'/'+chipTried+' ('+pct(chipIn,chipTried)+')</b></div>'
      +'<div class="stat">Short-sided on missed greens <b>'+ss+'/'+missed+'</b></div>'
      +'<div class="stat">Total putts <b>'+tP+'</b></div>'
      +'<div class="stat">3–6 ft putts made <b>'+made+'/'+att+' ('+pct(made,att)+')</b></div>'
      +'<div class="stat">Penalty strokes <b>'+tPen+'</b></div>';
  }
}

// v16b: every number here is derived from state.rounds. Nothing is hardcoded, and a metric
// with no denominator renders as em-dash rather than a stale or invented figure -- an honest
// blank beats a confident wrong number, which is the whole reason this rewrite exists.
function buildTrends(){
  var rs=((state&&state.rounds)||[]).slice().sort(function(a,b){return a.date<b.date?1:-1;});
  var agg={fir:{n:0,d:0},gir:{n:0,d:0},chip6:{n:0,d:0},p36:{n:0,d:0}};
  var low18=null, low9=null;
  rs.forEach(function(r){
    var s=roundStats(r);
    ['fir','gir','chip6','p36'].forEach(function(k){agg[k].n+=(s[k]&&s[k].n)||0; agg[k].d+=(s[k]&&s[k].d)||0;});
    if(s.played>=18){if(low18===null||s.score<low18)low18=s.score;}
    else if(s.played===9){if(low9===null||s.score<low9)low9=s.score;}
  });
  function pctOf(o){return o.d?Math.round(o.n/o.d*100)+'%':'\u2014';}
  function setTxt(id,v){var e=document.getElementById(id); if(e)e.textContent=v;}
  setTxt('tSeasonLow', low18===null?'\u2014':low18);
  setTxt('tNineLow',   low9===null?'\u2014':low9);
  setTxt('tFirPct',    pctOf(agg.fir));
  setTxt('tGirPct',    pctOf(agg.gir));
  setTxt('tChipPct',   pctOf(agg.chip6));
  setTxt('tP36Pct',    pctOf(agg.p36));
  setTxt('tLeakChip',  pctOf(agg.chip6));
  buildHotspots(rs);
  buildSegments(rs);
  buildLag(rs);
  var hl=document.getElementById('historyList');
  if(!hl)return;
  if(!rs.length){hl.innerHTML='<i>No rounds logged yet.</i>'; return;}
  hl.innerHTML=rs.map(function(r){
    var s=roundStats(r), diff=s.score-s.par;
    function frac(o){return o&&o.d?o.n+'/'+o.d:'\u2014';}
    return '<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid #22304a;">'
      +'<b>'+r.date+'</b> ('+(r.label||s.type)+' &middot; '+(r.tee||'blue')+(r.pin?' &middot; Pin '+r.pin:'')+'): '
      +'<b>'+s.score+'</b> ('+(diff>=0?'+':'')+diff+') &middot; '
      +'FIR '+frac(s.fir)+' &middot; GIR '+frac(s.gir)+' &middot; Putts '+s.putts+' &middot; P36 '+frac(s.p36)
      +(r.suspect?' <span title="logged while quick presets fabricated data (v14-v16a)">\u26a0</span>':'')
      +'</div>';
  }).join('');
}

// v17: hotspots answer "which holes actually cost me strokes" -- the one question that
// changes pre-round strategy. Holes with n<2 are listed separately rather than ranked,
// because one bad round would otherwise crown a hole Kenny plays fine.
function buildHotspots(rounds){
  var el=document.getElementById('hotspotList'); if(!el)return;
  var hs=holeStats(rounds).filter(function(o){return o.n>0;});
  if(!hs.length){el.innerHTML='<i>No hole-level data yet.</i>'; return;}
  var ranked=hs.filter(function(o){return o.n>=2;}).sort(function(a,b){return b.avgOver-a.avgOver;});
  var thin=hs.filter(function(o){return o.n<2;});
  var rows=ranked.slice(0,6).map(function(o){
    var bits=[];
    if(o.threePutts)bits.push(o.threePutts+' three-putt'+(o.threePutts>1?'s':''));
    if(o.pen)bits.push(o.pen+' pen');
    if(o.gir.d)bits.push('GIR '+o.gir.n+'/'+o.gir.d);
    if(o.chip6.d)bits.push('CHIP6 '+o.chip6.n+'/'+o.chip6.d);
    return '<div style="margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid #22304a;">'
      +'<b>H'+o.hole+'</b> (par '+o.par+', hcp '+o.hcp+') <b style="color:var(--brass)">+'
      +o.avgOver.toFixed(2)+'</b>/rd &middot; avg '+o.avg.toFixed(1)+' <span style="color:var(--muted)">(n='+o.n+')</span>'
      +(bits.length?'<br><span style="color:var(--muted)">'+bits.join(' &middot; ')+'</span>':'')
      +'</div>';
  }).join('');
  if(thin.length)rows+='<div style="color:var(--muted); font-size:11.5px; margin-top:4px;">Too few rounds to rank: '
    +thin.map(function(o){return 'H'+o.hole;}).join(', ')+'</div>';
  el.innerHTML=rows;
}

function buildSegments(rounds){
  var el=document.getElementById('segmentList'); if(!el)return;
  var segs=segmentStats(rounds).filter(function(s){return s.n>0;});
  if(!segs.length){el.innerHTML='<i>No hole-level data yet.</i>'; return;}
  var rows=segs.map(function(s){
    var miss=s.firD?('L '+s.l+' / R '+s.r+' / hit '+s.y):'\u2014';
    return '<div style="margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid #22304a;">'
      +'<b>'+s.label+'</b> <b style="color:var(--brass)">+'+s.avgOver.toFixed(2)+'</b>/hole '
      +'<span style="color:var(--muted)">(n='+s.n+' holes)</span><br>'
      +'<span style="color:var(--muted)">Tee: '+miss+' &middot; '+s.threePutts+' three-putts &middot; '+s.pen+' pen</span>'
      +'</div>';
  }).join('');
  var nine=nineSplit(rounds);
  if(nine.front.n&&nine.back.n){
    var f=nine.front.over/nine.front.n, b=nine.back.over/nine.back.n, d=b-f;
    rows+='<div style="margin-top:6px; font-size:12px;">Front +'+f.toFixed(2)+'/hole vs back +'+b.toFixed(2)
      +'/hole \u2014 <b>'+(Math.abs(d)<0.1?'no meaningful split':(d>0?'back nine costs +'+d.toFixed(2)+'/hole':'front nine costs +'+(-d).toFixed(2)+'/hole'))+'</b>'
      +' <span style="color:var(--muted)">(n='+(nine.front.n+nine.back.n)+' holes)</span></div>';
  }
  el.innerHTML=rows;
}

// v19: this card is deliberately blunt about coverage. The five backfilled rounds have no
// lag data at all, so it opens by saying so rather than rendering four empty buckets that
// look like a finding. It becomes useful after a few logged rounds -- and then it either
// confirms prescription #2 or falsifies it, which is the point.
function buildLag(rounds){
  var el=document.getElementById('lagList'); if(!el)return;
  var L=lagStats(rounds);
  if(!L.withPutts){el.innerHTML='<i>No putting data yet.</i>'; return;}
  var recorded=L.withPutts-L.missing;
  if(!recorded){
    el.innerHTML='<i>First-putt distance not recorded on any hole yet.</i>'
      +'<div style="color:var(--muted); font-size:11.5px; margin-top:4px;">Tap it on each green and this will show whether 3-putts come from long first putts (approach problem) or short ones (stroke problem). '
      +L.withPutts+' holes with putts are waiting on it.</div>';
    return;
  }
  var rows=LAGORDER.map(function(k){
    var b=L.buckets[k];
    if(!b.n)return '<div style="color:var(--muted); margin-bottom:4px;">'+b.label+' &mdash; no data</div>';
    var rate=Math.round(b.threePutts/b.n*100);
    return '<div style="margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid #22304a;">'
      +'<b>'+b.label+'</b> &middot; <b style="color:var(--brass)">'+rate+'%</b> three-putt '
      +'<span style="color:var(--muted)">('+b.threePutts+'/'+b.n+' holes &middot; '+(b.putts/b.n).toFixed(2)+' putts avg)</span></div>';
  }).join('');
  if(L.missing)rows+='<div style="color:var(--muted); font-size:11.5px; margin-top:4px;">'
    +L.missing+' of '+L.withPutts+' holes missing a first-putt distance ('+Math.round(L.coverage*100)+'% coverage).</div>';
  el.innerHTML=rows;
}

function showView(viewId){
  ['holeView','summaryView','trendsView'].forEach(function(v){
    var el=document.getElementById(v); if(el)el.style.display=(v===viewId?'block':'none');
  });
  var tabBtn=document.getElementById('tabBtn');
  var trendsBtn=document.getElementById('trendsBtn');
  if(tabBtn)tabBtn.textContent=(viewId==='summaryView'?'Holes':'Summary');
  if(trendsBtn)trendsBtn.textContent=(viewId==='trendsView'?'Holes':'Trends');
}

function toggleView(){
  vibe(20);
  var curShow=document.getElementById('summaryView').style.display==='block';
  showView(curShow?'holeView':'summaryView');
}

function toggleTrends(){
  vibe(20);
  var curShow=document.getElementById('trendsView').style.display==='block';
  showView(curShow?'holeView':'trendsView');
}

function guardPartial(){
  var un=unscoredHoles();
  var r=targetHolesRange();
  if(!un.length)return true;
  if(confirm(r.label+' Holes '+un.join(', ')+' have no score. Export a PARTIAL round anyway?'))return true;
  cur=un[0]-1;
  showView('holeView');
  render();
  return false;
}

function copyExport(skipGuard){
  vibe(20);
  if(!skipGuard&&!guardPartial())return;
  var t=document.getElementById('exportText').textContent;
  var msg=document.getElementById('copiedMsg');
  function ok(){if(msg)msg.textContent='Copied log — ready for Gemini.'; state.exported=true; save(); setTimeout(function(){if(msg)msg.textContent='';},2500);}
  function fallback(){
    var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta);
    ta.select(); try{document.execCommand('copy'); ok();}catch(e){if(msg)msg.textContent='Long-press the text to copy.';}
    document.body.removeChild(ta);
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(ok,function(){fallback();});
  }else fallback();
  showView('summaryView');
}

function copyGeminiPrompt(){
  vibe(20);
  if(!guardPartial())return;
  var t=document.getElementById('exportText').textContent;
  var r=targetHolesRange();
  var tp=getTeeProfile();
  var modeLabel=(r.count===9?' ('+r.label+')':'');
  var teeLabel=' played from the '+tp.label+' tees ('+tp.yds.toLocaleString()+' yds)';
  var prompt='Analyze my Bay Oaks round'+modeLabel+teeLabel+' from '+state.date+':\n\n'+t+'\n\nPerform short-game leak accounting (CHIP6 proximity, wedge choices, 3-putts), evaluate course strategy vs the plan, and provide 1-2 focused prescriptions for my next session.';
  var msg=document.getElementById('copiedMsg');
  function ok(){if(msg)msg.textContent='Copied prompt — ready for Gemini!'; state.exported=true; save(); setTimeout(function(){if(msg)msg.textContent='';},2500);}
  function fallback(){
    var ta=document.createElement('textarea'); ta.value=prompt; document.body.appendChild(ta);
    ta.select(); try{document.execCommand('copy'); ok();}catch(e){if(msg)msg.textContent='Long-press the text to copy.';}
    document.body.removeChild(ta);
  }
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(prompt).then(ok,function(){fallback();});
  }else fallback();
  showView('summaryView');
}

function shareExport(){
  vibe(20);
  buildSummary();
  if(!guardPartial())return;
  var t=document.getElementById('exportText').textContent;
  var r=targetHolesRange();
  var tp=getTeeProfile();
  var modeLabel=(r.count===9?' ('+r.label+')':'');
  var teeLabel=' played from the '+tp.label+' tees ('+tp.yds.toLocaleString()+' yds)';
  var prompt='Analyze my Bay Oaks round'+modeLabel+teeLabel+' from '+state.date+':\n\n'+t+'\n\nPerform short-game leak accounting (CHIP6 proximity, wedge choices, 3-putts), evaluate course strategy vs the plan, and provide 1-2 focused prescriptions for my next session.';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(prompt).catch(function(){});
  }
  var fname='bay-oaks-round-'+state.date+'.txt';
  try{
    if(navigator.canShare&&window.File){
      var f=new File([t],fname,{type:'text/plain'});
      if(navigator.canShare({files:[f]})){navigator.share({files:[f],title:fname}).then(function(){state.exported=true; save();},function(){}); return;}
    }
  }catch(e){}
  if(navigator.share){navigator.share({title:fname,text:t}).then(function(){state.exported=true; save();},function(){}); return;}
  copyExport(true);
}

load(); render();
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  navigator.serviceWorker.register('sw.js').then(function(reg){
    reg.update();
  }).catch(function(){});
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    window.location.reload();
  });
}
