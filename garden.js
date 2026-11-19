// One viewport canvas. Only the visible part of Home, Skills or Experience is drawn.
const canvas=document.querySelector('#garden'),ctx=canvas.getContext('2d'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),theme=matchMedia('(prefers-color-scheme: dark)');
const baseCanvas=document.createElement('canvas'),baseCtx=baseCanvas.getContext('2d');
let baseDirty=true;
const DURATIONS=[5.8,8.2,6.6],STARTS=[0,6.8,16],PERIOD=23.6,TAU=Math.PI*2;
const targets=[...document.querySelectorAll('#home,#skills,#experience')],pauseButtons=[...document.querySelectorAll('[data-motion-toggle]')];
let w=0,h=0,ratio=1,target=null,clip=null,masks=[],field=null,cache=new Map(),frame=0,scrollFrame=0,lastTick=0,lastDraw=0,clock=0,paused=false,windowActive=true,pending=null,lastPointer=null,colors=null,seed=177,stats={
  frames:0,total:0,max:0
},lastStats=0;
function clamp(v,a,b){
  return Math.max(a,Math.min(b,v))
}
function mod(v,n){
  return((v%n)+n)%n
}
function rand(){
  seed=seed*16807%2147483647;
  return(seed-1)/2147483646
}
function profile(){
  const mobile=w<700,home=target?.id==='home';
  return {
    limit:home?(mobile?750:1700):(mobile?280:650),fps:home?(mobile?24:30):(mobile?12:18),dpr:mobile?1:Math.min(devicePixelRatio||1,1.5)
  }
}
function surface(s,a){
  return s.r*(1+.095*Math.sin(a*3+s.seed)+.055*Math.cos(a*5-s.seed))
}
function distance(x,y,s){
  const dx=(x-s.x)/s.sx,dy=(y-s.y)/s.sy;
  return Math.hypot(dx,dy)-surface(s,Math.atan2(dy,dx))
}
function wave(delay,t,i){
  const cycle=Math.floor(t/PERIOD),local=mod(t,PERIOD)-STARTS[i],head=-.24+1.48*local/DURATIONS[i];
  return {
    pass:cycle+(head>=delay?0:-1),pulse:local<0||local>DURATIONS[i]?0:Math.exp(-(((head-delay)/.085)**2))
  }
}
function makeField(limit){
  seed=177;
  const r=Math.min(w*.09,95),stones=[{
    x:w*.68,y:h*.43,r,sx:1.12,sy:.84,seed:.4
  },{
    x:w*.18,y:h*.65,r:r*.49,sx:1.16,sy:.8,seed:2.2
  },{
    x:w*.22,y:h*.19,r:r*.34,sx:.87,sy:1.13,seed:4.1
  }];
  for(const s of stones)s.reach=Math.max(...[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>distance(x,y,s)));
  const gap=Math.max(13,Math.sqrt(w*h/limit)),points=[];
  for(let k=0;k<3;k++){
    const s=stones[k];
    for(let offset=12;offset<Math.hypot(w,h)*.85;offset+=gap*1.16){
      const count=Math.floor(TAU*(s.r+offset)/gap);
      for(let i=0;i<count;i++){
        const a=i/count*TAU,rad=surface(s,a)+offset,x=s.x+Math.cos(a)*rad*s.sx,y=s.y+Math.sin(a)*rad*s.sy;
        if(x<0||x>w||y<0||y>h)continue;
        const distances=stones.map(stone=>distance(x,y,stone)),nearest=Math.min(...distances);
        if(nearest<8||distances[k]!==nearest)continue;
        const delays=distances.map((d,j)=>clamp(Math.max(0,d)/stones[j].reach*.9,0,.9));
        points.push({
          x,y,bx:x,by:y,dx:0,dy:0,gx:0,gy:0,left:0,delays,passes:delays.map((d,j)=>wave(d,clock,j).pass),size:.7+rand()*.55,phase:rand()*TAU
        });
      }
    }
  }
  if(points.length<=limit)return points;
  return Array.from({
    length:limit
  },(_,i)=>points[Math.floor(i*points.length/limit)]);
}
function readColors(){
  baseDirty=true;
  const style=getComputedStyle(document.documentElement);
  colors={
    grain:style.getPropertyValue('--grain').trim(),disturbed:style.getPropertyValue('--disturbed').trim()
  };
  if(target)draw(0);
}
function covered(x,y){
  for(const r of masks)if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)return true;
  return false;
}
function setState(){
  const state=document.hidden?'hidden':!windowActive?'unfocused':paused?'paused':reduce.matches?'reduced-motion':target?'running':'idle';
  canvas.dataset.state=state;
  canvas.dataset.section=target?.id||'none';
  canvas.dataset.particles=String(field?.length||0);
  canvas.dataset.fpsCap=String(target?profile().fps:0);
  canvas.style.visibility=target?'visible':'hidden';
  const global=document.querySelector('#global-motion');
  global.hidden=!target||target.id==='home';
  for(const b of pauseButtons){
    b.setAttribute('aria-pressed',String(paused));
    b.querySelector('span').textContent=paused?'Resume motion':'Pause motion';
  }
  document.documentElement.classList.toggle('motion-paused',paused||document.hidden||!windowActive||!target);
}
function runnable(){
  return !!target&&!document.hidden&&windowActive&&!paused&&!reduce.matches;
}
function start(){
  if(!frame&&runnable()){
    lastTick=lastDraw=performance.now();
    frame=requestAnimationFrame(tick);
  }
  setState();
}
function stop(){
  cancelAnimationFrame(frame);
  frame=0;
  pending=null;
  lastPointer=null;
  setState();
}
function inspect(){
  baseDirty=true;
  scrollFrame=0;
  if(document.hidden)return;
  let best=null,area=0,bounds=null;
  for(const s of targets){
    const r=s.getBoundingClientRect(),visible=Math.max(0,Math.min(h,r.bottom)-Math.max(80,r.top));
    if(visible>area&&visible>90){
      area=visible;
      best=s;
      bounds=r;
    }
  }
  const changed=target!==best;
  target=best;
  if(changed){
    stop();
    field=null;
    ctx.clearRect(0,0,w,h);
  }
  if(!target){
    clip=null;
    setState();
    return;
  }
  clip={
    top:Math.max(0,bounds.top),bottom:Math.min(h,bounds.bottom)
  };
  if(!field){
    if(!cache.has(target.id))cache.set(target.id,makeField(profile().limit));
    field=cache.get(target.id);
    stats={
      frames:0,total:0,max:0
    };
  }
  const selector=target.id==='home'?'.eyebrow,.name,.role,.tags':target.id==='skills'?'.skills-intro,.skill-card':'.chapter-heading,.experience-card';
  masks=[...target.querySelectorAll(selector)].map(el=>{
    const r=el.getBoundingClientRect();
    return {
      left:r.left-12,right:r.right+12,top:r.top-10,bottom:r.bottom+10
    };
  });
  if(changed||!runnable())draw(0);
  start();
}
function requestInspect(){
  if(!document.hidden&&!scrollFrame)scrollFrame=requestAnimationFrame(inspect);
}
function resize(){
  stop();
  w=document.documentElement.clientWidth;
  h=innerHeight;
  ratio=profile().dpr;
  canvas.width=Math.round(w*ratio);
  canvas.height=Math.round(h*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
  baseCanvas.width=canvas.width;
  baseCanvas.height=canvas.height;
  baseCtx.setTransform(ratio,0,0,ratio,0,0);
  baseDirty=true;
  cache.clear();
  field=null;
  inspect();
  readColors();
  canvas.dataset.bufferMiB=(canvas.width*canvas.height*8/1048576).toFixed(2);
}
function disturb(x,y){
  baseDirty=true;
  for(const p of field){
    if(covered(p.x,p.y))continue;
    const dx=p.x-x,dy=p.y-y,d=Math.hypot(dx,dy);
    if(d<80){
      const a=d>1?Math.atan2(dy,dx):rand()*TAU,f=(1-d/80)*45;
      p.gx=clamp(p.gx+Math.cos(a)*f,-130,130);
      p.gy=clamp(p.gy+Math.sin(a)*f,-130,130);
      p.dx+=(p.gx-p.dx)*.3;
      p.dy+=(p.gy-p.dy)*.3;
      p.left=4;
      p.dynamic=true;
      p.passes=p.delays.map((delay,i)=>wave(delay,clock,i).pass);
    }
  }
}
function paintBase(){
  baseCtx.clearRect(0,0,w,h);
  baseCtx.fillStyle=`rgba(${colors.grain},${target.id==='home'?.14:.09})`;
  baseCtx.beginPath();
  for(const p of field){
    if(p.dynamic||p.by<clip.top||p.by>clip.bottom||covered(p.bx,p.by))continue;
    baseCtx.moveTo(p.bx+p.size,p.by);
    baseCtx.arc(p.bx,p.by,p.size,0,TAU);
  }
  baseCtx.fill();
  baseDirty=false;
}
const buckets=Array.from({
  length:16
},()=>[]),glows=[];
function draw(dt){
  for(const bucket of buckets)bucket.length=0;
  glows.length=0;
  ctx.clearRect(0,0,w,h);
  if(!field||!clip||!colors)return;
  const t0=performance.now();
  if(pending&&runnable()){
    disturb(pending.x,pending.y);
    pending=null;
  }
  if(baseDirty)paintBase();
  ctx.drawImage(baseCanvas,0,0,w,h);
  const local=mod(clock,PERIOD);
  let source=-1,head=0;
  for(let i=0;i<3;i++)if(local>=STARTS[i]&&local<=STARTS[i]+DURATIONS[i]){
    source=i;
    head=-.24+1.48*(local-STARTS[i])/DURATIONS[i];
    break;
  }
  let drawn=0;
  const blend=1-Math.exp(-dt*4.3);
  for(const p of field){
    if(p.y<clip.top||p.y>clip.bottom||covered(p.x,p.y))continue;
    if(p.left&&runnable()){
      let hits=0;
      for(let i=0;i<3;i++){
        const pass=wave(p.delays[i],clock,i).pass;
        hits+=Math.max(0,pass-p.passes[i]);
        p.passes[i]=pass;
      }
      if(hits){
        const before=p.left;
        p.left=Math.max(0,p.left-hits);
        p.gx*=p.left/before;
        p.gy*=p.left/before;
      }
    }
    p.dx+=(p.gx-p.dx)*blend;
    p.dy+=(p.gy-p.dy)*blend;
    p.x=p.bx+p.dx;
    p.y=p.by+p.dy;
    if(p.dynamic&&!p.left&&Math.hypot(p.dx,p.dy)<.1){
      p.dynamic=false;
      baseDirty=true;
    }
    if(p.dynamic&&covered(p.x,p.y))continue;
    const pulse=reduce.matches?.2:source<0||Math.abs(head-p.delays[source])>.23?0:Math.exp(-(((head-p.delays[source])/.085)**2)),disturbed=p.left>0,color=disturbed?colors.disturbed:colors.grain,alpha=(disturbed?.55+.06*Math.sin(clock*.9+p.phase):(p.dynamic?.14:0)+pulse*.57)*(target.id==='home'?1:.65),radius=p.size+(disturbed?.3:pulse*.4);
    if(!p.dynamic&&pulse<.02)continue;
    if(target.id==='home'&&alpha>.48)glows.push(p.x,p.y,radius*3);
    const bin=clamp(Math.round(alpha*10),0,7)+(disturbed?8:0);
    buckets[bin].push(p.x,p.y,radius);
    drawn++;
  }
  if(glows.length){
    ctx.fillStyle=`rgba(${colors.grain},.018)`;
    ctx.beginPath();
    for(let i=0;i<glows.length;i+=3){
      ctx.moveTo(glows[i]+glows[i+2],glows[i+1]);
      ctx.arc(glows[i],glows[i+1],glows[i+2],0,TAU);
    }
    ctx.fill();
  }
  for(let b=1;b<16;b++){
    const bucket=buckets[b];
    if(!bucket.length)continue;
    ctx.fillStyle=`rgba(${b>=8?colors.disturbed:colors.grain},${(b%8)/10})`;
    ctx.beginPath();
    for(let i=0;i<bucket.length;i+=3){
      ctx.moveTo(bucket[i]+bucket[i+2],bucket[i+1]);
      ctx.arc(bucket[i],bucket[i+1],bucket[i+2],0,TAU);
    }
    ctx.fill();
  }
  const ms=performance.now()-t0;
  stats.frames++;
  stats.total+=ms;
  stats.max=Math.max(stats.max,ms);
  if(t0-lastStats>1000){
    lastStats=t0;
    canvas.dataset.drawn=String(drawn);
    canvas.dataset.drawMs=(stats.total/stats.frames).toFixed(2);
    canvas.dataset.maxDrawMs=stats.max.toFixed(2);
    canvas.dataset.renderedFrames=String(stats.frames);
  }
}
function tick(t){
  frame=0;
  if(!runnable()){
    setState();
    return;
  }
  const dt=Math.min((t-lastTick)/1000,.12);
  lastTick=t;
  clock+=dt;
  if(t-lastDraw>=1000/profile().fps-1){
    const elapsed=Math.min((t-lastDraw)/1000,.15);
    lastDraw=t;
    draw(elapsed);
  }
  frame=requestAnimationFrame(tick);
}
addEventListener('scroll',requestInspect,{
  passive:true
});
let resizeTimer=0;
addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(resize,150);
});
addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'||!runnable()||e.target.closest('a,button,input,textarea,summary')||!target.contains(e.target))return;
  const x=e.clientX,y=e.clientY;
  if(!lastPointer||Math.hypot(x-lastPointer.x,y-lastPointer.y)>3){
    pending={
      x,y
    };
    lastPointer={
      x,y
    };
  }
},{
  passive:true
});
addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch'&&runnable()&&target.contains(e.target)&&!e.target.closest('a,button,input,textarea,summary'))pending={
    x:e.clientX,y:e.clientY
  };
},{
  passive:true
});
for(const b of pauseButtons)b.addEventListener('click',()=>{
  paused=!paused;
  if(paused)stop();
  else start();
});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    cancelAnimationFrame(scrollFrame);
    scrollFrame=0;
    clearTimeout(resizeTimer);
    stop();
  }else inspect();
});
addEventListener('blur',()=>{
  windowActive=false;
  stop();
});
addEventListener('focus',()=>{
  windowActive=true;
  inspect();
});
reduce.addEventListener('change',()=>{
  stop();
  for(const points of cache.values())for(const p of points){
    p.dx=p.dy=p.gx=p.gy=p.left=0;
    p.dynamic=false;
  }
  baseDirty=true;
  draw(0);
  start();
});
theme.addEventListener('change',readColors);
addEventListener('load',requestInspect);
resize();
