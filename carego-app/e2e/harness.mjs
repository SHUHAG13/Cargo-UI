import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/carego-app/browser');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml' };

export function serve(port = 4321) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    let file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, () => r({ server, base: `http://localhost:${port}` })));
}

/** Chrome/Chromium to drive. Set CHROME_PATH to override. */
function chromePath() {
  const candidates = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const found = candidates.find((c) => c && fs.existsSync(c));
  if (!found) throw new Error('No Chrome/Chromium found. Set CHROME_PATH.');
  return found;
}

export async function launch() {
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: 'new', args: ['--no-sandbox', '--window-size=1400,1000', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion'], defaultViewport: { width: 1400, height: 1000 } });
  return browser;
}

/** Wires error collection to a page. Returns the array that fills with problems. */
export function watch(page, ignore = []) {
  const problems = [];
  page.on('pageerror', (e) => problems.push('PAGEERROR ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      if (!ignore.some((i) => t.includes(i))) problems.push('CONSOLE ' + t.slice(0, 300));
    }
  });
  page.on('requestfailed', (r) => {
    const u = r.url();
    if (!/fonts\.g|cdn\.tailwind|cdnjs|gstatic|googleapis/.test(u)) problems.push('REQFAILED ' + u.slice(0, 120));
  });
  return problems;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Click the first element matching selector whose text includes `text`. */
export async function clickText(page, selector, text, opts = {}) {
  const ok = await page.evaluate((sel, txt, exact) => {
    const els = [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null || e.getClientRects().length);
    const el = els.find((e) => (exact ? e.textContent.trim() === txt : e.textContent.replace(/\s+/g, ' ').includes(txt)));
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.click();
    return true;
  }, selector, text, !!opts.exact);
  if (!ok) throw new Error(`clickText: no <${selector}> containing "${text}"`);
  await sleep(opts.wait ?? 250);
}

export async function type(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 5000 });
  await sleep(400);
  await page.$eval(selector, (e) => { e.value = ''; });
  await page.type(selector, String(value));
  await sleep(150); // zoneless change detection settles ~70ms after the last keystroke
}

export async function text(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
}

/** Signs in on a brand-new tab (headless Chrome drops input focus on a tab that was reloaded after a redirect). */
export async function login(browser, base, who, oldPage) {
  const creds = { customer: 'customer@carego.demo', caregiver: 'caregiver@carego.demo', admin: 'admin@carego.demo' }[who];
  if (oldPage) {
    await oldPage.evaluate(() => { try { localStorage.removeItem('carego.session'); } catch {} });
    await oldPage.close();
  }
  const page = await browser.newPage();
  await page.bringToFront();
  await page.goto(base + '/auth/login', { waitUntil: 'networkidle2' });
  await page.evaluate(() => { try { localStorage.removeItem('carego.session'); } catch {} });
  await page.goto(base + '/auth/login', { waitUntil: 'networkidle2' });
  await type(page, 'input[name="identifier"]', creds);
  await type(page, 'input[name="password"]', 'demo1234');
  await clickText(page, 'button', 'Log In', { wait: 200 });
  await page.waitForFunction(() => !location.pathname.startsWith('/auth/login'), { timeout: 10000 }).catch(() => {});
  await sleep(800);
  return page;
}
