'use strict';
// Real smoke test — launches an actual browser against a stable public
// page. Not a mocked unit test: the whole point of this tool is that it
// drives a real browser, so that's what gets tested.

const assert = require('assert');
const { fetchPage } = require('../lib');

async function main() {
  const text = await fetchPage('https://example.com', {});
  assert(text.includes('Example Domain'), 'text mode should find page content');

  const html = await fetchPage('https://example.com', { html: true });
  assert(html.includes('<h1>'), 'html mode should return raw markup');

  const selector = await fetchPage('https://example.com', { selector: 'h1' });
  assert.strictEqual(selector.trim(), 'Example Domain', 'selector mode should scope to one element');

  console.log('smoke test passed');
}

main().catch((err) => {
  console.error('smoke test failed:', err);
  process.exitCode = 1;
});
