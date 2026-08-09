'use strict';
const { chromium } = require('playwright');

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

async function openContext({ width = 1280, height = 900 } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: DEFAULT_UA,
    viewport: { width, height },
  });
  return { browser, context };
}

async function openPage(opts) {
  const { browser, context } = await openContext(opts);
  const page = await context.newPage();
  return { browser, context, page };
}

module.exports = { openContext, openPage, DEFAULT_UA };
