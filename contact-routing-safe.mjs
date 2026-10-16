import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT=process.cwd();
const KEEP='6572669726';
const E164='+16572669726';
const DISPLAY='(657) 266-9726';
const MARK='RAMIRO_TEXT_FIRST_CONTACT_2026_10_16_V2';
const SKIP=new Set(['.git','.github','node_modules','netlify','.netlify','account']);
const PHONE=/(?:\+?1[\s.\-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.\-]*\d{3}[\s.\-]*\d{4}/g;

function files(dir,out=[]){
  for(const e of readdirSync(dir,{withFileTypes:true})){
    const abs=join(dir,e.name), rel=relative(ROOT,abs), top=rel.split(sep)[0];
    if(SKIP.has(top)) continue;
    if(e.isDirectory()) files(abs,out);
    else if(e.isFile()&&rel.toLowerCase().endsWith('.html')) out.push(abs);
  }
  return out;
}

mkdirSync(join(ROOT,'assets'),{recursive:true});

const js=`(()=>{
const N='${E164}',D='${DISPLAY}';
const spanish=()=>document.body?.classList.contains('lang-es')||(document.documentElement.lang||'').toLowerCase().startsWith('es');
const setBilingual=(a,en,es)=>{const e=a.querySelector('[data-lang="en"]'),s=a.querySelector('[data-lang="es"]');if(e&&s){e.textContent=en;s.textContent=es;return true}return false};
const setPlain=(a,en,es)=>{if(/\\d{3}/.test(a.textContent||''))return;if(!setBilingual(a,en,es))a.textContent=spanish()?es:en};
const run=()=>{
  const hero=document.querySelector('a.hero-phone');
  if(hero){hero.href='sms:'+N;hero.classList.add('ramiro-text-primary');hero.setAttribute('aria-label',(spanish()?'Texto ':'Text ')+D);hero.innerHTML='<span data-lang="en">Text</span><span data-lang="es">Texto</span>: '+D}
  const texts=[...document.querySelectorAll('a[href^="sms:"]')];
  const calls=[...document.querySelectorAll('a[href^="tel:"]')];
  texts.forEach(a=>{a.href='sms:'+N;a.classList.add('ramiro-text-primary');a.setAttribute('aria-label',(spanish()?'Texto':'Text'));setPlain(a,'Text','Texto')});
  calls.forEach(a=>{a.href='tel:'+N;a.classList.add('ramiro-call-secondary');a.setAttribute('aria-label',spanish()?'Llamar; deje un mensaje de voz si no contestamos':'Call; leave a voicemail if there is no answer');setPlain(a,'Call','Llamar')});
  const parents=new Set([...texts,...calls].map(a=>a.parentElement).filter(Boolean));
  parents.forEach(p=>{const t=[...p.children].find(x=>x.matches?.('a[href^="sms:"]')),c=[...p.children].find(x=>x.matches?.('a[href^="tel:"]'));if(t&&c&&t.nextElementSibling!==c)p.insertBefore(t,c)});
};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();
document.addEventListener('click',e=>{if(e.target?.closest?.('[data-set-lang]'))setTimeout(run,80)});
})();`;

const css=`/* ${MARK} */\n.ramiro-text-primary{font-weight:800}.ramiro-call-secondary{font-weight:650}`;
writeFileSync(join(ROOT,'assets/contact-routing-20261016.js'),js,'utf8');
writeFileSync(join(ROOT,'assets/contact-routing-20261016.css'),css,'utf8');

const htmlFiles=files(ROOT); let complete=0;
for(const f of htmlFiles){
  let h=readFileSync(f,'utf8');
  h=h.replace(PHONE,DISPLAY);
  h=h.replace(/(href\s*=\s*["'](?:tel|sms):)[^"']*(["'])/gi,'$1'+E164+'$2');
  h=h.replace(/("telephone"\s*:\s*")[^"]*(")/gi,'$1'+E164+'$2');
  h=h.replace(/Textoo+/gi,'Texto').replace(/Llamar(?:\s*\/\s*buz[oó]n)+/gi,'Llamar').replace(/Call(?:\s*\/\s*voicemail)+/gi,'Call');
  if(/class=["'][^"']*hero-phone[^"']*["']/i.test(h)){
    h=h.replace(/<a([^>]*class=["'][^"']*hero-phone[^"']*["'][^>]*)>[\s\S]*?<\/a>/i,(m,attrs)=>{
      let clean=attrs.replace(/\s+href=["'][^"']*["']/i,'');
      return '<a'+clean+' href="sms:'+E164+'"><span data-lang="en">Text</span><span data-lang="es">Texto</span>: '+DISPLAY+'</a>';
    });
  }
  if(h.includes('</head>')&&h.includes('</body>')){
    complete++;
    if(!h.includes(MARK)){
      h=h.replace('</head>','<link rel="stylesheet" href="/assets/contact-routing-20261016.css" data-contact-routing="'+MARK+'">\n</head>');
      h=h.replace('</body>','<script src="/assets/contact-routing-20261016.js" data-contact-routing="'+MARK+'" defer></script>\n</body>');
    }
  }
  writeFileSync(f,h,'utf8');
}

if(!complete)throw new Error('No complete public pages found for protected contact routing.');
const bad=[];
for(const f of htmlFiles){
  const h=readFileSync(f,'utf8');
  for(const m of h.matchAll(PHONE)){
    const d=m[0].replace(/\D/g,'').slice(-10);
    if(d&&d!==KEEP)bad.push(relative(ROOT,f)+': '+m[0]);
  }
  for(const m of h.matchAll(/href\s*=\s*["'](?:tel|sms):([^"']*)["']/gi)){
    const d=m[1].replace(/\D/g,'').slice(-10);
    if(d!==KEEP)bad.push(relative(ROOT,f)+': '+m[0]);
  }
  if(/Textoo+|buz[oó]n\s*\/\s*buz[oó]n|voicemail\s*\/\s*voicemail/i.test(h))bad.push(relative(ROOT,f)+': duplicated contact label');
}
if(bad.length)throw new Error('Contact verification failed:\n'+bad.slice(0,30).join('\n'));
const home=readFileSync(join(ROOT,'index.html'),'utf8');
if(!home.includes('href="sms:'+E164+'"><span data-lang="en">Text</span><span data-lang="es">Texto</span>: '+DISPLAY+'</a>'))throw new Error('Homepage hero is not exact Text/Texto-first contact.');
if(!home.includes(MARK))throw new Error('Homepage contact routing injection missing.');
console.log('Protected contact routing verified: exact Text/Texto first, Call/Llamar secondary, only '+DISPLAY+' public, QR destination untouched.');
