import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['.'];
const skip = new Set(['.git', 'node_modules', '.ramiro-pass']);
const marker = 'RAMIRO_AUTH_FINAL_POLISH_2026_10_14';

const css = String.raw`<style id="ramiro-auth-final-polish">
/* ${marker} */
[hidden]{display:none!important}
body.rl-auth-page .rl-auth-card{max-width:680px;margin-left:auto;margin-right:auto;background:rgba(255,253,247,.97);border:1px solid rgba(15,67,51,.12);border-radius:28px;box-shadow:0 18px 50px rgba(14,46,37,.09);padding:clamp(20px,4vw,32px)!important;overflow:hidden}
body.rl-auth-page .rl-auth-native-tabs{display:none!important}
body.rl-auth-page .rl-auth-switch{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:6px;margin:0 0 26px;background:#eeece2;border:1px solid rgba(15,67,51,.08);border-radius:18px}
body.rl-auth-page .rl-auth-switch button{appearance:none;border:0;background:transparent;color:#53665d;min-height:50px;border-radius:13px;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer;transition:background .18s ease,color .18s ease,box-shadow .18s ease,transform .18s ease}
body.rl-auth-page .rl-auth-switch button[aria-selected="true"]{background:#fffdf8;color:#0c4333;box-shadow:0 5px 18px rgba(14,46,37,.08)}
body.rl-auth-page .rl-auth-switch button:active{transform:scale(.985)}
body.rl-auth-page .rl-auth-form{display:grid!important;gap:14px;margin:0!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
body.rl-auth-page .rl-auth-form label{display:block;margin:2px 0 -5px;color:#3f5d51;font-size:1rem;font-weight:800;line-height:1.25}
body.rl-auth-page .rl-auth-form input{box-sizing:border-box;width:100%;min-height:58px;margin:0!important;padding:13px 16px!important;border:1px solid #d0d8d4!important;border-radius:16px!important;background:#fff!important;color:#17382e!important;font:inherit;font-size:16px!important;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)!important;transition:border-color .16s ease,box-shadow .16s ease}
body.rl-auth-page .rl-auth-form input:focus{border-color:#276a55!important;box-shadow:0 0 0 3px rgba(39,106,85,.11)!important}
body.rl-auth-page .rl-auth-form button[type="submit"],body.rl-auth-page .rl-auth-form input[type="submit"]{appearance:none;width:100%;min-height:58px;margin:8px 0 0!important;border:0!important;border-radius:16px!important;background:#0b4333!important;color:#fff!important;font:inherit;font-size:1.06rem!important;font-weight:850!important;cursor:pointer;box-shadow:none!important}
body.rl-auth-page .rl-auth-forgot-link{appearance:none;border:0;background:transparent;color:#0c4333;text-decoration:underline;text-underline-offset:4px;font:inherit;font-weight:800;padding:4px 0 0;justify-self:start;cursor:pointer}
body.rl-auth-page .rl-auth-forgot-head{margin:0 0 4px}
body.rl-auth-page .rl-auth-forgot-head h2{margin:0 0 8px;color:#123f32;font-family:Georgia,'Times New Roman',serif;font-size:clamp(1.7rem,6vw,2.3rem);font-weight:500;line-height:1.03}
body.rl-auth-page .rl-auth-forgot-head p{margin:0 0 12px;color:#5d6e66;line-height:1.55}
body.rl-auth-page .rl-create-note{margin:14px 0 0!important;color:#52675e!important;font-size:.96rem!important;line-height:1.55!important}
body.rl-auth-page .rl-auth-back{appearance:none;border:0;background:transparent;color:#0c4333;text-decoration:underline;text-underline-offset:4px;font:inherit;font-weight:800;padding:0;margin:4px 0 12px;cursor:pointer}
@media (max-width:560px){body.rl-auth-page .rl-auth-card{margin-left:16px!important;margin-right:16px!important;border-radius:24px;padding:20px!important}body.rl-auth-page .rl-auth-switch{margin-bottom:22px}body.rl-auth-page .rl-auth-switch button{min-height:48px;padding:8px 10px;font-size:.96rem}body.rl-auth-page .rl-auth-form{gap:13px}body.rl-auth-page .rl-auth-form input{min-height:56px}body.rl-auth-page .rl-auth-form button[type="submit"],body.rl-auth-page .rl-auth-form input[type="submit"]{min-height:56px}}
</style>`;

