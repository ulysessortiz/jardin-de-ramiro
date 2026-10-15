import {
  signup, login, logout, getUser, handleAuthCallback,
  requestPasswordRecovery, updateUser, getSettings
} from '@netlify/identity';

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = v => v == null || v === '' ? '—' : new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v));
const date = v => v ? new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle: String(v).includes('T') ? 'short' : undefined}).format(new Date(v)) : '—';
const shortDate = v => v ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(v)) : '—';
const timeOnly = v => v ? new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(v)) : '—';
const safe = v => esc(v || '');
const pct = v => `${Number(v || 0).toFixed(Number(v||0)%1 ? 1 : 0)}%`;

let state = null;
let currentSection = 'today';
let authUser = null;
let installPrompt = null;
let liveSource = null;
let draftLeadId = '';
let draftJobId = '';
let draftQuoteId = '';
let trafficTimer = null;
let lang = (()=>{try{return localStorage.getItem('ramiro-language')||'en'}catch{return 'en'}})();

const T = {
  en:{website:'Website',signout:'Sign out',signin:'Sign in',create:'Create account',forgot:'Forgot password',today:'Today',visitors:'Visitors',leads:'Leads',quotes:'Quotes',jobs:'Jobs',customers:'Customers',messages:'Messages',billing:'Billing',contracts:'Contracts',finance:'Finance',growth:'Growth',intelligence:'Intelligence',profile:'Profile',requests:'Requests',history:'History',install:'Install app',hello:'Good to see you',memberSub:'Your requests, messages, work and billing in one place.',ownerSub:'Your live operating view of Ramiro Landscaping.',ramiroSub:'Today’s work, customers, billing and field updates.',empty:'Nothing here yet.',save:'Save',send:'Send',review:'Review',open:'Open',optional:'Optional',live:'Live sync'},
  es:{website:'Sitio',signout:'Salir',signin:'Entrar',create:'Crear cuenta',forgot:'Olvidé mi contraseña',today:'Hoy',visitors:'Visitas',leads:'Prospectos',quotes:'Cotizaciones',jobs:'Trabajos',customers:'Clientes',messages:'Mensajes',billing:'Facturación',contracts:'Contratos',finance:'Finanzas',growth:'Crecimiento',intelligence:'Inteligencia',profile:'Perfil',requests:'Solicitudes',history:'Historial',install:'Instalar app',hello:'Qué gusto verte',memberSub:'Tus solicitudes, mensajes, trabajos y facturación en un solo lugar.',ownerSub:'Tu centro operativo en vivo de Ramiro Landscaping.',ramiroSub:'Trabajo de hoy, clientes, facturación y actualizaciones.',empty:'Todavía no hay nada aquí.',save:'Guardar',send:'Enviar',review:'Revisar',open:'Abrir',optional:'Opcional',live:'Sincronización en vivo'}
};
const tr = key => T[lang]?.[key] || T.en[key] || key;
const L = (en,es) => lang==='es' ? es : en;
const toast = msg => { const el=$('#toast'); if(!el)return; el.textContent=msg; el.hidden=false; clearTimeout(el._t); el._t=setTimeout(()=>el.hidden=true,3600); };
const setAuthStatus = msg => { const el=$('#auth-status'); if(el) el.textContent=msg || ''; };

async function api(method='GET', body){
  const init={method,headers:{'accept':'application/json'}};
  if(body){init.headers['content-type']='application/json';init.body=JSON.stringify(body)}
  const res=await fetch('/api/account',init);
  const data=await res.json().catch(()=>({ok:false,error:`HTTP ${res.status}`}));
  if(!res.ok||data.ok===false) throw new Error(data.error||`Request failed (${res.status})`);
  return data;
}
async function trafficApi(){
  const res=await fetch('/api/owner-traffic',{headers:{accept:'application/json'},cache:'no-store'});
  const data=await res.json().catch(()=>({ok:false,error:`HTTP ${res.status}`}));
  if(!res.ok||data.ok===false) throw new Error(data.error||`Traffic request failed (${res.status})`);
  return data;
}
async function act(action, payload={}){
  const out=await api('POST',{action,...payload});
  await refreshState(false,false);
  return out;
}

function setLanguage(next){
  lang=next==='es'?'es':'en';
  try{localStorage.setItem('ramiro-language',lang)}catch{}
  document.documentElement.lang=lang;
  $('#account-lang').textContent=lang==='en'?'ES':'EN';
  if(state) renderPortal();
}
function authTabs(tab){
  $$('[data-auth-tab]').forEach(b=>b.classList.toggle('active',b.dataset.authTab===tab));
  ['login','signup','forgot'].forEach(id=>$('#'+id+'-form').hidden=id!==tab);
  $('#reset-form').hidden=true;
}
async function initializeAuth(){
  $('#account-lang').addEventListener('click',()=>setLanguage(lang==='en'?'es':'en'));
  $$('[data-auth-tab]').forEach(b=>b.addEventListener('click',()=>authTabs(b.dataset.authTab)));
  $('#logout-button').addEventListener('click',async()=>{await logout();try{const regs=await navigator.serviceWorker?.getRegistrations?.();regs?.forEach(r=>r.unregister())}catch{}location.href='/account/'});
  $('#login-form').addEventListener('submit',async e=>{e.preventDefault();setAuthStatus(L('Signing in…','Entrando…'));const fd=new FormData(e.currentTarget);try{await login(fd.get('email'),fd.get('password'));location.reload()}catch(err){setAuthStatus(err.message)}});
  $('#signup-form').addEventListener('submit',async e=>{e.preventDefault();setAuthStatus(L('Creating account…','Creando cuenta…'));const fd=new FormData(e.currentTarget);try{await signup(fd.get('email'),fd.get('password'),{full_name:fd.get('name')});setAuthStatus(L('Account created. Check your email if confirmation is required, then sign in.','Cuenta creada. Revisa tu correo si se requiere confirmación y después entra.'));authTabs('login')}catch(err){setAuthStatus(err.message)}});
  $('#forgot-form').addEventListener('submit',async e=>{e.preventDefault();setAuthStatus(L('Sending reset link…','Enviando enlace…'));const fd=new FormData(e.currentTarget);try{await requestPasswordRecovery(fd.get('email'));setAuthStatus(L('Check your email for the password reset link.','Revisa tu correo para restablecer la contraseña.'))}catch(err){setAuthStatus(err.message)}});
  $('#reset-form').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);setAuthStatus(L('Updating password…','Actualizando contraseña…'));try{await updateUser({password:fd.get('password')});setAuthStatus(L('Password updated.','Contraseña actualizada.'));setTimeout(()=>location.href='/account/',800)}catch(err){setAuthStatus(err.message)}});
  try{const callback=await handleAuthCallback();if(callback?.type==='recovery'){$('#login-form').hidden=$('#signup-form').hidden=$('#forgot-form').hidden=true;$('#reset-form').hidden=false;setAuthStatus(L('Choose a new password.','Elige una contraseña nueva.'))}}catch(err){setAuthStatus(err.message)}
  try{await getSettings()}catch(err){setAuthStatus(L('Account service is not active yet. Ramiro Landscaping can still receive quote requests normally.','El servicio de cuenta todavía no está activo. Ramiro Landscaping aún puede recibir solicitudes normalmente.'))}
  try{authUser=await getUser()}catch{authUser=null}
  if(authUser) await enterPortal();
}
async function enterPortal(){
  $('#auth-view').hidden=true;$('#portal-view').hidden=false;$('#logout-button').hidden=false;
  await refreshState(true,true);
  setupLiveSync();
  setupPwaEligibility();
  clearInterval(trafficTimer);
  trafficTimer=setInterval(()=>{if(state?.mode==='owner'&&['today','visitors','growth'].includes(currentSection))refreshTraffic(false)},90000);
}
async function refreshState(initial=false,loadTraffic=false){
  try{
    const priorTraffic=state?.traffic;
    state=await api();
    if(state.mode==='owner'){
      state.traffic=priorTraffic||null;
      if(loadTraffic||!state.traffic){try{state.traffic=await trafficApi()}catch(err){console.warn(err)}}
    }
    if(initial) currentSection=state.mode==='owner'?'today':'home';
    renderPortal();
  }catch(err){toast(err.message)}
}
async function refreshTraffic(showToast=true){
  if(state?.mode!=='owner')return;
  try{state.traffic=await trafficApi();renderPortal();if(showToast)toast(L('Visitor activity refreshed.','Actividad de visitantes actualizada.'))}catch(err){toast(err.message)}
}
function setupLiveSync(){
  if(liveSource) liveSource.close();
  const pill=$('#sync-pill');
  try{
    liveSource=new EventSource('/api/live-sync');
    liveSource.addEventListener('ready',()=>pill.classList.remove('offline'));
    liveSource.addEventListener('change',()=>{pill.classList.remove('offline');refreshState(false,false)});
    liveSource.onerror=()=>pill.classList.add('offline');
  }catch{pill.classList.add('offline')}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshState(false,false)},{once:false});
}
function setupPwaEligibility(){
  if(!document.querySelector('link[rel="manifest"]')){const manifest=document.createElement('link');manifest.rel='manifest';manifest.href='/manifest.webmanifest';document.head.appendChild(manifest)}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
}

