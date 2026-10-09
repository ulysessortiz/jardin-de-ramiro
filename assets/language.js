
(() => {
  const supported = ['en','es'];
  const brand = 'Ramiro Landscaping';
  const brandReplacements = [
    [/Jardín de Ramiro/g, brand],
    [/Jardin de Ramiro/g, brand],
    [/JARDÍN DE RAMIRO/g, 'RAMIRO LANDSCAPING'],
    [/JARDIN DE RAMIRO/g, 'RAMIRO LANDSCAPING'],
    [/Ramiro’s Garden & Landscape Care/g, brand],
    [/Ramiro's Garden & Landscape Care/g, brand],
    [/Jardines y Paisajes de Ramiro/g, brand]
  ];
  const phoneByLanguage = {
    en: { dial: '+16572669726', display: '(657) 266-9726' },
    es: { dial: '+17145748095', display: '(714) 574-8095' }
  };
  const phoneHrefPattern = /^(tel|sms):\+1(?:6572669726|7145748095)(.*)$/;
  const displayPattern = /\(657\)\s*266-9726|\(714\)\s*574-8095/g;
  let saved; try { saved = localStorage.getItem('ramiro-language'); } catch (_) {}
  const browser = (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
  let lang = supported.includes(saved) ? saved : browser;
  const buttons = document.querySelectorAll('[data-set-lang]');
  const formLang = document.querySelector('input[name="language"]');
  const alts = document.querySelectorAll('[data-alt-en][data-alt-es]');

  const replaceBrand = value => {
    let next = String(value ?? '');
    brandReplacements.forEach(([pattern,replacement]) => { next = next.replace(pattern,replacement); });
    return next;
  };

  const applyBranding = (root = document) => {
    const scope = root.nodeType === Node.ELEMENT_NODE || root.nodeType === Node.DOCUMENT_NODE ? root : document;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(node => {
      const next = replaceBrand(node.nodeValue);
      if (next !== node.nodeValue) node.nodeValue = next;
    });

    const elements = scope.querySelectorAll ? scope.querySelectorAll('*') : [];
    elements.forEach(el => {
      [...el.attributes].forEach(attr => {
        const next = replaceBrand(attr.value);
        if (next !== attr.value) el.setAttribute(attr.name, next);
      });
    });

    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      const next = replaceBrand(script.textContent);
      if (next !== script.textContent) script.textContent = next;
    });

    document.querySelectorAll('meta[content]').forEach(meta => {
      const next = replaceBrand(meta.getAttribute('content'));
      if (next !== meta.getAttribute('content')) meta.setAttribute('content', next);
    });

    if (document.title) document.title = replaceBrand(document.title);
  };

  const routePhoneLinks = () => {
    const route = phoneByLanguage[lang] || phoneByLanguage.en;
    document.querySelectorAll('a[href^="tel:"],a[href^="sms:"]').forEach(link => {
      const raw = link.getAttribute('href') || '';
      const match = raw.match(phoneHrefPattern);
      if (match) link.setAttribute('href', `${match[1]}:${route.dial}${match[2] || ''}`);
      const walker = document.createTreeWalker(link, NodeFilter.SHOW_TEXT);
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(node => {
        node.nodeValue = (node.nodeValue || '').replace(displayPattern, route.display);
      });
    });
  };

  const setLanguage = (next) => {
    lang = supported.includes(next) ? next : 'en';
    document.body.classList.remove('lang-en','lang-es');
    document.body.classList.add(`lang-${lang}`);
    document.documentElement.lang = lang;
    try { localStorage.setItem('ramiro-language', lang); } catch (_) {}
    buttons.forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang)));
    if (formLang) formLang.value = lang;
    alts.forEach(img => img.alt = img.dataset[`alt${lang[0].toUpperCase()+lang.slice(1)}`] || '');
    applyBranding(document);
    document.title = replaceBrand(document.body.dataset['title' + (lang === 'es' ? 'Es' : 'En')] || 'Ramiro Landscaping | Orange County');
    routePhoneLinks();
    document.dispatchEvent(new CustomEvent('languagechange',{detail:lang}));
  };

  applyBranding(document);
  buttons.forEach(btn => btn.addEventListener('click', () => setLanguage(btn.dataset.setLang)));
  setLanguage(lang);
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  const observer = new MutationObserver(records => {
    records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) applyBranding(node);
      else if (node.nodeType === Node.TEXT_NODE) {
        const next = replaceBrand(node.nodeValue);
        if (next !== node.nodeValue) node.nodeValue = next;
      }
    }));
    routePhoneLinks();
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
const menu=document.querySelector('.menu-button'),links=document.querySelector('#menu-links');
if(menu&&links){menu.addEventListener('click',()=>{const open=menu.getAttribute('aria-expanded')!=='true';menu.setAttribute('aria-expanded',String(open));links.classList.toggle('open',open);});document.addEventListener('keydown',e=>{if(e.key==='Escape'){links.classList.remove('open');menu.setAttribute('aria-expanded','false');}});}
