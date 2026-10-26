"use strict";
(() => {
  const y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear();
  const light=document.querySelector('.g-one');
  if(light && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    window.addEventListener('pointermove', e => {
      if(e.pointerType==='touch')return;
      light.style.transform=`translate(${((e.clientX/window.innerWidth)-0.5)*48}px,${((e.clientY/window.innerHeight)-0.5)*48}px)`;
    },{passive:true});
  }
})();
