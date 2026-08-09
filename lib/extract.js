'use strict';

const MAX_CHARS = 20000;

async function text(page) {
  return page.evaluate(() => document.body.innerText);
}

async function html(page) {
  return page.content();
}

async function selectorText(page, selector) {
  return page.locator(selector).first().innerText();
}

function truncate(output, full) {
  if (full || output.length <= MAX_CHARS) return output;
  return output.slice(0, MAX_CHARS) + `\n\n[...truncated, ${output.length} total chars, pass --full for everything]`;
}

module.exports = { text, html, selectorText, truncate, MAX_CHARS };