function navForMode(){
  if(state.mode==='owner') return [
    ['today',tr('today')],['visitors',tr('visitors')],['leads',tr('leads')],['quotes',tr('quotes')],['jobs',tr('jobs')],['customers',tr('customers')],['messages',tr('messages')],['billing',tr('billing')],['contracts',tr('contracts')],['finance',tr('finance')],['growth',tr('growth')],['intelligence',tr('intelligence')],['profile',tr('profile')],['install',tr('install')]
  ];
  return [['home',tr('today')],['requests',tr('requests')],['messages',tr('messages')],['billing',tr('billing')],['history',tr('history')],['profile',tr('profile')],['install',tr('install')]];
}
function renderPortal(){
  if(!state)return;
  const isOwner=state.mode==='owner';
  $('#portal-title').textContent=isOwner?(state.auth.role==='ramiro'?'Ramiro':L('Owner Command','Centro de Dueños')):`${tr('hello')}, ${state.profile?.full_name?.split(' ')[0]||state.auth.name||''}`;
  $('#portal-subtitle').textContent=isOwner?(state.auth.role==='ramiro'?tr('ramiroSub'):tr('ownerSub')):tr('memberSub');
  $('#portal-eyebrow').textContent=isOwner?L('Ramiro Landscaping · Business','Ramiro Landscaping · Negocio'):L('Ramiro Landscaping · Member','Ramiro Landscaping · Miembro');
  const nav=$('#portal-nav');
  nav.innerHTML=navForMode().map(([id,label])=>`<button type="button" data-section="${id}" class="${currentSection===id?'active':''}">${safe(label)}</button>`).join('');
  $$('[data-section]',nav).forEach(b=>b.addEventListener('click',()=>{currentSection=b.dataset.section;renderPortal();setTimeout(()=>b.scrollIntoView({block:'nearest',inline:'center',behavior:'smooth'}),0)}));
  $('#portal-content').innerHTML=isOwner?renderOwnerSection(currentSection):renderMemberSection(currentSection);
  bindPortalActions();
}

const chip=(text,cls='')=>`<span class="chip ${cls}">${safe(text||'')}</span>`;
const empty=msg=>`<div class="empty-state">${safe(msg||tr('empty'))}</div>`;
const record=(title,meta,body,actions='')=>`<article class="record"><div class="record-head"><div><h3>${safe(title)}</h3><div class="record-meta">${meta||''}</div></div></div>${body||''}${actions?`<div class="actions-row">${actions}</div>`:''}</article>`;
const button=(label,action,id='',cls='account-secondary',extra='')=>`<button type="button" class="${cls}" data-action="${action}" data-id="${safe(id)}" ${extra}>${safe(label)}</button>`;
const goButton=(label,section,cls='account-secondary')=>button(label,'go-section',section,cls);
const contactLinks=(row={})=>{
  const links=[];
  if(row.phone){links.push(`<a class="account-mini" href="tel:${safe(row.phone)}">${L('Call','Llamar')}</a>`);links.push(`<a class="account-mini" href="sms:${safe(row.phone)}">${L('Text','Texto')}</a>`)}
  if(row.email)links.push(`<a class="account-mini" href="mailto:${safe(row.email)}">${L('Email','Correo')}</a>`);
  return links.join('');
};
const noData=(title,body,actions='')=>`<section class="panel owner-empty"><p class="account-eyebrow">${L('Ready when you are','Listo cuando tú estés')}</p><h2>${safe(title)}</h2><p>${safe(body)}</p>${actions?`<div class="actions-row">${actions}</div>`:''}</section>`;
const metric=(label,value,sub='')=>`<div class="metric"><small>${safe(label)}</small><strong>${safe(value)}</strong>${sub?`<span>${safe(sub)}</span>`:''}</div>`;
const trafficMetric=(label,value,sub='')=>metric(label,String(value??0),sub);

