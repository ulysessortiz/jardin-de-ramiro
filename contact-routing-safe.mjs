import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT=process.cwd();
const KEEP='6572669726';
const E164='+16572669726';
const DISPLAY='(657) 266-9726';
const MARK='RAMIRO_TEXT_FIRST_CONTACT_2026_10_15';
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
const N='${E164}',D='${DISPLAY}',M='${MARK}';
const es=()=>{if((document.documentElement.lang||'').toLowerCase().startsWith('es'))return true;const b=[...document.querySelectorAll('button,a')].find(x=>/^(EN|ES)$/.test((x.textContent||'').trim()));return (b?.textContent||'').trim()==='EN'};
const relabel=(a,t)=>{a.setAttribute('aria-label',t);const s=(a.textContent||'').trim();if(s&&s.length<28&&!/\\d{3}/.test(s)){const w=document.createTreeWalker(a,NodeFilter.SHOW_TEXT);let n,last;while(n=w.nextNode())if((n.nodeValue||'').trim())last=n;if(last)last.nodeValue=last.nodeValue.replace(/Call(?: now)?|Llamar(?: ahora)?|Text(?: us)?|Texto|SMS|Mensaje/gi,t)}};
const run=()=>{const spanish=es(),texts=[...document.querySelectorAll('a[href^="sms:"]')],calls=[...document.querySelectorAll('a[href^="tel:"]')];texts.forEach(a=>{a.href='sms:'+N;a.classList.add('ramiro-text-primary');relabel(a,spanish?'Texto':'Text')});calls.forEach(a=>{a.href='tel:'+N;a.classList.add('ramiro-call-secondary');relabel(a,spanish?'Llamar / buzón':'Call / voicemail')});const ps=new Set([...texts,...calls].map(a=>a.parentElement).filter(Boolean));ps.forEach(p=>{const t=[...p.children].find(x=>x.matches?.('a[href^="sms:"]')),c=[...p.children].find(x=>x.matches?.('a[href^="tel:"]'));if(t&&c)p.insertBefore(t,c)});if((location.pathname==='/'||location.pathname==='/index.html')&&!document.getElementById(M)){const a=document.createElement('aside');a.id=M;a.className='ramiro-contact-note';a.innerHTML=spanish?'<strong>¿La forma más rápida? Envíenos un texto.</strong><span>Si prefiere llamar y no podemos contestar, deje su nombre, número de teléfono y una breve descripción del trabajo que desea realizar.</span><div><a class="ramiro-text-primary" href="sms:${E164}">Enviar texto</a><a class="ramiro-call-secondary" href="tel:${E164}">Llamar / buzón</a></div>':'<strong>Fastest way to reach us? Send a text.</strong><span>If you prefer to call and we miss you, please leave your name, phone number, and a short description of the work you would like done.</span><div><a class="ramiro-text-primary" href="sms:${E164}">Text us</a><a class="ramiro-call-secondary" href="tel:${E164}">Call / voicemail</a></div>';const f=document.querySelector('footer');f?.parentNode?f.parentNode.insertBefore(a,f):document.body.appendChild(a)}};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run,{once:true}):run();document.addEventListener('click',e=>{if(/^(EN|ES)$/.test((e.target?.textContent||'').trim()))setTimeout(run,80)})})();`;
const css=`/* ${MARK} */\n.ramiro-text-primary{font-weight:800}.ramiro-call-secondary{font-weight:650}.ramiro-contact-note{max-width:1180px;margin:1.25rem auto;padding:1rem 1.15rem;border:1px solid rgba(18,62,48,.14);border-radius:1.1rem;background:rgba(248,246,237,.78);color:#123e30;display:grid;gap:.45rem;line-height:1.5}.ramiro-contact-note span{font-size:.92rem;opacity:.84}.ramiro-contact-note div{display:flex;gap:.65rem;flex-wrap:wrap;margin-top:.25rem}.ramiro-contact-note a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:999px;padding:.7rem 1rem;border:1px solid rgba(18,62,48,.18)}.ramiro-contact-note .ramiro-text-primary{background:#0b3b2f;color:#fff;border-color:#0b3b2f}.ramiro-contact-note .ramiro-call-secondary{background:transparent;color:#123e30}@media(max-width:640px){.ramiro-contact-note{margin:1rem}.ramiro-contact-note div{display:grid;grid-template-columns:1fr 1fr}}`;
writeFileSync(join(ROOT,'assets/contact-routing-20261015.js'),js,'utf8');
writeFileSync(join(ROOT,'assets/contact-routing-20261015.css'),css,'utf8');

const htmlFiles=files(ROOT); let complete=0;
for(const f of htmlFiles){let h=readFileSync(f,'utf8');h=h.replace(/(href\s*=\s*["'](?:tel|sms):)[^"']*(["'])/gi,'$1'+E164+'$2');h=h.replace(PHONE,DISPLAY);if(h.includes('</head>')&&h.includes('</body>')){complete++;if(!h.includes(MARK)){h=h.replace('</head>','<link rel="stylesheet" href="/assets/contact-routing-20261015.css" data-contact-routing="'+MARK+'">\n</head>');h=h.replace('</body>','<script src="/assets/contact-routing-20261015.js" data-contact-routing="'+MARK+'" defer></script>\n</body>')}}writeFileSync(f,h,'utf8')}
if(!complete)throw new Error('No complete public pages found for protected contact routing.');
const bad=[];for(const f of htmlFiles){const h=readFileSync(f,'utf8');for(const m of h.matchAll(PHONE)){const d=m[0].replace(/\D/g,'').slice(-10);if(d&&d!==KEEP)bad.push(relative(ROOT,f)+': '+m[0])}for(const m of h.matchAll(/href\s*=\s*["'](?:tel|sms):([^"']*)["']/gi)){const d=m[1].replace(/\D/g,'').slice(-10);if(d!==KEEP)bad.push(relative(ROOT,f)+': '+m[0])}}
if(bad.length)throw new Error('Non-approved public phone route remains:\n'+bad.slice(0,20).join('\n'));
const home=readFileSync(join(ROOT,'index.html'),'utf8');if(!home.includes(MARK))throw new Error('Homepage contact routing injection missing.');
console.log('Protected contact routing verified: Text first, Call/voicemail secondary, only '+DISPLAY+' public, QR destination unchanged.');
