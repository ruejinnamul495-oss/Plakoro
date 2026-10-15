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
 function applyMoveEffects(ctx){
  var move=ctx.move,own=ctx.own,targetEffects=ctx.targetEffects,notes=ctx.notes,damage=Number(ctx.damage)||0,damageParts=ctx.damageParts,heal=Number(ctx.heal)||0,selfDamage=Number(ctx.selfDamage)||0,failed=!!ctx.failed,roll=ctx.roll||[],counts=ctx.counts||rollCounts(roll),posture=ctx.posture;
  if(move.baseReduceNext){own.reduce=(own.reduce||0)+move.baseReduceNext;notes.push('다음 상대 턴 받는 피해 -'+move.baseReduceNext)}
  (move.effects||[]).forEach(function(e){
   if(e.poses&&e.poses.length&&!e.poses.includes(posture))return;
   switch(e.type){
    case 'bonus': damage+=Number(e.value||0);damageParts.push(Number(e.value||0));notes.push('자세 효과 피해 +'+e.value);break;
    case 'setDamage': damage=Number(e.value||0);notes.push('피해 '+e.value+'로 설정');break;
    case 'heal': heal+=Number(e.value||0);notes.push('HP '+e.value+' 회복');break;
    case 'selfDamage': selfDamage+=Number(e.value||0);notes.push('자신에게 피해 '+e.value);break;
    case 'diceShift': if(e.selfNext)own.nextDice=(own.nextDice||0)+e.selfNext;if(e.opponent!==undefined)targetEffects.nextDice=(targetEffects.nextDice||0)+e.opponent;notes.push('다음 턴 에네코로 수 변경');break;
    case 'reduceNext': targetEffects.reduce=(targetEffects.reduce||0)+Number(e.value||0);notes.push('상대 다음 턴 받는 피해 -'+e.value);break;
    case 'reduceSelfNext': own.reduce=(own.reduce||0)+Number(e.value||0);notes.push('자신의 다음 방어 피해 -'+e.value);break;
    case 'opponentDice': targetEffects.nextDice=(targetEffects.nextDice||0)+Number(e.value||0);notes.push('상대 다음 턴 에네코로 '+e.value);break;
    case 'blockMove': if(ctx.chooseBlockedMove){var blocked=ctx.chooseBlockedMove();if(blocked){targetEffects.blocked=blocked.id;notes.push('상대 기술 봉쇄: '+blocked.name)}}break;
    case 'fireCountBonus': var fire=(counts['불꽃']||0)*Number(e.value||0);damage+=fire;if(fire)damageParts.push(fire);notes.push('불꽃 에너지 추가 피해 +'+fire);break;
    case 'lowHpBonus': if(ctx.ownerHp<=e.threshold){damage+=Number(e.value||0);damageParts.push(Number(e.value||0));notes.push('남은 HP 조건 피해 +'+e.value)}break;
    case 'failMove': failed=true;notes.push('기술 실패');break;
    case 'immuneSelfNext': case 'immuneNext': own.immuneNext=true;notes.push('다음 상대 턴 기술 피해 무효');break;
    case 'skipPosture': targetEffects.noPostureNext=true;notes.push('상대 다음 턴 캐릭코로 던지기 불가');break;
    case 'skipRoll': targetEffects.skipRoll=true;notes.push('상대 다음 턴 에네코로 굴리기 불가');break;
    case 'delayedDamage': targetEffects.startDamage=(targetEffects.startDamage||0)+Number(e.value||0);notes.push('상대 다음 턴 예약 피해 '+e.value);break;
    case 'poisonMark': own.poisoned=true;notes.push('독가스 성공 기록');break;
    case 'healIfPoison': if(own.poisoned){heal+=Number(e.value||0);notes.push('독가스 성공: HP +'+e.value)}else notes.push('독가스 성공 기록 없음');break;
    case 'bonusIfPoison': if(own.poisoned){damage+=Number(e.value||0);damageParts.push(Number(e.value||0));notes.push('독가스 성공: 피해 +'+e.value)}else notes.push('독가스 성공 기록 없음');break;
    case 'bonusIfOpponentFailed': if(ctx.targetFailed){damage+=Number(e.value||0);damageParts.push(Number(e.value||0));notes.push('상대 직전 실패: 피해 +'+e.value)}break;
    case 'bonusIfSelfFailed': if(ctx.ownerFailed){damage+=Number(e.value||0);damageParts.push(Number(e.value||0));notes.push('자신 직전 실패: 피해 +'+e.value)}break;
    case 'conditionalBonus': case 'gyroBonus': {var rp=ctx.randomPose?ctx.randomPose():'정방향';notes.push('상대 캐릭코로 '+rp);if((e.postures||[]).includes(rp)){damage+=Number(e.value||0);damageParts.push(Number(e.value||0));notes.push('조건 성립 피해 +'+e.value)}break}
    case 'opponentEnergyBonus': if(ctx.rollOpponent){var oc=rollCounts(ctx.rollOpponent()),mx=Math.max(0,...Object.values(oc)),od=mx*Number(e.value||0);damage+=od;if(od)damageParts.push(od);notes.push('상대 에네코로 최다 타입 '+mx+'개: 피해 +'+od)}break;
    case 'reflectDouble': {var last=ctx.getTargetLastMove?ctx.getTargetLastMove():null;damage=last?Number(last.damage||0):0;if(last)notes.push('상대 직전 기술 기본 피해 '+last.damage);if(posture&&posture!=='캐릭코로 금지')damage*=2;break}
    case 'repeat': {var total=Object.keys(counts).reduce(function(sum,k){return sum+Number(counts[k]||0)},0),extra=Math.max(0,total-1)*(Number(move.damage)||0);damage+=extra;if(extra)damageParts.push(extra);notes.push('에네코로 결과에 따른 반복 공격');break}
    case 'diceCountBonus': var db=roll.length*Number(e.value||0);damage+=db;if(db)damageParts.push(db);notes.push('굴린 에네코로 수 피해 +'+db);break;
    case 'extraRoll': if(ctx.rollExtra){var extraRoll=ctx.rollExtra();roll=roll.concat(extraRoll);counts=rollCounts(roll);notes.push('추가 에네코로 '+extraRoll.map(function(x){return x.join('+')}).join('/'))}break;
   }
  });
  return {damage:damage,damageParts:damageParts,heal:heal,selfDamage:selfDamage,failed:failed,roll:roll,counts:counts,notes:notes};
 }
 root.PlakoroBattleCore={rollCounts:rollCounts,canPay:canPay,pose:pose,attackType:attackType,validateMove:validateMove,diceCount:diceCount,applyDamageRules:applyDamageRules,applyMoveEffects:applyMoveEffects};
})(typeof window!=='undefined'?window:this);
