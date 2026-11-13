import { serve, launch, watch, sleep, login, text } from './harness.mjs';

const { server, base } = await serve();
const browser = await launch();
let failures = 0;
const fail = (m) => { failures++; console.log('  FAIL', m); };

async function visit(page, url, mustHave = [], label = url) {
  const problems = watch(page);
  await page.goto(base + url, { waitUntil: 'networkidle2' });
  await sleep(900);
  const t = await text(page);
  const broken = await page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:')).map((i) => i.src.slice(-60)));
  const bad = problems.filter((p) => !/tailwind|favicon/.test(p));
  const missing = mustHave.filter((m) => !t.includes(m));
  if (bad.length || broken.length || missing.length) {
    fail(`${label}: ${[...bad, ...broken.map((b) => 'BROKEN IMG ' + b), ...missing.map((m) => 'missing text "' + m + '"')].join(' | ')}`);
  } else console.log('  ok  ', label);
  page.removeAllListeners('pageerror'); page.removeAllListeners('console'); page.removeAllListeners('requestfailed');
}

try {
  let page = await browser.newPage();
  console.log('PUBLIC');
  await visit(page, '/', ['Professional Care', '500+', 'Book a Service'], 'home');
  await visit(page, '/services', ['Services & Packages'], 'services');
  await visit(page, '/services/nursing', ['Registered Nurse'], 'services/nursing');
  await visit(page, '/services/nanny', ['NANNY'], 'services/nanny');
  await visit(page, '/about', ['500+'], 'about');
  await visit(page, '/contact', ['Get In Touch'], 'contact');
  await visit(page, '/become-caregiver', ['Apply as a caregiver'], 'become-caregiver');
  await visit(page, '/auth/login', ['Demo accounts'], 'login');
  await visit(page, '/auth/register', ['Create your'], 'register');

  console.log('GUARDS');
  await page.goto(base + '/app/bookings', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => location.pathname.startsWith('/auth/login'), { timeout: 6000 }).catch(() => {});
  if (!page.url().includes('/auth/login?returnUrl')) fail('/app/bookings should redirect to login, at ' + page.url()); else console.log('  ok   /app guarded');
  await page.goto(base + '/admin', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => location.pathname.startsWith('/auth/login'), { timeout: 6000 }).catch(() => {});
  if (!page.url().includes('/auth/login')) fail('/admin should redirect to login'); else console.log('  ok   /admin guarded');

  console.log('CUSTOMER');
  page = await login(browser, base, 'customer', page);
  if (!page.url().endsWith('/app/bookings')) fail('customer lands on ' + page.url());
  await visit(page, '/app/bookings', ['My Bookings', 'CG-', 'Home Nursing'], 'my-bookings');
  const ids = await page.evaluate(() => [...document.querySelectorAll('a[href^="/app/bookings/"]')].map((a) => a.getAttribute('href')));
  console.log('   bookings:', ids.length);
  if (ids.length !== 7) fail('expected 7 booking cards, got ' + ids.length);
  for (const href of ids.slice(0, 7)) await visit(page, href, ['Booking ID', 'Price Breakdown'], href);
  await visit(page, '/app/patients', ['My Patients', 'Abdul Karim', 'Tahmina Begum'], 'my-patients');
  for (const id of ['PT-1001', 'PT-1002', 'PT-1003', 'PT-1004']) await visit(page, '/app/patients/' + id, ['Basic Patient Information'], 'patient ' + id);
  await visit(page, '/app/billing', ['Payment & Billing', 'Saved Payment Methods', 'Transaction History'], 'billing');
  const inv = ids[0].split('/').pop();
  await visit(page, '/app/billing/' + inv, ['Payment Summary', 'Payment Timeline'], 'invoice');
  await visit(page, '/app/book', ['Book a New Service', 'Select Service Category'], 'wizard');
  await visit(page, '/app/profile', ['Identity verification'], 'profile');

  console.log('CAREGIVER');
  page = await login(browser, base, 'caregiver', page);
  if (!page.url().includes('/caregiver/schedule')) fail('caregiver lands on ' + page.url());
  await visit(page, '/caregiver/schedule', ['My Schedule', 'Active — Checked In'], 'cg schedule');
  await visit(page, '/caregiver/bookings', ['Bookings', 'Tahmina Begum'], 'cg bookings');
  const cgb = await page.evaluate(() => [...document.querySelectorAll('a[href^="/caregiver/bookings/"]')].map((a) => a.getAttribute('href')));
  if (!cgb.length) fail('no caregiver booking links'); else await visit(page, cgb[0], ['Responsibilities', 'Care Plan'], 'cg booking details');
  await visit(page, '/caregiver/schedule', ['My Schedule'], 'cg schedule again');
  const shift = await page.evaluate(() => [...document.querySelectorAll('a[href^="/caregiver/shifts/"]')].map((a) => a.getAttribute('href'))[0]);
  if (!shift) fail('no shift link'); else await visit(page, shift, ['Shift Overview', 'Patient Information'], 'cg shift');
  await visit(page, '/caregiver/earnings', ['My Earnings', 'Withdraw Funds'], 'cg earnings');
  await visit(page, '/caregiver/accounts', ['Accounts & Ledger', 'Settlement Center'], 'cg accounts');

  console.log('ADMIN');
  page = await login(browser, base, 'admin', page);
  if (!page.url().endsWith('/admin')) fail('admin lands on ' + page.url());
  await visit(page, '/admin', ['Operations overview', 'Bookings awaiting confirmation'], 'admin overview');
  await visit(page, '/admin/bookings', ['Bookings', 'CG-'], 'admin bookings');
  const ab = await page.evaluate(() => document.querySelector('tbody tr td')?.textContent.trim());
  await visit(page, '/admin/bookings/' + ab, ['Care team', 'Payment schedule'], 'admin booking detail');
  await visit(page, '/admin/payments', ['Payments & payouts'], 'admin payments');
  await visit(page, '/admin/caregivers', ['Directory', 'Applications'], 'admin caregivers');
  await visit(page, '/admin/settings', ['Business rules in force'], 'admin settings');
} catch (e) {
  fail('EXCEPTION ' + e.message);
}
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nSMOKE OK');
process.exit(failures ? 1 : 0);
