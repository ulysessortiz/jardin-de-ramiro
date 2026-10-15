import { readFileSync, writeFileSync, copyFileSync, appendFileSync, rmSync } from 'node:fs';

const mustReplace = (text, pattern, replacement, label) => {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`Business depth pass could not patch ${label}. Protected build stopped.`);
  return next;
};

// 1) Replace the generated account client with the deeper cumulative owner/member client.
copyFileSync('business-depth/account-source.mjs', 'assets/account-source.mjs');
copyFileSync('business-depth/owner-traffic.mjs', 'netlify/functions/owner-traffic.mjs');

// 2) Add owner operating-desk styles without changing public-site styling.
const cssPath = 'assets/account.css';
const depthCss = readFileSync('business-depth/account-depth.css', 'utf8');
let accountCss = readFileSync(cssPath, 'utf8');
if (!accountCss.includes('RAMIRO_OWNER_BUSINESS_DEPTH_2026_10_15')) {
  appendFileSync(cssPath, `\n${depthCss}\n`, 'utf8');
}

// 3) Deepen account API actions while preserving the protected API architecture.
const apiPath = 'netlify/functions/account-api.mjs';
let api = readFileSync(apiPath, 'utf8');

api = mustReplace(
  api,
  /q\(`SELECT j\.\*,p\.full_name AS customer_name,p\.email AS customer_email FROM ramiro_jobs j LEFT JOIN ramiro_profiles p ON p\.user_id=j\.user_id ORDER BY j\.updated_at DESC LIMIT 120`\)/,
  "q(`SELECT j.*,COALESCE(p.full_name,l.name) AS customer_name,COALESCE(p.email,l.email) AS customer_email,l.phone AS customer_phone,l.city AS customer_city FROM ramiro_jobs j LEFT JOIN ramiro_profiles p ON p.user_id=j.user_id LEFT JOIN ramiro_quotes jq ON jq.id=j.quote_id LEFT JOIN ramiro_leads l ON l.id=jq.lead_id ORDER BY j.updated_at DESC LIMIT 120`)",
  'owner job contact join'
);

