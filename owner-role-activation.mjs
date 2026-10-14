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
    return json({ eligible: false, promoted: false, roles: user.roles || [] });
  }

  const current = await admin.getUser(user.id);
  const currentRoles = new Set([
    ...(Array.isArray(current.roles) ? current.roles : []),
    ...(Array.isArray(current.appMetadata?.roles) ? current.appMetadata.roles : []),
  ]);
  const alreadyOwner = currentRoles.has('owner');
  currentRoles.add('member');
  currentRoles.add('owner');

  if (!alreadyOwner) {
    await admin.updateUser(user.id, {
      appMetadata: {
        ...(current.appMetadata || {}),
        roles: [...currentRoles],
      },
    });
  }

  return json({ eligible: true, promoted: !alreadyOwner, roles: [...currentRoles] });
};
`;

writeFileSync(`${functionDir}/owner-bootstrap.mjs`, functionCode, 'utf8');

await build({
  stdin: {
    contents: `
      import { getUser, refreshSession } from '@netlify/identity';

      async function activateOwnerRole() {
        try {
          const user = await getUser();
          if (!user?.email) return;
          if (Array.isArray(user.roles) && user.roles.includes('owner')) return;

          const response = await fetch('/api/owner-bootstrap', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'accept': 'application/json' },
          });
          if (!response.ok) return;
          const result = await response.json();
          if (!result?.eligible) return;

          await refreshSession();
          window.location.reload();
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