const js = String.raw`<script id="ramiro-auth-final-polish-js">
(()=>{
  const marker='${marker}';
  const norm=v=>(v||'').replace(/\\s+/g,' ').trim().toLowerCase();
  const isSign=t=>/^(sign in|iniciar sesi[oó]n|ingresar)$/.test(norm(t));
  const isCreate=t=>/^(create account|crear cuenta)$/.test(norm(t));
  const isForgot=t=>/(forgot password|reset password|send reset|recover|recuperar|restablecer|olvidaste|contrase)/.test(norm(t));
  const allForms=[...document.querySelectorAll('form')];
  const submitText=f=>[...f.querySelectorAll('button,input[type="submit"]')].map(el=>el.tagName==='INPUT'?el.value:el.textContent).join(' | ');
  const signForm=allForms.find(f=>isSign(submitText(f)));
  const createForm=allForms.find(f=>isCreate(submitText(f)));
  let forgotForm=allForms.find(f=>isForgot(submitText(f))&&!isSign(submitText(f))&&!isCreate(submitText(f)));
  if(!forgotForm&&createForm){const i=allForms.indexOf(createForm);forgotForm=allForms.slice(i+1).find(f=>f.querySelector('input[type="email"]'))||null;}
  if(!signForm||!createForm) return;

  document.body.classList.add('rl-auth-page');
  [signForm,createForm,forgotForm].filter(Boolean).forEach(f=>f.classList.add('rl-auth-form'));

  let card=signForm.parentElement;
  while(card&&card!==document.body&&!card.contains(createForm)) card=card.parentElement;
  if(!card||card===document.body) card=signForm.parentElement;
  card.classList.add('rl-auth-card');

  const controls=[...document.querySelectorAll('button,a,[role="button"]')].filter(el=>!el.closest('form'));
  const nativeSign=controls.find(el=>isSign(el.textContent));
  const nativeCreate=controls.find(el=>isCreate(el.textContent));
  const nativeForgot=controls.find(el=>isForgot(el.textContent));
  let nativeHost=nativeSign?.parentElement||null;
  if(nativeHost){
    while(nativeHost&&nativeHost!==card){
      const c=[...nativeHost.querySelectorAll('button,a,[role="button"]')].filter(el=>!el.closest('form'));
      if(c.some(el=>isSign(el.textContent))&&c.some(el=>isCreate(el.textContent))) break;
      nativeHost=nativeHost.parentElement;
    }
    if(nativeHost&&nativeHost!==card) nativeHost.classList.add('rl-auth-native-tabs');
  }

  const switcher=document.createElement('div');
  switcher.className='rl-auth-switch';
  switcher.setAttribute('role','tablist');
  const signTab=document.createElement('button');
  const createTab=document.createElement('button');
  signTab.type=createTab.type='button';
  signTab.setAttribute('role','tab');createTab.setAttribute('role','tab');
  const syncLabels=()=>{signTab.textContent=(nativeSign?.textContent||'Sign in').trim();createTab.textContent=(nativeCreate?.textContent||'Create account').trim();if(forgotLink)forgotLink.textContent=(nativeForgot?.textContent||'Forgot password').trim();};
  switcher.append(signTab,createTab);
  (nativeHost?.parentElement||card).insertBefore(switcher,nativeHost||signForm);

  const forgotLink=document.createElement('button');
  forgotLink.type='button';forgotLink.className='rl-auth-forgot-link';
  const signSubmit=[...signForm.querySelectorAll('button,input[type="submit"]')].find(el=>isSign(el.tagName==='INPUT'?el.value:el.textContent));
  if(signSubmit) signSubmit.insertAdjacentElement('afterend',forgotLink); else signForm.append(forgotLink);

  let createNote=[...document.querySelectorAll('p,small,div')].find(el=>{
    const t=norm(el.textContent);return !el.querySelector('form')&&(t.includes('account benefits are optional')||t.includes('creating an account does not install')||t.includes('los beneficios de la cuenta'));
  });
  if(createNote) createNote.classList.add('rl-create-note');

  let forgotHead=null,back=null;
  if(forgotForm){
    forgotHead=document.createElement('div');forgotHead.className='rl-auth-forgot-head';
    forgotHead.innerHTML='<h2>Reset password</h2><p>Enter the email connected to your Ramiro Landscaping account.</p>';
    back=document.createElement('button');back.type='button';back.className='rl-auth-back';back.textContent='Back to sign in';
    forgotForm.insertAdjacentElement('beforebegin',forgotHead);forgotHead.insertAdjacentElement('afterend',back);
  }

  const setHidden=(el,v)=>{if(el)el.hidden=v;};
  const show=view=>{
    setHidden(signForm,view!=='sign');setHidden(createForm,view!=='create');setHidden(forgotForm,view!=='forgot');
    setHidden(forgotHead,view!=='forgot');setHidden(back,view!=='forgot');
    if(createNote) createNote.hidden=view!=='create';
    switcher.hidden=view==='forgot';
    signTab.setAttribute('aria-selected',String(view==='sign'));createTab.setAttribute('aria-selected',String(view==='create'));
    if(view==='sign') nativeSign?.click();
    if(view==='create') nativeCreate?.click();
    if(view==='forgot') nativeForgot?.click();
    requestAnimationFrame(()=>{const first=(view==='sign'?signForm:view==='create'?createForm:forgotForm)?.querySelector('input:not([type="hidden"])');if(first&&document.activeElement?.tagName!=='INPUT') first.focus({preventScroll:true});});
  };
  signTab.addEventListener('click',()=>show('sign'));
  createTab.addEventListener('click',()=>show('create'));
  forgotLink.addEventListener('click',()=>show('forgot'));
  back?.addEventListener('click',()=>show('sign'));

  syncLabels();
  if(nativeHost){new MutationObserver(syncLabels).observe(nativeHost,{subtree:true,childList:true,characterData:true});}
  const recovery=/recovery|reset|password/i.test(location.hash+location.search);
  show(recovery&&forgotForm?'forgot':'sign');
})();
</script>`;

function walk(dir, out=[]) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, out);
    else if (st.isFile() && p.endsWith('.html')) out.push(p);
  }
  return out;
}

let patched = 0;
for (const file of walk('.')) {
  let html = readFileSync(file, 'utf8');
  if (html.includes(marker)) continue;
  const target = html.includes('Keep your work with Ramiro organized') || html.includes('Account benefits are optional') || html.includes('Creating an account does not install the app');
  if (!target) continue;
  if (!html.includes('</head>') || !html.includes('</body>')) throw new Error(`Auth page structure is incomplete: ${file}`);
  html = html.replace('</head>', `${css}\n</head>`).replace('</body>', `${js}\n</body>`);
  writeFileSync(file, html);
  patched++;
  console.log(`Polished Ramiro account entry: ${file}`);
}

if (!patched) throw new Error('Ramiro account entry page was not found after build; refusing to publish an unverified auth polish.');
console.log(`Ramiro auth final polish applied to ${patched} page(s).`);
