(()=>{
  const body=document.body; const supported=['en','es'];
  const safeGet=()=>{try{return localStorage.getItem('ramiro-language')}catch(e){return null}};
  const safeSet=(v)=>{try{localStorage.setItem('ramiro-language',v)}catch(e){}};
  let lang=supported.includes(safeGet())?safeGet():((navigator.language||'en').toLowerCase().startsWith('es')?'es':'en');
  function setLang(next){lang=supported.includes(next)?next:'en'; body.classList.remove('lang-en','lang-es');body.classList.add('lang-'+lang);document.documentElement.lang=lang;safeSet(lang);document.querySelectorAll('[data-set-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.setLang===lang)));document.querySelectorAll('input[name="language"]').forEach(i=>i.value=lang);document.dispatchEvent(new CustomEvent('ramiro:language',{detail:{lang}}));}
  document.querySelectorAll('[data-set-lang]').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.setLang)));
  const toggle=document.querySelector('[data-nav-toggle]'), nav=document.querySelector('.nav'); if(toggle&&nav){toggle.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle.setAttribute('aria-expanded','false')}));}
  document.querySelectorAll('[data-year]').forEach(el=>el.textContent='2026');
  setLang(lang);
  const slots=[...document.querySelectorAll('[data-legacy-image]')];
  if(slots.length){fetch('/index.html',{cache:'force-cache'}).then(r=>r.text()).then(t=>{const d=new DOMParser().parseFromString(t,'text/html');const imgs=[...d.querySelectorAll('img')].filter(i=>/^data:image\/(webp|png|jpeg)/.test(i.getAttribute('src')||''));slots.forEach(slot=>{const n=Number(slot.dataset.legacyImage);const src=imgs[n]?.getAttribute('src');if(src){slot.src=src;slot.removeAttribute('data-loading')}})}).catch(()=>{});}
})();