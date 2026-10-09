import { getStore } from '@netlify/blobs';

const timeZone = 'America/Los_Angeles';

const localDateKey = (value) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date(value));
  const pick = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
};

const longDate = (dateKey) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 19, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

const pct = (part, whole) => whole ? `${((part / whole) * 100).toFixed(1)}%` : '0.0%';

const countBy = (items, keyFn) => {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item) || 'unknown';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
};

const linesFromCounts = (entries, limit = 8) =>
  entries.slice(0, limit).map(([name, count]) => `  ${name}: ${count}`);

export default async () => {
  const now = Date.now();
  const reportDate = localDateKey(now - 24 * 60 * 60 * 1000);
  const store = getStore({ name: 'ramiro-conversion-pulse', consistency: 'strong' });

  const markerKey = `report-sent/${reportDate}`;
  if (await store.get(markerKey, { type: 'json' })) return;

  const listing = await store.list({ prefix: `${reportDate}/` });
  const events = (
    await Promise.all(
      listing.blobs.map(({ key }) => store.get(key, { type: 'json', consistency: 'strong' }))
    )
  ).filter(Boolean);

  const count = (name) => events.filter((event) => event.event === name).length;
  const visits = events.filter((event) => event.event === 'visit');
  const submitted = events.filter((event) => event.event === 'quote_submitted');

  const visitCount = visits.length;
  const quoteStarts = count('quote_open');
  const serviceSelected = count('service_selected');
  const locationReached = count('location_reached');
  const photosReached = count('photos_reached');
  const photoAdded = count('photo_added');
  const contactReached = count('contact_reached');
  const reviewReached = count('review_reached');
  const quoteSubmitted = submitted.length;
  const callClicks = count('call_click');
  const textClicks = count('text_click');

  const languageCounts = countBy(visits, (event) => event.language);
  const sourceCounts = countBy(visits, (event) => event.source);
  const pageCounts = countBy(events.filter((event) => event.event === 'page_view'), (event) => event.path);
  const serviceCounts = countBy(submitted, (event) => event.service);

  const funnel = [
    ['Quote starts', quoteStarts],
    ['Service selected', serviceSelected],
    ['Location step reached', locationReached],
    ['Photos step reached', photosReached],
    ['Contact step reached', contactReached],
    ['Review reached', reviewReached],
    ['Completed quotes', quoteSubmitted]
  ];

  let dropOff = 'Not enough funnel activity to identify a meaningful drop-off.';
  if (quoteStarts > 0) {
    let largest = { loss: 0, from: '', to: '' };
    for (let i = 0; i < funnel.length - 1; i++) {
      const loss = Math.max(0, funnel[i][1] - funnel[i + 1][1]);
      if (loss > largest.loss) largest = { loss, from: funnel[i][0], to: funnel[i + 1][0] };
    }
    if (largest.loss > 0) {
      dropOff = `Largest observed drop-off: ${largest.from} → ${largest.to} (${largest.loss}).`;
    } else if (quoteSubmitted > 0) {
      dropOff = 'No meaningful funnel drop-off was observed today.';
    }
  }

  const english = languageCounts.find(([name]) => name === 'en')?.[1] || 0;
  const spanish = languageCounts.find(([name]) => name === 'es')?.[1] || 0;

  const report = [
    `RAMIRO LANDSCAPING OC · ${longDate(reportDate)}`,
    '',
    'TRAFFIC',
    `Visits: ${visitCount}`,
    `Page views: ${count('page_view')}`,
    '',
    'QUOTE FUNNEL',
    `Quote starts: ${quoteStarts}`,
    `Services selected: ${serviceSelected}`,
    `Location step reached: ${locationReached}`,
    `Photos step reached: ${photosReached}`,
    `Photos added: ${photoAdded}`,
    `Contact step reached: ${contactReached}`,
    `Review reached: ${reviewReached}`,
    `Completed quote requests: ${quoteSubmitted}`,
    '',
    'CONTACT ACTIONS',
    `Call taps: ${callClicks}`,
    `Text taps: ${textClicks}`,
    '',
    'LANGUAGE',
    `English: ${english} (${pct(english, visitCount)})`,
    `Spanish: ${spanish} (${pct(spanish, visitCount)})`,
    '',
    'TRAFFIC SOURCES',
    ...(sourceCounts.length ? linesFromCounts(sourceCounts) : ['  No visits recorded']),
    '',
    'TOP PAGES',
    ...(pageCounts.length ? linesFromCounts(pageCounts, 5) : ['  No page views recorded']),
    '',
    'COMPLETED QUOTE SERVICES',
    ...(serviceCounts.length ? linesFromCounts(serviceCounts, 6) : ['  No completed quotes']),
    '',
    'CONVERSION',
    `Visit → quote start: ${pct(quoteStarts, visitCount)}`,
    `Quote start → completed quote: ${pct(quoteSubmitted, quoteStarts)}`,
    '',
    'OBSERVATION',
    dropOff,
    '',
    'PRIVACY',
    'Anonymous performance events only. Customer names, phone numbers, email addresses, messages, street addresses, and photo contents are not stored in analytics.'
  ].join('\n');

  const subject = `Ramiro's Business — DAILY PERFORMANCE REPORT · ${reportDate}`;
  const body = new URLSearchParams({
    'form-name': 'ramiro-daily-report',
    subject,
    'report-title': `Ramiro Landscaping OC · ${longDate(reportDate)}`,
    'report-date': reportDate,
    report
  });

  const response = await fetch('https://ramirolandscapingoc.com/analytics-report.html', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`Daily report form submission failed with ${response.status}`);
  }

  await store.setJSON(markerKey, { sentAt: new Date().toISOString(), reportDate }, { onlyIfNew: true });
};

export const config = {
  schedule: '15 15 * * *'
};