function attentionItems(){
  const items=[];
  const unread=(state.messages||[]).filter(m=>!m.read_by_staff).length;
  const hot=(state.leads||[]).filter(l=>l.heat==='hot'&&!['won','lost'].includes(l.status)).length;
  const moneyAttention=(state.jobs||[]).filter(j=>j.status==='completed'&&['unbilled','invoiced'].includes(j.payment_status)).length;
  const stalled=(state.leads||[]).filter(l=>['new','review','follow_up','prospect'].includes(l.status)&&Date.now()-new Date(l.updated_at).getTime()>3*86400000).length;
  if(unread)items.push({text:L(`${unread} unread customer message${unread===1?'':'s'}`,`${unread} mensaje${unread===1?'':'s'} sin leer`),section:'messages'});
  if(hot)items.push({text:L(`${hot} hot lead${hot===1?'':'s'} waiting for review`,`${hot} prospecto${hot===1?'':'s'} urgente${hot===1?'':'s'} por revisar`),section:'leads'});
  if(moneyAttention)items.push({text:L(`${moneyAttention} completed job${moneyAttention===1?'':'s'} need billing or payment follow-through`,`${moneyAttention} trabajo${moneyAttention===1?'':'s'} terminado${moneyAttention===1?'':'s'} necesita${moneyAttention===1?'':'n'} seguimiento de cobro`),section:'billing'});
  if(stalled)items.push({text:L(`${stalled} lead${stalled===1?' has':'s have'} been quiet for 3+ days`,`${stalled} prospecto${stalled===1?' lleva':'s llevan'} 3+ días sin movimiento`),section:'leads'});
  return items;
}
function quickActions(){
  return `<section class="panel owner-quick"><div class="record-head"><div><p class="account-eyebrow">${L('Quick actions','Acciones rápidas')}</p><h2>${L('Run the business from here.','Maneja el negocio desde aquí.')}</h2></div>${button(L('Refresh','Actualizar'),'refresh-all','','account-secondary')}</div><div class="owner-action-grid">${goButton(L('Add lead','Agregar prospecto'),'leads','account-primary')}${goButton(L('New quote','Nueva cotización'),'quotes')}${goButton(L('New job','Nuevo trabajo'),'jobs')}${goButton(L('Invoice / receipt','Factura / recibo'),'billing')}${goButton(L('Contract','Contrato'),'contracts')}${goButton(L('Visitor activity','Visitas del sitio'),'visitors')}</div></section>`;
}
function renderTrafficSummary(){
  const t=state.traffic?.today||{};
  return `<section class="panel"><div class="record-head"><div><p class="account-eyebrow">${L('Website pulse · today','Pulso del sitio · hoy')}</p><h2>${L('What visitors are doing','Qué hacen los visitantes')}</h2></div>${button(L('Open visitors','Ver visitas'),'go-section','visitors')}</div><div class="metric-grid traffic-metrics">${trafficMetric(L('Visitors','Visitantes'),t.visitors||0)}${trafficMetric(L('Page views','Páginas vistas'),t.pageViews||0)}${trafficMetric(L('Call taps','Toques llamar'),t.callClicks||0)}${trafficMetric(L('Text taps','Toques texto'),t.textClicks||0)}${trafficMetric(L('Quote starts','Cotizaciones iniciadas'),t.quoteStarts||0)}${trafficMetric(L('QR visits','Visitas QR'),t.qrScans||0)}</div></section>`;
}
function renderVisitors(){
  const traffic=state.traffic||{};const t=traffic.today||{},w=traffic.week||{},m=traffic.month||{};const recent=traffic.recent||[];
  const sourceRows=(w.sources||[]).map(x=>record(x.name,chip(`${x.count} ${L('visits','visitas')}`),'')).join('');
  const pageRows=(w.topPages||[]).map(x=>record(x.name,chip(`${x.count} ${L('views','vistas')}`),'')).join('');
  const targetRows=(w.topTargets||[]).map(x=>record(x.name,chip(`${x.count} ${L('clicks','clics')}`),'')).join('');
  const trails=recent.slice(0,12).map(v=>record(`${v.id} · ${timeOnly(v.last)}`,`${chip(v.source)} ${chip(v.language==='es'?'ES':'EN')} ${v.qr?chip('QR','good'):''}`,`<p><b>${L('Pages','Páginas')}:</b> ${(v.pages||[]).map(safe).join(' → ')||'—'}</p><p><b>${L('Actions','Acciones')}:</b> ${(v.actions||[]).map(a=>safe(a.replaceAll('_',' '))).join(', ')||L('Browsing only','Solo navegación')}</p>`)).join('');
  const qrLink='https://ramirolandscapingoc.com/?src=business-card-qr';
  return `<div class="owner-stack"><section class="panel"><div class="record-head"><div><p class="account-eyebrow">${L('Visitor intelligence','Inteligencia de visitantes')}</p><h2>${L('See the website working.','Mira el sitio trabajando.')}</h2><p>${L('Anonymous, privacy-aware activity. No names, phone numbers, addresses or photo contents are collected here.','Actividad anónima y respetuosa de la privacidad. Aquí no se recopilan nombres, teléfonos, domicilios ni contenido de fotos.')}</p></div>${button(L('Refresh','Actualizar'),'refresh-traffic','','account-primary')}</div><div class="metric-grid">${trafficMetric(L('Visitors today','Visitantes hoy'),t.visitors||0,`${t.active30m||0} ${L('active in last 30m','activos en 30 min')}`)}${trafficMetric(L('7-day visitors','Visitantes 7 días'),w.visitors||0,`${w.engagedSessions||0} ${L('engaged','interactuaron')}`)}${trafficMetric(L('30-day visitors','Visitantes 30 días'),m.visitors||0)}${trafficMetric(L('7-day page views','Páginas 7 días'),w.pageViews||0)}${trafficMetric(L('Call + text taps','Llamadas + textos'),(w.callClicks||0)+(w.textClicks||0))}${trafficMetric(L('Quote submissions','Solicitudes enviadas'),w.quoteSubmits||0,pct(w.quoteConversion||0))}${trafficMetric(L('QR visits','Visitas QR'),w.qrScans||0)}${trafficMetric(L('Tracked link clicks','Clics rastreados'),w.linkClicks||0)}</div></section><div class="panel-grid"><section class="panel"><p class="account-eyebrow">${L('Traffic sources · 7 days','Fuentes · 7 días')}</p><h2>${L('How people found you','Cómo llegaron')}</h2><div class="record-list">${sourceRows||empty()}</div></section><section class="panel"><p class="account-eyebrow">${L('Top pages · 7 days','Páginas principales · 7 días')}</p><h2>${L('What they browsed','Qué vieron')}</h2><div class="record-list">${pageRows||empty()}</div></section></div><section class="panel"><div class="record-head"><div><p class="account-eyebrow">${L('Recent anonymous sessions','Sesiones anónimas recientes')}</p><h2>${L('Browsing trails','Recorridos de navegación')}</h2></div></div><div class="record-list">${trails||empty(L('No public visitor activity has been recorded yet.','Todavía no hay actividad pública registrada.'))}</div></section><div class="panel-grid"><section class="panel"><p class="account-eyebrow">${L('Tracked links','Enlaces rastreados')}</p><h2>${L('What people clicked','Qué tocaron')}</h2><div class="record-list">${targetRows||empty()}</div></section><section class="panel"><p class="account-eyebrow">${L('QR tracking','Rastreo QR')}</p><h2>${L('Know when the card gets scanned','Sabe cuándo escanean la tarjeta')}</h2><p>${L('Use this URL for the business-card QR. Visits from it are counted separately.','Usa este enlace para el QR de la tarjeta. Sus visitas se cuentan por separado.')}</p><code class="tracking-link">${safe(qrLink)}</code><div class="actions-row">${button(L('Copy QR link','Copiar enlace QR'),'copy-qr-link','','account-primary')}</div></section></div></div>`;
}

