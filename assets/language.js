
(() => {
  const supported = ['en','es'];
  let saved; try { saved = localStorage.getItem('ramiro-language'); } catch (_) {}
  const browser = (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  let lang = supported.includes(saved) ? saved : browser;
  const buttons = document.querySelectorAll('[data-set-lang]');
  const formLang = document.querySelector('input[name="language"]');
  const alts = document.querySelectorAll('[data-alt-en][data-alt-es]');
  const setLanguage = (next) => {
    lang = supported.includes(next) ? next : 'en';
    document.body.classList.remove('lang-en','lang-es');
    document.body.classList.add(`lang-${lang}`);
    document.documentElement.lang = lang;
    try { localStorage.setItem('ramiro-language', lang); } catch (_) {}
    document.dispatchEvent(new CustomEvent('languagechange',{detail:lang}));
    buttons.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang)));
    if (formLang) formLang.value = lang;
    alts.forEach(img => img.alt = img.dataset[`alt${lang[0].toUpperCase()+lang.slice(1)}`] || '');
    document.title = document.body.dataset['title' + (lang === 'es' ? 'Es' : 'En')] || 'Jardín de Ramiro | Orange County';
  };
  buttons.forEach(btn => btn.addEventListener('click', () => setLanguage(btn.dataset.setLang)));
  setLanguage(lang);
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
const menu=document.querySelector('.menu-button'),links=document.querySelector('#menu-links');
menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));links.classList.toggle('open',open);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){links.classList.remove('open');menu.setAttribute('aria-expanded','false');}});
