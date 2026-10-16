import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const KEEP_DIGITS = '6572669726';
const KEEP_TEL = '+16572669726';
const DISPLAY = '(657) 266-9726';
const MARKER = 'RAMIRO_TEXT_FIRST_CONTACT_2026_10_15';
const root = process.cwd();
const skipTop = new Set(['.git', '.github', 'node_modules', 'netlify', '.netlify', 'account']);
const phonePattern = /(?:\+?1[\s.\-]*)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.\-]*\d{3}[\s.\-]*\d{4}/g;
const hrefPattern = /(href\s*=\s*["'](?:tel|sms):)[^"']*(["'])/gi;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    const rel = relative(root, abs);
    const top = rel.split(sep)[0];
    if (skipTop.has(top)) continue;
    if (entry.isDirectory()) walk(abs, out);
    else if (entry.isFile() && rel.toLowerCase().endsWith('.html')) out.push(abs);
  }
  return out;
}

const assetDir = join(root, 'assets');
mkdirSync(assetDir, { recursive: true });

const runtime = `(() => {
  const KEEP='${KEEP_TEL}', DISPLAY='${DISPLAY}', MARKER='${MARKER}';
  const phoneRe=/(?:\\+?1[\\s.\\-]*)?(?:\\(\\s*\\d{3}\\s*\\)|\\d{3})[\\s.\\-]*\\d{3}[\\s.\\-]*\\d{4}/g;
  const currentSpanish=()=>{
    if ((document.documentElement.lang||'').toLowerCase().startsWith('es')) return true;
    const toggle=[...document.querySelectorAll('button,a')].find(el=>/^(EN|ES)$/.test((el.textContent||'').trim()));
    return (toggle?.textContent||'').trim()==='EN';
  };
  const label=(node, text)=>{
    const simple=(node.textContent||'').trim();
    if (simple && simple.length<=32 && !/\\d{3}/.test(simple)) {
      const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);
      let n, chosen=null;
      while((n=walker.nextNode())) if((n.nodeValue||'').trim()) chosen=n;
      if(chosen) chosen.nodeValue=chosen.nodeValue.replace(/Call(?: now)?|Llamar(?: ahora)?|Text(?: us)?|Texto|SMS|Mensaje/gi,text);
    }
    node.setAttribute('aria-label',text);
  };
  const normalizeVisiblePhones=()=>{
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){
      const p=n.parentElement?.tagName;
      return ['SCRIPT','STYLE','TEXTAREA','INPUT','OPTION'].includes(p)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;
    }});
    let n; while((n=walker.nextNode())) if(phoneRe.test(n.nodeValue||'')) { phoneRe.lastIndex=0; n.nodeValue=(n.nodeValue||'').replace(phoneRe,DISPLAY); }
  };
  const apply=()=>{
    const es=currentSpanish();
    const texts=[...document.querySelectorAll('a[href^="sms:"]')];
    const calls=[...document.querySelectorAll('a[href^="tel:"]')];
    texts.forEach(a=>{a.setAttribute('href','sms:'+KEEP);a.classList.add('ramiro-text-primary');label(a,es?'Texto':'Text');});
    calls.forEach(a=>{a.setAttribute('href','tel:'+KEEP);a.classList.add('ramiro-call-secondary');label(a,es?'Llamar / buzón':'Call / voicemail');});
    const parents=new Set([...texts,...calls].map(a=>a.parentElement).filter(Boolean));
    parents.forEach(parent=>{
      const sms=[...parent.children].find(el=>el.matches?.('a[href^="sms:"]'));
      const tel=[...parent.children].find(el=>el.matches?.('a[href^="tel:"]'));
      if(sms&&tel&&sms.nextElementSibling!==tel) parent.insertBefore(sms,tel);
    });
    normalizeVisiblePhones();
    if ((location.pathname==='/'||location.pathname==='/index.html') && !document.getElementById(MARKER)) {
      const note=document.createElement('aside'); note.id=MARKER; note.className='ramiro-contact-note';
      note.innerHTML=es
        ? '<strong>¿La forma más rápida? Envíenos un texto.</strong><span>Si prefiere llamar y no podemos contestar, deje su nombre, número de teléfono y una breve descripción del trabajo que desea realizar.</span><div><a class="ramiro-text-primary" href="sms:${KEEP_TEL}">Enviar texto</a><a class="ramiro-call-secondary" href="tel:${KEEP_TEL}">Llamar / buzón</a></div>'
        : '<strong>Fastest way to reach us? Send a text.</strong><span>If you prefer to call and we miss you, please leave your name, phone number, and a short description of the work you would like done.</span><div><a class="ramiro-text-primary" href="sms:${KEEP_TEL}">Text us</a><a class="ramiro-call-secondary" href="tel:${KEEP_TEL}">Call / voicemail</a></div>';
      const footer=document.querySelector('footer');
      if(footer?.parentNode) footer.parentNode.insertBefore(note,footer); else document.body.appendChild(note);
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true}); else apply();
  document.addEventListener('click',e=>{if((e.target?.textContent||'').trim().match(/^(EN|ES)$/)) setTimeout(apply,60);});
})();
`;

