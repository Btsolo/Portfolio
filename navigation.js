const toggle=document.querySelector('#menu-toggle'),nav=document.querySelector('#navigation'),narrow=matchMedia('(max-width:850px)');
function closeMenu(returnFocus=false){
  nav.classList.remove('open');
  toggle.setAttribute('aria-expanded','false');
  if(returnFocus)toggle.focus()
}
toggle.addEventListener('click',()=>{
  const open=toggle.getAttribute('aria-expanded')==='true';
  nav.classList.toggle('open',!open);
  toggle.setAttribute('aria-expanded',String(!open))
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true')closeMenu(true)
});
document.addEventListener('click',e=>{
  if(!e.target.closest('.site-header'))closeMenu()
});
nav.addEventListener('click',e=>{
  if(e.target.closest('a'))closeMenu()
});
narrow.addEventListener('change',()=>closeMenu());
const sectionLinks=[...nav.querySelectorAll('a[href^="#"]')],sections=sectionLinks.map(link=>document.querySelector(link.getAttribute('href'))).filter(Boolean);
let sectionFrame=0;
function markSection(){
  sectionFrame=0;
  let current=sections[0];
  for(const section of sections)if(section.getBoundingClientRect().top<=innerHeight*.35)current=section;
  document.body.classList.toggle('away-from-home',!!current&&current.id!=='home');
  document.body.dataset.activeSection=current?.id||'home';
  for(const link of sectionLinks){
    if(current&&link.getAttribute('href')==='#'+current.id)link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
}
addEventListener('scroll',()=>{
  if(!sectionFrame)sectionFrame=requestAnimationFrame(markSection)
},{
  passive:true
});
addEventListener('resize',markSection);
markSection();
addEventListener('load',()=>requestAnimationFrame(markSection));
