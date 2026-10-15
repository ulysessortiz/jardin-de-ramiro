const context = String(process.env.CONTEXT || '').trim();
const owners = String(process.env.RAMIRO_OWNER_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

if (context === 'production') {
  if (!owners.includes('contact@ulysessortiz.com')) {
    throw new Error('Production owner access is not configured: RAMIRO_OWNER_EMAILS must include the approved owner account.');
  }
  console.log('Production owner access configuration verified.');
} else {
  console.log(`Owner access guard skipped for ${context || 'non-production'} context.`);
}
