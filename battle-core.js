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
 function validateMove(moveId,lastMove,blockedMove){
  if(!moveId)return {ok:false,reason:'missing'};
  if(lastMove===moveId)return {ok:false,reason:'repeat'};
  if(blockedMove===moveId)return {ok:false,reason:'blocked'};
  return {ok:true,reason:null};
 }
 function diceCount(baseCount,modifier){
  return Math.max(0,Math.min(6,Number(baseCount||0)+Number(modifier||0)));
 }
 function applyDamageRules(input){
  var damage=Math.max(0,Number(input.damage)||0),notes=[];
  var failed=!!input.failed,targetEffects=input.targetEffects||(input.targetEffects={});
  if(failed){damage=0;notes.push('공격 실패')}
  else if(targetEffects.immuneNext){damage=0;targetEffects.immuneNext=false;notes.push('피해 무효')}
  if(!failed&&damage>0&&targetEffects.reduce){
   damage=Math.max(0,damage-Number(targetEffects.reduce||0));
   notes.push('피해 감소 -'+Number(targetEffects.reduce||0));
   targetEffects.reduce=0;
  }
  var type=attackType(input.move);
  if(!failed&&damage>0&&!input.ignoreWeakness&&type&&input.weakness===type){
   damage+=20;notes.push('약점 피해 +20');
  }
  return {damage:damage,notes:notes};
 }
 root.PlakoroBattleCore={rollCounts:rollCounts,canPay:canPay,pose:pose,attackType:attackType,validateMove:validateMove,diceCount:diceCount,applyDamageRules:applyDamageRules};
})(typeof window!=='undefined'?window:this);
