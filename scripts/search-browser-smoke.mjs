import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, serveBuild } from './settings-browser-harness.mjs';
import { createSearchBrowserDriver, selectors } from './search-browser-driver.mjs';
import { scopeScenarios } from './search-browser-scope.mjs';
import { observationScenarios, ledgerScenarios } from './search-browser-observations.mjs';
import { presetScenarios } from './search-browser-presets.mjs';
import { matchScenarios } from './search-browser-matches.mjs';
import { inspectionScenarios } from './search-browser-inspection.mjs';
import { verificationScenarios } from './search-browser-verification.mjs';
import { sweepScenarios } from './search-browser-sweep.mjs';

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist-search-smoke');
const server = await serveBuild(dist);
let browser;
let passed = 0;
try {
  browser = await launchBrowser(server.url);
  const d = createSearchBrowserDriver(browser.cdp);
  await d.visible(selectors.fixture);
  const step = async (name, action) => {
    try {
      await action();
      passed++;
      console.log('PASS ' + name);
    } catch (cause) {
      throw new Error('Search browser scenario failed: ' + name, { cause });
    }
  };
  await scopeScenarios(d, step);
  await observationScenarios(d, step);
  await ledgerScenarios(d, step);
  await presetScenarios(d, step);
  await matchScenarios(d, step);
  await sweepScenarios(d, step);
  await inspectionScenarios(d, step);
  await verificationScenarios(d, step);
  assert.deepEqual(browser.cdp.errors, [], 'Unexpected browser runtime exceptions');
  console.log('Completed ' + passed + ' independent search browser scenarios.');
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    await server.close();
  }
}