function renderOwnerSection(section){
  const f=state.finance||{};
  if(section==='today'){
    const attention=attentionItems(),recent=(state.leads||[]).slice(0,5);
    return `<div class="owner-stack">${quickActions()}${renderTrafficSummary()}<div class="metric-grid">${metric(L('MTD received','Recibido mes'),money(f.mtd_received))}${metric(L('MTD secured','Asegurado mes'),money(f.mtd_secured))}${metric(L('Outstanding','Pendiente'),money(f.outstanding))}${metric(L('YTD received','Recibido año'),money(f.ytd_received))}</div><div class="panel-grid"><section class="panel"><p class="account-eyebrow">${L('Needs attention','Necesita atención')}</p><h2>${attention.length?L(`${attention.length} things need you`,`${attention.length} cosas te necesitan`):L('Business is caught up','Negocio al día')}</h2><div class="attention-list">${attention.length?attention.map((x,i)=>`<div class="attention"><b>${i+1}</b><span>${safe(x.text)}</span>${goButton(L('Open','Abrir'),x.section,'account-mini')}</div>`).join(''):`<p>${L('No urgent housekeeping flags right now.','No hay alertas urgentes ahora.')}</p>`}</div></section><section class="panel"><p class="account-eyebrow">${L('Newest opportunities','Oportunidades recientes')}</p><h2>${L('Lead pulse','Pulso de prospectos')}</h2><div class="record-list">${recent.length?recent.map(l=>record(l.name||l.reference,`${chip(l.heat,l.heat==='hot'?'hot':'')} ${chip(l.service)} ${chip(l.city)}`,`<p>${safe(l.ai_summary||l.next_action||L('New lead','Prospecto nuevo'))}</p>`,goButton(L('Open leads','Abrir prospectos'),'leads'))).join(''):noData(L('No leads yet','Todavía no hay prospectos'),L('Website quote requests and manually added prospects will appear here.','Las solicitudes del sitio y prospectos agregados aparecerán aquí.'),goButton(L('Add lead','Agregar prospecto'),'leads','account-primary'))}</div></section></div></div>`;
  }
  if(section==='visitors') return renderVisitors();
  if(section==='leads'){
    const rows=state.leads||[];
    const form=`<section class="panel"><div class="record-head"><div><p class="account-eyebrow">${L('Lead Address Book','Directorio de prospectos')}</p><h2>${L('Every opportunity, remembered.','Cada oportunidad, recordada.')}</h2><p>${L('Add calls, referrals, neighbors or researched prospects here. Website quote requests arrive automatically.','Agrega llamadas, referidos, vecinos o prospectos investigados. Las solicitudes del sitio llegan automáticamente.')}</p></div>${goButton(L('View visitors','Ver visitas'),'visitors')}</div><form class="inline-form" data-form="create-lead"><input name="name" placeholder="${L('Prospect / customer name','Nombre del prospecto / cliente')}" required><input name="email" type="email" placeholder="${L('Public email','Correo público')}"><input name="phone" placeholder="${L('Phone','Teléfono')}"><input name="city" placeholder="${L('City','Ciudad')}"><input name="service" placeholder="${L('Potential service','Servicio posible')}"><input name="source" placeholder="${L('Source: call, referral, Nextdoor…','Fuente: llamada, referido, Nextdoor…')}"><select name="heat"><option value="warm">warm</option><option value="hot">hot</option><option value="future">future</option></select><select name="status"><option value="prospect">prospect</option><option value="new">new</option><option value="follow_up">follow up</option><option value="won">customer / won</option></select><input class="span-2" name="nextAction" placeholder="${L('Next action','Próxima acción')}"><label class="check-row"><input type="checkbox" name="recurring"> ${L('Possible recurring service','Posible servicio recurrente')}</label><button class="account-primary" type="submit">${L('Add opportunity','Agregar oportunidad')}</button></form></section>`;
    const list=rows.length?rows.map(l=>record(l.name||l.reference,`${chip(l.heat,l.heat==='hot'?'hot':'')} ${chip(l.status)} ${chip(l.service)} ${chip(l.city)} ${chip(l.source)}`,`<div class="contact-actions">${contactLinks(l)}</div><p>${safe(l.ai_summary||'')}</p><div class="bilingual"><div class="language-block"><small>Ramiro Español</small><p>${safe(l.ramiro_spanish||L('Pending','Pendiente'))}</p></div><div class="language-block"><small>${L('Next best action','Próxima mejor acción')}</small><p>${safe(l.next_action||L('Review','Revisar'))}</p></div></div><form class="inline-form compact-form" data-form="lead-update" data-id="${safe(l.id)}"><select name="heat"><option ${l.heat==='hot'?'selected':''}>hot</option><option ${l.heat==='warm'?'selected':''}>warm</option><option ${l.heat==='future'?'selected':''}>future</option></select><select name="status"><option ${l.status==='prospect'?'selected':''}>prospect</option><option ${l.status==='new'?'selected':''}>new</option><option ${l.status==='review'?'selected':''}>review</option><option ${l.status==='follow_up'?'selected':''} value="follow_up">follow up</option><option ${l.status==='won'?'selected':''}>won</option><option ${l.status==='lost'?'selected':''}>lost</option></select><input class="span-2" name="nextAction" value="${safe(l.next_action||'')}" placeholder="${L('Next action','Próxima acción')}"><button class="account-secondary" type="submit">${L('Update','Actualizar')}</button></form>`,`${button(L('Create quote','Crear cotización'),'quote-for-lead',l.id,'account-primary')}${button(L('Create job','Crear trabajo'),'job-for-lead',l.id)}`)).join(''):noData(L('No leads yet','Todavía no hay prospectos'),L('Add the first opportunity or wait for a quote request from the website.','Agrega la primera oportunidad o espera una solicitud del sitio.'),goButton(L('View visitor activity','Ver actividad'),'visitors'));
    return `<div class="owner-stack">${form}<div class="record-list">${list}</div></div>`;
  }
  if(section==='quotes'){
    const rows=state.quotes||[],leads=state.leads||[];
    const options=leads.map(l=>`<option value="${safe(l.id)}" ${draftLeadId===l.id?'selected':''}>${safe(l.name||l.reference)} · ${safe(l.service||'')}</option>`).join('');
    const create=leads.length?`<section class="panel"><p class="account-eyebrow">${L('Quote desk','Mesa de cotizaciones')}</p><h2>${L('Build a quote from a real opportunity.','Crea una cotización desde una oportunidad real.')}</h2><form class="inline-form" data-form="create-quote"><select name="leadId" required><option value="">${L('Choose lead / customer','Elige prospecto / cliente')}</option>${options}</select><input name="service" placeholder="${L('Service','Servicio')}"><input name="estimatedMin" type="number" step="0.01" placeholder="${L('Estimate minimum','Estimado mínimo')}"><input name="estimatedMax" type="number" step="0.01" placeholder="${L('Estimate maximum','Estimado máximo')}"><textarea class="span-4" name="summary" placeholder="${L('Customer need / scope notes','Necesidad del cliente / alcance')}"></textarea><button class="account-primary" type="submit">${L('Create quote draft','Crear borrador')}</button></form></section>`:noData(L('A quote starts with a lead','Una cotización empieza con un prospecto'),L('Add a lead first, then build the quote here.','Agrega un prospecto primero y luego crea la cotización aquí.'),goButton(L('Add lead','Agregar prospecto'),'leads','account-primary'));
    const list=rows.length?rows.map(qt=>record(`${qt.name||L('Customer','Cliente')} · ${qt.reference}`,`${chip(qt.status)} ${chip(qt.service)} ${chip(qt.heat,qt.heat==='hot'?'hot':'')} ${chip(qt.confidence||qt.intelligence?.confidence||'')}`,`<div class="contact-actions">${contactLinks(qt)}</div><div class="bilingual"><div class="language-block"><small>${L('Customer / source','Cliente / fuente')}</small><p>${safe(qt.customer_summary||qt.original_data?.message||'')}</p></div><div class="language-block"><small>Para Ramiro</small><p>${safe(qt.ramiro_spanish||'')}</p></div></div><div class="intel-block"><small>${L('Internal estimate intelligence','Inteligencia de estimación interna')}</small><p>${money(qt.estimated_min)} – ${money(qt.estimated_max)}</p><p>${safe(qt.next_action||L('Ramiro approves final customer pricing.','Ramiro aprueba el precio final.'))}</p></div><form class="inline-form compact-form" data-form="quote-approve" data-id="${safe(qt.id)}"><input name="amount" type="number" step="0.01" value="${safe(qt.approved_amount||'')}" placeholder="${L('Approved amount','Monto aprobado')}"><select name="status"><option ${qt.status==='review'?'selected':''}>review</option><option ${qt.status==='sent'?'selected':''}>sent</option><option ${qt.status==='accepted'?'selected':''}>accepted</option><option ${qt.status==='declined'?'selected':''}>declined</option></select><label class="check-row"><input type="checkbox" name="createJob"> ${L('Create job','Crear trabajo')}</label><button class="account-primary" type="submit">${L('Save quote','Guardar')}</button></form>`)).join(''):noData(L('No quote records yet','Todavía no hay cotizaciones'),L('Create the first draft above. Website submissions also appear automatically.','Crea el primer borrador arriba. Las solicitudes del sitio también aparecen automáticamente.'));
    return `<div class="owner-stack">${create}<div class="record-list">${list}</div></div>`;
  }
  if(section==='jobs'){
    const rows=state.jobs||[],quotes=state.quotes||[],leads=state.leads||[];
    const qOpts=quotes.map(q=>`<option value="${safe(q.id)}" ${draftQuoteId===q.id?'selected':''}>${safe(q.reference)} · ${safe(q.name||q.service||'')}</option>`).join('');
    const lOpts=leads.map(l=>`<option value="${safe(l.id)}" ${draftLeadId===l.id?'selected':''}>${safe(l.name||l.reference)} · ${safe(l.service||'')}</option>`).join('');
    const create=`<section class="panel"><p class="account-eyebrow">${L('Job desk','Mesa de trabajos')}</p><h2>${L('Create and run the work.','Crea y maneja el trabajo.')}</h2><form class="inline-form" data-form="create-job"><select name="quoteId"><option value="">${L('Related quote (optional)','Cotización relacionada (opcional)')}</option>${qOpts}</select><select name="leadId"><option value="">${L('Lead / customer (optional)','Prospecto / cliente (opcional)')}</option>${lOpts}</select><input name="service" placeholder="${L('Service','Servicio')}" required><input name="serviceAddress" placeholder="${L('Service address','Domicilio del trabajo')}"><input name="contractValue" type="number" step="0.01" placeholder="${L('Agreed value','Valor acordado')}"><textarea class="span-4" name="notes" placeholder="${L('Work notes / scope','Notas / alcance')}"></textarea><button class="account-primary" type="submit">${L('Create job','Crear trabajo')}</button></form></section>`;
    const list=rows.length?rows.map(j=>record(`${j.reference} · ${j.customer_name||L('Customer','Cliente')}`,`${chip(j.status,j.status==='completed'?'good':'')} ${chip(j.payment_status)} ${chip(j.service)}`,`<p>${safe(j.service_address||'')}</p><p>${safe(j.notes||'')}</p><p><b>${L('Contract value','Valor')}:</b> ${money(j.contract_value)} · <b>${L('Scheduled','Programado')}:</b> ${date(j.scheduled_at)}</p><div class="owner-job-actions">${button(L('Invoice','Factura'),'billing-for-job',j.id)}${button(L('Contract','Contrato'),'contract-for-job',j.id)}</div><form class="inline-form compact-form" data-form="job-update" data-id="${safe(j.id)}"><select name="status"><option ${j.status==='secured'?'selected':''}>secured</option><option ${j.status==='scheduled'?'selected':''}>scheduled</option><option ${j.status==='in_progress'?'selected':''} value="in_progress">in progress</option><option ${j.status==='completed'?'selected':''}>completed</option></select><input name="notes" class="span-2" placeholder="${L('Ramiro field note / update','Nota de campo / actualización')}"><button class="account-primary" type="submit">${L('Update job','Actualizar')}</button></form><form class="inline-form compact-form" data-form="schedule-job" data-id="${safe(j.id)}"><input name="scheduledAt" type="datetime-local"><button class="account-secondary" type="submit">${L('Schedule','Programar')}</button></form><form class="inline-form compact-form" data-form="record-payment" data-id="${safe(j.id)}"><input name="amount" type="number" step="0.01" placeholder="${L('Payment received','Pago recibido')}"><select name="method"><option>Cash</option><option>Check</option><option>Zelle</option><option>Other</option></select><input name="note" placeholder="${L('Payment note','Nota de pago')}"><button class="account-secondary" type="submit">${L('Record payment','Registrar pago')}</button></form><form class="inline-form compact-form" data-form="add-cost" data-id="${safe(j.id)}"><select name="category"><option>Materials</option><option>Disposal</option><option>Plants</option><option>Sod</option><option>Sprinkler parts</option><option>Other</option></select><input name="amount" type="number" step="0.01" placeholder="${L('Direct cost','Costo directo')}"><input name="note" placeholder="${L('Cost note','Nota de costo')}"><button class="account-secondary" type="submit">${L('Add cost','Agregar costo')}</button></form>`)).join(''):noData(L('No jobs yet','Todavía no hay trabajos'),L('Create the first job above or turn an accepted quote into a job.','Crea el primer trabajo arriba o convierte una cotización aceptada.'),goButton(L('Open quotes','Abrir cotizaciones'),'quotes'));
    return `<div class="owner-stack">${create}<div class="record-list">${list}</div></div>`;
  }
  if(section==='customers'){
    const members=(state.customers||[]).filter(c=>c.role==='member');const contacts=(state.leads||[]);
    const memberRows=members.length?members.map(c=>record(c.full_name||c.email,`${chip(c.preferred_language==='es'?'Español':'English')} ${chip(c.preferred_contact||'')}`,`<div class="contact-actions">${contactLinks(c)}</div><p>${safe(c.service_address||L('No saved property','Sin domicilio guardado'))}</p>`,button(L('Message','Mensaje'),'message-customer',c.user_id,'account-primary'))).join(''):empty(L('No member accounts yet.','Todavía no hay cuentas de clientes.'));
    const contactRows=contacts.length?contacts.map(c=>record(c.name||c.reference,`${chip(c.status)} ${chip(c.service)} ${chip(c.city)}`,`<div class="contact-actions">${contactLinks(c)}</div><p>${safe(c.next_action||'')}</p>`,button(L('Quote','Cotizar'),'quote-for-lead',c.id,'account-primary'))).join(''):empty(L('No business contacts yet.','Todavía no hay contactos.'));
    return `<div class="panel-grid"><section class="panel"><p class="account-eyebrow">${L('Customer accounts','Cuentas de clientes')}</p><h2>${L('Portal customers','Clientes con portal')}</h2><div class="record-list">${memberRows}</div></section><section class="panel"><p class="account-eyebrow">${L('Business contacts','Contactos del negocio')}</p><h2>${L('Leads and customers you know','Prospectos y clientes conocidos')}</h2><div class="record-list">${contactRows}</div><div class="actions-row">${goButton(L('Add contact','Agregar contacto'),'leads','account-primary')}</div></section></div>`;
  }
  if(section==='messages'){
    const rows=state.messages||[];
    return rows.length?`<div class="record-list">${rows.map(m=>record(m.customer_name||m.customer_email||L('Customer','Cliente'),`${chip(m.sender_role)} ${chip(shortDate(m.created_at))}`,`<div class="bilingual"><div class="language-block"><small>${L('Original','Original')}</small><p>${safe(m.body_original)}</p></div><div class="language-block"><small>Español / English</small><p>${safe(lang==='es'?m.body_es:m.body_en)}</p></div></div><form class="inline-form" data-form="send-message" data-user="${safe(m.user_id)}" data-job="${safe(m.job_id||'')}"><textarea class="span-4" name="message" placeholder="${L('Reply. AI prepares both English and Spanish versions.','Responde. La IA prepara versiones en inglés y español.')}" required></textarea><button class="account-primary" type="submit">${L('Send reply','Enviar respuesta')}</button></form>`)).join('')}</div>`:noData(L('No private messages yet','Todavía no hay mensajes privados'),L('Messages live here when a customer has an account. Calls and prospects stay in Leads until then.','Los mensajes aparecen aquí cuando un cliente tiene cuenta. Llamadas y prospectos permanecen en Prospectos.'),goButton(L('Open customers','Abrir clientes'),'customers'));
  }
  if(section==='billing') return renderOwnerDocuments('billing');
  if(section==='contracts') return renderOwnerDocuments('contracts');
  if(section==='finance'){
    const p=state.payments||[],costs=state.costs||[];const contribution=Number(f.mtd_received||0)-Number(f.mtd_direct_costs||0);
    return `<div class="owner-stack"><section class="panel"><div class="record-head"><div><p class="account-eyebrow">${L('Finance desk','Mesa financiera')}</p><h2>${L('Money movement, not guesswork.','Movimiento de dinero, no adivinanzas.')}</h2></div><div class="actions-row">${goButton(L('Create invoice','Crear factura'),'billing','account-primary')}${goButton(L('Open jobs','Abrir trabajos'),'jobs')}</div></div><div class="metric-grid">${metric(L('MTD received','Recibido mes'),money(f.mtd_received))}${metric(L('MTD secured','Asegurado mes'),money(f.mtd_secured))}${metric(L('MTD completed','Completado mes'),money(f.mtd_completed))}${metric(L('Outstanding','Pendiente'),money(f.outstanding))}${metric(L('Direct job costs','Costos directos'),money(f.mtd_direct_costs))}${metric(L('Contribution after direct costs','Contribución tras costos directos'),money(contribution),L('Not full profit','No es ganancia neta'))}</div></section><div class="panel-grid"><section class="panel"><p class="account-eyebrow">${L('Money timeline','Historial de dinero')}</p><h2>${L('Received','Recibido')}</h2><div class="record-list">${p.length?p.slice(0,25).map(x=>record(money(x.amount),`${chip(x.method)} ${chip(date(x.received_at))}`,`<p>${safe(x.note||L('Payment received','Pago recibido'))}</p>`)).join(''):empty()}</div></section><section class="panel"><p class="account-eyebrow">${L('Direct job costs','Costos directos')}</p><h2>${L('Learning the real cost','Aprendiendo el costo real')}</h2><div class="record-list">${costs.length?costs.slice(0,25).map(x=>record(money(x.amount),`${chip(x.category)} ${chip(shortDate(x.created_at))}`,`<p>${safe(x.note||'')}</p>`)).join(''):empty()}</div></section></div></div>`;
  }
  if(section==='growth'){
    const leads=state.leads||[],by={};leads.forEach(l=>by[l.source||'unknown']=(by[l.source||'unknown']||0)+1);const recurring=leads.filter(l=>l.recurring_opportunity&&l.status!=='lost');const w=state.traffic?.week||{};
    return `<div class="owner-stack"><section class="panel"><div class="record-head"><div><p class="account-eyebrow">${L('Growth desk','Mesa de crecimiento')}</p><h2>${L('See what actually brings opportunity.','Mira qué trae oportunidades de verdad.')}</h2></div>${goButton(L('Visitor detail','Detalle de visitas'),'visitors','account-primary')}</div><div class="metric-grid">${trafficMetric(L('7-day visitors','Visitantes 7 días'),w.visitors||0)}${trafficMetric(L('QR visits','Visitas QR'),w.qrScans||0)}${trafficMetric(L('Call taps','Toques llamar'),w.callClicks||0)}${trafficMetric(L('Quote submissions','Solicitudes'),w.quoteSubmits||0)}</div></section><div class="panel-grid"><section class="panel"><p class="account-eyebrow">${L('Lead sources','Fuentes de prospectos')}</p><h2>${L('Where opportunities come from','De dónde vienen')}</h2><div class="record-list">${Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>record(k,chip(`${v} ${L('leads','prospectos')}`),'')).join('')||empty()}</div></section><section class="panel"><p class="account-eyebrow">${L('Recurring opportunities','Oportunidades recurrentes')}</p><h2>${L('Worth a human follow-up','Vale seguimiento humano')}</h2><div class="record-list">${recurring.length?recurring.slice(0,20).map(l=>record(l.name||l.reference,`${chip(l.service)} ${chip(l.city)}`,`<p>${safe(l.next_action||L('Review recurring-service opportunity.','Revisar oportunidad recurrente.'))}</p>`,button(L('Open lead','Abrir'),'quote-for-lead',l.id))).join(''):empty()}</div></section></div></div>`;
  }
  if(section==='intelligence'){
    const i=state.insights||{},rates=state.rateBook||[],w=state.traffic?.week||{};const attention=attentionItems();
    return `<div class="owner-stack"><section class="panel"><p class="account-eyebrow">${L('Business nervous system','Sistema nervioso del negocio')}</p><h2>${L('What the system sees','Lo que ve el sistema')}</h2><div class="health-grid"><div class="health"><strong>${L('Open leads','Prospectos abiertos')} ${safe(i.lead?.open||0)}</strong><small>${safe(i.lead?.hot||0)} hot</small></div><div class="health"><strong>${L('Active jobs','Trabajos activos')} ${safe(i.job?.active||0)}</strong><small>${safe(i.job?.billing_attention||0)} ${L('need money follow-through','necesitan cobro')}</small></div><div class="health"><strong>${L('7-day visitors','Visitantes 7 días')} ${safe(w.visitors||0)}</strong><small>${safe(w.quoteSubmits||0)} ${L('quote submissions','solicitudes')}</small></div><div class="health"><strong>${L('Housekeeping','Pendientes')} ${safe(i.stalled||0)}</strong><small>${L('stalled leads','prospectos estancados')}</small></div></div><div class="attention-list">${attention.length?attention.map((x,n)=>`<div class="attention"><b>${n+1}</b><span>${safe(x.text)}</span>${goButton(L('Open','Abrir'),x.section,'account-mini')}</div>`).join(''):`<p>${L('No urgent housekeeping flags.','No hay alertas urgentes.')}</p>`}</div><div class="owner-action-grid">${goButton(L('Review visitors','Revisar visitas'),'visitors')}${goButton(L('Review leads','Revisar prospectos'),'leads')}${goButton(L('Review jobs','Revisar trabajos'),'jobs')}${goButton(L('Review billing','Revisar cobros'),'billing')}</div></section><section class="panel"><p class="account-eyebrow">${L('Private rate book','Tarifario privado')}</p><h2>${L('Estimating assumptions','Supuestos de estimación')}</h2><div class="record-list">${rates.map(r=>`<form class="record inline-form" data-form="update-rate" data-key="${safe(r.key)}"><div class="span-2"><b>${safe(r.label)}</b><small style="display:block;color:#68776e">${safe(r.unit||'')}</small></div><input name="value" type="number" step="0.01" value="${safe(r.value)}"><button class="account-secondary" type="submit">${L('Update','Actualizar')}</button></form>`).join('')}</div></section></div>`;
  }
  if(section==='profile') return renderProfile(true);
  if(section==='install') return renderInstall();
  return empty();
}

