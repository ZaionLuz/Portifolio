'use strict';
const WHATSAPP='5588997173005';
const nav=document.querySelector('#main-nav');
const toggle=document.querySelector('.menu-toggle');
const navLinks=[...document.querySelectorAll('.nav-link')];
if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');});nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Abrir menu');}));document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}});document.addEventListener('click',e=>{if(!nav.contains(e.target)&&!toggle.contains(e.target)){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');}});}
const sectionObserver=('IntersectionObserver' in window)?new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){const id=entry.target.id;navLinks.forEach(link=>{const active=link.getAttribute('href')==='#'+id;link.classList.toggle('current',active);if(active)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}}},{rootMargin:'-20% 0px -70% 0px'}):null;
if(sectionObserver)document.querySelectorAll('section[id],header[id]').forEach(s=>sectionObserver.observe(s));
const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reduceMotion&&'IntersectionObserver' in window){const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target);}}},{threshold:.08,rootMargin:'0px 0px 80px 0px'});document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));}else document.querySelectorAll('.reveal').forEach(el=>el.classList.add('visible'));
const filters=[...document.querySelectorAll('.filter')];const projects=[...document.querySelectorAll('.project-card')];
filters.forEach(btn=>btn.addEventListener('click',()=>{const filter=btn.dataset.filter;filters.forEach(f=>{const active=f===btn;f.classList.toggle('active',active);f.setAttribute('aria-pressed',String(active));});projects.forEach(project=>{project.hidden=filter!=='todos'&&project.dataset.category!==filter;});}));
const info={
 helly:{tag:'IDENTIDADE VISUAL · LOGO FINAL',title:'Helly Viagens',image:'assets/helly-viagens-sem-fundo.png',alt:'Logo preto e dourado da Helly Viagens com emblema de carro',description:'Identidade visual desenvolvida para a Helly Viagens, com emblema circular preto e dourado e uma composição que remete a transporte e viagens. A imagem exibida é a versão final da logo fornecida para este portfólio.'},
 marta:{tag:'IDENTIDADE VISUAL · PROPOSTA',title:'Dra. Maria Marta Andrade',image:'assets/marta-andrade-logo.webp',alt:'Logo circular em vinho rosado para a Dra. Maria Marta Andrade',description:'Estudo de identidade visual para um consultório odontológico, com monograma, paleta vinho rosado e composição elegante. Apresentado como proposta visual; a publicação ou adoção definitiva pela profissional não foi confirmada.'},
 vertice:{tag:'SITE INSTITUCIONAL · DEMONSTRAÇÃO',title:'Vértice Metal',image:'assets/vertice-metal-demo.webp',alt:'Interface demonstrativa de website para metalúrgica',description:'Demonstração de site institucional com apresentação dos serviços, navegação objetiva e foco em facilitar o primeiro contato. Projeto conceitual de portfólio, sem alegação de contratação.'},
 aurora:{tag:'LANDING PAGE · DEMONSTRAÇÃO',title:'Aurora Odontologia',image:'assets/aurora-odontologia-demo.webp',alt:'Demonstração de landing page para odontologia',description:'Conceito de landing page de odontologia criado para explorar direção de arte, hierarquia visual, responsividade e chamadas para contato. Trata-se de uma demonstração de design e desenvolvimento.'}
};
const dialog=document.querySelector('#project-dialog');const closeBtn=dialog?.querySelector('.dialog-close');let previouslyFocused=null;
function openProject(key){const p=info[key];if(!dialog||!p)return;previouslyFocused=document.activeElement;dialog.querySelector('#dialog-tag').textContent=p.tag;dialog.querySelector('#dialog-title').textContent=p.title;dialog.querySelector('#dialog-description').textContent=p.description;const img=dialog.querySelector('#dialog-image');img.src=p.image;img.alt=p.alt;dialog.querySelector(".dialog-image-wrap")?.classList.toggle("badge-preview",key==="helly"||key==="marta");dialog.showModal();document.body.classList.add('dialog-open');closeBtn?.focus();}
function closeProject(){if(!dialog?.open)return;dialog.close();document.body.classList.remove('dialog-open');previouslyFocused?.focus();}
document.querySelectorAll('.project-open').forEach(btn=>btn.addEventListener('click',()=>openProject(btn.dataset.project)));
closeBtn?.addEventListener('click',closeProject);dialog?.addEventListener('click',e=>{if(e.target===dialog)closeProject();});dialog?.addEventListener('close',()=>{document.body.classList.remove('dialog-open');previouslyFocused?.focus();});dialog?.querySelector('#dialog-cta')?.addEventListener('click',closeProject);
const select=document.querySelector('#service');document.querySelectorAll('[data-service]').forEach(link=>link.addEventListener('click',()=>{if(select){select.value=link.dataset.service;}}));
const form=document.querySelector('#contact-form');form?.addEventListener('submit',e=>{e.preventDefault();if(!form.reportValidity())return;const name=form.querySelector('#name').value.trim();const service=form.querySelector('#service').value;const message=form.querySelector('#message').value.trim();if(!name||!service||!message)return;const text=`Olá, Zaion! Vi seu portfólio e gostaria de solicitar um orçamento.\n\n*Nome:* ${name}\n*Serviço:* ${service}\n*Projeto:* ${message}`;const url=`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;const newTab=window.open(url,'_blank','noopener,noreferrer');if(!newTab)window.location.href=url;});
const year=document.querySelector('#year');if(year)year.textContent=String(new Date().getFullYear());


// Faixa de serviços: contínua, sem botão e com velocidade adequada à leitura.
(function startServiceTicker(){
  const track=document.querySelector('.ticker-track');
  const group=track?.querySelector('.ticker-group');
  if(!track||!group) return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let offset=0;
  let previous=0;
  let width=group.getBoundingClientRect().width;
  const resize=()=>{width=group.getBoundingClientRect().width||1;offset=offset%width;};
  if('ResizeObserver' in window)new ResizeObserver(resize).observe(group);
  else window.addEventListener('resize',resize,{passive:true});
  const frame=(time)=>{
    if(!previous)previous=time;
    const dt=Math.min((time-previous)/1000,.06);previous=time;
    if(document.visibilityState!=='hidden'&&width>0){
      offset=(offset+32*dt)%width;
      track.style.transform=`translate3d(${-offset}px,0,0)`;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