const css = `/* ${MARKER} */
.ramiro-text-primary{font-weight:800}
.ramiro-call-secondary{font-weight:650}
.ramiro-contact-note{max-width:1180px;margin:1.25rem auto;padding:1rem 1.15rem;border:1px solid rgba(18,62,48,.14);border-radius:1.1rem;background:rgba(248,246,237,.78);color:#123e30;display:grid;gap:.45rem;line-height:1.5}
.ramiro-contact-note strong{font-size:1rem}
.ramiro-contact-note span{font-size:.92rem;opacity:.84}
.ramiro-contact-note div{display:flex;gap:.65rem;flex-wrap:wrap;margin-top:.25rem}
.ramiro-contact-note a{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;border-radius:999px;padding:.7rem 1rem;border:1px solid rgba(18,62,48,.18)}
.ramiro-contact-note .ramiro-text-primary{background:#0b3b2f;color:#fff;border-color:#0b3b2f}
.ramiro-contact-note .ramiro-call-secondary{background:transparent;color:#123e30}
@media(max-width:640px){.ramiro-contact-note{margin:1rem}.ramiro-contact-note div{display:grid;grid-template-columns:1fr 1fr}.ramiro-contact-note a{padding:.75rem .7rem}}
`;

writeFileSync(join(assetDir, 'contact-routing-20261015.js'), runtime, 'utf8');
writeFileSync(join(assetDir, 'contact-routing-20261015.css'), css, 'utf8');

const htmlFiles = walk(root);
if (!htmlFiles.length) throw new Error('Protected contact routing found no public HTML to verify.');
let patched = 0;
for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(hrefPattern, `$1${KEEP_TEL}$2`);
  html = html.replace(phonePattern, DISPLAY);
  if (!html.includes(MARKER)) {
    if (!html.includes('</head>') || !html.includes('</body>')) throw new Error(`Protected contact routing cannot safely inject ${relative(root,file)}.`);
    html = html.replace('</head>', `<link rel="stylesheet" href="/assets/contact-routing-20261015.css" data-contact-routing="${MARKER}">\n</head>`);
    html = html.replace('</body>', `<script src="/assets/contact-routing-20261015.js" data-contact-routing="${MARKER}" defer></script>\n</body>`);
  }
  if (html !== before) { writeFileSync(file, html, 'utf8'); patched++; }
}

const violations = [];
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(phonePattern)) {
    const digits = match[0].replace(/\D/g,'').slice(-10);
    if (digits && digits !== KEEP_DIGITS) violations.push(`${relative(root,file)}: ${match[0]}`);
  }
  for (const match of html.matchAll(/href\s*=\s*["'](?:tel|sms):([^"']*)["']/gi)) {
    const digits = match[1].replace(/\D/g,'').slice(-10);
    if (digits !== KEEP_DIGITS) violations.push(`${relative(root,file)}: ${match[0]}`);
  }
}
if (violations.length) throw new Error(`Protected contact routing blocked deployment. Non-approved public phone route(s) remain:\n${violations.slice(0,20).join('\n')}`);

const index = join(root,'index.html');
const indexHtml = readFileSync(index,'utf8');
if (!indexHtml.includes(MARKER)) throw new Error('Homepage contact routing marker missing.');
console.log(`Protected text-first contact routing applied to ${patched} public HTML files. Only ${DISPLAY} remains public. QR destination/query behavior preserved.`);
