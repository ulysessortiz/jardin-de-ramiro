import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const accountPath = 'account/index.html';
const marker = 'RAMIRO_OWNER_ROLE_ACTIVATION_2026_10_14';
const assetPath = 'assets/owner-role-activation-20261014.js';
const functionPath = 'netlify/functions/owner-bootstrap.mjs';

// Owner/business access is already enforced by the protected account API through
// RAMIRO_OWNER_EMAILS and RAMIRO_FIELD_EMAILS. Remove the later bootstrap shim so
// there is one authoritative server-side role decision and no client-side role churn.
let html = readFileSync(accountPath, 'utf8');
const pattern = new RegExp(`\\s*<script[^>]*id=["']${marker}["'][^>]*><\\/script>\\s*`, 'gi');
const cleaned = html.replace(pattern, '\n');
if (cleaned !== html) writeFileSync(accountPath, cleaned, 'utf8');

rmSync(assetPath, { force: true });
rmSync(functionPath, { force: true });

console.log('Ramiro owner access uses the protected server allowlists: RAMIRO_OWNER_EMAILS / RAMIRO_FIELD_EMAILS.');
