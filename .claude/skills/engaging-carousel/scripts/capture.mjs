// Capture REAL web pages (a Wikipedia infobox, a company's own product page) as PNGs, for focus_card / paper_card.
//
//   node scripts/capture.mjs jobs.json <project>/media/captures
//
// jobs.json = [{"url": "https://en.wikipedia.org/wiki/Gunpei_Yokoi", "name": "wp_yokoi", "selector": "table.infobox"},
//              {"url": "https://www.nintendo.com/jp/...", "name": "nin_hanafuda", "width": 1000, "height": 1400},
//              {"url": "...", "name": "x", "clip": [0, 200, 800, 900], "scale": 2, "wait": 1500, "hide": [".banner"]}]
// selector → just that element; clip [x, y, w, h] → that page region; neither → the first screen.
// Uses the Chrome HyperFrames downloaded (setup.sh) through puppeteer-core in ~/.engaging-carousel/node.
// Add every capture to SOURCES.md by hand ("(capture)" row): a portrait inside an infobox may be a fair-use image.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EC = process.env.EC_HOME || path.join(os.homedir(), '.engaging-carousel');
const require = createRequire(path.join(EC, 'node', 'package.json'));
const puppeteer = require('puppeteer-core');
const HF = process.env.EC_HYPERFRAMES || 'hyperframes@0.8.185';

const [jobsPath, outDir] = process.argv.slice(2);
if (!jobsPath || !outDir) { console.error('usage: node capture.mjs jobs.json <outdir>'); process.exit(1); }
const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const chrome = process.env.EC_CHROME || execSync(`npx --yes ${HF} browser path`, { encoding: 'utf8' }).trim().split('\n').pop();
const browser = await puppeteer.launch({ executablePath: chrome, headless: true,
  args: ['--no-sandbox', '--disable-blink-features=AutomationControlled', '--hide-scrollbars'] });
let failed = 0;
for (const j of jobs) {
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36');
    await page.setViewport({ width: j.width || 1280, height: j.height || 1600, deviceScaleFactor: j.scale || 2 });
    await page.goto(j.url, { waitUntil: 'networkidle2', timeout: 60000 });
    // cookie banners: click the obvious "accept" button if there is one
    await page.evaluate(() => {
      const re = /^(accept|accept all|agree|i agree|allow all|ok|got it|同意する|すべて許可)$/i;
      for (const b of document.querySelectorAll('button, a[role=button]')) if (re.test((b.innerText || '').trim())) { b.click(); break; }
    });
    for (const sel of j.hide || []) await page.evaluate((s) => document.querySelectorAll(s).forEach((e) => (e.style.visibility = 'hidden')), sel);
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo(0, 0); });
    await new Promise((r) => setTimeout(r, j.wait || 800));
    const out = path.join(outDir, `${j.name}.png`);
    if (j.selector) {
      const el = await page.$(j.selector);
      if (!el) throw new Error(`selector not found: ${j.selector}`);
      await el.screenshot({ path: out });
    } else if (j.clip) {
      const [x, y, w, h] = j.clip;
      await page.setViewport({ width: j.width || 1280, height: Math.max(j.height || 1600, y + h), deviceScaleFactor: j.scale || 2 });
      await page.screenshot({ path: out, clip: { x, y, width: w, height: h } });
    } else {
      await page.screenshot({ path: out });
    }
    console.log('captured', out);
  } catch (e) { failed++; console.error(`✗ ${j.name}: ${e.message}`); }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