function renderOwnerDocuments(mode){
  const docs=(state.documents||[]).filter(d=>mode==='billing'?['invoice','receipt'].includes(d.kind):['contract','change_order'].includes(d.kind));
  const jobs=state.jobs||[],members=(state.customers||[]).filter(c=>c.role==='member'),leads=state.leads||[];
  const memberOpts=members.map(c=>`<option value="member:${safe(c.user_id)}">${safe(c.full_name||c.email)} · ${L('account','cuenta')}</option>`).join('');
  const leadOpts=leads.map(c=>`<option value="lead:${safe(c.id)}" ${draftLeadId===c.id?'selected':''}>${safe(c.name||c.reference)} · ${L('business contact','contacto')}</option>`).join('');
  const jobOpts=jobs.map(j=>`<option value="${safe(j.id)}" ${draftJobId===j.id?'selected':''}>${safe(j.reference)} · ${safe(j.customer_name||j.service)}</option>`).join('');
  const kindOpts=mode==='billing'?'<option value="invoice">Invoice</option><option value="receipt">Receipt</option>':'<option value="contract">Service contract</option><option value="change_order">Change order</option>';
  const help=mode==='billing'?L('Create for a member account or any business contact. Member accounts receive portal delivery; other contacts can be printed or saved as PDF.','Crea para una cuenta o cualquier contacto. Las cuentas reciben entrega en el portal; otros contactos se pueden imprimir o guardar en PDF.'):L('Contracts can be built for any contact. Portal e-signing requires the customer to have an account; otherwise print/save the signed business copy for manual delivery.','Los contratos se pueden crear para cualquier contacto. La firma electrónica del cliente requiere cuenta; si no, imprime o guarda la copia firmada para entrega manual.');
  const form=`<section class="panel"><div class="record-head"><div><p class="account-eyebrow">${mode==='billing'?L('Billing Desk','Mesa de facturación'):L('Contract Center','Centro de contratos')}</p><h2>${mode==='billing'?L('Create professional billing documents','Crea documentos profesionales'):L('Build, publish and sign work agreements','Crea, publica y firma acuerdos')}</h2><p>${help}</p></div></div><form class="inline-form" data-form="create-document"><select name="kind">${kindOpts}</select><select name="customerKey"><option value="">${L('Customer / contact','Cliente / contacto')}</option><optgroup label="${L('Member accounts','Cuentas')}">${memberOpts}</optgroup><optgroup label="${L('Leads / contacts','Prospectos / contactos')}">${leadOpts}</optgroup></select><select name="jobId"><option value="">${L('Related job (optional)','Trabajo relacionado (opcional)')}</option>${jobOpts}</select><input name="title" placeholder="${L('Document title','Título')}"><input name="amount" type="number" step="0.01" placeholder="${L('Amount','Monto')}"><textarea class="span-2" name="scope" placeholder="${L('Scope / work performed','Alcance / trabajo realizado')}"></textarea><textarea class="span-2" name="terms" placeholder="${L('Terms / payment schedule / exclusions','Términos / pagos / exclusiones')}"></textarea><div class="span-4" data-items><input name="itemDescription" placeholder="${L('Line item description','Descripción de partida')}"><input name="itemAmount" type="number" step="0.01" placeholder="${L('Line item amount','Monto de partida')}"></div><button class="account-primary" type="submit">${L('Create draft','Crear borrador')}</button></form></section>`;
  const list=docs.length?docs.map(d=>renderDocRecord(d,true)).join(''):noData(mode==='billing'?L('No billing documents yet','Todavía no hay facturas o recibos'):L('No contracts yet','Todavía no hay contratos'),mode==='billing'?L('Use the form above when a job needs an invoice or a payment needs a receipt.','Usa el formulario cuando un trabajo necesite factura o un pago necesite recibo.'):L('Use the form above for recurring service, larger jobs or change orders.','Usa el formulario para servicio recurrente, trabajos grandes o cambios.'));
  return `<div class="owner-stack">${form}<div class="record-list">${list}</div></div>`;
}
function renderDocRecord(d,owner=false){
  const sigs=(state.signatures||[]).filter(s=>s.document_id===d.id),businessSigned=sigs.some(s=>s.signer_role==='business'),customerSigned=sigs.some(s=>s.signer_role==='customer');
  let actions=button(L('Open document','Abrir documento'),'view-document',d.id);
  if(owner&&d.status==='draft') actions+=button(L('Publish','Publicar'),'publish-document',d.id,'account-primary');
  if(owner&&['awaiting_business_signature','draft'].includes(d.status)) actions+=button(L('Sign as business','Firmar como negocio'),'sign-document',d.id,'account-primary','data-role="business"');
  if(!owner&&d.status==='awaiting_customer_signature') actions+=button(L('Review & e-sign','Revisar y firmar'),'sign-document',d.id,'account-primary','data-role="customer"');
  const delivery=d.data?.deliveryMode==='manual'?chip(L('manual delivery','entrega manual')):'';
  return record(`${d.number} · ${d.title}`,`${chip(d.kind)} ${chip(d.status,d.status==='executed'?'good':'')} ${chip(money(d.amount))} ${delivery}`,`<p>${safe(d.data?.scope||'')}</p><p><b>${L('Business signed','Negocio firmado')}:</b> ${businessSigned?L('Yes','Sí'):L('No','No')} · <b>${L('Customer signed','Cliente firmado')}:</b> ${customerSigned?L('Yes','Sí'):L('No','No')}</p>`,actions);
}

