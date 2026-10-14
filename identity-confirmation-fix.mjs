import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';

const rootPath = 'index.html';
const accountPath = 'account/index.html';
const assetDir = 'assets';
const routerAsset = '/assets/identity-confirmation-router-20261014.js';
const callbackAsset = '/assets/identity-confirmation-callback-20261014.js';
const rootMarker = 'RAMIRO_IDENTITY_CONFIRMATION_ROUTER_2026_10_14';
const accountMarker = 'RAMIRO_IDENTITY_CONFIRMATION_CALLBACK_2026_10_14';

mkdirSync(assetDir, { recursive: true });

const routerCode = `(() => {
  const hash = window.location.hash || '';
  if (hash.startsWith('#confirmation_token=')) {
    window.location.replace('/account/' + hash);
  }
})();\n`;
writeFileSync(`${assetDir}/identity-confirmation-router-20261014.js`, routerCode, 'utf8');

await build({
  stdin: {
    contents: `
      import { handleAuthCallback } from '@netlify/identity';

      const hash = window.location.hash || '';
      const confirmation = hash.startsWith('#confirmation_token=');

      function surface(message, ok = false) {
        const run = () => {
          const card = document.querySelector('.rl-auth-card') || document.querySelector('main') || document.body;
          let box = document.querySelector('[data-ramiro-confirmation-status]');
          if (!box) {
            box = document.createElement('p');
            box.setAttribute('data-ramiro-confirmation-status', '');
            box.style.margin = '18px 0 0';
            box.style.padding = '14px 16px';
            box.style.borderRadius = '14px';
            box.style.lineHeight = '1.5';
            box.style.fontWeight = '700';
            card.appendChild(box);
          }
          box.style.background = ok ? 'rgba(28, 105, 76, .08)' : 'rgba(140, 92, 38, .08)';
          box.style.color = ok ? '#174f3d' : '#7a552f';
          box.textContent = message;
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
        else run();
      }

      async function completeConfirmation() {
        if (!confirmation) {
          if (new URLSearchParams(window.location.search).get('confirmed') === '1') {
            surface('Email confirmed. Your Ramiro Landscaping account is ready.', true);
          }
          return;
        }

        surface('Confirming your email…', true);
        try {
          const result = await handleAuthCallback();
          if (result && result.type === 'confirmation') {
            window.location.replace('/account/?confirmed=1');
            return;
          }
          surface('This confirmation link could not be completed. Please request a new confirmation email and try again.');
        } catch (error) {
          console.error('Ramiro Identity confirmation failed', error);
          surface('This confirmation link could not be completed. Please request a new confirmation email and try again.');
        }
      }

      completeConfirmation();
    `,
    resolveDir: process.cwd(),
    sourcefile: 'ramiro-identity-confirmation-entry.js',
    loader: 'js',
  },
  outfile: `${assetDir}/identity-confirmation-callback-20261014.js`,
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2020'],
  minify: true,
  sourcemap: false,
});

function injectExternalScript(path, marker, asset, typeModule = false) {
  let html = readFileSync(path, 'utf8');
  if (html.includes(marker)) return false;
  if (!html.includes('</body>')) throw new Error(`Missing </body> in ${path}`);
  const script = `<script id="${marker}"${typeModule ? ' type="module"' : ''} src="${asset}"></script>`;
  html = html.replace('</body>', `${script}\n</body>`);
  writeFileSync(path, html, 'utf8');
  return true;
}

const rootChanged = injectExternalScript(rootPath, rootMarker, routerAsset, false);
const accountChanged = injectExternalScript(accountPath, accountMarker, callbackAsset, true);

console.log(`Ramiro Identity confirmation bridge ready. root=${rootChanged} account=${accountChanged}`);
