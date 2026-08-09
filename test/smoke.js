'use strict';
// Real smoke test — launches an actual browser against a stable public
// page. Not a mocked unit test: the whole point of this tool is that it
// drives a real browser, so that's what gets tested.

const assert = require('assert');
const { fetchPage, fetchMany } = require('../lib');

async function main() {
  const text = await fetchPage('https://example.com', {});
  assert(text.includes('Example Domain'), 'text mode should find page content');

  const html = await fetchPage('https://example.com', { html: true });
  assert(html.includes('<h1>'), 'html mode should return raw markup');

  const selector = await fetchPage('https://example.com', { selector: 'h1' });
  assert.strictEqual(selector.trim(), 'Example Domain', 'selector mode should scope to one element');

  const batch = await fetchMany(
    ['https://example.com', 'https://this-domain-does-not-exist-agentfetch-test.invalid'],
    { concurrency: 2 }
  );
  assert.strictEqual(batch.length, 2, 'fetchMany should return one result per URL, in order');
  assert.strictEqual(batch[0].ok, true, 'good URL in a batch should succeed');
  assert(batch[0].result.includes('Example Domain'), 'batch result should contain extracted content');
  assert.strictEqual(batch[1].ok, false, 'bad URL in a batch should fail without taking the whole batch down');

  // Regression case for a real bug found via stress-testing: unicode.org
  // keeps navigating client-side after the network 'load' event, which can
  // tear down the execution context mid-extraction. If this site ever
  // changes its reload behavior the retry path just won't be exercised —
  // that's fine, it's still a valid live check of the happy path.
  const unicode = await fetchPage('https://www.unicode.org', { wait: 0 });
  assert(unicode.length > 0, 'unicode.org should extract successfully despite its post-load navigation');

  console.log('smoke test passed');
}

main().catch((err) => {
  console.error('smoke test failed:', err);
  process.exitCode = 1;
});
