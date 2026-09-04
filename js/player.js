// Kenny's player model. Separated from caddy logic in v18 so that updating a yardage is a
// data edit, not a code edit -- previously carries were baked into both the recommender's
// thresholds and its display strings, so the two could drift apart silently.
//
// `upTo` is the effective-distance ceiling for the slot (after pin-depth adjustment), and
// `carry` is the honest number the swing produces. Ordered ascending; the recommender walks
// the list and takes the first slot that fits.
//
// NOTE for Kenny: the vault profile lists GW full carry at 110-120 with an 80% swing giving
// 95-105. The bag below encodes the 80% swing because that is the shot actually in play --
// full GW has ~5 swings in four years. Flagged rather than reconciled silently.
var BAG=[
  {club:'58\u00b0 Wedge',        carry:75,  upTo:80,  swing:'Full 75y swing (aim fat side)'},
  {club:'54\u00b0 Wedge',        carry:95,  upTo:102, swing:'Stock 90-100y pitch (bites quick)'},
  {club:'Gap Wedge (GW)',   carry:100, upTo:112, swing:'80% smooth swing (95-105y target)'},
  {club:'Pitching Wedge (PW)', carry:120, upTo:125, swing:'Smooth PW (117-125y)'},
  {club:'Pitching Wedge (PW)', carry:135, upTo:138, swing:'Full stock PW (135y)'},
  {club:'9-Iron',           carry:145, upTo:148, swing:'Stock 9-iron (145y)'},
  {club:'8-Iron',           carry:155, upTo:160, swing:'Stock 8-iron (155y, check rough flyer)'},
  {club:'7-Iron',           carry:170, upTo:174, swing:'Stock 7-iron (170y center green)'},
  {club:'6-Iron',           carry:180, upTo:186, swing:'Stock 6-iron (180y)'},
  {club:'5-Iron',           carry:195, upTo:200, swing:'Natural draw 5-iron (195y)'},
  {club:'4-Hybrid',         carry:210, upTo:225, swing:'Stock 4h (210y) or 8i layup'},
  {club:'Driver',           carry:260, upTo:999, swing:'Driver 260 carry / 270 total'}
];

// Distances offered in the caddy selector, derived from the bag so they can never drift
// from the clubs that actually cover them.
function bagDistances(){
  var seen={}, out=[];
  BAG.forEach(function(b){ if(!seen[b.carry]){seen[b.carry]=1; out.push(b.carry);} });
  return out.sort(function(a,b){return a-b;});
}

// Dispersion facts that drive course-management advice, kept here rather than in tips prose.
var PLAYER={
  handicap:13,
  driverSpeed:'103-105 mph',
  smash:1.45,
  missTendency:'aim-based, ~10 yds either side, little curve; snap hook left only on a babied driver',
  dangerHoles:[5,17],   // water on the miss side
  safeMissHoles:[18]    // water opposite the miss
};
