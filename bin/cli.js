#!/usr/bin/env node
'use strict';

const { fetchPage, fetchMany, recipes } = require('../lib');

const USAGE = `agent-fetch <url> [<url2> ...] [options]

A real headless browser for fetching pages a sandboxed fetch tool can't
reach — JS-rendered content, bot-walled sites, or a real screenshot.
Pass more than one URL to fetch them concurrently against one shared
browser instance (much faster than one CLI call per URL — see README).

Output modes (pick one, default is readable text):
  --html                  raw HTML instead of extracted text
  --selector <css>        innerText of one element only
  --recipe <name>         structured JSON via a named recipe (see --list-recipes)
  --screenshot <file>     save a PNG instead of extracting content (single URL only)

Options:
  --concurrency <n>       max concurrent pages when multiple URLs are given, default 5
  --limit <n>             passed through to recipes that take one (e.g. reddit-list, default 10)
  --wait <ms>             extra settle time after load, default 300
  --full                  don't truncate text/html output
  --full-page             with --screenshot, capture the whole scrollable page
  --width <n>             viewport width, default 1280
  --height <n>            viewport height, default 900
  --timeout <ms>          navigation timeout, default 30000
  --list-recipes          print available recipes and exit
  -h, --help              print this help and exit
`;

function parseArgs(argv) {
  const args = {
    urls: [], html: false, full: false, selector: null, wait: 300,
    recipe: null, limit: 10, screenshot: null, fullPage: false, concurrency: 5,
    width: 1280, height: 900, timeout: 30000, listRecipes: false, help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--html') args.html = true;
    else if (a === '--full') args.full = true;
    else if (a === '--recipe') args.recipe = argv[++i];
    else if (a === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (a === '--concurrency') args.concurrency = parseInt(argv[++i], 10);
    else if (a === '--selector') args.selector = argv[++i];
    else if (a === '--wait') args.wait = parseInt(argv[++i], 10);
    else if (a === '--screenshot') args.screenshot = argv[++i];
    else if (a === '--full-page') args.fullPage = true;
    else if (a === '--width') args.width = parseInt(argv[++i], 10);
    else if (a === '--height') args.height = parseInt(argv[++i], 10);
    else if (a === '--timeout') args.timeout = parseInt(argv[++i], 10);
    else if (a === '--list-recipes') args.listRecipes = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else args.urls.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(USAGE);
    return;
  }
  if (args.listRecipes) {
    for (const r of recipes.list()) console.log(`${r.name}\t${r.description}`);
    return;
  }
  if (args.urls.length === 0) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  if (args.screenshot && args.urls.length > 1) {
    console.error('agent-fetch: --screenshot only supports a single URL');
    process.exitCode = 1;
    return;
  }

  const opts = {
    html: args.html, full: args.full, selector: args.selector, wait: args.wait,
    recipeName: args.recipe, limit: args.limit, screenshot: args.screenshot,
    fullPage: args.fullPage, width: args.width, height: args.height, timeout: args.timeout,
  };

  try {
    if (args.urls.length === 1) {
      const result = await fetchPage(args.urls[0], opts);
      if (args.screenshot) console.log(`saved screenshot to ${result}`);
      else if (typeof result === 'string') console.log(result);
      else console.log(JSON.stringify(result, null, 2));
    } else {
      const results = await fetchMany(args.urls, { ...opts, concurrency: args.concurrency });
      console.log(JSON.stringify(results, null, 2));
      if (results.some((r) => !r.ok)) process.exitCode = 1; // some URLs failed — still printed what succeeded
    }
  } catch (err) {
    console.error(`agent-fetch: ${err.message}`);
    process.exitCode = 1;
  }
}

main();
