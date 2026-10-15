import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';

const functionDir = 'netlify/functions';
const assetDir = 'assets';
const accountPath = 'account/index.html';
const marker = 'RAMIRO_OWNER_ROLE_ACTIVATION_2026_10_14';
const assetPath = '/assets/owner-role-activation-20261014.js';

mkdirSync(functionDir, { recursive: true });
mkdirSync(assetDir, { recursive: true });

const functionCode = `import { getUser, admin } from '@netlify/identity';

export const config = { path: '/api/owner-bootstrap' };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

const allowedEmails = () => new Set(
  String(process.env.RAMIRO_STAFF_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);

const roleList = (user) => {
  const roles = new Set([
    ...(Array.isArray(user?.roles) ? user.roles : []),
    ...(Array.isArray(user?.appMetadata?.roles) ? user.appMetadata.roles : []),
  ]);
  return [...roles];
};

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = new URL(req.url);
  const origin = req.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'Forbidden' }, 403);

  const user = await getUser();
  if (!user?.id || !user?.email) return json({ error: 'Unauthorized' }, 401);

  const email = user.email.trim().toLowerCase();
  const allowlist = allowedEmails();
  if (!allowlist.size || !allowlist.has(email)) {
    return json({ eligible: false, ownerPersisted: false, roles: user.roles || [] });
  }

  const current = await admin.getUser(user.id);
  const desiredRoles = new Set(roleList(current));
  desiredRoles.add('member');
  desiredRoles.add('staff');
  desiredRoles.add('owner');

  const before = roleList(current);
  const needsUpdate = !before.includes('owner') || !before.includes('staff');

  if (needsUpdate) {
    await admin.updateUser(user.id, {
      app_metadata: {
        ...(current.appMetadata || {}),
        roles: [...desiredRoles],
      },
    });
  }

  const verified = await admin.getUser(user.id);
  const after = roleList(verified);
  const ownerPersisted = after.includes('owner') && after.includes('staff');

  console.log(JSON.stringify({
    event: 'ramiro_owner_bootstrap',
    eligible: true,
    needsUpdate,
    ownerPersisted,
    beforeRoles: before,
    afterRoles: after,
  }));

  if (!ownerPersisted) {
    return json({ error: 'Owner role did not persist', eligible: true, ownerPersisted: false, roles: after }, 500);
  }

  return json({ eligible: true, ownerPersisted: true, promoted: needsUpdate, roles: after });
};
`;

writeFileSync(`${functionDir}/owner-bootstrap.mjs`, functionCode, 'utf8');

await build({
  stdin: {
    contents: `
      import { getUser, logout } from '@netlify/identity';

      function showOwnerReadyMessage() {
        if (new URLSearchParams(window.location.search).get('owner_access') !== 'ready') return;
        const run = () => {
          const host = document.querySelector('.rl-auth-card') || document.querySelector('main') || document.body;
          if (document.querySelector('[data-owner-ready-message]')) return;
          const box = document.createElement('div');
          box.setAttribute('data-owner-ready-message', '');
          box.style.margin = '0 0 18px';
          box.style.padding = '14px 16px';
          box.style.borderRadius = '14px';
          box.style.background = 'rgba(28,105,76,.08)';
          box.style.color = '#174f3d';
          box.style.fontWeight = '700';
          box.style.lineHeight = '1.5';
          box.textContent = 'Business-owner access is activated. Sign in once more to open the private business controls.';
          host.prepend(box);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
        else run();
      }

      async function activateOwnerRole() {
        try {
          const user = await getUser();
          if (!user?.email) {
            showOwnerReadyMessage();
            return;
          }
          if (Array.isArray(user.roles) && user.roles.includes('owner')) return;

          const response = await fetch('/api/owner-bootstrap', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'accept': 'application/json' },
          });
          const result = await response.json().catch(() => null);
          if (!response.ok || !result?.eligible || !result?.ownerPersisted) return;

          // Netlify roles live in the JWT. A freshly-issued JWT is not force-refreshed
          // by refreshSession(), so end the stale member session once after persistence.
          await logout();
          window.location.replace('/account/?owner_access=ready');
        } catch (error) {
          console.error('Ramiro owner role activation failed', error);
        }
      }

      activateOwnerRole();
    `,
    resolveDir: process.cwd(),
    sourcefile: 'ramiro-owner-role-entry.js',
    loader: 'js',
  },
  outfile: `${assetDir}/owner-role-activation-20261014.js`,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
});

let html = readFileSync(accountPath, 'utf8');
if (!html.includes(marker)) {
  if (!html.includes('</body>')) throw new Error('Ramiro account page is missing </body>.');
  html = html.replace('</body>', `<script id="${marker}" type="module" src="${assetPath}"></script>\n</body>`);
  writeFileSync(accountPath, html, 'utf8');
}

console.log('Ramiro owner role activation bridge ready.');
