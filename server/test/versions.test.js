import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

// The browser and server share collision and hit code, so they must run the same three.js.
test('browser and server load the same three.js version', () => {
  const server = JSON.parse(read('package.json')).dependencies.three;
  const browser = read('public/index.html').match(/three@([\d.]+)\//)?.[1];
  assert.equal(browser, server, 'update the importmap in public/index.html to match package.json');
});
