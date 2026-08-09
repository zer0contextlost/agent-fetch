'use strict';

const { openPage } = require('./browser');
const extract = require('./extract');
const recipes = require('../recipes');

/**
 * Fetch a URL through a real headless browser and return either extracted
 * text/html/selector text (string), a recipe's structured result (object),
 * or write a screenshot to disk (returns the file path).
 *
 * This is the shared core behind bin/cli.js — kept separate so it's usable
 * programmatically (e.g. from an MCP server) without shelling out.
 */
async function fetchPage(url, options = {}) {
  const {
    html = false, full = false, selector = null, wait = 800,
    recipeName = null, limit = 10, screenshot = null, fullPage = false,
    width = 1280, height = 900, timeout = 30000,
  } = options;

  const recipe = recipeName ? recipes.get(recipeName) : null;
  const { browser, context, page } = await openPage({ width, height });

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
    await browser.close();
  }
}

module.exports = { fetchPage, recipes };
