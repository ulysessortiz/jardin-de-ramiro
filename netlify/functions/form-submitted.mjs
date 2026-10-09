import { getStore } from '@netlify/blobs';

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

const extract = (summary, label) => {
  const match = String(summary || '').match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
  return match ? match[1].trim() : '';
};

export default {
  async formSubmitted(event) {
    const data = event?.data || {};

    if (!data.service || !data.reference) return;

    const now = Date.now();
    const summary = String(data.summary || '');
    const source = clean(extract(summary, 'Traffic source') || 'unknown', 80) || 'unknown';
    const session = clean(extract(summary, 'Analytics session') || data.reference || 'anonymous', 80) || 'anonymous';

    const entry = {
      event: 'quote_submitted',
      ts: now,
      source,
      language: data.language === 'es' || data['preferred-language'] === 'Español' ? 'es' : 'en',
      path: '/get-a-quote/',
      session,
      service: clean(data.service, 40)
    };

    const store = getStore({ name: 'ramiro-conversion-pulse', consistency: 'strong' });
    const key = `${localDateKey(now)}/${now}-${crypto.randomUUID()}`;
    await store.setJSON(key, entry);
  }
};