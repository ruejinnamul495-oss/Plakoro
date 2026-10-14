(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
var CFG='plakoro-pvp-supabase-config-v1',client=null,channel=null,roomCode='',role='',playerId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random(),roomState=null,connected=false;
function say(t){$('pvpRoomStatus').textContent=t}
function conf(){return {url:$('pvpSupabaseUrl').value.trim(),key:$('pvpSupabaseKey').value.trim()}}
try{var saved=JSON.parse(localStorage.getItem(CFG)||'{}');$('pvpSupabaseUrl').value=saved.url||'';$('pvpSupabaseKey').value=saved.key||''}catch(e){}
$('pvpName').value='플레이어-'+Math.floor(100+Math.random()*900);
function initClient(){
 var c=conf();
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(c.url)||!c.key){say('Supabase Project URL과 공개용 key를 입력해.');return false}
 if(!window.supabase||!window.supabase.createClient){say('Supabase 라이브러리를 불러오지 못했어. 네트워크/CDN 접근을 확인해.');return false}
 try{localStorage.setItem(CFG,JSON.stringify(c));if(client&&channel)client.removeChannel(channel);client=window.supabase.createClient(c.url,c.key);$('pvpConnectionStatus').textContent='설정 저장됨';return true}catch(e){say('설정 오류: '+e.message);return false}
}
$('pvpSaveConfig').onclick=function(){if(initClient())say('설정을 저장했어. 방을 만들거나 코드를 입력해.')};
$('pvpPokemon').innerHTML=starterData.map(function(p){return '<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>'}).join('');
function updateMoves(){var p=starterData.find(function(x){return x.name===$('pvpPokemon').value})||starterData[0];$('pvpMove').innerHTML=p.moves.map(function(m,i){return '<option value="'+i+'">'+esc(m.name)+' · '+Number(m.damage||0)+' 피해</option>'}).join('')}
$('pvpPokemon').onchange=updateMoves;updateMoves();
function leave(){if(channel&&client)client.removeChannel(channel);channel=null;roomCode='';role='';roomState=null;connected=false;$('pvpLeave').disabled=true;$('pvpCreateRoom').disabled=false;$('pvpJoinRoom').disabled=false;$('pvpReady').disabled=true;$('pvpAttack').disabled=true;$('pvpPlayers').innerHTML='';say('방에서 나왔어.')}
function log(t){roomState.log=(roomState.log||[]).concat([t]).slice(-50)}
function publish(){if(channel&&roomState)channel.send({type:'broadcast',event:'room_state',payload:{by:playerId,state:roomState}});render()}
function render(){
 if(!roomState)return;
 var ps=roomState.players||{},ids=Object.keys(ps),both=ids.length===2&&ids.every(function(id){return ps[id].ready});
 $('pvpPlayers').innerHTML=ids.map(function(id){return '<span class="tag">'+esc(ps[id].name)+(ps[id].ready?' · 준비 완료':' · 대기 중')+'</span>'}).join('');
 $('pvpBattleState').innerHTML='<div class="item"><div><b>'+(roomState.over?'대전 종료':roomState.turn===playerId?'내 차례':esc((ps[roomState.turn]||{}).name||'상대')+' 차례')+'</b><small>방 코드 '+roomCode+'</small></div></div>'+ids.map(function(id){var p=ps[id];return '<div class="item"><div><b>'+esc(p.name)+(id===playerId?' (나)':'')+'</b><small>'+esc(p.pokemon||'포켓몬 미선택')+' · HP '+(p.hp==null?'—':p.hp)+'</small></div><span class="pill">'+(p.ready?'준비 완료':'준비 중')+'</span></div>'}).join('');
 $('pvpLog').innerHTML=(roomState.log||[]).map(function(x){return '<p>'+esc(x)+'</p>'}).join('');
 $('pvpReady').disabled=!connected||!ps[playerId]||ps[playerId].ready||ids.length!==2;
 $('pvpAttack').disabled=!connected||!both||roomState.over||roomState.turn!==playerId;
}
function hostAction(a){
 if(role!=='host'||!roomState)return;
 var ps=roomState.players;
 if(a.kind==='join'){
  if(Object.keys(ps).length>=2&&!ps[a.by]){say('이 방은 이미 가득 찼어.');return}
  ps[a.by]={name:String(a.name||'상대').slice(0,20),ready:false,pokemon:'',hp:0};log(ps[a.by].name+'가 참가했어.');publish();return;
 }
 if(a.kind==='ready'&&ps[a.by]&&!ps[a.by].ready){
  var mon=starterData.find(function(p){return p.name===a.pokemon});if(!mon)return;
  ps[a.by].ready=true;ps[a.by].pokemon=mon.name;ps[a.by].hp=mon.hp;
  if(Object.keys(ps).length===2&&Object.keys(ps).every(function(id){return ps[id].ready})){roomState.turn=Object.keys(ps)[Math.floor(Math.random()*2)];log('양쪽 준비 완료. '+ps[roomState.turn].name+'부터 시작해.')}else log(ps[a.by].name+' 포켓몬 확정. 상대 준비를 기다리는 중이야.');
  publish();return;
 }
 if(a.kind==='attack'&&ps[a.by]&&roomState.turn===a.by&&!roomState.over){
  var ids=Object.keys(ps);if(ids.length!==2||!ids.every(function(id){return ps[id].ready}))return;
  var target=ids.find(function(id){return id!==a.by}),attacker=ps[a.by],mon2=starterData.find(function(p){return p.name===attacker.pokemon})||starterData[0],move=mon2.moves[Number(a.moveIndex)]||mon2.moves[0],damage=Math.max(0,Number(move.damage)||0);
  ps[target].hp=Math.max(0,ps[target].hp-damage);log(attacker.name+'의 '+move.name+'! '+damage+' 피해.');
  if(ps[target].hp<=0){roomState.over=true;log(attacker.name+' 승리!')}else roomState.turn=target;
  publish();
 }
}
async function connectRoom(code,asRole){
 if(!client&&!initClient())return;
 code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6);
 if(code.length!==6){say('방 코드는 영문/숫자 6자리야.');return}
 leave();roomCode=code;role=asRole;
 channel=client.channel('plakoro-pvp-'+code,{config:{broadcast:{self:false},presence:{key:playerId}}});
 channel.on('broadcast',{event:'room_state'},function(msg){if(msg.payload&&msg.payload.state){roomState=msg.payload.state;render();if(role==='guest'&&roomState.players[playerId])say('방 '+roomCode+'에 연결됐어.')}})
 .on('broadcast',{event:'room_action'},function(msg){if(msg.payload&&role==='host')hostAction(msg.payload)});
 channel.on('presence',{event:'sync'},function(){var count=Object.keys(channel.presenceState()).length;say('방 '+roomCode+' · 접속 '+count+'/2명')});
 channel.subscribe(async function(state){
  if(state==='SUBSCRIBED'){
   connected=true;await channel.track({id:playerId,name:$('pvpName').value.trim()||'플레이어'});
   $('pvpLeave').disabled=false;$('pvpCreateRoom').disabled=true;$('pvpJoinRoom').disabled=true;$('pvpRoomCode').value=roomCode;
   if(role==='host'){roomState={players:{},turn:playerId,over:false,log:['방이 생성됐어. 상대가 참가하기를 기다리는 중이야.']};roomState.players[playerId]={name:$('pvpName').value.trim()||'플레이어',ready:false,pokemon:'',hp:0};publish();say('방 생성 완료. 코드 '+roomCode+'를 상대에게 알려 줘.')}
   else {channel.send({type:'broadcast',event:'room_action',payload:{kind:'join',by:playerId,name:$('pvpName').value.trim()||'상대'}});say('방 참가 요청을 보냈어. 호스트 응답을 기다리는 중이야.')}
   render();
  }else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){connected=false;say('실시간 연결 실패 ('+state+'). Supabase URL/key와 Realtime 연결을 확인해.')}
 });
}
$('pvpCreateRoom').onclick=function(){var alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',code='';for(var i=0;i<6;i++)code+=alphabet[Math.floor(Math.random()*alphabet.length)];connectRoom(code,'host')};
$('pvpJoinRoom').onclick=function(){connectRoom($('pvpRoomCode').value,'guest')};
$('pvpLeave').onclick=leave;
$('pvpReady').onclick=function(){if(!channel||!roomState||!roomState.players[playerId])return;var mon=starterData.find(function(p){return p.name===$('pvpPokemon').value})||starterData[0];var a={kind:'ready',by:playerId,pokemon:mon.name};if(role==='host')hostAction(a);else channel.send({type:'broadcast',event:'room_action',payload:a})};
$('pvpAttack').onclick=function(){if(!channel||!roomState||roomState.turn!==playerId||roomState.over)return;var a={kind:'attack',by:playerId,moveIndex:Number($('pvpMove').value)};if(role==='host')hostAction(a);else channel.send({type:'broadcast',event:'room_action',payload:a})};
$('pvpLeave').disabled=true;
})();