api = mustReplace(
  api,
  /  if \(action === 'create-lead'\) \{[\s\S]*?\n  \}\n  if \(action === 'lead-status'\) \{/,
`  if (action === 'create-lead') {
    const lid=id('LEAD'), ref=id('RL');
    const status=['prospect','new','review','follow_up','won','lost'].includes(body.status)?body.status:'prospect';
    await q(\`INSERT INTO ramiro_leads(id,reference,name,email,phone,city,zip,service,language,source,status,heat,next_action,recurring_opportunity)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)\`,[lid,ref,cleanText(body.name,120),cleanEmail(body.email),cleanPhone(body.phone),cleanText(body.city,100),cleanText(body.zip,20),cleanText(body.service,80),body.language==='es'?'es':'en',cleanText(body.source||'owner prospect',80),status,cleanText(body.heat||'warm',20),cleanText(body.nextAction,500),Boolean(body.recurring)]);
    await audit(auth,'lead_created','lead',lid,{reference:ref,source:body.source||'owner prospect'}); return {ok:true,id:lid,reference:ref};
  }
  if (action === 'lead-status') {`,
  'enhanced lead creation'
);

api = mustReplace(
  api,
  "  if (action === 'quote-approve') {",
`  if (action === 'create-quote') {
    const leadId=cleanText(body.leadId,120); if(!leadId) throw Object.assign(new Error('Lead is required'),{status:400});
    const lead=await one(\`SELECT * FROM ramiro_leads WHERE id=$1\`,[leadId]); if(!lead) throw Object.assign(new Error('Lead not found'),{status:404});
    const qid=id('Q'), ref=id('RL-Q'), service=cleanText(body.service||lead.service,100), estimatedMin=money(body.estimatedMin), estimatedMax=money(body.estimatedMax), summary=cleanText(body.summary||lead.ai_summary||lead.next_action,5000);
    const original={manual:true,source:'owner',leadReference:lead.reference};
    const intelligence={confidence:'owner-entered',createdBy:'business owner'};
    await q(\`INSERT INTO ramiro_quotes(id,lead_id,user_id,reference,status,service,original_data,customer_summary,ramiro_spanish,intelligence,estimated_min,estimated_max)
      VALUES($1,$2,$3,$4,'review',$5,$6::jsonb,$7,$8,$9::jsonb,$10,$11)\`,[qid,lead.id,lead.user_id||null,ref,service,JSON.stringify(original),summary,lead.ramiro_spanish||'',JSON.stringify(intelligence),estimatedMin,estimatedMax]);
    await q(\`UPDATE ramiro_leads SET status=CASE WHEN status='prospect' THEN 'review' ELSE status END,updated_at=NOW() WHERE id=$1\`,[lead.id]);
    await audit(auth,'quote_created','quote',qid,{reference:ref,leadId:lead.id}); return {ok:true,id:qid,reference:ref};
  }
  if (action === 'create-job') {
    let quoteId=cleanText(body.quoteId,120)||null; const leadId=cleanText(body.leadId,120)||null; const contractValue=money(body.contractValue);
    let quote=quoteId?await one(\`SELECT * FROM ramiro_quotes WHERE id=$1\`,[quoteId]):null;
    let lead=leadId?await one(\`SELECT * FROM ramiro_leads WHERE id=$1\`,[leadId]):null;
    if(!lead&&quote?.lead_id) lead=await one(\`SELECT * FROM ramiro_leads WHERE id=$1\`,[quote.lead_id]);
    if(!quoteId&&lead){
      const qid=id('Q'),qref=id('RL-Q'); quoteId=qid;
      await q(\`INSERT INTO ramiro_quotes(id,lead_id,user_id,reference,status,service,original_data,customer_summary,intelligence,approved_amount) VALUES($1,$2,$3,$4,'accepted',$5,$6::jsonb,$7,$8::jsonb,$9)\`,[qid,lead.id,lead.user_id||null,qref,cleanText(body.service||lead.service,100),JSON.stringify({manualJob:true,source:'owner'}),cleanText(body.notes||lead.ai_summary,5000),JSON.stringify({confidence:'owner-entered'}),contractValue]);
      quote=await one(\`SELECT * FROM ramiro_quotes WHERE id=$1\`,[qid]);
    }
    const service=cleanText(body.service||quote?.service||lead?.service,100); if(!service) throw Object.assign(new Error('Service is required'),{status:400});
    const jid=id('JOB'),ref=id('RL-J'),userId=quote?.user_id||lead?.user_id||null;
    await q(\`INSERT INTO ramiro_jobs(id,quote_id,user_id,reference,service,service_address,status,contract_value,notes) VALUES($1,$2,$3,$4,$5,$6,'secured',$7,$8)\`,[jid,quoteId,userId,ref,service,cleanText(body.serviceAddress,240),contractValue,cleanText(body.notes,3000)]);
    if(lead) await q(\`UPDATE ramiro_leads SET status='won',updated_at=NOW() WHERE id=$1\`,[lead.id]);
    await audit(auth,'job_created','job',jid,{reference:ref,quoteId,leadId:lead?.id||null}); return {ok:true,id:jid,reference:ref};
  }
  if (action === 'quote-approve') {`,
  'quote and job creation actions'
);

api = mustReplace(
  api,
  /  if \(action === 'create-document'\) \{[\s\S]*?\n  \}\n  if \(action === 'publish-document'\) \{/,
`  if (action === 'create-document') {
    const kind=['invoice','receipt','contract','change_order'].includes(body.kind)?body.kind:'invoice';
    const job=body.jobId?await one(\`SELECT * FROM ramiro_jobs WHERE id=$1\`,[body.jobId]):null;
    const customerKey=cleanText(body.customerKey,180);
    let requestedUserId='',lead=null,profile=null;
    if(customerKey.startsWith('member:')) requestedUserId=customerKey.slice(7);
    if(customerKey.startsWith('lead:')) lead=await one(\`SELECT * FROM ramiro_leads WHERE id=$1\`,[customerKey.slice(5)]);
    if(!lead&&job?.quote_id){const linked=await one(\`SELECT lead_id FROM ramiro_quotes WHERE id=$1\`,[job.quote_id]);if(linked?.lead_id)lead=await one(\`SELECT * FROM ramiro_leads WHERE id=$1\`,[linked.lead_id]);}
    let userId=requestedUserId||lead?.user_id||job?.user_id||'';
    if(userId) profile=await profileFor(userId);
    if(!profile&&lead?.user_id){profile=await profileFor(lead.user_id);if(profile)userId=lead.user_id;}
    if(!profile&&!lead&&!job) throw Object.assign(new Error('Customer or contact is required'),{status:400});
    const amount=money(body.amount ?? job?.contract_value);
    const deliveryMode=userId?'portal':'manual';
    const data={
      customerName:cleanText(body.customerName||profile?.full_name||lead?.name||'Customer',120),customerEmail:cleanEmail(body.customerEmail||profile?.email||lead?.email),customerPhone:cleanPhone(body.customerPhone||profile?.phone||lead?.phone),
      serviceAddress:cleanText(body.serviceAddress||job?.service_address||profile?.service_address,240),city:cleanText(body.city||lead?.city,100),jobReference:job?.reference||'',scope:cleanText(body.scope||job?.notes||job?.service,5000),terms:cleanText(body.terms,7000),paymentMethod:cleanText(body.paymentMethod,80),deliveryMode,leadId:lead?.id||null,items:Array.isArray(body.items)?body.items.slice(0,30).map(x=>({description:cleanText(x.description,300),amount:money(x.amount)||0})):[]
    };
    const did=id('DOC'), number=documentNumber(kind), title=cleanText(body.title || ({invoice:'Service Invoice',receipt:'Payment Receipt',contract:'Service Agreement',change_order:'Change Order'}[kind]),180);
    const content=buildDocHtml({kind,number,title,amount,data});
    await q(\`INSERT INTO ramiro_documents(id,user_id,job_id,quote_id,kind,number,title,status,amount,data,content_html) VALUES($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9::jsonb,$10)\`,[did,userId||'',job?.id||null,job?.quote_id||null,kind,number,title,amount,JSON.stringify(data),content]);
    await audit(auth,'document_created','document',did,{kind,number,deliveryMode}); return {ok:true,id:did,number,deliveryMode};
  }
  if (action === 'publish-document') {`,
  'manual or portal document creation'
);

api = mustReplace(api, "    if(!['contract','change_order'].includes(doc.kind)){", "    if(doc.user_id && !['contract','change_order'].includes(doc.kind)){", 'manual billing publish guard');
api = mustReplace(api, "    const next=role==='business'?'awaiting_customer_signature':'executed';", "    const next=role==='business'?(doc.user_id?'awaiting_customer_signature':'business_signed_manual'):'executed';", 'manual contract signature state');
api = mustReplace(api, "    if(role==='business'){", "    if(role==='business' && doc.user_id){", 'manual contract portal-message guard');

writeFileSync(apiPath, api, 'utf8');

// 4) Extend the already-approved anonymous analytics pulse with generic public link clicks.
const analyticsClientPath='assets/analytics.js';
let analytics=readFileSync(analyticsClientPath,'utf8');
analytics=mustReplace(
  analytics,
  "      ...(extra.service ? { service: safe(extra.service, 40) } : {})",
  "      ...(extra.service ? { service: safe(extra.service, 40) } : {}),\n      ...(extra.target ? { target: safe(extra.target, 80) } : {})",
  'analytics link target payload'
);
analytics=mustReplace(
  analytics,
  "    if (href.startsWith('tel:')) trackOnce('call_click');\n    else if (href.startsWith('sms:')) trackOnce('text_click');",
  "    if (href.startsWith('tel:')) trackOnce('call_click');\n    else if (href.startsWith('sms:')) trackOnce('text_click');\n    else if (href && !href.startsWith('#') && !href.startsWith('javascript:')) track('link_click', { target: href });",
  'public link click tracking'
);
writeFileSync(analyticsClientPath,analytics,'utf8');

const analyticsFnPath='netlify/functions/analytics-event.mjs';
let analyticsFn=readFileSync(analyticsFnPath,'utf8');
analyticsFn=mustReplace(analyticsFn,"  'text_click'\n]);","  'text_click',\n  'link_click'\n]);",'analytics allowed link event');
analyticsFn=mustReplace(
  analyticsFn,
  "  if (event === 'service_selected' && payload?.service) {\n    entry.service = clean(payload.service, 40);\n  }",
  "  if (event === 'service_selected' && payload?.service) {\n    entry.service = clean(payload.service, 40);\n  }\n  if (event === 'link_click' && payload?.target) {\n    entry.target = clean(payload.target, 80);\n  }",
  'analytics link target storage'
);
writeFileSync(analyticsFnPath,analyticsFn,'utf8');

// Build workspace hygiene: keep the implementation source out of the published site root.
rmSync('business-depth',{recursive:true,force:true});
rmSync('business-depth-pass.mjs',{force:true});
console.log('Ramiro owner business-depth pass applied: actions, visitor intelligence, CRM, finance and document workflows.');
