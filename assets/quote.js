(() => {
'use strict';
const form=document.getElementById('quote-form');if(!form)return;
form.noValidate=true; form.querySelectorAll('[data-declare],[data-photo-declare]').forEach(c=>c.remove());
const tr=(en,es)=>document.documentElement.lang==='es'?es:en;
const bi=(en,es)=>`<span data-lang="en">${en}</span><span data-lang="es">${es}</span>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const steps=[...form.querySelectorAll('.quote-step')],next=document.getElementById('next'),back=document.getElementById('back'),error=document.getElementById('form-error');
const control=name=>form.elements.namedItem(name);
let step=0,photos=[],busy=false,uploading=false;
const branches={
 irrigation:{label:['What are you noticing?','¿Qué observa?'],options:[['unsure','Not sure','No estoy seguro'],['leak','Leak','Fuga'],['broken','Broken sprinkler','Aspersor roto'],['dry','Area not receiving water','Área sin agua'],['timer','Controller / timer issue','Problema con controlador / temporizador'],['off','System will not turn on','El sistema no enciende'],['uneven','Uneven watering','Riego irregular']],tip:['Take a wide photo of the affected area and a close photo of the sprinkler or visible leak.','Tome una foto amplia del área afectada y una cercana del aspersor o fuga visible.']},
 lawn:{label:['Where does the lawn need attention?','¿Dónde necesita atención el césped?'],options:[['unsure','Not sure','No estoy seguro'],['front','Front yard','Jardín delantero'],['back','Backyard','Patio trasero'],['both','Both','Ambos']],tip:['Show the full lawn and a close view of dry, bare or worn areas.','Muestre todo el césped y una vista cercana de áreas secas, sin pasto o desgastadas.']},
 flowers:{label:['What needs care?','¿Qué necesita cuidado?'],options:[['unsure','Not sure','No estoy seguro'],['roses','Roses','Rosas'],['flowers','Flowers / garden beds','Flores / camas de jardín'],['planting','New planting','Plantas nuevas']],tip:['Show the entire plant or flower bed, plus a closer view of leaves or flowers.','Muestre la planta o área de flores completa y una vista cercana de hojas o flores.']},
 trimming:{label:['What would you like trimmed?','¿Qué le gustaría podar?'],options:[['unsure','Not sure','No estoy seguro'],['shrubs','Shrubs','Arbustos'],['plants','Garden plants','Plantas del jardín']],tip:['Show the whole shrub or plant, including nearby structures and access.','Muestre todo el arbusto o planta, incluyendo estructuras cercanas y acceso.']},
 maintenance:{label:['What matters most?','¿Qué le importa más?'],options:[['unsure','Not sure','No estoy seguro'],['general','Overall garden care','Cuidado general del jardín'],['overgrown','Overgrown areas','Áreas descuidadas'],['tidy','Keeping the space tidy','Mantener el espacio ordenado']],tip:['Show a wide view of your yard and the areas that need regular attention.','Muestre una vista amplia del jardín y las áreas que necesitan atención regular.']},
 cleanup:{label:['What needs cleaning up?','¿Qué necesita limpieza?'],options:[['unsure','Not sure','No estoy seguro'],['overgrown','Overgrown plants / beds','Plantas / áreas descuidadas'],['leaves','Leaves and garden debris','Hojas y residuos del jardín']],tip:['Show the whole area and the main spots you want cleared.','Muestre el área completa y las partes que desea limpiar.']},
 improvements:{label:['What would you like to improve?','¿Qué le gustaría mejorar?'],options:[['unsure','Not sure','No estoy seguro'],['planting','Planting and color','Plantas y color'],['lawn','Lawn area','Área de césped'],['overall','Overall garden appearance','Aspecto general del jardín']],tip:['Show a wide view of the space and any area you would like to change.','Muestre una vista amplia del espacio y las partes que desea cambiar.']}
};
function optionMarkup(options){return options.map(([v,en,es])=>`<option value="${v}" data-en="${esc(en)}" data-es="${esc(es)}">${esc(tr(en,es))}</option>`).join('');}
function adaptive(){
 const key=control('service').value,b=branches[key];
 document.getElementById('adaptive-fields').innerHTML=b?`<div class="field"><label for="project-type">${bi(...b.label)}</label><select id="project-type" name="project-type">${optionMarkup(b.options)}</select></div>`:'';
 if(key==='lawn')document.getElementById('adaptive-fields').insertAdjacentHTML('beforeend',`<div class="form-grid"><div class="field"><label for="yard-size">${bi('Approximate size','Tamaño aproximado')}</label><select id="yard-size" name="yard-size">${optionMarkup([['unsure','Not sure','No estoy seguro'],['small','Small','Pequeño'],['medium','Medium','Mediano'],['large','Large','Grande']])}</select></div><div class="field"><label for="lawn-condition">${bi('Current condition','Estado actual')}</label><select id="lawn-condition" name="lawn-condition">${optionMarkup([['unsure','Not sure','No estoy seguro'],['existing','Existing lawn','Césped existente'],['bare','Bare area','Área sin pasto'],['damaged','Damaged lawn','Césped dañado']])}</select></div></div>`);
 document.getElementById('photo-guidance').innerHTML=bi(...(b?.tip||['Start with a wide view and add a close view of the problem.','Empiece con una vista amplia y agregue otra cercana del problema.']));
 document.getElementById('general-followup').hidden=!['maintenance','cleanup','unsure','other'].includes(key);
 control('frequency').value=key==='cleanup'?'once':'unsure';
}
function localize(){
 form.querySelectorAll('option[data-en]').forEach(o=>o.textContent=tr(o.dataset.en,o.dataset.es));
 if(!error.hidden && error.dataset.en)error.textContent=tr(error.dataset.en,error.dataset.es);
 document.getElementById('step-label').textContent=tr(`Step ${step+1} of 8`,`Paso ${step+1} de 8`);
 document.getElementById('quote-progress').setAttribute('aria-label',tr('Quote progress','Progreso de la solicitud'));
 if(step===6)readiness();if(step===7)summary();areaFeedback();renderPhotos();
}
function saveProgress(){try{localStorage.setItem('ramiro-quote-progress',JSON.stringify({service:control('service').value,step,at:Date.now()}));}catch(_){} }
function show(n,focus=true){
 step=Math.max(0,Math.min(7,n));steps.forEach((s,i)=>s.hidden=i!==step);back.hidden=step===0;next.hidden=step===7;
 document.getElementById('quote-progress').value=step+1;error.hidden=true;
 localize();saveProgress();if(focus){steps[step].querySelector('h2').focus({preventScroll:true});form.scrollIntoView({block:'start',behavior:'instant'});}
}
function fail(en,es){error.dataset.en=en;error.dataset.es=es;error.textContent=tr(en,es);error.hidden=false;error.focus();return false;}
function valid(index){
 const panel=steps[index];
 if(index===5){const mode=control('preferred-contact').value;control('phone').required=mode!=='Email';control('email').required=mode==='Email';const phone=control('phone').value.trim();if(mode!=='Email'&&phone.replace(/\D/g,'').length<10)return fail('Please add a phone number with at least 10 digits.','Agregue un teléfono con al menos 10 dígitos.');}
 for(const c of panel.querySelectorAll('input,select,textarea')){if(!c.disabled&&(!c.checkValidity()||(c.required&&!String(c.value).trim()))){error.dataset.en='Please complete the highlighted field with valid information.';error.dataset.es='Complete el campo indicado con información válida.';error.textContent=tr(error.dataset.en,error.dataset.es);error.hidden=false;c.setAttribute('aria-invalid','true');if(!panel.hidden)c.focus();return false;}}
 return true;
}
function areaFeedback(){let en='Orange County is our service region. We’ll confirm availability for your city.',es='Orange County es nuestra región de servicio. Confirmaremos disponibilidad para su ciudad.';if(control('county').value==='no'){en='This may be outside our normal region. You can still ask; availability must be confirmed.';es='Es posible que esté fuera de nuestra región habitual. Puede consultar; necesitamos confirmar disponibilidad.';}else if(control('county').value==='unsure'){en='Tell us your city and ZIP so we can check whether your project is within reach.';es='Indique su ciudad y código postal para consultar si podemos atender su proyecto.';}document.getElementById('area-feedback').textContent=tr(en,es);}
function readiness(){
 let items=[];if(!control('area').value.trim())items.push(tr('Add your city so we can check availability.','Agregue su ciudad para consultar disponibilidad.'));
 if(!photos.length)items.push(tr('A wide yard photo would help, but is optional.','Una foto amplia del jardín ayudaría, pero es opcional.'));
 if(!control('message').value.trim())items.push(tr('A short description would help explain what needs care.','Una breve descripción ayudaría a explicar qué necesita cuidado.'));
 document.getElementById('readiness').innerHTML=`<h3>${esc(tr('Everything needed to send is ready.','Lo necesario para enviar está listo.'))}</h3>`+(items.length?'<ul>'+items.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':`<p>${esc(tr('Your details and photos are ready for review.','Sus detalles y fotos están listos para revisión.'))}</p>`);
}
function label(name){const c=control(name);if(!c)return '';return c.tagName==='SELECT'?c.selectedOptions[0]?.textContent||'':c.value;}
function rows(){return [[tr('Service','Servicio'),label('service'),0],[tr('Project detail','Detalle del proyecto'),[label('project-type'),label('yard-size'),label('lawn-condition'),control('project-detail').value].filter(Boolean).join(' · '),1],[tr('Frequency','Frecuencia'),document.getElementById('general-followup').hidden?'':label('frequency'),1],[tr('City / ZIP','Ciudad / código postal'),[control('area').value,control('zip').value].filter(Boolean).join(' '),2],[tr('Photos','Fotos'),String(photos.length),3],[tr('Description','Descripción'),control('message').value,4],[tr('Customer','Cliente'),control('name').value,5],[tr('Contact','Contacto'),[label('preferred-contact'),control('phone').value,control('email').value].filter(Boolean).join(' · '),5],[tr('Language','Idioma'),control('preferred-language').value,5],[tr('Timing','Fecha'),label('timing'),5]];}
function summary(){document.getElementById('review-summary').innerHTML=rows().filter(r=>r[1]).map(([a,b,n])=>`<div class="summary-row"><strong>${esc(a)}</strong><span>${esc(b)}</span></div><button type="button" class="review-edit" data-edit="${n}">${esc(tr('Edit','Editar'))} ${esc(a.toLowerCase())}</button>`).join('');document.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>show(Number(b.dataset.edit))));}
function leadSummary(){const fd=new FormData(form);const val=k=>String(fd.get(k)||'');return ['NEW JARDÍN DE RAMIRO REQUEST',`Reference: ${val('reference')}`,`Coordinator: Ulysess Ortiz — contact@ulysessortiz.com`,`Customer: ${val('name')}`,`Phone: ${val('phone')}`,`Email: ${val('email')}`,`Preferred contact: ${val('preferred-contact')}`,`PREFERRED LANGUAGE: ${val('preferred-language')}`,`City: ${val('area')}`,`ZIP: ${val('zip')}`,`Orange County: ${val('county')}`,`Service: ${val('service')}`,`Project type: ${val('project-type')}`,`Detail: ${val('project-detail')}`,`Yard size: ${val('yard-size')}`,`Lawn condition: ${val('lawn-condition')}`,`Frequency: ${document.getElementById('general-followup').hidden?'N/A':val('frequency')}`,`Timing: ${val('timing')}`,`Description: ${val('message')}`,`Photos: ${photos.length} — attached to request`, 'STATUS: Needs Ramiro review / Needs price'].join('\n');}
async function canvasBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error(tr('This photo could not be prepared. Try a different image.','No se pudo preparar esta foto. Intente con otra.'))),'image/jpeg',quality));}
async function compress(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error(tr('Use a JPG, PNG or WebP photo.','Use una foto JPG, PNG o WebP.'));
 if(file.size>8*1024*1024)throw new Error(tr('Each original photo must be 8 MB or less.','Cada foto original debe pesar 8 MB o menos.'));
 const header=new Uint8Array(await file.slice(0,12).arrayBuffer());const jpg=header[0]===255&&header[1]===216&&header[2]===255,png=header[0]===137&&header[1]===80&&header[2]===78&&header[3]===71,webp=String.fromCharCode(...header.slice(0,4))==='RIFF'&&String.fromCharCode(...header.slice(8,12))==='WEBP';
 if(!jpg&&!png&&!webp)throw new Error(tr('This file does not appear to be a supported photo.','Este archivo no parece ser una foto compatible.'));
 const url=URL.createObjectURL(file),im=new Image();
 try{
  await new Promise((ok,no)=>{im.onload=ok;im.onerror=()=>no(new Error(tr('This photo could not be opened. Try a different image.','No se pudo abrir esta foto. Intente con otra.')));im.src=url;});
  let maxSide=1600,quality=.82,blob;
  for(let attempt=0;attempt<3;attempt++){
   const scale=Math.min(1,maxSide/Math.max(im.naturalWidth,im.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(im.naturalWidth*scale));canvas.height=Math.max(1,Math.round(im.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(im,0,0,canvas.width,canvas.height);
   blob=await canvasBlob(canvas,quality);if(blob.size<=700*1024)break;maxSide=Math.max(1000,Math.round(maxSide*.78));quality=Math.max(.56,quality-.12);
  }
  if(!blob||blob.size>700*1024)throw new Error(tr('This photo is still too large. Try a closer or smaller photo.','Esta foto sigue siendo demasiado grande. Intente con otra más pequeña.'));
  return new File([blob],`yard-photo-${photos.length+1}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
 }finally{URL.revokeObjectURL(url);}
}
function discardPhoto(index){const [removed]=photos.splice(index,1);if(removed?.url)URL.revokeObjectURL(removed.url);}
function clearPhotos(){photos.forEach(p=>{if(p.url)URL.revokeObjectURL(p.url);});photos=[];}
function renderPhotos(){const list=document.getElementById('photo-list');list.replaceChildren();photos.forEach((p,i)=>{const fig=document.createElement('figure');fig.className='upload-photo';const img=document.createElement('img');img.src=p.url;img.alt=tr(`Your yard photo ${i+1}`,`Su foto del jardín ${i+1}`);const button=document.createElement('button');button.type='button';button.textContent=tr(`Remove photo ${i+1}`,`Quitar foto ${i+1}`);button.addEventListener('click',()=>{discardPhoto(i);renderPhotos();document.getElementById('photo-status').textContent=tr('Photo removed.','Foto eliminada.');});fig.append(img,button);list.append(fig);});}
async function addPhotos(e){if(uploading)return;const selected=[...e.target.files];uploading=true;next.disabled=true;document.getElementById('photo-status').textContent=tr('Preparing photos…','Preparando fotos…');let issue='';try{for(const file of selected){if(photos.length>=6){issue=tr('You can add up to six photos.','Puede agregar hasta seis fotos.');break;}try{const prepared=await compress(file);photos.push({file:prepared,url:URL.createObjectURL(prepared)});}catch(err){issue=err.message;}}renderPhotos();document.getElementById('photo-status').textContent=issue||tr(`${photos.length} photos ready.`,`${photos.length} fotos listas.`);}finally{uploading=false;next.disabled=false;e.target.value='';}}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(busy||uploading)return;if(control('bot-field').value)return fail('Please try again or contact us directly.','Intente de nuevo o contáctenos directamente.');
 for(let i=0;i<8;i++){if(!valid(i)){show(i,false);valid(i);return;}}
 if(step!==7){show(7);return;}
 if(!navigator.onLine)return fail('You appear to be offline. Your details are still here. Reconnect and try again, or call us.','Parece que no hay conexión. Sus datos siguen aquí. Reconéctese e intente de nuevo o llámenos.');
 if(!control('reference').value){const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);control('reference').value='JDR-'+Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('').toUpperCase();}
 control('summary').value=leadSummary();control('subject').value=`Jardín de Ramiro ${control('reference').value} — ${control('preferred-language').value}`;
 const body=new FormData(form);body.delete('project-type');body.append('project-type',control('project-type')?.value||'');body.set('yard-size',control('yard-size')?.value||'');body.set('lawn-condition',control('lawn-condition')?.value||'');body.set('frequency',document.getElementById('general-followup').hidden?'':control('frequency').value);
 photos.forEach((p,i)=>body.append(`photo-${i+1}`,p.file,p.file.name));
 let requestBytes=0;for(const value of body.values())requestBytes+=typeof value==='string'?new TextEncoder().encode(value).length:value.size;if(requestBytes>7*1024*1024)return fail('The request is too large. Remove a photo and try again.','La solicitud es demasiado grande. Quite una foto e intente de nuevo.');
 busy=true;const send=document.getElementById('send-request');send.disabled=true;send.textContent=tr('Sending…','Enviando…');back.disabled=true;
 const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),30000);
 try{
 const response=await fetch('/get-a-quote/',{method:'POST',body,signal:abort.signal,redirect:'follow'});
 // A site page served by a preview/local server must never be interpreted as delivery.
 if(!response.ok)throw new Error('rejected');
 const content=await response.text();if(/id=["']quote-form["']/.test(content))throw new Error('unprocessed');
 form.hidden=true;const confirmation=document.getElementById('confirmation');const ref=control('reference').value;
 confirmation.innerHTML=`<h2>${bi('We’ve got it.','Ya lo recibimos.')}</h2><p>${bi('Your request has been received. We’ll review the information and photos with Ramiro and contact you about the next step.','Recibimos su solicitud. Revisaremos la información y fotos con Ramiro y le contactaremos sobre el siguiente paso.')}</p><p class="reference">${esc(ref)}</p><p>${esc(label('service'))}<br>${esc(label('preferred-contact'))} · ${esc(control('preferred-language').value)}</p><p>${bi('Next step: Ramiro reviews the project, then we’ll contact you about the work and availability.','Siguiente paso: Ramiro revisa el proyecto y después le contactaremos sobre el trabajo y la disponibilidad.')}</p><div class="hero-actions"><a class="btn btn-dark" href="mailto:contact@ulysessortiz.com?subject=${encodeURIComponent('Additional information '+ref)}">${bi('Add information','Agregar información')}</a><a class="btn btn-outline" href="sms:+17145748095?body=${encodeURIComponent(ref)}">${bi('Text us','Envíenos un mensaje')}</a><a class="btn btn-outline" href="/">${bi('Return home','Volver al inicio')}</a></div>`;confirmation.hidden=false;confirmation.focus();try{localStorage.removeItem('ramiro-quote-progress');}catch(_){}
 clearPhotos();
 }catch(_){fail('We could not confirm delivery. Your details are still here. If the connection was interrupted, include your reference when contacting us before sending again: '+control('reference').value,'No pudimos confirmar la entrega. Sus datos siguen aquí. Si se interrumpió la conexión, incluya su referencia al contactarnos antes de enviar otra vez: '+control('reference').value);}
 finally{clearTimeout(timeout);busy=false;send.disabled=false;back.disabled=false;send.innerHTML=bi('Send for review','Enviar para revisión');}
});
// Declare adaptive fields in static HTML so Netlify recognizes every submitted name.
form.addEventListener('input',e=>{if(e.target.checkValidity?.())e.target.removeAttribute('aria-invalid');});
next.addEventListener('click',()=>{if(valid(step))show(step+1);});back.addEventListener('click',()=>show(step-1));
control('service').addEventListener('change',()=>{adaptive();saveProgress();});control('county').addEventListener('change',areaFeedback);
control('preferred-contact').addEventListener('change',()=>{control('phone').required=control('preferred-contact').value!=='Email';control('email').required=control('preferred-contact').value==='Email';});
for(const id of ['camera','photo-picker'])document.getElementById(id).addEventListener('change',addPhotos);
document.addEventListener('languagechange',localize);
form.querySelector('.wizard-progress').hidden=false;form.querySelector('.wizard-controls').hidden=false;
const params=new URLSearchParams(location.search);let saved;try{saved=JSON.parse(localStorage.getItem('ramiro-quote-progress'));}catch(_){}
if(params.get('service')&&[...control('service').options].some(x=>x.value===params.get('service')))control('service').value=params.get('service');
else if(saved&&Date.now()-saved.at<7*86400000&&[...control('service').options].some(x=>x.value===saved.service)){control('service').value=saved.service;document.getElementById('resume-note').textContent=tr('Your service choice was remembered. Add your details again; contact information and photos are not saved on this device.','Recordamos el servicio elegido. Agregue sus detalles otra vez; no guardamos datos de contacto ni fotos en este dispositivo.');}
control('preferred-language').value=document.documentElement.lang==='es'?'Español':'English';adaptive();show(0,false);
})();
