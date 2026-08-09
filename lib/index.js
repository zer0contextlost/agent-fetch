'use strict';

const { openContext } = require('./browser');
const extract = require('./extract');
const recipes = require('../recipes');

// Every real single-page fetch through this tool spends ~250ms just
// launching Node + Chromium — measured, not assumed. That cost is fixed
// per browser instance, not per page, so fetchMany() amortizes it across
// N URLs by reusing one browser/context and running pages concurrently
// (bounded by `concurrency`, since Chromium tabs aren't free — each one
// is a real process using real memory).

async function runOnPage(context, url, options) {
  const {
    html = false, full = false, selector = null, wait = 300,
    recipeName = null, limit = 10, screenshot = null, fullPage = false, timeout = 30000,
  } = options;

  const recipe = recipeName ? recipes.get(recipeName) : null;
  const page = await context.newPage();
  try {
    if (recipe?.prep) await recipe.prep(context, url);

    await page.goto(url, { waitUntil: 'load', timeout });
    if (wait) await page.waitForTimeout(wait);

    if (screenshot) {
      await page.screenshot({ path: screenshot, fullPage });
      return screenshot;
    }
    if (recipe) return await recipe.extract(page, { limit });
    if (selector) return extract.truncate(await extract.selectorText(page, selector), full);
    if (html) return extract.truncate(await extract.html(page), full);
    return extract.truncate(await extract.text(page), full);
  } finally {
    await page.close();
  }
}

/**
 * Fetch a single URL through a real headless browser. Returns extracted
 * text/html/selector text (string), a recipe's structured result (object),
 * or a screenshot file path.
 */
async function fetchPage(url, options = {}) {
  const { width = 1280, height = 900 } = options;
  const { browser, context } = await openContext({ width, height });
  try {
    return await runOnPage(context, url, options);
  } finally {
    await browser.close();
  }
}

/**
 * Fetch many URLs concurrently against one shared browser instance —
 * amortizes browser-launch cost across the batch instead of paying it
 * once per URL. Returns results in input order, one bad URL doesn't fail
 * the batch: [{ url, ok: true, result } | { url, ok: false, error }].
 */
async function fetchMany(urls, options = {}) {
  const { width = 1280, height = 900, concurrency = 5 } = options;
  const { browser, context } = await openContext({ width, height });
  const results = new Array(urls.length);
  let next = 0;

  async function worker() {
    while (next < urls.length) {
      const i = next++;
      try {
        results[i] = { url: urls[i], ok: true, result: await runOnPage(context, urls[i], options) };
      } catch (err) {
        results[i] = { url: urls[i], ok: false, error: err.message };
      }
    }
  }

  try {
    const workerCount = Math.max(1, Math.min(concurrency, urls.length));
    await Promise.all(Array.from({ length: workerCount }, worker));
    return results;
  } finally {
    await browser.close();
  }
}

module.exports = { fetchPage, fetchMany, recipes };
