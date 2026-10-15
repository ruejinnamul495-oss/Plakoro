const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('./battle-core.js').PlakoroBattleCore;

function run(effect, overrides = {}) {
  const move = Object.assign({ damage: 10 }, overrides.move || {});
  move.effects = [effect];
  const ctx = Object.assign({
    move,
    own: {},
    targetEffects: {},
    notes: [],
    damage: 10,
    damageParts: [10],
    heal: 0,
    selfDamage: 0,
    failed: false,
    roll: [['불꽃'], ['물']],
    counts: { 불꽃: 1, 물: 1 },
    posture: '정방향',
    ownerHp: 120,
    ownerFailed: false,
    targetFailed: false,
    randomPose: () => '뒤로',
    chooseBlockedMove: () => ({ id: 'blocked-id', name: '봉쇄 기술' }),
    rollOpponent: () => [['물'], ['물', '불꽃'], ['물']],
    rollExtra: () => [['불꽃']],
    getTargetLastMove: () => ({ damage: 30 })
  }, overrides);
  ctx.move = move;
  return { result: core.applyMoveEffects(ctx), ctx };
}

assert.deepEqual(core.rollCounts([['불꽃', '물'], ['물']]), { 불꽃: 1, 물: 2 });
assert.equal(core.canPay({ 불꽃: 1, 무색: 1 }, [['불꽃'], ['물']]), true);
assert.equal(core.canPay({ 불꽃: 2 }, [['불꽃'], ['물']]), false);
assert.equal(core.diceCount(3, -2), 1);
assert.equal(core.diceCount(3, 20), 6);
assert.equal(core.validateMove('a', 'a', null).reason, 'repeat');
assert.equal(core.validateMove('a', null, 'a').reason, 'blocked');
assert.equal(core.validateMove('a', null, null).ok, true);
assert.deepEqual(core.poseInfo('물구나무'), ['🔄', '물구나무']);

{
  const mewMoves = [
    { name: '염동력', damage: 10, value: 20, poses: ['정방향', '물구나무', '뒤로'] },
    { name: '환상빔', damage: 20, value: 30, poses: ['정방향', '물구나무'] },
    { name: '사이코샷', damage: 30, value: 20, poses: ['정방향', '물구나무', '뒤로', '엎드림'] }
  ];
  for (const move of mewMoves) {
    for (const posture of move.poses) {
      const { result } = run(
        { type: 'bonus', value: move.value, poses: move.poses },
        { move: { damage: move.damage }, damage: move.damage, damageParts: [move.damage], posture }
      );
      assert.equal(result.damage, move.damage + move.value, `Mew ${move.name} bonus must apply in ${posture}`);
      assert.deepEqual(result.damageParts, [move.damage, move.value]);
    }
    const excludedPose = ['왼쪽', '오른쪽', '엎드림'].find(p => !move.poses.includes(p));
    if (excludedPose) {
      const { result } = run(
        { type: 'bonus', value: move.value, poses: move.poses },
        { move: { damage: move.damage }, damage: move.damage, damageParts: [move.damage], posture: excludedPose }
      );
      assert.equal(result.damage, move.damage, `Mew ${move.name} bonus must not apply in ${excludedPose}`);
    }
  }
}


