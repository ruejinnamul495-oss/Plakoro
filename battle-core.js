/* Shared battle rules used by VS AI and online PvP. Keep deterministic rules here. */
(function(root){
 'use strict';
 function rollCounts(roll){
  var counts={};
  (roll||[]).forEach(function(face){
   (Array.isArray(face)?face:[face]).forEach(function(type){
    counts[type]=(counts[type]||0)+1;
   });
  });
  return counts;
 }
 function canPay(cost,rollOrCounts){
  var counts=Array.isArray(rollOrCounts)?rollCounts(rollOrCounts):Object.assign({},rollOrCounts||{});
  var remaining=Object.assign({},counts);
  for(var type in (cost||{})){
   if(type==='무색')continue;
   var needed=Number(cost[type]||0);
   if((remaining[type]||0)<needed)return false;
   remaining[type]=(remaining[type]||0)-needed;
  }
  var leftover=Object.keys(remaining).reduce(function(total,type){return total+Number(remaining[type]||0)},0);
  return leftover>=Number((cost||{}).무색||0);
 }
 function pose(){return ['정방향','왼쪽','오른쪽','뒤로','엎드림','물구나무','뒤집힘'][Math.floor(Math.random()*7)]}
 function attackType(move){return Object.keys((move&&move.cost)||{}).find(function(type){return type!=='무색'})||null}
 root.PlakoroBattleCore={rollCounts:rollCounts,canPay:canPay,pose:pose,attackType:attackType};
})(typeof window!=='undefined'?window:this);
