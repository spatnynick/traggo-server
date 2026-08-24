#!/usr/bin/env node
// Minimal chromium-cli-style REPL for driving the traggo UI headlessly.
// Reads commands from stdin, one per line. Commands:
//   nav <url>
//   wait-for text=<substring> | wait-for <css-selector>
//   click <css-selector>
//   fill <css-selector> <value...>
//   press <key>
//   screenshot [name]
//   console        (dump collected console/page errors so far)
//   sleep <ms>
//   quit
import { chromium } from 'playwright';
import fs from 'fs';
import readline from 'readline';

const shotDir = new URL('./screenshots/', import.meta.url).pathname;
fs.mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[console:${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

let shotN = 0;
function resolve(arg) {
  if (arg.startsWith('text=')) return page.getByText(arg.slice(5));
  if (arg.startsWith('label=')) return page.getByLabel(arg.slice(6));
  return page.locator(arg);
}

const rl = readline.createInterface({ input: process.stdin });
for await (const raw of rl) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [cmd, ...rest] = line.split(' ');
  const arg = rest.join(' ');
  try {
    if (cmd === 'nav') {
      await page.goto(arg, { waitUntil: 'domcontentloaded' });
      console.log(`ok nav ${arg}`);
    } else if (cmd === 'wait-for') {
      await resolve(arg).first().waitFor({ timeout: 15000 });
      console.log(`ok wait-for ${arg}`);
    } else if (cmd === 'click') {
      await resolve(arg).first().click();
      console.log(`ok click ${arg}`);
    } else if (cmd === 'fill') {
      const sp = rest.join(' ');
      const idx = sp.indexOf(' ');
      const sel = sp.slice(0, idx);
      const val = sp.slice(idx + 1);
      await resolve(sel).first().fill(val);
      console.log(`ok fill ${sel}`);
    } else if (cmd === 'press') {
      await page.keyboard.press(arg);
      console.log(`ok press ${arg}`);
    } else if (cmd === 'screenshot') {
      const name = arg || `shot-${++shotN}`;
      const path = `${shotDir}${name}.png`;
      await page.screenshot({ path });
      console.log(`ok screenshot ${path}`);
    } else if (cmd === 'html') {
      console.log(await resolve(arg || 'body').first().evaluate((el) => el.outerHTML));
    } else if (cmd === 'console') {
      console.log(logs.length ? logs.join('\n') : '(no console output captured)');
    } else if (cmd === 'sleep') {
      await new Promise((r) => setTimeout(r, Number(arg)));
      console.log(`ok sleep ${arg}`);
    } else if (cmd === 'quit') {
      break;
    } else {
      console.log(`err unknown command: ${cmd}`);
    }
  } catch (e) {
    console.log(`err ${cmd}: ${e.message.split('\n')[0]}`);
  }
}
await browser.close();
