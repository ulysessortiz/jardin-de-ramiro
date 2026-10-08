(()=>{
  const slots=[...document.querySelectorAll('[data-legacy-image]')];
  if(!slots.length) return;
  fetch('/legacy-master.html',{cache:'force-cache'})
    .then(r=>{if(!r.ok) throw new Error('legacy source unavailable'); return r.text();})
    .then(t=>{
      const d=new DOMParser().parseFromString(t,'text/html');
      const imgs=[...d.querySelectorAll('img')].map(i=>i.getAttribute('src')||'').filter(s=>/^data:image\/(?:webp|png|jpeg|svg\+xml)/i.test(s));
      slots.forEach(slot=>{const n=Number(slot.dataset.legacyImage); if(imgs[n]) slot.src=imgs[n];});
    })
    .catch(()=>{});
})();
