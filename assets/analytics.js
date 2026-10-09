(() => {
  'use strict';

  const endpoint = '/api/analytics';
  const sessionKey = 'ramiro-pulse-session';
  const sourceKey = 'ramiro-pulse-source';
  const oncePrefix = 'ramiro-pulse-once:';
  const url = new URL(window.location.href);

  const safe = (value, max = 80) =>
    String(value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9._:-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max) || 'unknown';

  const getSession = () => {
    try {
      let value = sessionStorage.getItem(sessionKey);
      if (!value) {
        value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(sessionKey, value);
      }
      return value;
    } catch (_) {
      return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  };

  const referrerSource = () => {
    const explicit = url.searchParams.get('src') || url.searchParams.get('utm_source');
    if (explicit) return safe(explicit);

    let ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (_) {}

    const sameHost = ref && (ref === location.hostname.replace(/^www\./, '') || ref.endsWith('.ramirolandscapingoc.com'));
    if (sameHost) return 'internal';

    if (!ref && location.pathname === '/' && ['en','es'].includes(url.searchParams.get('lang'))) {
      return 'business-card-qr';
    }

    if (!ref) return 'direct';
    if (/(^|\.)google\./.test(ref)) return 'google';
    if (/(^|\.)bing\.com$/.test(ref)) return 'bing';
    if (/(^|\.)yahoo\./.test(ref)) return 'yahoo';
    if (/(^|\.)duckduckgo\.com$/.test(ref)) return 'duckduckgo';
    if (/(^|\.)facebook\.com$|(^|\.)fb\.com$/.test(ref)) return 'facebook';
    if (/(^|\.)instagram\.com$/.test(ref)) return 'instagram';
    if (/(^|\.)nextdoor\.com$/.test(ref)) return 'nextdoor';
    if (/(^|\.)yelp\.com$/.test(ref)) return 'yelp';
    return `referral:${safe(ref, 56)}`;
  };

  const session = getSession();
  let source = '';
  try {
    source = sessionStorage.getItem(sourceKey) || '';
    if (!source || source === 'internal') {
      source = referrerSource();
      if (source === 'internal') source = 'direct';
      sessionStorage.setItem(sourceKey, source);
    }
  } catch (_) {
    source = referrerSource();
    if (source === 'internal') source = 'direct';
  }

  const currentLanguage = () => document.documentElement.lang === 'es' ? 'es' : 'en';

  const send = (payload) => {
    const body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(endpoint, blob)) return;
      }
    } catch (_) {}
    try {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin'
      }).catch(() => {});
    } catch (_) {}
  };

  const track = (event, extra = {}) => {
    send({
      event,
      source,
      language: currentLanguage(),
      path: location.pathname.slice(0, 120),
      session,
      ts: Date.now(),
      ...(extra.service ? { service: safe(extra.service, 40) } : {})
    });
  };

  const trackOnce = (event, extra = {}) => {
    const key = `${oncePrefix}${event}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (_) {}
    track(event, extra);
  };

  window.ramiroPulse = Object.freeze({ track, trackOnce, source, session });

  trackOnce('visit');
  track('page_view');

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    if (href.startsWith('tel:')) trackOnce('call_click');
    else if (href.startsWith('sms:')) trackOnce('text_click');
  }, { capture: true });

  const form = document.getElementById('quote-form');
  if (form) {
    trackOnce('quote_open');

    const service = form.elements.namedItem('service');
    if (service) {
      service.addEventListener('change', () => {
        if (service.value) trackOnce('service_selected', { service: service.value });
      });
    }

    form.querySelectorAll('.photo-input').forEach((input) => {
      input.addEventListener('change', () => {
        if (input.files && input.files.length) trackOnce('photo_added');
      });
    });

    const stepEvents = {
      '2': 'location_reached',
      '3': 'photos_reached',
      '5': 'contact_reached',
      '7': 'review_reached'
    };

    form.querySelectorAll('.quote-step[data-step]').forEach((step) => {
      const noteStep = () => {
        if (!step.hidden) {
          const eventName = stepEvents[step.dataset.step];
          if (eventName) trackOnce(eventName);
        }
      };
      noteStep();
      new MutationObserver(noteStep).observe(step, { attributes: true, attributeFilter: ['hidden'] });
    });
  }

  const priorFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const body = init?.body;
    if (body instanceof FormData && body.get('form-name') === 'ramiro-quote-request') {
      if (body.has('subject')) body.set('subject', "Ramiro's Business — NEW QUOTE REQUEST");
      if (body.has('summary')) {
        const original = String(body.get('summary') || '');
        if (!original.includes('Traffic source:')) {
          body.set(
            'summary',
            `${original}\nTraffic source: ${source}\nAnalytics session: ${session}`.trim()
          );
        }
      }
    }
    return priorFetch(input, init);
  };

  if (location.pathname.startsWith('/privacy/')) {
    const legal = document.querySelector('.legal-copy');
    if (legal && !document.getElementById('anonymous-performance-measurement')) {
      const section = document.createElement('section');
      section.id = 'anonymous-performance-measurement';
      section.innerHTML =
        '<h2><span data-lang="en">Anonymous performance measurement</span><span data-lang="es">Medición anónima del rendimiento</span></h2>' +
        '<p><span data-lang="en">This site records limited anonymous events such as visits, quote steps reached, language, traffic source, and call or text taps so we can understand whether the website is helping customers. These performance records do not include names, phone numbers, email addresses, messages, street addresses, or photo contents, and no advertising or analytics cookies are used.</span>' +
        '<span data-lang="es">Este sitio registra eventos anónimos limitados, como visitas, pasos alcanzados en la solicitud, idioma, fuente de tráfico y toques para llamar o enviar mensajes, para entender si el sitio ayuda a los clientes. Estos registros de rendimiento no incluyen nombres, números de teléfono, correos electrónicos, mensajes, domicilios ni el contenido de las fotos, y no se utilizan cookies de publicidad ni de análisis.</span></p>';
      legal.insertBefore(section, legal.lastElementChild);
    }
  }
})();