function renderMemberSection(section){
  const jobs=state.jobs||[],docs=state.documents||[],quotes=state.quotes||[],messages=state.messages||[];
  if(section==='home'){
    const active=jobs.find(j=>!['completed','cancelled'].includes(j.status));
    return `<div class="panel-grid"><section class="panel"><p class="account-eyebrow">${active?L('Active work','Trabajo activo'):L('Your Ramiro account','Tu cuenta Ramiro')}</p><h2>${active?`${safe(active.service||L('Service','Servicio'))} · ${safe(active.status)}`:L('What does your yard need?','¿Qué necesita tu jardín?')}</h2>${active?`<p>${safe(active.reference)} · ${safe(active.service_address||'')}</p><div class="record-meta">${chip(active.status)} ${chip(active.payment_status)}</div>`:`<p>${L('Start a new request whenever you need Ramiro. Your account keeps the history organized.','Inicia una solicitud cuando necesites a Ramiro. Tu cuenta mantiene todo organizado.')}</p><a class="account-primary" style="display:inline-block;text-decoration:none" href="/get-a-quote/">${L('Request help','Pedir ayuda')}</a>`}</section><section class="panel"><p class="account-eyebrow">${L('Messages','Mensajes')}</p><h2>${messages.length?`${messages.filter(m=>!m.read_by_customer).length} ${L('new updates','actualizaciones nuevas')}`:L('Stay connected','Mantente conectado')}</h2><p>${L('Private messages stay with your Ramiro Landscaping account and related work.','Los mensajes privados permanecen con tu cuenta y trabajo relacionado.')}</p>${button(L('Open messages','Abrir mensajes'),'go-section','messages')}</section></div>`;
  }
  if(section==='requests') return `<div class="record-list">${quotes.length?quotes.map(q=>record(q.reference,`${chip(q.status)} ${chip(q.service)}`,`<p>${q.approved_amount?`${L('Approved amount','Monto aprobado')}: ${money(q.approved_amount)}`:L('Ramiro is reviewing your request.','Ramiro está revisando tu solicitud.')}</p>`)).join(''):empty(L('No saved requests yet.','Todavía no hay solicitudes.'))}</div>`;
  if(section==='messages') return `<section class="panel"><p class="account-eyebrow">${L('Private messages','Mensajes privados')}</p><h2>${L('Messages with Ramiro Landscaping','Mensajes con Ramiro Landscaping')}</h2><form class="inline-form" data-form="send-message"><textarea class="span-4" name="message" placeholder="${L('Write a message. English or Spanish is welcome.','Escribe un mensaje. Inglés o español está bien.')}" required></textarea><button class="account-primary" type="submit">${L('Send message','Enviar mensaje')}</button></form></section><div class="record-list" style="margin-top:14px">${messages.length?messages.map(m=>record(m.sender_role==='member'?L('You','Tú'):'Ramiro Landscaping',chip(date(m.created_at)),`<p>${safe(lang==='es'?(m.body_es||m.body_original):(m.body_en||m.body_original))}</p>`)).join(''):empty()}</div>`;
  if(section==='billing'){
    const bill=docs.filter(d=>['invoice','receipt'].includes(d.kind)),contracts=docs.filter(d=>['contract','change_order'].includes(d.kind));
    return `<div class="panel-grid"><section class="panel"><p class="account-eyebrow">${L('Billing','Facturación')}</p><h2>${L('Your invoices and receipts','Tus facturas y recibos')}</h2><div class="record-list">${bill.length?bill.map(d=>renderDocRecord(d,false)).join(''):empty()}</div></section><section class="panel"><p class="account-eyebrow">${L('Contracts','Contratos')}</p><h2>${L('Agreements requiring your attention','Acuerdos que necesitan tu atención')}</h2><div class="record-list">${contracts.length?contracts.map(d=>renderDocRecord(d,false)).join(''):empty()}</div></section></div>`;
  }
  if(section==='history') return `<div class="record-list">${jobs.length?jobs.map(j=>record(j.reference,`${chip(j.status,j.status==='completed'?'good':'')} ${chip(j.service)}`,`<p>${safe(j.notes||'')}</p><p>${date(j.completed_at||j.scheduled_at)}</p>`)).join(''):empty()}</div>`;
  if(section==='profile') return renderProfile(false);
  if(section==='install') return renderInstall();
  return empty();
}
function renderProfile(owner){
  const p=state.profile||{};
  return `<section class="panel"><p class="account-eyebrow">${owner?L('Owner account','Cuenta de dueño'):L('Your profile','Tu perfil')}</p><h2>${L('Keep the useful details current.','Mantén los datos útiles al día.')}</h2><form class="inline-form" data-form="save-profile"><input name="fullName" value="${safe(p.full_name||'')}" placeholder="${L('Full name','Nombre completo')}"><input name="phone" value="${safe(p.phone||'')}" placeholder="${L('Phone','Teléfono')}"><select name="preferredLanguage"><option value="en" ${p.preferred_language==='en'?'selected':''}>English</option><option value="es" ${p.preferred_language==='es'?'selected':''}>Español</option></select><select name="preferredContact"><option ${p.preferred_contact==='Text'?'selected':''}>Text</option><option ${p.preferred_contact==='Call'?'selected':''}>Call</option><option ${p.preferred_contact==='Email'?'selected':''}>Email</option></select><input class="span-4" name="serviceAddress" value="${safe(p.service_address||'')}" placeholder="${L('Saved service address (optional)','Domicilio guardado (opcional)')}"><button class="account-primary" type="submit">${L('Save profile','Guardar perfil')}</button></form><p><small>Email: ${safe(p.email||state.auth.email)}</small></p></section>`;
}
function renderInstall(){
  return `<div class="install-card"><p class="account-eyebrow" style="color:#bad6c6">${L('Member benefit · always optional','Beneficio · siempre opcional')}</p><h2 style="font:500 2.2rem Georgia,serif;margin:.4rem 0">${L('Keep Ramiro Landscaping one tap away.','Ten Ramiro Landscaping a un toque.')}</h2><p>${L('Install the private account experience for faster access. Nothing is installed unless you choose it.','Instala la experiencia privada para acceso rápido. Nada se instala sin tu elección.')}</p><div class="actions-row"><button class="account-primary" data-action="install-pwa" type="button">${L('Add to phone','Agregar al teléfono')}</button></div></div>`;
}

