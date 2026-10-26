'use strict';
(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const C = 23, R = 15, S = 30;
  const $ = (id) => document.getElementById(id);
  const scoreEl=$('score'), bestEl=$('best'), thirdEl=$('third'), statusEl=$('status');
  const overlay=$('overlay'), title=$('overlay-title'), message=$('overlay-message');
  const btnPause=$('pause'), btnStart=$('start'), btnSound=$('sound');
  const btnQuest=$('mode-quest'), btnSnake=$('mode-snake');
  const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
  let game='quest', state='ready', points=0, lives=3, best=0, sound=false;
  let player={x:2,y:2}, direction=dirs.right, intended=dirs.right, snake=[], food={x:0,y:0}, enemies=[], tiles=[], stepCount=0;
  let audioCtx=null, last=0, raf=0, rng=Math.random;
  const speed={quest:125,snake:145};
  const blocks=[];
  for(let y=0;y<R;y++) for(let x=0;x<C;x++) if ((x%6===0&&y>2&&y<R-3&&y%5!==0)||(y===7&&x>4&&x<C-5&&x%7!==0)) blocks.push(`${x},${y}`);
  const hasBlock=(x,y)=>blocks.includes(`${x},${y}`);
  const inside=(x,y)=>x>=0&&y>=0&&x<C&&y<R;
  const coord=(p)=>`${p.x},${p.y}`;
  const randomOpen=(excluded=new Set())=>{
    const possible=[];for(let y=0;y<R;y++)for(let x=0;x<C;x++)if(!hasBlock(x,y)&&!excluded.has(`${x},${y}`))possible.push({x,y});
    return possible.length?possible[Math.floor(Math.random()*possible.length)]:{x:1,y:1};
  };
  function bestKey(){return 'dion-arcade-best-'+game}
  function loadBest(){try{return Number(localStorage.getItem(bestKey())||0)}catch(e){return 0}}
  function saveBest(){if(points>best){best=points;try{localStorage.setItem(bestKey(),String(best))}catch(e){}}}
  function beep(hz=460){if(!sound)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();let o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(.07,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.09);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+.1)}catch(e){}}
  function hud(){scoreEl.textContent=String(points).padStart(4,'0');bestEl.textContent=String(best).padStart(4,'0');thirdEl.textContent=game==='quest'?String(lives):String(snake.length);statusEl.textContent=state.toUpperCase()}
  function showOverlay(t,m,buttonText){title.textContent=t;message.textContent=m;$('overlay-start').textContent=buttonText;overlay.classList.remove('hidden')}
  function setMode(newMode){game=newMode;btnQuest.classList.toggle('active',game==='quest');btnSnake.classList.toggle('active',game==='snake');btnQuest.setAttribute('aria-pressed',String(game==='quest'));btnSnake.setAttribute('aria-pressed',String(game==='snake'));$('third-label').textContent=game==='quest'?'LIVES':'LENGTH';$('how-title').textContent=game==='quest'?'Collect commits. Avoid bugs.':'Keep growing. Stay alive.';$('how-text').textContent=game==='quest'?'Move around the board and collect green commit tiles. Avoid red bugs. You have three lives.':'Eat the bright green tiles, grow longer, and avoid crashing into walls or yourself.';reset(false)}
  function reset(start){points=0;lives=3;stepCount=0;best=loadBest();player={x:2,y:2};direction=dirs.right;intended=dirs.right;
    snake=[{x:4,y:4},{x:3,y:4},{x:2,y:4}];const occupied=new Set(snake.map(coord));food=randomOpen(occupied);
    tiles=[];enemies=[];
    if(game==='quest'){
      for(let i=0;i<26;i++){const p=randomOpen(new Set([coord(player),...tiles.map(coord)]));tiles.push(p)}
      enemies=[{x:20,y:3},{x:19,y:12},{x:3,y:12}];
    }
    state=start?'playing':'ready';btnPause.disabled=!start;btnPause.textContent='Ⅱ Pause';overlay.classList.toggle('hidden',start);
    if(!start)showOverlay(game==='quest'?'Commit Quest':'Pixel Snake',game==='quest'?'Collect green commit tiles. Watch out for red bugs.':'Collect tiles to grow longer. Don\'t hit the walls or your tail.','Start game ↗');hud();draw();last=0;
  }
  function start(){reset(true);beep(660)}
  function pause(){if(state==='playing'){state='paused';showOverlay('Paused','Take a break. Your score is safe.','Resume game ↗');btnPause.textContent='▶ Resume'}else if(state==='paused'){state='playing';overlay.classList.add('hidden');btnPause.textContent='Ⅱ Pause';last=0}hud()}
  function end(t,m){state='game over';saveBest();showOverlay(t,m,'Play again ↗');btnPause.disabled=true;beep(210);hud()}
  function move(d){if(!d)return;if(game==='snake'&&snake.length>1&&d.x===-direction.x&&d.y===-direction.y)return;intended=d;if(game==='quest')direction=d}
  function tickQuest(){
    const n={x:player.x+direction.x,y:player.y+direction.y};if(inside(n.x,n.y)&&!hasBlock(n.x,n.y))player=n;
    const i=tiles.findIndex(t=>t.x===player.x&&t.y===player.y);
    if(i!==-1){points+=10;saveBest();beep(660);tiles.splice(i,1);tiles.push(randomOpen(new Set([coord(player),...tiles.map(coord),...enemies.map(coord)])))}
    if(stepCount%3===0)for(const b of enemies){
      const choices=Object.values(dirs).map(d=>({x:b.x+d.x,y:b.y+d.y})).filter(p=>inside(p.x,p.y)&&!hasBlock(p.x,p.y));
      if(choices.length){choices.sort((p,q)=>(Math.abs(p.x-player.x)+Math.abs(p.y-player.y))-(Math.abs(q.x-player.x)+Math.abs(q.y-player.y)));let pick=Math.random()<.65?choices[0]:choices[Math.floor(Math.random()*choices.length)];b.x=pick.x;b.y=pick.y;}
    }
    if(enemies.some(e=>e.x===player.x&&e.y===player.y)){
      lives--;beep(250);player={x:2,y:2};direction=dirs.right;
      if(lives<=0)end('Out of lives',`You scored ${points} points. Give it another go.`)
    }
  }
  function tickSnake(){
    direction=intended;
    const h=snake[0],n={x:h.x+direction.x,y:h.y+direction.y};
    const eating=n.x===food.x&&n.y===food.y;
    const body=eating?snake:snake.slice(0,-1);
    if(!inside(n.x,n.y)||body.some(b=>b.x===n.x&&b.y===n.y))return end('Game over',`Your score: ${points}. One more run?`);
    snake.unshift(n);if(eating){points+=10;saveBest();beep(710);food=randomOpen(new Set(snake.map(coord)));if(snake.length>=C*R-1)end('You win!','The board is yours.');}else snake.pop();
  }
  function round(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
  function draw(){
    const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);
    const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#0b2224');grad.addColorStop(1,'#071820');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
    for(let y=0;y<R;y++)for(let x=0;x<C;x++){
      const z=((x*73+y*11)%19);round(x*S+3,y*S+3,S-6,S-6,5,z<3?'#1a4039':'#12312f');
      if(game==='quest'&&hasBlock(x,y))round(x*S+3,y*S+3,S-6,S-6,5,'#28565a','#40716b');
    }
    if(game==='quest'){
      for(const t of tiles){round(t.x*S+8,t.y*S+8,S-16,S-16,3,'#83eaa9');ctx.fillStyle='#c9ffda';ctx.fillRect(t.x*S+12,t.y*S+12,6,6)}
      for(const b of enemies){round(b.x*S+5,b.y*S+5,S-10,S-10,6,'#f07578');ctx.fillStyle='#102228';ctx.fillRect(b.x*S+11,b.y*S+11,4,4);ctx.fillRect(b.x*S+19,b.y*S+11,4,4)}
      round(player.x*S+4,player.y*S+4,S-8,S-8,6,'#ffba73');ctx.fillStyle='#132925';ctx.fillRect(player.x*S+10,player.y*S+11,4,4);ctx.fillRect(player.x*S+18,player.y*S+11,4,4)
    }else{
      for(let i=snake.length-1;i>=0;i--){const s=snake[i];round(s.x*S+4,s.y*S+4,S-8,S-8,6,i===0?'#ffba73':'#55cfa1')}
      round(food.x*S+7,food.y*S+7,S-14,S-14,4,'#b1ff85');
    }
    // subtle scanlines
    ctx.fillStyle='#030a0d10';for(let y=0;y<h;y+=5)ctx.fillRect(0,y,w,1)
  }
  function loop(time){if(state==='playing'&&(last===0||time-last>=speed[game])){if(last===0){last=time}else{last=time;stepCount++;if(game==='quest')tickQuest();else tickSnake();hud()}}draw();raf=requestAnimationFrame(loop)}
  btnQuest.addEventListener('click',()=>setMode('quest'));btnSnake.addEventListener('click',()=>setMode('snake'));
  btnStart.addEventListener('click',start);btnPause.addEventListener('click',pause);
  $('overlay-start').addEventListener('click',()=>state==='paused'?pause():start());
  btnSound.addEventListener('click',()=>{sound=!sound;btnSound.setAttribute('aria-pressed',String(sound));btnSound.textContent=sound?'♪ Sound on':'♪ Sound off';if(sound)beep()});
  document.addEventListener('keydown',e=>{const key=e.key.toLowerCase();const k={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[key];if(k){e.preventDefault();move(dirs[k])}else if(key===' '){e.preventDefault();if(state==='playing'||state==='paused')pause();else start()}});
  document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('pointerdown',(e)=>{e.preventDefault();move(dirs[b.dataset.dir]);if(state==='ready')start()}));
  $('year').textContent=String(new Date().getFullYear());setMode('quest');requestAnimationFrame(loop);
})();
