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
  } else if(tee==='white'){
    // v39: every tip except the Tips variant was written for Blue, and pvTip only ever
    // branched on 'tips'. White is 6,092 yds against Blue's 6,594 -- nine holes are 25-52
    // yds apart -- so a tip naming a club ("Smooth PW from ~117") is systematically one club
    // long from White. There are 18 tipsTip entries and no whiteTip entries, and inventing
    // eighteen sets of club numbers is not something this file should do on its own. Until
    // they are authored, say which tee the number came from instead of quietly being wrong.
    if(COURSE[i].whiteTip){
      t=COURSE[i].whiteTip;
    } else {
      var wy=+holeYardage(i,'white'), by=+holeYardage(i,'blue'), dy=by-wy;
      t='WHITE: '+wy+'y'+(dy>0?' ('+dy+'y shorter than Blue)':'')+'. '+t
        +(dy>0?'\nThe clubs above are BLUE numbers -- from White you are '+dy+'y closer, so club down.':'');
    }
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

// v28: the current hole is round state, not view state. Before this, `cur` reset to 0 on
// every reload while state.mode persisted -- a Back 9 round reopened showing "Hole 1" under
// a "Back 9" pill, and the very next tap wrote into holes[0]. Restored and re-validated
// against the mode, so a stale or out-of-range value can never point outside the round.
function clampCur(c){
  var rr=targetHolesRange();
  var n=parseInt(c,10);
  if(isNaN(n)||n<0||n>17)return rr.start;
  // An export can include a recorded hole outside the selected nine. Its missing
  // score must remain reachable when the player declines a partial export.
  if((n<rr.start||n>rr.end)&&!holeHasData(holes[n]))return rr.start;
  return n;
}

// v29: the cursor lives in its own key. v28 stored it inside the round and called save()
// on every Next/Prev, which meant an idle second tab could write its whole stale round
// over a newer one by navigating -- losing scores that were never touched. Navigation must
// never write the round. Keyed to the date so yesterday's cursor cannot land on today.
var CURKEY='bayoaks-cursor-v1';
function saveCursor(){try{localStorage.setItem(CURKEY,JSON.stringify({date:state&&state.date,cur:cur}));}catch(e){}}
function loadCursor(){
  try{var c=JSON.parse(localStorage.getItem(CURKEY));
    if(c&&c.date===state.date&&c.cur!=null)return c.cur;}catch(e){}
  return (state&&state.cur!=null)?state.cur:null;   // one-version migration from v28
}
function setCur(n){cur=clampCur(n); saveCursor(); return cur;}

function vibe(ms){try{if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(ms||15);}catch(e){}}

// v21: bone is the default and dusk is the option -- the inverse of v20.
function applyTheme(isDusk){
  document.body.classList.toggle('dusk',isDusk);
  var btn=document.getElementById('themeToggle');
  if(btn)btn.textContent=isDusk?'☀️ Bone':'🌙 Dusk';
}
function toggleTheme(){
  vibe(20);
  var isDusk=!document.body.classList.contains('dusk');
  applyTheme(isDusk);
  try{localStorage.setItem('bayoaks-theme',isDusk?'dusk':'bone');}catch(e){}
}
function loadTheme(){
  try{
    // A returning phone still holds a pre-v21 value. 'midnight' was the old dark
    // default, so it becomes dusk; 'sunlight' was the light exception, which is
    // now simply the default. Anything else (including null) falls to bone.
    var th=localStorage.getItem('bayoaks-theme');
    if(th==='midnight')th='dusk';
    if(th!=='dusk')th='bone';
    localStorage.setItem('bayoaks-theme',th);
    applyTheme(th==='dusk');
  }catch(e){applyTheme(false);}
}

function targetHolesRange(){
  var m=(state&&state.mode)||'full';
  if(m==='front')return {start:0,end:8,count:9,label:'Front 9'};
  if(m==='back')return {start:9,end:17,count:9,label:'Back 9'};
  return {start:0,end:17,count:18,label:'Full 18'};
}

// v36 (F3): ONE included-hole selection, shared by the export, the archive and the guards.
// The mode buttons choose which holes the entry screen walks through -- that is navigation.
// They were also, silently, deciding what the round IS: buildSummary() masked the export to
// the mode range while newRound() archived all eighteen holes and stamped the selected mode
// on them. Front 9 selected with scores on the back produced a nine-hole export and an
// eighteen-hole archive labelled 'front' and carrying Hole 10, so the summary, the copied
// text and the history disagreed about the same round.
//
// The rule: a hole is included if the mode selects it OR it has data in it. A hole Kenny
// actually played is never dropped to make the label tidy, and the label is derived from
// what is included rather than asserted over the top of it. Excluded holes are, by
// construction, both out of scope and empty -- so nothing is deleted.
function includedHoles(){
  var r=targetHolesRange(), inc=[];
  for(var i=0;i<18;i++){
    if((i>=r.start&&i<=r.end)||holeHasData(holes[i]))inc.push(i);
  }
  return inc;
}
// Holes carrying data that the current mode does not select. Their presence is stated in
// the export rather than resolved by deleting them.
function strayHoles(){
  var r=targetHolesRange(), out=[];
  for(var i=0;i<18;i++){ if((i<r.start||i>r.end)&&holeHasData(holes[i]))out.push(i+1); }
  return out;
}
function includedMode(inc){
  if(!inc||!inc.length)return (state&&state.mode)||'full';
  if(inc[inc.length-1]<9)return 'front';
  if(inc[0]>=9)return 'back';
  return 'full';
}
function includedLabel(inc){
  var m=includedMode(inc);
  if(m==='front'&&inc.length===9)return 'Front 9';
  if(m==='back'&&inc.length===9)return 'Back 9';
  return inc.length===18?'Full 18':inc.length+' Holes';
}

function setMode(m){
  vibe(15);
  ensureDate();
  state.mode=m;
  var range=targetHolesRange();
  if(cur<range.start||cur>range.end)cur=range.start;
  cur=clampCur(cur); saveCursor();
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
  if(typeof state.rev!=='number')state.rev=0;   // pre-v29 rounds join the scheme at 0
  ensureRoundId();
  cur=clampCur(loadCursor());                    // reads the cursor key, then v28's state.cur
  delete state.cur;                              // v28 field; the cursor has its own key now
  saveCursor();
  saveConflict=''; saveFailed=false; saveUnreadable=false; saveReadOnly=false;
  mergeBlocked=null; stashFailed=false; crossRound=false; metaClash=null; restoreRefused=false;
  recovered=loadRecovery();
  ensureDate();
  loadTheme();
  // load() is what resets these flags, so it is what owes the banner an update. Relying on
  // the boot line meant a stale warning could outlive the state that produced it.
  showSaveState();
}
// v29: two tabs on the same round used to be a last-writer-wins race, silently. The round
// now carries a revision; a tab whose copy is behind what is already in storage refuses to
// write and says so, instead of winning by being last. And a failed write is no longer
// swallowed -- a full-storage phone mid-round used to keep accepting taps that went nowhere.
var TAB_ID=Math.random().toString(36).slice(2,10);
var RECOVERY='bayoaks-recovery-v2', RECOVERY_V1='bayoaks-recovery-v1';
// '' | 'refused' (nothing was written) | 'overwritten' (our write was replaced)
var saveConflict='', saveFailed=false, saveUnreadable=false, saveReadOnly=false, recovered=null;
// v33: a delayed copy resolving in the background set exported=true and called save(). When
// that save was refused the flag stayed set in memory, disarming newRound()'s warning for a
// round that never reached storage. Refusing a write has to undo what the write was for.
function markExported(){
  var was=state.exported;
  state.exported=true;
  if(!save()){ state.exported=was; return false; }
  return true;
}

// v34: an export marks EXACTLY the round and revision whose text was copied. Undoing the flag
// after a refused save was not enough -- a copy that succeeded could still bless a round that
// had moved on since, or a different round entirely. The token is taken when the text is
// built and checked when the copy lands.
function exportToken(){ return {roundId:state.roundId, seq:dataSeq}; }
function completeExport(token){
  if(!token||token.roundId!==state.roundId||token.seq!==dataSeq){
    var m=document.getElementById('copiedMsg');
    if(m)m.textContent='Copied \u2014 but the round changed since. Copy again to mark it exported.';
    return false;
  }
  return markExported();
}
var stashFailed=false, mergeBlocked=null, crossRound=false, metaClash=null, dataSeq=0, restoreRefused=false;

// v33: a round needs an identity that outlives neither more nor less than the round itself.
// Dates are not it -- a new round can start on the same day, and a tab holding yesterday's
// round shares a date with nothing useful. Without this, "add my holes to the newer round"
// happily poured yesterday's scores into today's empty holes: scores never shot, on a round
// whose real copy was already archived, so they would have been counted twice.
function mintRoundId(date){ return 'r-'+date+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
// Legacy rounds carry no id. Derive one deterministically from the date so two tabs holding
// the same pre-v33 round agree, rather than each minting a different id and refusing forever.
function ensureRoundId(){ if(!state.roundId)state.roundId='r-'+state.date+'-legacy'; return state.roundId; }

// v31: real exclusion where the browser offers it. One tab holds the writer lock for its
// lifetime; the others are read-only and say so, which is a truthful description of what
// was already happening silently. Chrome on Android has Web Locks; where it is missing this
// is inert and the synchronous guards below carry the weight.
var writerRole='writer', lockRelease=null, lockGen=0;
// Asked at call time, not once at parse: the answer is a property of the environment when
// we need it, and freezing it at load made the oracle's own environment untestable.
function lockSupported(){
  return typeof navigator!=='undefined'&&!!navigator.locks&&typeof navigator.locks.request==='function';
}

// v32: the lock follows the VISIBLE tab, not the tab that happened to open first. v31 held it
// for the tab's lifetime, so a backgrounded tab kept the lock and the tab actually in front
// went read-only and could not record a score at all -- a worse on-course failure than the
// race the lock exists to stop. Hidden releases, visible re-acquires.
function electWriter(){
  if(!lockSupported()){ writerRole='writer'; return; }
  if(lockRelease)return;                       // already holding
  var gen=++lockGen;
  try{
    navigator.locks.request('bayoaks-round-writer',{mode:'exclusive',ifAvailable:true},function(lock){
      // A request answered after this tab hid again must not install itself as writer.
      // Returning undefined hands the lock straight back for whoever is actually in front.
      if(gen!==lockGen)return undefined;
      if(!lock){ writerRole='reader'; showSaveState(); return undefined; }
      writerRole='writer'; saveReadOnly=false; showSaveState();
      return new Promise(function(resolve){ lockRelease=function(){ lockRelease=null; resolve(); }; });
    });
  }catch(e){ writerRole='writer'; }
}
function releaseWriter(){
  lockGen++;                                   // invalidate any request still in flight
  if(lockRelease)lockRelease();
  writerRole='reader';
}
function reelectWriter(){ if(writerRole!=='writer')electWriter(); }

// The losing draft has to outlive a reload, or "reload" is advice to destroy it.
// v34: a single slot could only ever hold one draft. Two tabs each stashing overwrote each
// other, and restoring one draft left the round it displaced with nowhere to go. Drafts are
// now a keyed collection -- one slot per round per tab -- so nothing a refusal saved can be
// destroyed by the next refusal.
function draftKey(slot){ return (state.roundId||'unknown')+'|'+TAB_ID+(slot?'|'+slot:''); }
var DRAFT_PREFIX='bayoaks-draft-v3:', DRAFT_REMOVED='bayoaks-draft-removed-v3:', draftSeq=0;
// Independent immutable entries: stashing never reads or replaces another tab's backup.
// Legacy collections stay untouched; per-entry receipts hide only the exact retired copy.
function readDrafts(){
  var box={};
  function legacy(key,draft){
    if(localStorage.getItem(DRAFT_REMOVED+key)!==JSON.stringify(draft))box[key]=draft;
  }
  try{
    var raw=localStorage.getItem(RECOVERY);
    if(raw){var parsed=JSON.parse(raw); if(!parsed||!parsed.drafts)throw Error('Invalid recovery');
      Object.keys(parsed.drafts).forEach(function(k){legacy('v2|'+k,parsed.drafts[k]);});}
    var old=localStorage.getItem(RECOVERY_V1);
    if(old){var o=JSON.parse(old); if(!o||!o.holes)throw Error('Invalid recovery'); legacy('v1',o);}
    for(var i=0;i<localStorage.length;i++){
      var k=localStorage.key(i);
      if(k&&k.indexOf(DRAFT_PREFIX)===0){
        var value=localStorage.getItem(k);
        if(value!==null)box[k.slice(DRAFT_PREFIX.length)]=JSON.parse(value);
      }
    }
    return box;
  }catch(e){return null;} // unknown is never permission to replace or delete backups
}
function writeDrafts(box){
  try{
    for(var k in box){
      var key=DRAFT_PREFIX+k, value=JSON.stringify(box[k]), old=localStorage.getItem(key);
      if(old!==null&&old!==value)return false;
      localStorage.setItem(key,value);
    }
    return true;
  }catch(e){return false;}
}
function retireDraft(key,draft){
  try{
    if(key==='v1'||key.indexOf('v2|')===0)localStorage.setItem(DRAFT_REMOVED+key,JSON.stringify(draft));
    else if(localStorage.getItem(DRAFT_PREFIX+key)===JSON.stringify(draft))localStorage.removeItem(DRAFT_PREFIX+key);
  }catch(e){} // leaving an extra copy is safer than deleting an unknown one
}
// v38: v37 wrote one immutable entry per stash and never removed one. Nine holes of
// ordinary entry with saves refused left 36 entries; a later successful save retired
// exactly one, and five such rounds accumulated 180 entries / 468 KB with nothing to prune
// them. A backup store that grows without bound eventually becomes the storage failure it
// exists to survive. Retention is therefore SUPERSESSION, not age: an older snapshot is
// retired only when a newer one demonstrably contains everything it held.
var DRAFT_GROUP_CAP=12;
// A field counts as recorded when it holds something a player put there. sixAtt/sixMade/pen
// default to 0 and notes to '' -- those are absence, not data.
function fieldRecorded(v,k){
  if(v===null||v===undefined)return false;
  if(k==='notes')return !!String(v).trim();
  if(k==='sixAtt'||k==='sixMade'||k==='pen')return v>0;
  return true;
}
var DRAFT_FIELDS=['score','putts','fir','gir','ss','chip','lag','sixAtt','sixMade','pen','notes','tee'];
// Does `newer` hold everything `older` held? Same round identity, and every recorded field
// in the old snapshot present and equal in the new one. A correction that CLEARS a field
// (GIR No -> Yes drops the chip) fails this test, so that snapshot is kept.
function supersedes(newer,older){
  if(!newer||!older||!newer.holes||!older.holes)return false;
  if(draftMetadata(newer)!==draftMetadata(older))return false;
  for(var i=0;i<older.holes.length;i++){
    var o=older.holes[i], nn=newer.holes[i];
    if(!o)continue;
    if(!nn)return false;
    for(var f=0;f<DRAFT_FIELDS.length;f++){
      var k=DRAFT_FIELDS[f];
      if(fieldRecorded(o[k],k)&&o[k]!==nn[k])return false;
    }
  }
  return true;
}
// roundId|tab[|slot] -- the trailing three segments are the stamp, sequence and salt that
// make each entry unique. Grouping by the prefix keeps the 'displaced' slot separate, which
// is the draft v35 lost when cleanup deleted by ownership.
function draftGroup(key){
  var parts=String(key).split('|');
  return parts.length>3?parts.slice(0,parts.length-3).join('|'):String(key);
}
function draftStamp(key){
  var parts=String(key).split('|');
  if(parts.length<3)return [0,0];
  return [parseInt(parts[parts.length-3],36)||0, parseInt(parts[parts.length-2],10)||0];
}
function stashRecovery(slot){
  var key=draftKey(slot)+'|'+Date.now().toString(36)+'|'+(++draftSeq)+'|'+Math.random().toString(36).slice(2);
  var box={}, entry={date:state.date,mode:state.mode,pin:state.pin,tee:state.tee,
    roundId:state.roundId,holes:state.holes,stashedAt:new Date().toISOString(),tab:TAB_ID};
  box[key]=entry;
  stashFailed=!writeDrafts(box);
  if(!stashFailed)pruneSupersededDrafts(key,entry);
  return !stashFailed;
}
// Retire the entries this one made redundant. Only within its own group, only entries it
// supersedes -- so nothing another tab, another round or another slot holds is ever at risk.
// The cap is a backstop for a round of corrections that never supersede: losing the oldest
// snapshot of one round beats filling the origin and losing the ability to save at all.
function pruneSupersededDrafts(newKey,newEntry){
  var box=readDrafts();
  if(!box)return;                       // unknown is never permission to delete
  var group=draftGroup(newKey), mine=[];
  for(var k in box){
    if(k===newKey||!box[k]||!box[k].holes)continue;
    if(k==='v1'||k.indexOf('v2|')===0)continue;          // legacy keeps its own receipts
    if(draftGroup(k)!==group)continue;
    if(supersedes(newEntry,box[k])){ retireDraft(k,box[k]); continue; }
    mine.push(k);
  }
  if(mine.length>=DRAFT_GROUP_CAP){
    mine.sort(function(a,b){var x=draftStamp(a),y=draftStamp(b); return x[0]-y[0]||x[1]-y[1];});
    var over=mine.length-(DRAFT_GROUP_CAP-1);
    for(var i=0;i<over;i++)retireDraft(mine[i],box[mine[i]]);
  }
}
// v35: cleanup used to delete every draft this tab held for the round, which threw away a
// displaced draft that had never been persisted. A draft is safe to drop only when the bytes
// just written ARE that draft -- identity by content, not by ownership.
function draftMetadata(d){
  return JSON.stringify([d.roundId||null,d.date||null,d.mode||'full',d.tee||'blue',d.pin||'?']);
}
function draftContent(d){return JSON.stringify([draftMetadata(d),d.holes]);}
// v38: exact-content match retired one entry out of the pile a refused stretch left behind.
// What was actually written supersedes every snapshot it contains, so retire those too --
// still lossless: a snapshot holding something the saved round does not keep stays.
function clearPersistedDrafts(persistedContent,persistedState){
  var box=readDrafts(); if(!box)return;
  for(var k in box){
    if(!box[k]||!box[k].holes)continue;
    if(draftContent(box[k])===persistedContent){ retireDraft(k,box[k]); continue; }
    if(persistedState&&k!=='v1'&&k.indexOf('v2|')!==0&&supersedes(persistedState,box[k])){
      retireDraft(k,box[k]);
    }
  }
}
function loadRecovery(){
  var box=readDrafts(), mine=draftContent(state), out=[], seen={};
  if(!box)return null;
  for(var k in box){
    if(!box[k]||!box[k].holes)continue;
    var content=draftContent(box[k]);
    if(content===mine||seen[content])continue;
    seen[content]=true;   // exact round and metadata, not just matching scores
    out.push(Object.assign({key:k},box[k]));
  }
  // v38: stashedAt is millisecond-resolution, so a burst of stashes ties and the order fell
  // back to whatever the store enumerated -- and "Show the kept round" restores out[0]. The
  // monotonic sequence already in the key breaks the tie.
  out.sort(function(a,b){
    var t=String(b.stashedAt||'').localeCompare(String(a.stashedAt||''));
    if(t)return t;
    var x=draftStamp(a.key), y=draftStamp(b.key);
    return (y[0]-x[0])||(y[1]-x[1]);
  });
  return out.length?out:null;
}
function recoverDraft(key){
  if(!recovered||!recovered.length)return false;
  var draft=null;
  for(var i=0;i<recovered.length;i++){ if(!key||recovered[i].key===key){draft=recovered[i]; break;} }
  if(!draft)return false;
  // A swap, not an overwrite -- and if the round on screen cannot be kept, the swap does not
  // happen at all. v33 stashed, ignored the failure, and overwrote anyway, which destroyed
  // the current round to display an older one.
  if(roundHasData()&&!stashRecovery('displaced')){ restoreRefused=true; showSaveState(); return false; }
  state.roundId=draft.roundId||state.roundId;
  state.holes=draft.holes; holes=state.holes;
  state.date=draft.date||state.date; state.mode=draft.mode||state.mode;
  state.pin=draft.pin||state.pin; state.tee=draft.tee||state.tee;
  // The restored draft stays in the collection until it is actually saved, so a reload right
  // now still finds both it and whatever it displaced.
  recovered=loadRecovery();
  cur=clampCur(cur);
  render();
  showView('summaryView');
  return true;
}
// v32: a tab that fell behind could never persist what it held -- safe, but it meant the
// round in your hand was unsaveable. Adopt the newer round, then re-apply only the holes this
// tab holds that the newer round has nothing for. Anything genuinely contested is named and
// left alone; this never silently picks a winner, and it is only ever user-initiated.
function heldEntryDiff(){
  var read=readStored();
  if(read.status!=='ok'||!read.value||!read.value.holes)return {ok:false,reason:'unreadable'};
  var disk=read.value;
  // Same round, or no merge. Anything else is two different rounds that happen to share a
  // storage key, and pouring one into the other invents scores.
  if(!disk.roundId||!state.roundId||disk.roundId!==state.roundId)return {ok:false,reason:'cross-round'};
  // Round-level facts are not per-hole and cannot be merged position by position. If the two
  // copies disagree about the mode or the pin, one of them is describing a different round of
  // golf; adopting either silently would relabel real holes.
  var meta=[];
  if(state.mode&&disk.mode&&state.mode!==disk.mode)meta.push('round mode ('+state.mode+' here, '+disk.mode+' there)');
  var mp=state.pin&&state.pin!=='?'?state.pin:null, dp=disk.pin&&disk.pin!=='?'?disk.pin:null;
  if(mp&&dp&&mp!==dp)meta.push('pin ('+mp+' here, '+dp+' there)');
  if(meta.length)return {ok:false,reason:'meta',meta:meta};
  var mine=state.holes, conflicts=[], applied=[];
  for(var i=0;i<18;i++){
    var m=mine[i], d=disk.holes[i];
    if(!holeHasData(m))continue;
    if(JSON.stringify(m)===JSON.stringify(d))continue;
    if(holeHasData(d))conflicts.push(i+1); else applied.push(i+1);
  }
  return {ok:true, disk:disk, conflicts:conflicts, applied:applied};
}
function mergeHeldEntries(){
  var d=heldEntryDiff();
  if(!d.ok&&d.reason==='cross-round'){ crossRound=true; stashRecovery(); showSaveState(); return false; }
  if(!d.ok&&d.reason==='meta'){ metaClash=d.meta.slice(); stashRecovery(); showSaveState(); return false; }
  if(!d.ok){ saveUnreadable=true; stashRecovery(); showSaveState(); return false; }
  if(d.conflicts.length){
    mergeBlocked=d.conflicts.slice();
    stashRecovery();               // a blocked merge must still leave a way back
    showSaveState();
    return false;
  }
  var mine=state.holes.map(function(h){return Object.assign({},h);});
  // The draft this tab was holding is about to be incorporated. Once the merge is written it
  // has been saved -- just not byte-identically -- so it must stop being offered as lost.
  var mergedFrom=draftContent(state), mergedMetadata=draftMetadata(state);
  var disk=d.disk;
  state.rev=disk.rev; state.writer=disk.writer; state.date=disk.date||state.date;
  state.mode=disk.mode||state.mode; state.tee=disk.tee||state.tee; state.pin=disk.pin||state.pin;
  state.rounds=disk.rounds||state.rounds;
  state.holes=disk.holes; holes=state.holes;
  d.applied.forEach(function(n){ holes[n-1]=mine[n-1]; });
  saveConflict=''; mergeBlocked=null; crossRound=false; metaClash=null;
  var ok=save();
  if(ok){
    if(draftMetadata(state)===mergedMetadata)clearPersistedDrafts(mergedFrom);
    recovered=loadRecovery(); showSaveState();
  }
  cur=clampCur(cur);
  render();
  return ok;
}
// v38: this retired only entries whose bytes matched the offered one exactly. After a
// refused stretch that was one snapshot out of dozens, "Discard it" removed the newest copy
// and left the banner claiming the rest -- clearing it meant tapping Discard once per tap of
// the round. Discarding the offered draft now also discards every snapshot it SUPERSEDES,
// which is the pile that led up to it. Matching the round identity instead would be one step
// too wide: two tabs can hold genuinely different states of the same round, and neither
// contains the other, so discarding one must leave the other alone.
function dismissRecovery(){
  if(recovered&&recovered.length){
    var target=recovered[0], content=draftContent(target), box=readDrafts();
    if(box)for(var k in box){
      if(!box[k])continue;
      if(draftContent(box[k])===content||supersedes(target,box[k]))retireDraft(k,box[k]);
    }
  }
  recovered=loadRecovery();
  showSaveState();
}

// v30: three outcomes, not two. v29 caught read and parse errors and returned null -- the
// same value as a genuinely empty store -- so an unreadable revision looked like permission
// to initialise a fresh one, and a stale tab overwrote a newer round reporting success.
// Absent is the ONLY state that permits a blind first write.
function readStored(){
  var raw;
  try{ raw=localStorage.getItem(STORE); }
  catch(e){ return {status:'unreadable', raw:null, value:null}; }
  if(raw===null||raw===undefined||raw==='') return {status:'absent', raw:null, value:null};
  try{ return {status:'ok', raw:raw, value:JSON.parse(raw)}; }
  catch(e){ return {status:'unreadable', raw:raw, value:null}; }   // keep the bytes; never clobber them
}

// v30: v29 asked only "is disk ahead of me". Two tabs that both read rev 1 then both wrote
// rev 2 were invisible to that test -- equal revisions, different writers, one score gone,
// neither tab told. The writer id was already being stored and never used. It is used now.
function isForeign(stored){
  if(!stored||typeof stored.rev!=='number'||typeof state.rev!=='number')return false;
  if(stored.rev>state.rev)return true;                                 // someone is ahead
  // Compared against the writer recorded in OUR copy, not against TAB_ID. After a reload
  // this tab holds someone else's writer id legitimately -- that is being in sync, not a
  // collision. It is a collision only when the revision we hold was overwritten by someone
  // whose id differs from the one we loaded or last wrote.
  if(stored.rev===state.rev&&stored.writer!==state.writer)return true;
  return false;
}

function save(){
  if(!state)return false;
  if(writerRole==='reader'){ saveReadOnly=true; stashRecovery(); showSaveState(); return false; }
  var read=readStored();
  if(read.status==='unreadable'){ saveUnreadable=true; stashRecovery(); showSaveState(); return false; }
  if(isForeign(read.value)){
    saveConflict='refused';
    // Work out up front whether a merge is even possible, so the banner never offers a
    // button that cannot do anything.
    crossRound=!!(read.value&&state.roundId&&read.value.roundId&&read.value.roundId!==state.roundId);
    stashRecovery(); showSaveState(); return false;
  }
  if(typeof state.rev!=='number')state.rev=0;
  // Any round that reaches storage carries an identity. Minting only at load() left rounds
  // created by other paths anonymous, and two anonymous rounds look identical to a merge.
  ensureRoundId();
  var prevRev=state.rev, prevWriter=state.writer;
  state.rev++; state.writer=TAB_ID;
  var payload=JSON.stringify(state);
  var abort=function(){ state.rev=prevRev; state.writer=prevWriter; };

  // v31: re-read IMMEDIATELY before the write. v30 checked the revision, then did all the
  // work of serialising state, then wrote -- and anything another tab did in that gap was
  // invisible. Comparing the raw bytes means any change at all under us aborts, instead of
  // being overwritten and reported as success. The window this cannot close is the one
  // between this read and the setItem below; localStorage has no compare-and-set and the
  // HTML spec is explicit that there is no storage mutex. Web Locks closes it above where
  // the browser provides it. This narrows it to as small as the language allows.
  var again=readStored();
  if(again.status==='unreadable'){ abort(); saveUnreadable=true; stashRecovery(); showSaveState(); return false; }
  if(again.raw!==read.raw){ abort(); saveConflict='refused'; stashRecovery(); showSaveState(); return false; }

  try{
    localStorage.setItem(STORE,payload);
  }catch(e){
    abort();                                       // never claim a revision we did not write
    saveFailed=true; stashRecovery(); showSaveState(); return false;
  }
  // Residual case: someone wrote between our check and our setItem. Our data is gone from
  // disk and this screen holds the only copy, which is a different situation from a refusal
  // and gets different advice.
  var after=readStored();
  if(after.status==='ok'&&after.value&&after.value.writer&&after.value.writer!==TAB_ID){
    saveConflict='overwritten'; stashRecovery(); showSaveState(); return false;
  }
  saveFailed=false; saveConflict=''; saveUnreadable=false; saveReadOnly=false; mergeBlocked=null; stashFailed=false; crossRound=false; metaClash=null; restoreRefused=false;
  clearPersistedDrafts(draftContent(state),state);
  recovered=loadRecovery();
  showSaveState(); return true;
}

// Fires when another tab writes the round. Separate from save() so the oracle can drive it.
function onExternalWrite(key){
  if(key&&key!==STORE)return;
  var read=readStored();
  if(read.status==='unreadable'){ saveUnreadable=true; showSaveState(); return; }
  if(!isForeign(read.value))return;
  // If the stored revision is the one we wrote and the writer is not us, our write was
  // replaced -- this screen is the only copy left. Otherwise we are simply behind.
  var mine=(read.value&&read.value.rev===state.rev&&state.writer===TAB_ID);
  saveConflict=mine?'overwritten':'refused';
  stashRecovery();
  showSaveState();
}
function showSaveState(){
  var b=document.getElementById('saveAlert'); if(!b)return;
  var recoverBtn=' <button type="button" onclick="recoverDraft()">Show the kept round</button>'
    +' <button type="button" onclick="dismissRecovery()">Discard it</button>';
  var mergeBtn=' <button type="button" onclick="mergeHeldEntries()">Add my holes to the newer round</button>';
  // Only ever appended, never substituted for the instruction to copy first.
  var noCopyKept=stashFailed
    ? ' This browser could not keep a backup copy either, so Copy Log is the only thing standing between these entries and losing them.'
    : '';
  if(saveConflict==='overwritten'){
    // The one case where data really is gone from storage. Never tell them to reload here.
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f Your last save was replaced by another tab</b>'
      +'What is on this screen is now the only copy of these entries. '
      +'Hit Export Round and Copy Log before you reload or close this tab \u2014 reloading now would lose them.'
      +noCopyKept+mergeBtn;
  } else if(saveReadOnly){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f Read-only \u2014 this round is open in another tab</b>'
      +'The other tab is the one saving. Nothing here has been written and nothing there was '
      +'changed. Copy Log if you entered anything here, then close this tab and use the other one.'
      +noCopyKept;
  } else if(saveUnreadable){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f Not saved \u2014 saved round unreadable</b>'
      +'This browser could not read the stored round, so nothing was written over it. '
      +'Your entries are still on screen \u2014 Copy Log now, then reload.'+noCopyKept;
  } else if(metaClash){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f The two copies disagree about the round itself</b>'
      +'They differ on '+metaClash.join(' and ')+'. That is not something holes can be merged '
      +'across, so nothing was added and nothing was changed. Copy Log to keep this tab\u2019s '
      +'version, then reload.'+noCopyKept;
  } else if(crossRound){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f That is a different round</b>'
      +'This tab is holding a round that has since been finished and replaced \u2014 its holes '
      +'are not part of the round now in storage, so nothing was added and nothing was changed. '
      +'Copy Log to keep this one, then reload.'+noCopyKept;
  } else if(mergeBlocked){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f Hole '+mergeBlocked.join(', ')+' recorded differently in both</b>'
      +'The newer round already has a different entry on '
      +(mergeBlocked.length>1?'those holes':'that hole')+', so nothing was merged and nothing was '
      +'overwritten. Copy Log to keep this tab\u2019s version, then reload and re-enter '
      +(mergeBlocked.length>1?'them':'it')+' by hand.'+noCopyKept;
  } else if(saveConflict==='refused'){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f Not saved \u2014 the round changed in another tab</b>'
      +'Nothing here was written and nothing there was overwritten, but what you have entered '
      +'in this tab is not stored. You can add these holes to the newer round, or Copy Log and reload.'
      +noCopyKept+mergeBtn;
  } else if(restoreRefused){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f Nothing was swapped \u2014 the round on screen could not be kept</b>'
      +'There was not enough room to store a copy of what is on screen, so it was left alone '
      +'rather than replaced, and the kept round is still waiting. Copy Log now, then try again.';
  } else if(recovered&&recovered.length){
    b.style.display='block';
    // v38: this counted ENTRIES and called them rounds. One round of refused saves read
    // "36 rounds that could not be saved were kept", which is both wrong and alarming on a
    // course. Count distinct rounds; the entries behind them are an implementation detail.
    var roundsKept={}, nKept=0;
    for(var ri=0;ri<recovered.length;ri++){
      var rk=draftMetadata(recovered[ri]);
      if(!roundsKept[rk]){roundsKept[rk]=1; nKept++;}
    }
    b.innerHTML='<b>\u26a0\ufe0f '+(nKept===1?'A round that could not be saved was kept'
        :nKept+' rounds that could not be saved were kept')+'</b>'
      +'Entries from '+(recovered[0].date||'an earlier session')+' were never written to storage. '
      +'They are still here.'+recoverBtn;
  } else if(saveFailed){
    b.style.display='block';
    b.innerHTML='<b>\u26a0\ufe0f Not saved</b>'
      +'This browser refused to store the round, so the last few taps exist only on this '
      +'screen. Export the round now \u2014 a reload will lose them.'+noCopyKept;
  } else {
    b.style.display='none'; b.innerHTML='';
  }
}
// v29: one definition of "this hole has something in it", used by both the date-refresh
// rule and the archive guard. They used to disagree: newRound() asked only about scores, so
// a round of notes and putts with no score was deleted silently on Start New Round.
function holeHasData(h){
  return !!h&&(h.score!==null||h.putts!==null||h.fir!==null||h.gir!==null||h.ss!==null
    ||h.chip!==null||h.lag!=null||(h.sixAtt||0)>0||(h.sixMade||0)>0||(h.pen||0)>0
    ||!!(h.notes&&h.notes.trim()));
}
function roundHasData(){return holes.some(holeHasData);}
function pristine(){return !roundHasData();}
function ensureDate(){if(state.date!==today()&&pristine()){state.date=today(); save();}}
// v16a: any new data invalidates a prior export -- dirty (unsaved edits) and exported
// (round data has left the app) are separate facts. Copying no longer means saved.
function touch(){state.dirty=true; state.exported=false; dataSeq++; return save();}
function newRound(){
  vibe(25);
  // v29: was `holes.some(h => h.score !== null)`. A round carrying notes, putts, penalties
  // or fairways but no score counted as empty and was wiped with no prompt and no archived
  // copy -- while roundStats had just been taught that those same fields are real data.
  var hasData=roundHasData();
  if(hasData){
    var scored=holes.some(function(h){return h.score!==null;});
    var msg;
    if(!state.exported){
      msg=scored
        ? 'WARNING: this round has NOT been exported yet. Hit "Export Round" first, or archive it anyway?'
        : 'This round has notes or stats but no scores, and has NOT been exported. Archive it anyway so nothing is lost?';
    } else {
      msg='Archive this round ('+state.date+') and start a new one?';
    }
    if(!confirm(msg))return;
  }
  // v30: v29 pushed the archive, blanked the round, then called save() and ignored the
  // answer. A refused write left the archived round in memory only and replaced the export
  // with a blank card -- so the banner said "export the round now" while the thing worth
  // exporting was no longer reachable. Build the next state, commit it, and only then
  // change what is on screen.
  var prevMode=state.mode||'full';
  var prevTee=state.tee||'blue';
  var keep={date:state.date, holes:state.holes, rounds:state.rounds, pin:state.pin,
            dirty:state.dirty, exported:state.exported, roundId:state.roundId, cur:cur};
  if(hasData){
    // v36 (F3): archive exactly what was exported. This used to keep all eighteen holes and
    // stamp the SELECTED mode on them, so a Front 9 selection with back-nine scores archived
    // an eighteen-hole round labelled 'front' -- and history then disagreed with the copy
    // Kenny had just taken. includedHoles() is the same selection buildSummary() masks with,
    // and the mode is read off it. Excluded holes are out of scope AND empty by construction,
    // so nothing a player entered is dropped to make the two agree.
    var inc=includedHoles();
    var archMode=includedMode(inc);
    state.rounds=state.rounds.concat([{id:'log-'+state.date+'-'+Date.now().toString(36), date:state.date,
      mode:archMode, tee:prevTee, source:'logged', suspect:false,
      pin:(state.pin&&state.pin!=='?')?state.pin:null,
      holes:holes.map(function(h,i){return inc.indexOf(i)>-1?Object.assign({},h):null;}), summary:null}]);
  }
  state.date=today(); state.holes=mk(); state.dirty=false; state.exported=false;
  state.pin='?'; state.mode=prevMode; state.tee=prevTee;
  state.roundId=mintRoundId(state.date);   // a new round is a new identity, same day or not
  if(!save()){
    // Put the player back exactly where they were, with everything still exportable.
    state.date=keep.date; state.holes=keep.holes; state.rounds=keep.rounds; state.pin=keep.pin;
    state.dirty=keep.dirty; state.exported=keep.exported; state.roundId=keep.roundId;
    holes=state.holes; cur=keep.cur;
    render(); showView('holeView');
    return false;
  }
  holes=state.holes; cur=(prevMode==='back'?9:0); saveCursor();
  render();
  showView('holeView');
  return true;
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

var recognizer=null, isRecording=false, speechSeq=0;

// v35: the result handler read holes[cur] when the transcript arrived, so a note landed on
// whatever hole was on screen by then. Binding is to the round, the hole, and the recording
// session -- deliberately NOT to the round revision, because entering a score while speaking
// must not throw away a perfectly good note.
function beginDictation(){ return {seq:++speechSeq, roundId:state.roundId, hole:cur}; }
function applyDictation(session, transcript){
  var msg=document.getElementById('copiedMsg');
  var text=String(transcript||'').trim();
  if(!session||!text)return false;
  if(session.seq!==speechSeq)return false;                       // a later recording superseded this one
  if(session.roundId!==state.roundId){
    // Nowhere sensible to put it; show it rather than dropping it silently.
    if(msg)msg.textContent='Not added — that dictation belongs to the previous round: "'+text+'"';
    return false;
  }
  var h=holes[session.hole];
  if(!h)return false;
  // Read the note as it stands NOW, so anything typed while recognition was pending survives.
  var existing=h.notes||'';
  var merged=existing?(existing+' / '+text):text;
  h.notes=merged;
  if(session.hole===cur){ var nb=document.getElementById('noteBox'); if(nb)nb.value=merged; }
  ensureDate();
  var ok=touch();
  if(!ok&&msg)msg.textContent='Note kept on hole '+(session.hole+1)+' but not saved — Copy Log before reloading.';
  buildSummary();
  return ok;
}
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
    var session=beginDictation();
    recognizer.onresult=function(e){
      applyDictation(session, e.results[0][0].transcript);
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
  if(cur<r.start||cur>r.end){
    setCur(d<0?r.end:r.start);
  } else if(r.count===9){
    setCur(r.start+((cur-r.start+9+d)%9));
  } else {
    setCur((cur+18+d)%18);
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
  if(dl)dl.textContent=state.date+' · '+done+'/'+r.count+' holes ('+r.label+')'
    +(strayHoles().length?' · Also recorded: H'+strayHoles().join(', H'):'');

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
  var inc=includedHoles(), u=[];
  for(var j=0;j<inc.length;j++){
    if(holes[inc[j]].score===null)u.push(inc[j]+1);
  }
  return u;
}

function getTeeProfile(){
  var inc=includedHoles();
  var tips=0, blue=0, white=0, yds=0;
  for(var j=0,i=inc[0]; j<inc.length; j++){
    i=inc[j];
    var t=holeTee(i);
    if(t==='tips')tips++;
    else if(t==='white')white++;
    else blue++;
    yds+=holeYardage(i,t);
  }
  var label='Blue';
  if(tips===inc.length)label='Tips';
  else if(white===inc.length)label='White';
  else if(tips||white){
    var parts=[];
    if(tips)parts.push(tips+' Tips');
    if(blue)parts.push(blue+' Blue');
    if(white)parts.push(white+' White');
    label='Combo ('+parts.join(' / ')+')';
  }
  return {tips:tips, blue:blue, white:white, yds:yds, label:label};
}

function buildSummary(){
  // v36: the export describes the included holes, and its label is derived from them.
  var inc=includedHoles();
  var m=includedMode(inc);
  var stray=strayHoles();
  var tp=getTeeProfile();
  var modeTag=(m==='front'?' [FRONT 9]':(m==='back'?' [BACK 9]':''));
  var teeTag=(tp.label==='Blue'?'':' TEES:'+tp.label.toUpperCase());
  var lines=['BAY OAKS '+state.date+modeTag+teeTag+(state.pin&&state.pin!=='?'?' PIN:'+state.pin:'')];
  // v28: one calculation path. The per-hole lines below are still built here, but every
  // total now comes from roundStats() over the same holes, so the summary, the export text
  // and the archived round cannot drift apart again. The two confirmed divergences this
  // closes: a chip recorded and then corrected to GIR=Yes was dropped here but kept in the
  // archive, and putts on a not-yet-scored hole were counted here but skipped there.
  var masked=holes.map(function(h,i){return inc.indexOf(i)>-1?h:null;});
  var S=roundStats({holes:masked,summary:null});
  var tS=S.score, tPar=S.par, tP=S.putts, tPen=S.pen, out9=S.out, in9=S.inn;
  var gir=S.gir.n, girN=S.gir.d, chipIn=S.chip6.n, chipTried=S.chip6.d;
  var ss=S.ss.n, missed=S.ss.d, made=S.p36.n, att=S.p36.d;
  // v39: the denominator is still every missed green, so no historical figure moves. An
  // unanswered SS used to be indistinguishable from a green missed on the fat side, and the
  // error only ever ran in Kenny's favour. Coverage is shown only when it is short, so a
  // fully answered round exports byte-for-byte as before.
  var ssA=(S.ss&&S.ss.a!=null)?S.ss.a:missed;
  var ssCov=(ssA<missed)?' ('+ssA+' ans)':'';
  var firHit=S.fir.n, firN=S.fir.d, firL=S.fir.l||0, firR=S.fir.r||0;

  // v36: the mode selector chose the entry scope, not the record. If holes outside it hold
  // data, the export says so instead of dropping them.
  if(stray.length)lines.push('NOTE: '+targetHolesRange().label+' is selected, but H'+stray.join(', H')
    +(stray.length===1?' also has data. It is':' also have data. They are')+' included below, so the copy and the archive agree.');
  for(var j=0;j<inc.length;j++){
    var i=inc[j];
    var h=holes[i];
    var n=(i+1<10?'0':'')+(i+1);
    var pn=(h.pen==null?0:h.pen);
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
  }

  var diff=tS-tPar;
  var un=unscoredHoles();
  var scoredN=inc.length-un.length;
  var totLbl;
  if(un.length){
    totLbl='TOT S:'+tS+'* (PARTIAL '+scoredN+'/'+inc.length+', '+(diff>=0?'+':'')+diff+' thru scored) UNSCORED:H'+un.join(',H');
  } else {
    totLbl='TOT S:'+tS+' ('+(diff>=0?'+':'')+diff+')'+modeTag;
  }

  var splitScores=(m==='front'?' OUT:'+out9:(m==='back'?' IN:'+in9:' OUT:'+out9+' IN:'+in9));
  lines.push(totLbl+' FIR:'+firHit+'/'+firN+' (L:'+firL+' R:'+firR+') GIR:'+gir+'/'+girN
    +' PUTTS:'+tP+' CHIP6:'+chipIn+'/'+chipTried+' SS:'+ss+'/'+missed+ssCov
    +' P36:'+made+'/'+att+' PEN:'+tPen+splitScores);
  var et=document.getElementById('exportText'); if(et)et.textContent=lines.join('\n');
  var pct=function(a,b){return b?Math.round(100*a/b)+'%':'–';};
  var st=document.getElementById('stats');
  if(st){
    st.innerHTML=
      (un.length?'<div class="stat"><span class="warn">Unscored '+(inc.length===18?'holes':'('+includedLabel(inc)+')')+'</span> <b class="warn">'+un.join(', ')+'</b></div>':'')
      +'<div class="stat">Tees &amp; Total Yardage <b>'+tp.label+' ('+tp.yds.toLocaleString()+' yds)</b></div>'
      +(m==='full'?'<div class="stat">Out / In / Total <b>'+out9+' / '+in9+' / '+tS+(un.length?'*':'')+'</b></div>'
        :(m==='front'?'<div class="stat">Front 9 Score <b>'+tS+' (OUT: '+out9+')</b></div>'
          :'<div class="stat">Back 9 Score <b>'+tS+' (IN: '+in9+')</b></div>'))
      +'<div class="stat">Score vs Par <b>'+tS+' ('+(diff>=0?'+':'')+diff+')</b></div>'
      +'<div class="stat">Fairways <b>'+firHit+'/'+firN+' (L:'+firL+' R:'+firR+')</b></div>'
      +'<div class="stat">GIR <b>'+gir+'/'+girN+'</b></div>'
      +'<div class="stat">First chip inside 6 ft <b>'+chipIn+'/'+chipTried+' ('+pct(chipIn,chipTried)+')</b></div>'
      +'<div class="stat">Short-sided on missed greens <b>'+ss+'/'+missed+'</b>'
        +(ssA<missed?' <span class="warn">'+ssA+' of '+missed+' answered</span>':'')+'</div>'
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
    // v29: a round archived for its notes/stats with no scores is real, and must not read
    // as a 0 that looks like a data error.
    var scoreCell=s.played?('<b>'+s.score+'</b> ('+(diff>=0?'+':'')+diff+')'):'<b>&mdash;</b> <span style="color:var(--muted)">stats only</span>';
    return '<div style="margin-bottom:6px; padding-bottom:4px; border-bottom:1px solid var(--line-soft);">'
      +'<b>'+r.date+'</b> ('+(r.label||s.type)+' &middot; '+(r.tee||'blue')+(r.pin?' &middot; Pin '+r.pin:'')+'): '
      +scoreCell+' &middot; '
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
    return '<div style="margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid var(--line-soft);">'
      +'<b>H'+o.hole+'</b> (par '+o.par+', hcp '+o.hcp+') <b style="color:var(--oxblood)">+'
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
    return '<div style="margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid var(--line-soft);">'
      +'<b>'+s.label+'</b> <b style="color:var(--oxblood)">+'+s.avgOver.toFixed(2)+'</b>/hole '
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
    return '<div style="margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid var(--line-soft);">'
      +'<b>'+b.label+'</b> &middot; <b style="color:var(--oxblood)">'+rate+'%</b> three-putt '
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
  if(!un.length)return true;
  if(confirm(includedLabel(includedHoles())+' Holes '+un.join(', ')+' have no score. Export a PARTIAL round anyway?'))return true;
  setCur(un[0]-1);
  showView('holeView');
  render();
  return false;
}

function copyExport(skipGuard){
  vibe(20);
  if(!skipGuard&&!guardPartial())return;
  var t=document.getElementById('exportText').textContent;
  var msg=document.getElementById('copiedMsg');
  var token=exportToken();
  function ok(){if(completeExport(token)&&msg)msg.textContent='Copied log — ready for Gemini.'; setTimeout(function(){if(msg)msg.textContent='';},4000);}
  function fallback(){
    var ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta);
    ta.select();
    // v28: execCommand returns false on failure rather than throwing, so the old
    // try/catch reported "Copied log" and set state.exported=true after a copy that never
    // happened -- which also silenced the unexported-round warning in newRound(), the last
    // guard between a failed export and an archived round nobody has a copy of.
    var copied=false;
    try{copied=document.execCommand('copy')===true;}catch(e){copied=false;}
    document.body.removeChild(ta);
    if(copied)ok(); else if(msg)msg.textContent='Copy failed \u2014 long-press the text to copy.';
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
  var inc=includedHoles();
  var tp=getTeeProfile();
  var modeLabel=(inc.length===18?'':' ('+includedLabel(inc)+')');
  var teeLabel=' played from the '+tp.label+' tees ('+tp.yds.toLocaleString()+' yds)';
  var prompt='Analyze my Bay Oaks round'+modeLabel+teeLabel+' from '+state.date+':\n\n'+t+'\n\nPerform short-game leak accounting (CHIP6 proximity, wedge choices, 3-putts), evaluate course strategy vs the plan, and provide 1-2 focused prescriptions for my next session.';
  var msg=document.getElementById('copiedMsg');
  var token=exportToken();
  function ok(){if(completeExport(token)&&msg)msg.textContent='Copied prompt — ready for Gemini!'; setTimeout(function(){if(msg)msg.textContent='';},4000);}
  function fallback(){
    var ta=document.createElement('textarea'); ta.value=prompt; document.body.appendChild(ta);
    ta.select();
    // v28: execCommand returns false on failure rather than throwing, so the old
    // try/catch reported "Copied log" and set state.exported=true after a copy that never
    // happened -- which also silenced the unexported-round warning in newRound(), the last
    // guard between a failed export and an archived round nobody has a copy of.
    var copied=false;
    try{copied=document.execCommand('copy')===true;}catch(e){copied=false;}
    document.body.removeChild(ta);
    if(copied)ok(); else if(msg)msg.textContent='Copy failed \u2014 long-press the text to copy.';
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
  var inc=includedHoles();
  var tp=getTeeProfile();
  var modeLabel=(inc.length===18?'':' ('+includedLabel(inc)+')');
  var teeLabel=' played from the '+tp.label+' tees ('+tp.yds.toLocaleString()+' yds)';
  var prompt='Analyze my Bay Oaks round'+modeLabel+teeLabel+' from '+state.date+':\n\n'+t+'\n\nPerform short-game leak accounting (CHIP6 proximity, wedge choices, 3-putts), evaluate course strategy vs the plan, and provide 1-2 focused prescriptions for my next session.';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(prompt).catch(function(){});
  }
  var fname='bay-oaks-round-'+state.date+'.txt';
  var shareToken=exportToken();
  try{
    if(navigator.canShare&&window.File){
      var f=new File([t],fname,{type:'text/plain'});
      if(navigator.canShare({files:[f]})){navigator.share({files:[f],title:fname}).then(function(){completeExport(shareToken);},function(){}); return;}
    }
  }catch(e){}
  if(navigator.share){navigator.share({title:fname,text:t}).then(function(){completeExport(shareToken);},function(){}); return;}
  copyExport(true);
}

load(); render(); electWriter(); showSaveState();
// v29: another tab writing the round is a fact this tab needs to know before it tries to
// write over it. onExternalWrite() lives above so the oracle can drive it directly.
if(typeof window!=='undefined'&&window.addEventListener){
  window.addEventListener('storage',function(e){onExternalWrite(e&&e.key);});
  window.addEventListener('focus',reelectWriter);
  window.addEventListener('pageshow',reelectWriter);
  window.addEventListener('pagehide',releaseWriter);
  if(typeof document!=='undefined'&&document.addEventListener){
    // Hidden hands the lock over, so the tab in front is always the one that can save.
    document.addEventListener('visibilitychange',function(){
      if(document.hidden)releaseWriter(); else electWriter();
    });
  }
}
if('serviceWorker' in navigator && (location.protocol==='https:' || location.hostname==='localhost')){
  navigator.serviceWorker.register('sw.js').then(function(reg){
    reg.update();
  }).catch(function(){});
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    window.location.reload();
  });
}
