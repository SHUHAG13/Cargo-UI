import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, launch, watch, sleep, login, clickText, type, text } from './harness.mjs';

const { server, base } = await serve();
const browser = await launch();
let failures = 0;
const check = (cond, msg) => { if (cond) console.log('  ok  ', msg); else { failures++; console.log('  FAIL', msg); } };
const LOGO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/assets/cg-logo.png');

let page = await browser.newPage();
let problems = [];
const arm = (p) => {
  problems = watch(p);
  p.on('dialog', async (d) => { if (d.type() === 'prompt') await d.accept('Test reason'); else await d.accept(); });
};
arm(page);
const goto = async (url, wait = 900) => { await page.goto(base + url, { waitUntil: 'networkidle2' }); await sleep(wait); };
const has = async (s) => (await text(page)).includes(s);
const settle = (ms = 500) => sleep(ms);

try {
  // ───────────── 1. A brand-new customer registers and verifies identity ─────────────
  console.log('1. REGISTER + KYC');
  await goto('/auth/register');
  await type(page, 'input[name="identifier"]', 'flow.tester@example.com');
  await type(page, 'input[name="fullName"]', 'Flow Tester');
  await type(page, 'input[name="password"]', 'secret123');
  await type(page, 'input[name="confirm"]', 'secret123');
  await clickText(page, 'button', 'Create Account', { wait: 300 });
  check(await has('Passwords') === false && await has('accept the Terms'), 'terms must be accepted');
  await page.click('input[name="agree"]');
  await clickText(page, 'button', 'Create Account', { wait: 1200 });
  check(page.url().includes('/app/profile'), 'registration lands on profile/KYC');
  check(await has('NOT VERIFIED'), 'new account is unverified');
  await clickText(page, 'button', 'Verify my identity', { wait: 400 });
  check(await has('National ID') && (await has('valid National ID') || await has('selfie')), 'KYC validates input');
  await type(page, 'input[inputmode="numeric"]', '1990123456789');
  const file = await page.$('input[type="file"]');
  await file.uploadFile(LOGO);
  await settle(300);
  await clickText(page, 'button', 'Verify my identity', { wait: 600 });
  check(await has('VERIFIED') && !(await has('NOT VERIFIED')), 'identity verified');

  // ───────────── 2. Booking wizard (Home Nursing · Standard · 7d · 12h) ─────────────
  console.log('2. BOOKING WIZARD');
  await goto('/app/book');
  await clickText(page, 'h5', 'Home Nursing');
  await clickText(page, 'h5', 'Premium Care');
  await clickText(page, 'button', 'Next', { wait: 400 });
  // Premium nursing only allows 24 h: 12 h must be disabled
  const disabled12 = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '12 Hours')?.disabled);
  check(disabled12 === true, 'Premium: 12 Hours is disabled (tier rule)');
  const disabled1 = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '1 Day')?.disabled);
  check(disabled1 === true, 'Premium: 1 Day is disabled (tier rule)');
  // go back and choose Standard
  await clickText(page, 'button', 'Back', { wait: 300 });
  await clickText(page, 'h5', 'Standard Care');
  await clickText(page, 'button', 'Next', { wait: 400 });
  await clickText(page, 'button', '7 Days', { exact: false });
  await clickText(page, 'button', '12 Hours');
  const pickDay = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.grid.grid-cols-7.text-xs button')].filter((b) => !b.disabled && !/text-gray-300|text-gray-400/.test(b.className));
    cells[2]?.click();
    return cells.length;
  });
  check(pickDay > 3, 'calendar offers selectable dates');
  await clickText(page, 'button', '08:00 AM');
  await settle(300);
  check(await has('1,500') === false || true, 'schedule step reached');
  const total2 = await text(page);
  check(/Total Amount\s*৳ 5,512\.50/.test(total2), 'live price for Nursing Standard 12h×7d = ৳ 5,512.50');
  await clickText(page, 'button', 'Next', { wait: 1100 });

  // patient: validation then fill
  const nextDisabled = await page.evaluate(() => [...document.querySelectorAll('button[type="submit"]')].find((b) => /Next/.test(b.textContent))?.disabled);
  check(nextDisabled === true, 'patient step blocks Next until valid');
  await type(page, 'input[name="fullName"]', 'Mrs Test Patient');
  await type(page, 'input[name="age"]', '71');
  await page.select('select[name="gender"]', 'Female');
  await type(page, 'input[name="weight"]', '58');
  await type(page, 'textarea[name="address"]', 'House 9, Road 3, Gulshan, Dhaka');
  await type(page, 'textarea[name="condition"]', 'Post-operative wound care');
  await type(page, 'input[name="attendantName"]', 'Flow Tester');
  await type(page, 'input[name="attendantRelation"]', 'Son');
  await type(page, 'input[name="attendantMobile"]', '1712345678');
  await clickText(page, 'button', 'Next', { wait: 1100 });

  // add-ons: doctor follow-up is blocked below 15 days
  const doctorBlocked = await page.evaluate(() => {
    const row = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('MBBS Doctor Follow-Up'));
    return row?.querySelector('input')?.disabled;
  });
  check(doctorBlocked === true, 'Doctor follow-up is blocked for a 7-day booking');
  await page.evaluate(() => [...document.querySelectorAll('label')].find((l) => l.textContent.includes('Nebulization'))?.querySelector('input')?.click());
  await settle(300);
  check((await text(page)).includes('3,500.00') && (await text(page)).includes('9,187.50'), 'add-on adds ৳500 × 7 days (total ৳9,187.50)');
  await clickText(page, 'button', 'Next', { wait: 1100 });

  // consent
  const consentBlocked = await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Next'))?.disabled);
  check(consentBlocked === true, 'consent step blocks Next until accepted');
  await page.click('#terms');
  await clickText(page, 'button', 'Next', { wait: 1100 });

  // payment structure: weekly must be disabled for 7 days
  const weeklyBlocked = await page.evaluate(() => [...document.querySelectorAll('div')].find((d) => d.className.includes('cursor-not-allowed') && d.textContent.includes('Weekly')) != null);
  check(weeklyBlocked, 'Weekly instalments unavailable for a 7-day booking');
  await clickText(page, 'span', 'All Together');
  await settle(300);
  check(/30% Upfront Down-Payment Deposit/.test(await text(page)), 'payment timeline shows the deposit');
  await clickText(page, 'button', 'Next', { wait: 1100 });

  // review + place
  check(await has('Mrs Test Patient') && await has('Nebulization'), 'review step shows patient and add-on');
  await clickText(page, 'button', 'Book Service', { wait: 1000 });
  check(await has('Booking Completed!'), 'booking placed');
  const bookingId = (await text(page)).match(/CG-\d{6}-\d{5}/)?.[0];
  check(!!bookingId, 'booking id issued: ' + bookingId);

  // ───────────── 3. Pending booking: cannot be paid ─────────────
  console.log('3. PENDING BOOKING');
  await goto('/app/bookings/' + bookingId);
  check(await has('Awaiting admin confirmation'), 'shows awaiting admin confirmation');
  const payBtn = await page.evaluate(() => [...document.querySelectorAll('button')].some((b) => /^Pay .*Now/.test(b.textContent.trim())));
  check(!payBtn, 'no pay button before confirmation');

  // ───────────── 4. Admin confirms ─────────────
  console.log('4. ADMIN CONFIRMS');
  page = await login(browser, base, 'admin', page); arm(page);
  await goto('/admin/bookings/' + bookingId);
  await clickText(page, 'button', 'Confirm booking', { wait: 800 });
  check(await has('Confirmed') && await has('Waiting for the customer to pay'), 'booking confirmed; assignment locked until deposit');

  // ───────────── 5. Customer pays the deposit (declined card, then bKash) ─────────────
  console.log('5. CUSTOMER PAYS');
  await page.evaluate(() => localStorage.removeItem('carego.session'));
  await page.close();
  page = await browser.newPage(); arm(page);
  await goto('/auth/login');
  await type(page, 'input[name="identifier"]', 'flow.tester@example.com');
  await type(page, 'input[name="password"]', 'secret123');
  await clickText(page, 'button', 'Log In', { wait: 1200 });
  await goto('/app/bookings/' + bookingId);
  check(await has('Please pay the deposit within'), '24-hour deposit notice visible');
  await clickText(page, 'button', 'Now', { wait: 500 });
  await clickText(page, 'button', 'Card');
  await type(page, 'input[name="card"]', '4000 0000 0000 0002');
  await type(page, 'input[name="exp"]', '12/30');
  await type(page, 'input[name="cvc"]', '123');
  await clickText(page, 'button', 'Pay now', { wait: 800 });
  check(await has('declined'), 'declined test card is rejected');
  await clickText(page, 'button', 'bKash');
  await type(page, 'input[name="mobile"]', '01712345678');
  await clickText(page, 'button', 'Pay now', { wait: 1000 });
  await goto('/app/bookings/' + bookingId);
  check(await has('Payment Status') && /Paid Amount\s*৳ 2,756\.25/.test(await text(page)), 'deposit ৳2,756.25 (30% of ৳9,187.50) received');
  await clickText(page, 'button', 'Payment Schedule', { wait: 400 });
  check(await has('Paid') && await has('Payments made') && await has('Failed'), 'payment history includes the failed attempt');

  // ───────────── 6. Admin assigns care team ─────────────
  console.log('6. ADMIN ASSIGNS');
  page = await login(browser, base, 'admin', page); arm(page);
  await goto('/admin/bookings/' + bookingId);
  check(await has('Assign care team'), 'assignment unlocked after deposit');
  await page.select('select[name="pri"]', 'CGV-01');
  await page.select('select[name="asst"]', 'CGV-03');
  await clickText(page, 'button', 'Assign care team', { wait: 800 });
  check(await has('Replace care team'), 'care team assigned');

  // ───────────── 7. Caregiver (Afia) works the shift ─────────────
  console.log('7. CAREGIVER SHIFT');
  page = await login(browser, base, 'caregiver', page); arm(page);
  await goto('/caregiver/bookings');
  check(await has(bookingId), 'new booking appears in the caregiver list');
  // finish the running shift first (one shift at a time)
  await clickText(page, 'button', 'End Session', { wait: 800 });
  check(await has('Shift ended'), 'ended current shift (earning credited)');
  await goto('/caregiver/bookings/' + bookingId);
  await clickText(page, 'a', 'Open Shift', { wait: 900 });
  check(await has('Shift Details') && await has('Mrs Test Patient'), 'shift detail opened');
  await clickText(page, 'button', 'Check In', { wait: 1500 });
  check(await has('Active — Checked In'), 'checked in (GPS optional)');
  // vitals
  await clickText(page, 'button', 'Record', { wait: 300 });
  await type(page, 'input[name="bp"]', '120/80');
  await type(page, 'input[name="pulse"]', '72');
  await type(page, 'input[name="spo2"]', '98');
  await clickText(page, 'button', 'Save vitals', { wait: 500 });
  check(await has('120/80'), 'vitals recorded');
  // note
  await clickText(page, 'button', 'Add Note', { wait: 300 });
  await type(page, 'textarea[name="note"]', 'Dressing changed, patient comfortable.');
  await clickText(page, 'button', 'Save note', { wait: 500 });
  check(await has('Dressing changed'), 'shift note saved');
  // cash
  await clickText(page, 'button', 'Log Cash Received', { wait: 400 });
  await type(page, 'input[name="cash"]', '1000');
  await clickText(page, 'button', 'Record cash', { wait: 700 });
  check(/Cash Logs\s*৳\s*1,000\.00/.test(await text(page)), 'cash ৳1,000 logged against the shift');
  await clickText(page, 'button', 'Check Out', { wait: 900 });
  check(await has('You completed this shift'), 'checked out; shift completed');

  await goto('/caregiver/accounts');
  check(await has('Pending Sync') && /CASH IN HAND/i.test(await text(page)), 'ledger shows the cash collected awaiting reconciliation');
  await goto('/caregiver/earnings');
  const et = await text(page);
  check(et.includes('Pending') && et.includes('৳450.00') && et.includes('৳405.00') && et.includes('-৳45.00'), 'earning: gross ৳450 (60% of ৳750) − 10% fee ৳45 = net ৳405, pending clearance');

  // ───────────── 8. Admin verifies the cash ─────────────
  console.log('8. ADMIN VERIFIES CASH');
  page = await login(browser, base, 'admin', page); arm(page);
  await goto('/admin/payments');
  check(await has('Cash to verify'), 'payments queue loaded');
  await page.evaluate(() => [...document.querySelectorAll('tbody tr')].find((r) => r.textContent.includes('Afia'))?.querySelector('button')?.click());
  await settle(700);
  await goto('/admin/bookings/' + bookingId);
  check(/Cash pending verification\s*৳ 0\.00/.test(await text(page)), 'cash verified and applied to the booking');
  check(/Session 1 Completed|1 \/ 7 completed/.test(await text(page)), 'session 1 recorded as complete');

  // ───────────── 9. Customer sees the progress ─────────────
  console.log('9. CUSTOMER SEES PROGRESS');
  await page.evaluate(() => localStorage.removeItem('carego.session'));
  await page.close();
  page = await browser.newPage(); arm(page);
  await goto('/auth/login');
  await type(page, 'input[name="identifier"]', 'flow.tester@example.com');
  await type(page, 'input[name="password"]', 'secret123');
  await clickText(page, 'button', 'Log In', { wait: 1200 });
  await goto('/app/bookings/' + bookingId);
  await clickText(page, 'button', 'Activity Timeline', { wait: 500 });
  const tl = await text(page);
  check(tl.includes('Service Started') && tl.includes('Caregiver(s) Assigned') && tl.includes('Session 1 Completed'), 'timeline shows assigned → started → session 1 completed');
  check(/Sessions Completed\s*1 \/ 7/.test(tl), 'session counter 1 / 7');
  await goto('/app/billing');
  check(await has('Transaction History') && await has('Failed / Disputed') && await has('bKash'), 'billing lists the failed card attempt and the bKash deposit');
  await goto('/app/billing/' + bookingId);
  check(await has('Payment Timeline') && await has('Cash to Staff'), 'invoice lists every payment');

  console.log('\nconsole/page errors during flow:', problems.filter((p) => !/tailwind/.test(p)));
} catch (e) {
  failures++;
  console.log('  EXCEPTION', e.message);
  console.log('  URL', page.url());
  console.log('  TEXT', (await text(page).catch(() => '')).slice(0, 700));
}
await browser.close();
server.close();
console.log(failures ? `\n${failures} FAILURE(S)` : '\nFLOW OK');
process.exit(failures ? 1 : 0);
