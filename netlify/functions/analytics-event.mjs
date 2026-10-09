import { getStore } from '@netlify/blobs';

const allowedEvents = new Set([
  'visit',
  'page_view',
  'quote_open',
  'service_selected',
  'location_reached',
  'photos_reached',
  'photo_added',
  'contact_reached',
  'review_reached',
  'call_click',
  'text_click'
]);

const clean = (value, max = 120) =>
  String(value ?? '')
    .replace(/[^\w./:@-]+/g, '-')
    .slice(0, max);

const localDateKey = (value = Date.now()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
};

export default async (req, context) => {
  if (context.deploy?.context && context.deploy.context !== 'production') {
    return new Response(null, { status: 204 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch (_) {
    return new Response('Bad request', { status: 400 });
  }

  const event = clean(payload?.event, 40);
  if (!allowedEvents.has(event)) {
    return new Response('Unsupported event', { status: 400 });
  }

  const ts = Number(payload?.ts);
  const now = Date.now();
  const safeTs = Number.isFinite(ts) && Math.abs(now - ts) < 1000 * 60 * 60 * 24 ? ts : now;
  const entry = {
    event,
    ts: safeTs,
    source: clean(payload?.source || 'unknown', 80) || 'unknown',
    language: payload?.language === 'es' ? 'es' : 'en',
    path: clean(payload?.path || '/', 120) || '/',
    session: clean(payload?.session || 'anonymous', 80) || 'anonymous'
  };

  if (event === 'service_selected' && payload?.service) {
    entry.service = clean(payload.service, 40);
  }

  const store = getStore({ name: 'ramiro-conversion-pulse', consistency: 'strong' });
  const date = localDateKey(safeTs);
  const key = `${date}/${safeTs}-${crypto.randomUUID()}`;
  await store.setJSON(key, entry);

  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' }
  });
};

export const config = {
  path: '/api/analytics',
  method: 'POST',
  rateLimit: {
    action: 'rate_limit',
    aggregateBy: 'ip',
    windowSize: 60,
    windowLimit: 120
  }
};