{
  const { result } = run({ type: 'bonus', value: 20 });
  assert.equal(result.damage, 30);
  assert.deepEqual(result.damageParts, [10, 20]);
}
{
  const { result } = run({ type: 'bonus', value: 20, poses: ['뒤로'] }, { posture: '왼쪽' });
  assert.equal(result.damage, 10, 'pose-gated effect should not apply outside its pose');
}
{
  const { result } = run({ type: 'setDamage', value: 70 });
  assert.equal(result.damage, 70);
  assert.deepEqual(result.damageParts, [70], 'fixed damage should replace the old damage breakdown');
}
{
  const { result } = run({ type: 'heal', value: 20 });
  assert.equal(result.heal, 20);
}
{
  const { result } = run({ type: 'selfDamage', value: 15 });
  assert.equal(result.selfDamage, 15);
}
{
  const { result, ctx } = run({ type: 'diceShift', selfNext: -2, opponent: 1 });
  assert.equal(ctx.own.nextDice, -2);
  assert.equal(ctx.targetEffects.nextDice, 1);
  assert.equal(result.notes.length, 1);
}
{
  const { result, ctx } = run({ type: 'reduceNext', value: 30 });
  assert.equal(ctx.targetEffects.reduce, 30);
}
{
  const { result, ctx } = run({ type: 'reduceSelfNext', value: 30 });
  assert.equal(ctx.own.reduce, 30);
}
{
  const { result, ctx } = run({ type: 'opponentDice', value: -2 });
  assert.equal(ctx.targetEffects.nextDice, -2);
}
{
  const { result, ctx } = run({ type: 'blockMove' });
  assert.equal(ctx.targetEffects.blocked, 'blocked-id');
}
{
  const { result } = run({ type: 'fireCountBonus', value: 10 }, { counts: { 불꽃: 2 }, damageParts: [10] });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'lowHpBonus', value: 30, threshold: 40 }, { ownerHp: 30 });
  assert.equal(result.damage, 40);
}
{
  const { result } = run({ type: 'failMove' });
  assert.equal(result.failed, true);
}
{
  const { ctx } = run({ type: 'immuneSelfNext' });
  assert.equal(ctx.own.immuneNext, true);
}
{
  const { ctx } = run({ type: 'immuneNext' });
  assert.equal(ctx.own.immuneNext, true);
}
{
  const { ctx } = run({ type: 'skipPosture' });
  assert.equal(ctx.targetEffects.noPostureNext, true);
}
{
  const { ctx } = run({ type: 'skipRoll' });
  assert.equal(ctx.targetEffects.skipRoll, true);
}
{
  const { ctx } = run({ type: 'delayedDamage', value: 25 });
  assert.equal(ctx.targetEffects.startDamage, 25);
}
{
  const { ctx } = run({ type: 'poisonMark' });
  assert.equal(ctx.own.poisoned, true);
}
{
  const { result } = run({ type: 'healIfPoison', value: 20 }, { own: { poisoned: true } });
  assert.equal(result.heal, 20);
}
{
  const { result } = run({ type: 'bonusIfPoison', value: 20 }, { own: { poisoned: true } });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'bonusIfOpponentFailed', value: 20 }, { targetFailed: true });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'bonusIfSelfFailed', value: 20 }, { ownerFailed: true });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'conditionalBonus', value: 20, postures: ['뒤로'] });
  assert.equal(result.damage, 30);
}
{
  const { result } = run({ type: 'gyroBonus', value: 60, postures: ['엎드림'] });
  assert.equal(result.damage, 10, 'gyro bonus should not apply when the randomized posture misses its condition');
}
{
  const { result } = run({ type: 'opponentEnergyBonus', value: 10 });
  assert.equal(result.damage, 40, 'opponent-energy bonus should use the largest energy-type count from the supplied roll');
}
{
  const { result } = run({ type: 'reflectDouble', poses: ['정방향', '물구나무', '뒤로'] }, { posture: '왼쪽' });
  assert.equal(result.damage, 30, 'Reflection still deals base reflected damage outside its double-damage poses');
  assert.deepEqual(result.damageParts, [30]);
}
{
  const { result } = run({ type: 'reflectDouble', poses: ['정방향', '물구나무', '뒤로'] }, { posture: '뒤로' });
  assert.equal(result.damage, 60, 'Reflection doubles only in a listed posture');
  assert.deepEqual(result.damageParts, [30, 30]);
}
{
  const { result } = run({ type: 'reflectDouble', poses: ['정방향', '물구나무', '뒤로'] }, { posture: '뒤로', getTargetLastMove: () => null });
  assert.equal(result.damage, 0, 'Reflection has no base damage when no previous opponent move exists');
}
{
  const { result } = run({ type: 'repeat' }, { move: { damage: 20 }, counts: { 불꽃: 2, 물: 1 } });
  assert.equal(result.damage, 50, 'repeat uses the current total energy-symbol count');
}
{
  const { result } = run({ type: 'diceCountBonus', value: 30 }, { roll: [['불꽃'], ['물'], ['풀']] });
  assert.equal(result.damage, 100);
}
{
  const { result } = run({ type: 'extraRoll' });
  assert.equal(result.roll.length, 3);
  assert.equal(result.counts.불꽃, 2);
}

