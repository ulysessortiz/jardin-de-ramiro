import { getStore } from '@netlify/blobs';
import { requireOwner, json, asError } from '../lib/core.mjs';

const store = () => getStore({ name: 'ramiro-conversion-pulse', consistency: 'strong' });
const DAY = 86400000;
const publicEvent = (event) => event && !String(event.path || '/').startsWith('/account');
const localDateKey = (value = Date.now()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
};
const countBy = (rows, getter) => {
  const out = {};
  rows.forEach((row) => {
    const key = String(getter(row) || 'unknown');
    out[key] = (out[key] || 0) + 1;
  });
  return Object.entries(out).sort((a,b) => b[1]-a[1]).map(([name,count]) => ({ name, count }));
};
const qrSource = (source='') => /(^|[-_:])qr($|[-_:])|business-card-qr/i.test(String(source));
const sessionRows = (events) => {
  const grouped = new Map();
  for (const event of events) {
    const key = event.session || 'anonymous';
    if (!grouped.has(key)) grouped.set(key, { session:key, source:event.source || 'unknown', language:event.language || 'en', first:event.ts, last:event.ts, pages:[], events:[] });
    const row = grouped.get(key);
    row.first = Math.min(row.first || event.ts, event.ts);
    row.last = Math.max(row.last || event.ts, event.ts);
    row.source = row.source === 'unknown' && event.source ? event.source : row.source;
    if (event.path && !row.pages.includes(event.path)) row.pages.push(event.path);
    row.events.push({name:event.event,target:event.target||''});
  }
  return [...grouped.values()].map((row) => ({
    id: row.session === 'anonymous' ? 'Anonymous' : `Visitor ${String(row.session).slice(-5).toUpperCase()}`,
    source: row.source,
    language: row.language,
    first: row.first,
    last: row.last,
    pages: row.pages.slice(0,8),
    pageViews: row.events.filter((x) => x.name === 'page_view').length,
    actions: row.events.filter((x) => ['call_click','text_click','quote_open','quote_submitted','link_click'].includes(x.name)).map((x)=>x.target?`${x.name}:${x.target}`:x.name),
    qr: qrSource(row.source)
  })).sort((a,b) => b.last-a.last);
};
const summarize = (events) => {
  const rows = sessionRows(events);
  const visits = events.filter((e) => e.event === 'visit');
  const visitSessions = new Set(visits.map((e) => e.session || `visit:${e.ts}`));
  const pageViews = events.filter((e) => e.event === 'page_view');
  const calls = events.filter((e) => e.event === 'call_click');
  const texts = events.filter((e) => e.event === 'text_click');
  const links = events.filter((e) => e.event === 'link_click');
  const quoteStarts = events.filter((e) => e.event === 'quote_open');
  const quoteSubmits = events.filter((e) => e.event === 'quote_submitted');
  const qrSessions = new Set(rows.filter((x) => x.qr).map((x) => x.id));
  const engaged = rows.filter((x) => x.pageViews > 1 || x.actions.length > 0).length;
  const now = Date.now();
  return {
    visitors: visitSessions.size,
    sessions: rows.length,
    pageViews: pageViews.length,
    engagedSessions: engaged,
    active30m: rows.filter((x) => now-x.last <= 30*60*1000).length,
    callClicks: calls.length,
    textClicks: texts.length,
    linkClicks: links.length,
    quoteStarts: quoteStarts.length,
    quoteSubmits: quoteSubmits.length,
    qrScans: qrSessions.size,
    quoteConversion: visitSessions.size ? Math.round((quoteSubmits.length / visitSessions.size) * 1000) / 10 : 0,
    sources: countBy(visits.length ? visits : events, (e) => e.source || 'unknown').slice(0,10),
    topPages: countBy(pageViews, (e) => e.path || '/').slice(0,10),
    topTargets: countBy(links, (e) => e.target || 'unknown').slice(0,10),
    services: countBy(events.filter((e) => e.service), (e) => e.service).slice(0,10),
    languages: countBy(visits.length ? visits : events, (e) => e.language || 'en').slice(0,4)
  };
};
async function loadDays(days) {
  const s = store();
  const rows = [];
  for (let i=0; i<days; i++) {
    const day = localDateKey(Date.now() - i*DAY);
    const listing = await s.list({ prefix: `${day}/` });
    const entries = await Promise.all((listing.blobs || []).map(({key}) => s.get(key, { type:'json', consistency:'strong' }).catch(() => null)));
    rows.push(...entries.filter(publicEvent));
  }
  return rows.sort((a,b) => Number(a.ts || 0)-Number(b.ts || 0));
}

export default async (req) => {
  try {
    if (req.method !== 'GET') return json({ ok:false, error:'Method not allowed' }, { status:405 });
    await requireOwner();
    const events = await loadDays(30);
    const now = Date.now();
    const todayKey = localDateKey(now);
    const today = events.filter((e) => localDateKey(e.ts) === todayKey);
    const week = events.filter((e) => now-Number(e.ts || 0) <= 7*DAY);
    const month = events.filter((e) => now-Number(e.ts || 0) <= 30*DAY);
    return json({
      ok:true,
      generatedAt:new Date().toISOString(),
      today:summarize(today),
      week:summarize(week),
      month:summarize(month),
      recent:sessionRows(month).slice(0,24)
    });
  } catch (error) {
    console.error(error);
    return asError(error);
  }
};

export const config = { path:'/api/owner-traffic' };
