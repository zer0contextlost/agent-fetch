#!/usr/bin/env node
'use strict';

// MCP server wrapper around lib/index.js — exposes fetch/fetch_many/
// list_recipes as tools over stdio. Unlike the CLI (which launches and
// closes a browser per invocation), this process keeps ONE browser context
// warm for its whole lifetime and reuses it across every tool call, so an
// agent making many calls in a session only pays the ~250ms launch cost
// once instead of per call. The context is opened lazily on first use and
// torn down on shutdown.

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const { runOnPage, openContext, recipes } = require('../lib');
const pkg = require('../package.json');

const server = new McpServer({ name: pkg.name, version: pkg.version });

let contextPromise = null;
function getContext() {
  if (!contextPromise) contextPromise = openContext();
  return contextPromise;
}

async function closeContext() {
  if (!contextPromise) return;
  const { browser } = await contextPromise;
  contextPromise = null;
  await browser.close().catch(() => {});
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await closeContext();
    process.exit(0);
  });
}
process.on('exit', () => {
  if (contextPromise) contextPromise.then(({ browser }) => browser.close()).catch(() => {});
});

// No width/height here: the browser context (and its viewport) is opened
// once, lazily, on the first tool call and reused for the server's whole
// lifetime — a per-call viewport override wouldn't apply consistently.
const pageOptionsShape = {
  html: z.boolean().optional().describe('Return raw HTML instead of extracted text'),
  full: z.boolean().optional().describe("Don't truncate output (default caps at 20k chars)"),
  selector: z.string().optional().describe('CSS selector — return innerText of one element only'),
  wait: z.number().int().optional().describe('Extra settle time in ms after load (default 300)'),
  recipe: z.string().optional().describe('Named recipe for structured output (see list_recipes)'),
  limit: z.number().int().optional().describe('Passed through to recipes that take one, e.g. reddit-list (default 10)'),
  timeout: z.number().int().optional().describe('Navigation timeout in ms (default 30000)'),
};

function toOptions(args) {
  return {
    html: args.html,
    full: args.full,
    selector: args.selector,
    wait: args.wait,
    recipeName: args.recipe,
    limit: args.limit,
    timeout: args.timeout,
  };
}

function textResult(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function errorResult(err) {
  return { content: [{ type: 'text', text: `agent-fetch: ${err.message}` }], isError: true };
}

server.registerTool(
  'fetch',
  {
    title: 'Fetch a page',
    description:
      "Fetch a single URL through a real headless browser (Playwright/Chromium) — for JS-rendered content or sites that block a sandboxed fetch tool outright. Optionally save a screenshot instead of extracting content.",
    inputSchema: {
      url: z.string().describe('The URL to fetch'),
      ...pageOptionsShape,
      screenshot: z.string().optional().describe('If set, save a PNG to this path instead of extracting content'),
      fullPage: z.boolean().optional().describe('With screenshot, capture the whole scrollable page'),
    },
  },
  async (args) => {
    try {
      const { context } = await getContext();
      const result = await runOnPage(context, args.url, {
        ...toOptions(args),
        screenshot: args.screenshot,
        fullPage: args.fullPage,
      });
      if (args.screenshot) return textResult(`saved screenshot to ${result}`);
      return textResult(result);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  'fetch_many',
  {
    title: 'Fetch multiple pages concurrently',
    description:
      'Fetch several URLs concurrently against the shared browser context — much cheaper than one fetch call per URL. Returns one result per URL, in input order; a bad URL does not fail the whole batch.',
    inputSchema: {
      urls: z.array(z.string()).min(1).describe('URLs to fetch'),
      concurrency: z.number().int().optional().describe('Max concurrent pages (default 5)'),
      ...pageOptionsShape,
    },
  },
  async (args) => {
    try {
      const { context } = await getContext();
      const options = toOptions(args);
      const urls = args.urls;
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
      const workerCount = Math.max(1, Math.min(args.concurrency || 5, urls.length));
      await Promise.all(Array.from({ length: workerCount }, worker));
      return textResult(results);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.registerTool(
  'list_recipes',
  {
    title: 'List available recipes',
    description: 'List the named recipes fetch/fetch_many accept for structured (rather than raw text/HTML) output.',
    inputSchema: {},
  },
  async () => {
    const list = recipes.list().map((r) => ({ name: r.name, description: r.description }));
    return textResult(list);
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(`agent-fetch-mcp: ${err.message}`);
  process.exitCode = 1;
});