{
  const html = fs.readFileSync('./index.html', 'utf8');
  const coreSource = fs.readFileSync('./battle-core.js', 'utf8');
  const pokemonTypes = new Set(['풀', '불꽃', '물', '번개', '무색', '에스퍼', '악', '격투', '강철', '비행', 'application/json']);
  const usedEffects = [...html.matchAll(/type\s*:\s*['"]([^'"]+)['"]/g)]
    .map(match => match[1])
    .filter(type => !pokemonTypes.has(type));
  const implementedEffects = new Set([...coreSource.matchAll(/case\s+'([^']+)'/g)].map(match => match[1]));
  const missing = [...new Set(usedEffects)].filter(type => !implementedEffects.has(type));
  assert.deepEqual(missing, [], 'every effect used by the move database must have a shared-core handler');
  assert((html.match(/makeMove\(/g) || []).length >= 100, 'move database should be included in this coverage check');
}

{
  const index = fs.readFileSync('./index.html', 'utf8');
  assert(index.includes("rollOpponent:function(){return rollForTurn(opp,opp==='2',0,3).map(x=>x.face)}"),
    'opponent-energy bonus must roll using the target side dice configuration');
  assert(index.includes("face:rollFace(dieIndex,n==='2'?'2':'1')"),
    'dice face lookup must follow the actual side being rolled');
  assert(index.includes('rollExtra:function(){return rollForTurn(n,isAI,1,0).map(x=>x.face)}'),
    'extraRoll must choose a die index instead of always rolling die one');
}

{
  const pvp = fs.readFileSync('./pvp.js', 'utf8');
  const attack = pvp.indexOf('var att=ps[a.by],targetId=');
  const skip = pvp.indexOf('if(att.effects.skipRoll)', attack);
  const move = pvp.indexOf('var mon2=findMon(att.pokemon),move=', attack);
  const validation = pvp.indexOf('var moveCheck=PlakoroBattleCore.validateMove', attack);
  assert(attack >= 0 && skip > attack && move > skip && validation > move,
    'PvP must process a forced skipped turn before move selection and validation');
}


{
  const failed = core.applyDamageRules({ damage: 50, failed: true, move: { cost: { 불꽃: 1 } } });
  assert.equal(failed.damage, 0, 'failed attacks must deal no damage');
}
{
  const effects = { immuneNext: true };
  const blocked = core.applyDamageRules({ damage: 50, targetEffects: effects, move: { cost: { 불꽃: 1 } } });
  assert.equal(blocked.damage, 0);
  assert.equal(effects.immuneNext, false, 'a successful hit consumes the next-hit immunity');
}
{
  const effects = { reduce: 20 };
  const reduced = core.applyDamageRules({ damage: 50, targetEffects: effects, move: { cost: { 불꽃: 1 } } });
  assert.equal(reduced.damage, 30);
  assert.equal(effects.reduce, 0, 'damage reduction is consumed by a damaging hit');
}
{
  const weak = core.applyDamageRules({ damage: 50, weakness: '불꽃', move: { cost: { 불꽃: 1 } } });
  assert.equal(weak.damage, 70, 'weakness adds 20 damage');
  const ignored = core.applyDamageRules({ damage: 50, weakness: '불꽃', ignoreWeakness: true, move: { cost: { 불꽃: 1 } } });
  assert.equal(ignored.damage, 50, 'explicit weakness-ignore effects are respected');
}

console.log('Battle core tests passed: shared helpers, all 29 effect handlers, move-database coverage, and PvP skipped-turn ordering.');
