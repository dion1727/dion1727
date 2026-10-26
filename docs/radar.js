'use strict';
(() => {
const $ = id => document.getElementById(id);
const valid = p => /^\d{4}-\d{2}-\d{2}$/.test(p?.date||'') && Number.isFinite(+p.count) && +p.count>=0;
const urlList = () => [
  'https://github-contributions-api.jogruber.de/v4/dion1727?y=last',
  './data/contributions.json?cache='+Date.now()
];
const fmtTime=v=>v?new Date(v).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'Not synced';
function render(days=[], source='', time=''){
 const map=new Map(days.filter(valid).map(d=>[d.date,{count:Math.floor(+d.count),level:Math.min(4,Math.max(0,+d.level||0))}]));
 const now=new Date();const today=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate());const first=today-370*864e5;
 const start=first-(new Date(first).getUTCDay()*864e5);
 const root=$('heatmap'); root.textContent='';const frag=document.createDocumentFragment();
 let sum=0,active=0;
 for(let x=0;x<53;x++)for(let y=0;y<7;y++){
  const n=start+(x*7+y)*864e5,day=new Date(n).toISOString().slice(0,10),d=map.get(day)||{count:0,level:0};
  const future=n>today;const square=document.createElement('span');
  square.className='heat-cell'+(future?' future':'')+(d.count>0?' l'+Math.max(1,d.level):'');
  square.title=`${day} — ${days.length?d.count+' contributions':'Calendar not synced'}`;
  square.setAttribute('aria-label',square.title);
  frag.appendChild(square);if(!future){sum+=d.count;if(d.count>0)active++;}
 }
 root.appendChild(frag);
 $('contribution-total').textContent=days.length?sum.toLocaleString('id-ID'):'—';
 $('active-days').textContent=days.length?active:'—';
 $('radar-source').textContent=days.length?source:'SYNC PENDING';
 $('sync-age').textContent=days.length?fmtTime(time):'Not yet';
}
async function refresh(){
  $('radar-source').textContent='FETCHING…';
  for(const url of urlList()){
   try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)continue;const d=await r.json();
    const days=(Array.isArray(d.days)?d.days:Array.isArray(d.contributions)?d.contributions:[]).filter(valid);
    if(days.length){render(days,url.includes('jogruber')?'PUBLIC MIRROR':'GITHUB SYNC',d.fetched_at||(url.includes('jogruber')?new Date().toISOString():''));return;}
   }catch(e){}
  }
  render([], 'CALENDAR UNAVAILABLE', '');
}
async function activity(){
  const root=$('activity-feed');root.textContent='';
  try{
    const r=await fetch('https://api.github.com/users/dion1727/events/public?per_page=12',{headers:{Accept:'application/vnd.github+json'}});
    if(!r.ok)throw new Error('GitHub HTTP '+r.status);
    const rows=(await r.json()).slice(0,6);
    if(!rows.length)throw new Error('No public events yet');
    for(const item of rows){
      const box=document.createElement('div');box.className='event';
      const h=document.createElement('strong');h.textContent=item.type.replace(/Event$/,'')+' · '+(item.repo?.name||'Public activity');
      const d=document.createElement('small');d.textContent=new Date(item.created_at).toLocaleString('id-ID',{dateStyle:'short',timeStyle:'short'});
      box.append(h,d);root.appendChild(box);
    }
  }catch(e){const p=document.createElement('p');p.textContent='Live GitHub events temporarily unavailable. The arcade still works.';root.appendChild(p);}
}
$('refresh-radar').addEventListener('click',()=>{refresh();activity()});
render([], 'AWAITING LIVE CONTRIBUTION DATA', '');refresh();activity();
})();
