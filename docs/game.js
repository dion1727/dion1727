"use strict";
(() => {
  const USER='dion1727';
  const $=(id)=>document.getElementById(id);
  const canvas=$('board'), ctx=canvas.getContext('2d');
  const COLS=26, ROWS=7, STEP=25, BX=20, BY=125;
  const snakeRows=15, snakeCols=23, unit=30;
  const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  const allDirs=Object.values(dirs);
  let mode='quest', phase='ready', score=0, best=0, lives=3, sound=false;
  let days=[], board=new Map(), active=[], fetchedAt=null, source='not-synced', eventsCache=[];
  let player={x:0,y:0},direction=dirs.right, queued=dirs.right, ghosts=[], stepNumber=0;
  let snake=[], food={x:10,y:7}, ctxAudio=null, last=0;
  const px=(p)=>`${p.x},${p.y}`;
  const inQuest=(p)=>p.x>=0&&p.x<COLS&&p.y>=0&&p.y<ROWS;
  const inSnake=(p)=>p.x>=0&&p.x<snakeCols&&p.y>=0&&p.y<snakeRows;
  const rand=(n)=>Math.floor(Math.random()*n);
  const dayKey=(date)=>date.slice(0,10);
  const formatDate=(d)=>new Date(`${d}T12:00:00Z`).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
  const prettyTime=(t)=>t?new Date(t).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'belum tersedia';
  const bestKey=()=>`dion-real-arcade-${mode}`;
  function soundFX(f=650){ if(!sound)return;try{ctxAudio ??= new (window.AudioContext||window.webkitAudioContext)();const o=ctxAudio.createOscillator(),g=ctxAudio.createGain();o.type='triangle';o.frequency.value=f;g.gain.setValueAtTime(.035,ctxAudio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,ctxAudio.currentTime+.085);o.connect(g);g.connect(ctxAudio.destination);o.start();o.stop(ctxAudio.currentTime+.09);}catch{}}
  function bestLoad(){try{return Number(localStorage.getItem(bestKey())||0)}catch{return 0}}
  function bestUpdate(){if(score>best){best=score;try{localStorage.setItem(bestKey(),String(best))}catch{}}}
  function hud(){ $('score').textContent=String(score).padStart(4,'0');$('best').textContent=String(best).padStart(4,'0');$('third').textContent=String(mode==='quest'?lives:snake.length);$('status').textContent=phase.toUpperCase() }
  function overlay(title,detail,label='Start game ↗'){$('overlay-title').textContent=title;$('overlay-message').textContent=detail;$('overlay-start').textContent=label;$('overlay').classList.remove('hidden')}
  function end(title,detail){phase='game over';bestUpdate();$('pause').disabled=true;overlay(title,detail,'Play again ↗');soundFX(240);hud()}
  function setPhase(playing){phase=playing?'playing':'ready';$('pause').disabled=!playing;$('pause').textContent='Ⅱ Pause';$('overlay').classList.toggle('hidden',playing);last=0;hud()}
  function liveStatus(message,at,src){$('data-status').textContent=message;$('data-updated').textContent=(src?src+' · ':'')+(at?'Updated '+prettyTime(at):'Waiting for sync')}
  function normalize(raw){const items=Array.isArray(raw?.days)?raw.days:Array.isArray(raw?.contributions)?raw.contributions:[];return items.filter(p=>typeof p.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date)&&Number.isFinite(Number(p.count)))
    .map(p=>({date:p.date,count:Math.max(0,Math.trunc(Number(p.count))),level:Math.max(0,Number(p.level||0))}));}
  async function loadCalendar(force=false){
    liveStatus('Fetching real contribution calendar…',null,null);
    const raw=`https://raw.githubusercontent.com/${USER}/${USER}/main/docs/data/contributions.json?v=${Math.floor(Date.now()/300000)}`;
    for(const url of [raw, `./data/contributions.json?v=${Date.now()}`]){
      try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)continue;const payload=await r.json();const arr=normalize(payload);
        if(arr.length){days=arr;source='Full contribution calendar';fetchedAt=payload.fetched_at||null;
          buildBoard();liveStatus(`${arr.filter(d=>d.count>0).length} active days from dion1727 · genuine GitHub counts`,fetchedAt,source);
          if(phase!=='playing')reset(false);return;}
      }catch(e){/* proceed to other sources */}
    }
    // A public events fallback is honest, but NOT the full GitHub contribution calendar.
    try{const ev=eventsCache.length?eventsCache:await fetchPublicEvents();const cnt=new Map();
      for(const e of ev){const d=(e.created_at||'').slice(0,10);if(d)cnt.set(d,(cnt.get(d)||0)+1)}
      if(cnt.size){days=[...cnt].map(([date,count])=>({date,count,level:Math.min(4,count)}));source='Recent public events (partial)';fetchedAt=new Date().toISOString();
        buildBoard();liveStatus(`Showing ${cnt.size} days of public events, NOT the complete contribution calendar`,fetchedAt,source);if(phase!=='playing')reset(false);return;}
    }catch(e){/* offline */}
    days=[];source='Practice only';fetchedAt=null;buildBoard();liveStatus('Calendar unavailable. Practice mode uses clearly marked practice tiles.',null,'Practice');if(phase!=='playing')reset(false);
  }
  async function fetchPublicEvents(){const r=await fetch(`https://api.github.com/users/${USER}/events/public?per_page=100`,{headers:{Accept:'application/vnd.github+json'}});if(!r.ok)throw new Error(`API ${r.status}`);const a=await r.json();eventsCache=Array.isArray(a)?a:[];return eventsCache;}
  async function loadActivity(){
    try{const [pr,ev]=await Promise.all([fetch(`https://api.github.com/users/${USER}`,{headers:{Accept:'application/vnd.github+json'}}),fetchPublicEvents()]);
      if(pr.ok){const d=await pr.json();$('public-repos').textContent=Number(d.public_repos||0).toLocaleString('id-ID');$('followers').textContent=Number(d.followers||0).toLocaleString('id-ID')}
      const top=ev[0];$('recent-event').textContent=top?`${top.type.replace(/Event$/,'')} · ${(top.repo&&top.repo.name)||'GitHub'} · ${prettyTime(top.created_at)}. Public events refresh when you reopen the page.`:'No recent public events returned.';
    }catch(e){$('recent-event').textContent='Public GitHub API temporarily unavailable. The games still work.'}
  }
  function buildBoard(){
    board=new Map();active=[];const now=new Date(),today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()),dow=new Date(today).getUTCDay();const start=today-dow*86400000-(COLS-1)*7*86400000;
    // Board is the latest 26 calendar weeks, left-to-right, Sunday to Saturday.
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const date=new Date(start+(x*7+y)*86400000).toISOString().slice(0,10);
      board.set(`${x},${y}`,{x,y,date,count:0,future:(start+(x*7+y)*86400000)>today,level:0});
    }
    for(const d of days){const dt=Date.parse(d.date+'T00:00:00Z'),col=Math.floor((dt-start)/(7*86400000)),row=new Date(dt).getUTCDay();if(col<0||col>=COLS||dt>today)continue;const target=board.get(`${col},${row}`);if(target){target.count=d.count;target.level=d.level}}
    active=[...board.values()].filter(v=>v.count>0);
    $('stats-title').textContent=source==='Full contribution calendar'?`${active.reduce((a,d)=>a+d.count,0)} contributions on this board`:source==='Recent public events (partial)'?`${active.reduce((a,d)=>a+d.count,0)} recent public events`:'Practice mode';
  }
  function practiceTiles(){const used=new Set();const list=[];for(let i=0;i<28;i++){let x=rand(COLS),y=rand(ROWS);while(used.has(`${x},${y}`)){x=rand(COLS);y=rand(ROWS)}used.add(`${x},${y}`);list.push({x,y,date:'Practice',count:1,level:1,practice:true})}return list;}
  let tiles=[];
  function randomStart(){return {x:1,y:3}}
  function reset(start){
    score=0;lives=3;stepNumber=0;best=bestLoad();player=randomStart();direction=dirs.right;queued=dirs.right;
    tiles=(active.length?active:practiceTiles()).map(v=>({...v})).filter(t=>!(t.x===player.x&&t.y===player.y));
    ghosts=[{x:20,y:1},{x:16,y:5}];snake=[{x:4,y:7},{x:3,y:7},{x:2,y:7}];placeFood();setPhase(start);
    if(!start)overlay(mode==='quest'?'Commit Quest':'Pixel Snake',mode==='quest'?(source==='Full contribution calendar'?'Collect actual dion1727 contribution days. Tiles score their real GitHub counts.':source==='Recent public events (partial)'?'Playing recent real public events (partial calendar). Collect tiles and dodge bugs.':'Practice mode while GitHub data sync is unavailable.'):'Eat green pixels, grow longer, and avoid your own tail.');
    draw();
  }
  function setMode(m){mode=m;$('mode-quest').classList.toggle('active',m==='quest');$('mode-snake').classList.toggle('active',m==='snake');$('mode-quest').setAttribute('aria-pressed',String(m==='quest'));$('mode-snake').setAttribute('aria-pressed',String(m==='snake'));
    $('third-label').textContent=m==='quest'?'LIVES':'LENGTH';$('how-title').textContent=m==='quest'?'Real contributions become collectibles.':'Snake, but a little greener.';
    $('how-text').textContent=m==='quest'?'Each green tile maps to a contribution day on dion1727. When the full calendar sync is available, your score increases by that date’s real count. Avoid the red bugs.':'Collect the bright tiles, grow, and avoid walls or your own tail.';
    reset(false);
  }
  function pause(){if(phase==='playing'){phase='paused';overlay('Paused','Take a break. Your progress will stay here.','Resume ↗');$('pause').textContent='▶ Resume'}else if(phase==='paused'){phase='playing';$('overlay').classList.add('hidden');$('pause').textContent='Ⅱ Pause';last=0}hud()}
  function move(d){if(!d)return;if(mode==='snake'&&snake.length>1&&d.x===-direction.x&&d.y===-direction.y)return;queued=d;if(mode==='quest')direction=d}
  function questTick(){
    const p={x:player.x+direction.x,y:player.y+direction.y};if(inQuest(p))player=p;
    const i=tiles.findIndex(t=>t.x===player.x&&t.y===player.y);if(i>=0){const t=tiles.splice(i,1)[0];score+=t.count;bestUpdate();soundFX(780);$('recent-event').textContent=(t.practice?'Practice tile':formatDate(t.date))+` · ${t.count} ${source==='Recent public events (partial)'?'public events':'contributions'} collected!`;if(!tiles.length)return end('Board cleared!',`Collected ${score} ${source==='Recent public events (partial)'?'events':'contributions'}. Play again?`)}
    if(stepNumber%4===0)for(const g of ghosts){const ways=allDirs.map(d=>({x:g.x+d.x,y:g.y+d.y})).filter(inQuest);if(ways.length){ways.sort((a,b)=>(Math.abs(a.x-player.x)+Math.abs(a.y-player.y))-(Math.abs(b.x-player.x)+Math.abs(b.y-player.y)));const target=Math.random()<.52?ways[0]:ways[rand(ways.length)];g.x=target.x;g.y=target.y}}
    if(ghosts.some(g=>px(g)===px(player))){lives--;soundFX(230);player=randomStart();direction=dirs.right;if(lives<=0)end('Out of lives',`Collected ${score} contribution points. Try again.`)}
  }
  function randomFood(){const occ=new Set(snake.map(px));const choices=[];for(let y=0;y<snakeRows;y++)for(let x=0;x<snakeCols;x++)if(!occ.has(`${x},${y}`))choices.push({x,y});return choices.length?choices[rand(choices.length)]:null}
  function placeFood(){food=randomFood()||{x:10,y:7}}
  function snakeTick(){direction=queued;const p={x:snake[0].x+direction.x,y:snake[0].y+direction.y},eat=px(p)===px(food);const body=eat?snake:snake.slice(0,-1);if(!inSnake(p)||body.some(t=>px(t)===px(p)))return end('Game over',`You scored ${score}. Another round?`);snake.unshift(p);if(eat){score+=10;bestUpdate();soundFX(760);placeFood();if(snake.length>=snakeRows*snakeCols-1)end('You win!','Board completely filled!')}else snake.pop()}
  function rect(x,y,w,h,fill,stroke,r=5){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.lineWidth=1;ctx.strokeStyle=stroke;ctx.stroke()}}
  function draw(){const w=canvas.width,h=canvas.height;const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#0b2222');g.addColorStop(1,'#061523');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    if(mode==='quest'){
      ctx.textAlign='left';ctx.fillStyle='#91b6a8';ctx.font='12px monospace';ctx.fillText('← OLDER',BX,55);ctx.fillText('LAST 26 WEEKS • LIVE GITHUB DAYS',BX+155,55);ctx.fillText('NEWER →',w-110,55);
      const tags=['SUN','MON','TUE','WED','THU','FRI','SAT'];ctx.font='10px monospace';ctx.textAlign='left';tags.forEach((t,i)=>ctx.fillText(t,1,BY+i*STEP+15));
      for(const d of board.values()){const x=BX+d.x*STEP,y=BY+d.y*STEP;const intensity=Math.min(4,d.level||Math.ceil(d.count/3));const colors=['#122e31','#164a3b','#1e7650','#38a76e','#8bec9e'];rect(x+2,y+2,STEP-4,STEP-4,d.future?'#0a1b24':d.count?colors[intensity]:'#183335','#38574b',4)}
      for(const t of tiles){const x=BX+t.x*STEP,y=BY+t.y*STEP;rect(x+3,y+3,STEP-6,STEP-6,t.practice?'#ad9b50':'#79eaa0','#c7ffd7',4)}
      for(const g of ghosts){const x=BX+g.x*STEP,y=BY+g.y*STEP;rect(x+4,y+4,STEP-8,STEP-8,'#fc727c',null,6);ctx.fillStyle='#111';ctx.fillRect(x+8,y+9,3,4);ctx.fillRect(x+15,y+9,3,4)}
      const x=BX+player.x*STEP,y=BY+player.y*STEP;ctx.fillStyle='#ffc76b';ctx.beginPath();ctx.arc(x+STEP/2,y+STEP/2,STEP/2-3,.22,Math.PI*2-.22);ctx.lineTo(x+STEP/2,y+STEP/2);ctx.fill();
      ctx.textAlign='left';ctx.fillStyle='#87b9ad';ctx.font='12px monospace';const desc=source==='Full contribution calendar'?'ACCURATE CONTRIBUTION COUNTS':source==='Recent public events (partial)'?'PARTIAL PUBLIC EVENTS · NOT FULL CALENDAR':'PRACTICE TILES · CALENDAR PENDING';ctx.fillText(desc,BX,375);
      ctx.fillText(`${tiles.length} remaining tiles  •  hover a day for GitHub counts`,BX,402);
    }else{
      for(let y=0;y<snakeRows;y++)for(let x=0;x<snakeCols;x++)rect(x*unit+3,y*unit+3,unit-6,unit-6,(x+y)%3?'#143331':'#1c423d',null,5);
      for(let i=snake.length-1;i>=0;i--){const p=snake[i];rect(p.x*unit+4,p.y*unit+4,unit-8,unit-8,i?'#56c79b':'#ffc76b',null,6)}
      rect(food.x*unit+7,food.y*unit+7,unit-14,unit-14,'#aefa85',null,4);
    }
    ctx.fillStyle='#030b1014';for(let y=0;y<h;y+=6)ctx.fillRect(0,y,w,1);
  }
  function frame(t){if(phase==='playing'&&(last===0||t-last>=(mode==='quest'?105:135))){if(last===0)last=t;else{last=t;stepNumber++;mode==='quest'?questTick():snakeTick();hud()}}draw();requestAnimationFrame(frame)}
  $('mode-quest').addEventListener('click',()=>setMode('quest'));
  $('mode-snake').addEventListener('click',()=>setMode('snake'));
  $('start').addEventListener('click',()=>reset(true));
  $('pause').addEventListener('click',pause);
  $('overlay-start').addEventListener('click',()=>phase==='paused'?pause():reset(true));
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'♪ Sound on':'♪ Sound off';$('sound').setAttribute('aria-pressed',String(sound));soundFX(770)});
  $('refresh-data').addEventListener('click',()=>{loadCalendar(true);loadActivity()});
  document.addEventListener('keydown',e=>{const k=e.key.toLowerCase(),v={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[k];if(v){e.preventDefault();move(dirs[v]);}else if(k===' '){e.preventDefault();phase==='ready'||phase==='game over'?reset(true):pause()}});
  document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();move(dirs[b.dataset.dir])}));
  canvas.addEventListener('mousemove',e=>{if(mode!=='quest')return;const r=canvas.getBoundingClientRect(),x=Math.floor(((e.clientX-r.left)*canvas.width/r.width-BX)/STEP),y=Math.floor(((e.clientY-r.top)*canvas.height/r.height-BY)/STEP),d=board.get(`${x},${y}`);canvas.title=d&&!d.future?`${formatDate(d.date)} — ${d.count} contributions`:'GitHub contribution calendar'});
  $('year').textContent=String(new Date().getFullYear());
  const requested=new URL(location.href).searchParams.get('game');setMode(requested==='snake'?'snake':'quest');buildBoard();requestAnimationFrame(frame);
  loadActivity().finally(()=>loadCalendar());setInterval(()=>{loadActivity();if(phase!=='playing')loadCalendar()},300000);
})();