function bindPortalActions(){
  $$('[data-action="go-section"]').forEach(b=>b.addEventListener('click',()=>{currentSection=b.dataset.id;renderPortal()}));
  $$('[data-action="refresh-all"]').forEach(b=>b.addEventListener('click',async()=>{await refreshState(false,true);toast(L('Business data refreshed.','Datos actualizados.'))}));
  $$('[data-action="refresh-traffic"]').forEach(b=>b.addEventListener('click',()=>refreshTraffic(true)));
  $$('[data-action="copy-qr-link"]').forEach(b=>b.addEventListener('click',async()=>{const link='https://ramirolandscapingoc.com/?src=business-card-qr';try{await navigator.clipboard.writeText(link);toast(L('QR tracking link copied.','Enlace QR copiado.'))}catch{toast(link)}}));
  $$('[data-action="install-pwa"]').forEach(b=>b.addEventListener('click',installPwa));
  $$('[data-action="view-document"]').forEach(b=>b.addEventListener('click',()=>openDocument(b.dataset.id)));
  $$('[data-action="publish-document"]').forEach(b=>b.addEventListener('click',async()=>{try{await act('publish-document',{id:b.dataset.id});toast(L('Document published.','Documento publicado.'))}catch(e){toast(e.message)}}));
  $$('[data-action="sign-document"]').forEach(b=>b.addEventListener('click',()=>signDocumentPrompt(b.dataset.id,b.dataset.role)));
  $$('[data-action="message-customer"]').forEach(b=>b.addEventListener('click',()=>{currentSection='messages';renderPortal();setTimeout(()=>{$('textarea[name="message"]')?.focus()},0)}));
  $$('[data-action="quote-for-lead"]').forEach(b=>b.addEventListener('click',()=>{draftLeadId=b.dataset.id;currentSection='quotes';renderPortal()}));
  $$('[data-action="job-for-lead"]').forEach(b=>b.addEventListener('click',()=>{draftLeadId=b.dataset.id;currentSection='jobs';renderPortal()}));
  $$('[data-action="billing-for-job"]').forEach(b=>b.addEventListener('click',()=>{draftJobId=b.dataset.id;currentSection='billing';renderPortal()}));
  $$('[data-action="contract-for-job"]').forEach(b=>b.addEventListener('click',()=>{draftJobId=b.dataset.id;currentSection='contracts';renderPortal()}));
  $$('[data-form]').forEach(form=>form.addEventListener('submit',handlePortalForm));
}
async function handlePortalForm(e){
  e.preventDefault();const form=e.currentTarget,kind=form.dataset.form,fd=new FormData(form),v=n=>fd.get(n);
  try{
    if(kind==='save-profile') await act('save-profile',{fullName:v('fullName'),phone:v('phone'),preferredLanguage:v('preferredLanguage'),preferredContact:v('preferredContact'),serviceAddress:v('serviceAddress')});
    if(kind==='send-message') await act('send-message',{userId:form.dataset.user,message:v('message'),jobId:form.dataset.job||null});
    if(kind==='create-lead') await act('create-lead',{name:v('name'),email:v('email'),phone:v('phone'),city:v('city'),service:v('service'),source:v('source'),heat:v('heat'),status:v('status'),nextAction:v('nextAction'),recurring:fd.has('recurring')});
    if(kind==='lead-update') await act('lead-status',{id:form.dataset.id,status:v('status'),heat:v('heat'),nextAction:v('nextAction')});
    if(kind==='create-quote') {await act('create-quote',{leadId:v('leadId'),service:v('service'),estimatedMin:v('estimatedMin'),estimatedMax:v('estimatedMax'),summary:v('summary')});draftLeadId=''}
    if(kind==='quote-approve') await act('quote-approve',{id:form.dataset.id,amount:v('amount'),status:v('status'),createJob:fd.has('createJob')});
    if(kind==='create-job') {await act('create-job',{quoteId:v('quoteId'),leadId:v('leadId'),service:v('service'),serviceAddress:v('serviceAddress'),contractValue:v('contractValue'),notes:v('notes')});draftLeadId='';draftQuoteId=''}
    if(kind==='job-update') await act('job-status',{id:form.dataset.id,status:v('status'),notes:v('notes')});
    if(kind==='schedule-job') await act('schedule-job',{id:form.dataset.id,scheduledAt:v('scheduledAt')});
    if(kind==='record-payment') await act('record-payment',{jobId:form.dataset.id,amount:v('amount'),method:v('method'),note:v('note')});
    if(kind==='add-cost') await act('add-cost',{jobId:form.dataset.id,category:v('category'),amount:v('amount'),note:v('note')});
    if(kind==='update-rate') await act('update-rate',{key:form.dataset.key,value:v('value')});
    if(kind==='create-document') {const amount=v('amount'),itemAmount=v('itemAmount');await act('create-document',{kind:v('kind'),customerKey:v('customerKey'),jobId:v('jobId')||null,title:v('title'),amount,scope:v('scope'),terms:v('terms'),items:v('itemDescription')?[{description:v('itemDescription'),amount:itemAmount||amount}]:[]});draftJobId='';draftLeadId=''}
    toast(L('Saved.','Guardado.'));form.reset();
  }catch(err){toast(err.message)}
}
function openDocument(id){
  const d=(state.documents||[]).find(x=>x.id===id);if(!d)return;
  const wrap=document.createElement('div');wrap.className='document-view';
  wrap.innerHTML=`<div class="document-toolbar"><button data-print>${L('Print / Save PDF','Imprimir / Guardar PDF')}</button><button data-close>${L('Close','Cerrar')}</button></div>${d.content_html||'<article class="professional-document"><h1>Document unavailable</h1></article>'}`;
  document.body.appendChild(wrap);$('[data-close]',wrap).onclick=()=>wrap.remove();$('[data-print]',wrap).onclick=()=>window.print();
}
async function signDocumentPrompt(id,role){
  const d=(state.documents||[]).find(x=>x.id===id);if(!d)return;
  openDocument(id);const wrap=$('.document-view:last-of-type');const box=document.createElement('div');box.className='professional-document signature-box';
  box.innerHTML=`<h2>${L('Electronic signature','Firma electrónica')}</h2><p>${L('Review the complete document above before signing.','Revisa el documento completo antes de firmar.')}</p><label class="form-field">${L('Legal name','Nombre legal')}<input id="sig-name" value="${safe(state.profile?.full_name||state.auth.name||'')}"></label><label style="display:flex;gap:8px;align-items:flex-start;margin:14px 0"><input id="sig-consent" type="checkbox"> <span>${L('I reviewed this document and intend to sign it electronically.','Revisé este documento y deseo firmarlo electrónicamente.')}</span></label><div class="signature-name" id="sig-preview"></div><button class="account-primary" id="sig-submit" type="button">${L('Sign document','Firmar documento')}</button>`;
  wrap.appendChild(box);const input=$('#sig-name',box),prev=$('#sig-preview',box),sync=()=>prev.textContent=input.value;input.oninput=sync;sync();
  $('#sig-submit',box).onclick=async()=>{if(!$('#sig-consent',box).checked){toast(L('Please confirm electronic signature consent.','Confirma el consentimiento de firma electrónica.'));return}try{await act('sign-document',{id,signerName:input.value,consent:'I reviewed this document and intend to sign it electronically.'});wrap.remove();toast(L('Signed and time stamped.','Firmado con fecha y hora.'))}catch(e){toast(e.message)}};
}
async function installPwa(){
  if(window.matchMedia('(display-mode: standalone)').matches){toast(L('Ramiro Landscaping is already installed.','Ramiro Landscaping ya está instalado.'));return}
  if(installPrompt){installPrompt.prompt();const result=await installPrompt.userChoice;installPrompt=null;toast(result.outcome==='accepted'?L('Added to your phone.','Agregado al teléfono.'):L('Installation was not completed.','No se completó la instalación.'));return}
  const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);toast(isiOS?L('On iPhone: tap Share, then Add to Home Screen.','En iPhone: toca Compartir y Agregar a pantalla de inicio.'):L('Use your browser menu and choose Install app / Add to Home screen.','Usa el menú del navegador y elige Instalar app / Agregar a inicio.'));
}

window.addEventListener('online',()=>$('#sync-pill')?.classList.remove('offline'));
window.addEventListener('offline',()=>$('#sync-pill')?.classList.add('offline'));
initializeAuth();
