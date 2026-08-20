// Seed data: historical rounds + hole-level backfill.
var STORE='bayoaks-rounds-v6';

// v16b: SEED_ROUNDS is one-time seed data only -- hand-transcribed summaries from before
// the app archived rounds itself. It is read exactly once, by migrateState(), to populate
// state.rounds. Nothing else may read it: rounds[] is the single canonical round store.
var SEED_ROUNDS=[
  {date:'2026-07-15', score:94, par:72, fir:'7/14', gir:'7/18', putts:38, chip6:'2/10', ss:'5/11', p36:'16/20', pen:5, out:45, in:49, holes:18, type:'18 Holes', tee:'Blue'},
  {date:'2026-08-01', score:49, par:40, fir:'5/8', gir:'2/9', putts:21, chip6:'2/7', ss:'1/7', p36:'10/11', pen:1, out:44, in:5, holes:10, type:'10 Holes', tee:'Blue'},
  {date:'2026-08-06', score:82, par:72, fir:'11/14', gir:'11/17', putts:41, chip6:'1/6', ss:'2/6', p36:'17/17', pen:2, out:41, in:41, holes:18, type:'18 Holes', tee:'Blue'},
  {date:'2026-08-13', score:90, par:72, fir:'3/14', gir:'4/16', putts:31, chip6:'2/11', ss:'3/12', p36:'15/17', pen:2, out:44, in:46, holes:18, type:'18 Holes', tee:'Blue'},
  {date:'2026-08-19', score:43, par:36, fir:'4/7', gir:'5/9', putts:20, chip6:'0/4', ss:'1/4', p36:'8/8', pen:0, out:43, in:0, holes:9, type:'Front 9', tee:'Blue'}
];

// v16c: hole-level backfill, parsed from the Drive round exports and verified against each
// file's own TOT line (40/40 stat checks reproduced exactly). Encoding per hole, 9 chars:
// score, fir(y/l/r/-), gir(y/n/-), ss(y/n/-), chip(i/o/-), putts, sixMade, sixAtt, pen.
// Empty entry = hole not played. Single-digit fields only -- an oracle check verifies the
// decoded holes reproduce each round's summary, so a bad encode cannot land silently.
// NOTE: the 07-15 file's header reads 2026-07-10. File creation time (evening of 07-15) and
// the vault both say 07-15; the stale header is the v10 stale-date bug's fingerprint. Keyed
// to 07-15 deliberately -- flagged to Kenny, not silently resolved.
var SEED_HOLES={
 '2026-07-15':'4ry--2110,7rnno3011,3-y--1000,4yy--2110,8rnyo2111,4ynyi1110,6lnyo2110,3-y--2110,6lnno3110,4yy--2110,5ynyi1110,6-nno2111,8rnn-3121,4-nno2110,5yy--3120,5yy--2110,5lnyo2110,7ynno3121',
 '2026-08-01':'5rnno2110,5lnni1110,3-nni1110,4ynno2110,5yy--2110,5yy--3120,7rnyo2111,5-nno3110,5ynno2110,5y---3110,,,,,,,,',
 '2026-08-06':'4yy--2110,5ry--3110,6-nno3111,5ynno2110,5yy--3110,5yy--3110,4y---2110,3-y--2110,4yy--2110,5ynyo2000,5lnni1111,4-y--3110,4yy--2110,4-nyo2110,5ynno2110,6ry--3110,4yy--2110,4yy--2110',
 '2026-08-13':'5lnno2110,4yy--2110,4-nyo2110,6rnno2111,6yy--3120,4ln-o1000,6l---2110,4-nyo2110,5rnno2110,4ry--2110,5yy--2110,4-nno2110,5lny--000,4-nni2120,5lnni1110,6l----000,7lnno2111,6lnno2110',
 '2026-08-19':'4yy--2110,5lnno2110,3-y--2110,6lnno2110,5yy--2110,6ynyo3110,5yy--2110,4-y--3110,5rnno2000,,,,,,,,,'
};
var SEED_PINS={'2026-08-19':'D'};

function decodeSeedHoles(csv){
  if(!csv)return null;
  return csv.split(',').map(function(t){
    if(!t)return {score:null,fir:null,gir:null,ss:null,chip:null,putts:null,sixAtt:0,sixMade:0,pen:0,notes:''};
    var ch=function(c){return c==='-'?null:c;};
    return {score:+t[0], fir:ch(t[1]), gir:t[2]==='y'?true:(t[2]==='n'?false:null),
      ss:t[3]==='y'?true:(t[3]==='n'?false:null),
      chip:t[4]==='i'?'in':(t[4]==='o'?'out':null),
      putts:t[5]==='-'?null:+t[5], sixMade:+t[6], sixAtt:+t[7], pen:+t[8], notes:''};
  });
}
