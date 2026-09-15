# agent-fetch

A real headless browser (Playwright/Chromium) for AI coding agents to fetch
pages that a sandboxed fetch tool can't reach — JS-rendered content, sites
that block bots outright, or a real screenshot when you need to *see* the
result instead of guess at it.

Claude Code's built-in `WebFetch` (and most agent-tooling equivalents) is
sandboxed for good reasons, but that means it can't execute JavaScript and
gets hard-blocked by some sites (reddit.com is a reliable example). This is
a real browser, launched from wherever your agent is actually running, for
the cases where that matters.

## Install

```
npx github:zer0contextlost/agent-fetch <url>
```

or clone and link it locally:

```
git clone https://github.com/zer0contextlost/agent-fetch
cd agent-fetch && npm install && npm link
agent-fetch <url>
```

Requires Node 18+. `npm install` pulls Playwright's Chromium build the
first time, which is a real download (~150MB) — subsequent installs reuse
the cached browser.

## Usage

```
agent-fetch <url>                        readable text (document.body.innerText)
agent-fetch <url> --html                 raw HTML instead of extracted text
agent-fetch <url> --full                 don't truncate output (default caps at 20k chars)
agent-fetch <url> --selector '#thing'    innerText of one element only
agent-fetch <url> --wait 2000            extra settle time in ms after load (default 300)
agent-fetch <url> --recipe reddit-post   structured JSON via a named recipe
agent-fetch <url> --screenshot out.png   save a PNG instead of extracting content
agent-fetch <url> --screenshot out.png --full-page   capture the whole scrollable page
agent-fetch --list-recipes               show available recipes
```

### Fetching multiple URLs

Pass more than one URL and they run concurrently against one shared
browser instance instead of one CLI call (one browser launch) each:

```
agent-fetch <url1> <url2> <url3> --concurrency 5
```

Every single-URL call pays a real, fixed browser-launch cost — measured at
roughly 250ms on ordinary hardware, separate from network time. That cost
is per *browser*, not per *page*, so batching amortizes it: on this
project's own dev box (4 cores), fetching 5 real URLs as 5 separate CLI
calls took 7.1s; the same 5 URLs in one `fetchMany` call took 1.0s. Exact
numbers will vary with your hardware and the sites involved — the
mechanism (one browser, many concurrent tabs) is the actual fix, not the
specific multiplier.

Output is a JSON array in input order, one bad URL doesn't take the whole
batch down:

```json
[
  { "url": "https://example.com", "ok": true, "result": "Example Domain..." },
  { "url": "https://bad.invalid", "ok": false, "error": "net::ERR_NAME_NOT_RESOLVED at https://bad.invalid/" }
]
```

`--screenshot` only supports a single URL at a time.

### Recipes

A recipe is a small module that knows how to pull structured data out of a
specific kind of page instead of a blob of text. Two ship today, both
grounded in sites that actually needed them:

- `reddit-post` — `{title, body, comments[]}` for a single post/comments page
- `reddit-list` — `[{title, url, score, numComments}]` for a subreddit/listing page (`--limit N`, default 10)

old.reddit.com is server-rendered and reliable for both; www.reddit.com is
a client-rendered app that often throws a consent wall at logged-out
headless browsers, so prefer old.reddit.com URLs when you have a choice.

Adding a recipe means implementing `{ name, description, extract(page, opts), prep?(context, url) }`
in `recipes/` and registering it in `recipes/index.js` — `extract` gets a live
Playwright `Page` and returns anything JSON-serializable; `prep` is an
optional hook for context-level setup (cookies, auth) before navigation.

### Programmatic use

```js
const { fetchPage, fetchMany } = require('agent-fetch');

const html = await fetchPage('https://example.com', { html: true });
const posts = await fetchPage('https://old.reddit.com/r/selfhosted', { recipeName: 'reddit-list', limit: 5 });

const results = await fetchMany(['https://a.example', 'https://b.example'], { concurrency: 5 });
// [{ url, ok: true, result } | { url, ok: false, error }, ...] in input order
```

## MCP server

`agent-fetch` also ships as an MCP server so an agent can call it as a real
tool instead of shelling out to the CLI:

```
agent-fetch-mcp
```

(installed as a bin alongside `agent-fetch`; point your MCP client's stdio
config at it, e.g. `npx -p github:zer0contextlost/agent-fetch agent-fetch-mcp`,
or `node bin/mcp-server.js` from a local clone).

It exposes three tools: `fetch` (single URL, same options as the CLI minus
`--width`/`--height`), `fetch_many` (concurrent batch), and `list_recipes`.
Unlike the CLI, the MCP server keeps **one browser context warm for its
whole process lifetime** and reuses it across every tool call — an agent
making many calls in a session pays the ~250ms browser-launch cost once,
not per call, which is the persistent-daemon behavior described in the
roadmap below, gotten essentially for free from the MCP server being a
long-lived process.

Example opencode `opencode.json` entry:

```json
{
  "mcp": {
    "agent-fetch": {
      "type": "local",
      "command": ["node", "D:/agent-fetch/bin/mcp-server.js"],
      "enabled": true
    }
  }
}
```

## Why this exists

Built while operating a homelab through an AI agent — the agent kept
needing to read pages its sandboxed fetch tool couldn't reach, or verify a
UI change by actually looking at it instead of reasoning about CSS in the
abstract. Generalized out of that private tool into something anyone
running an agent against real infrastructure would want.

## Roadmap

- ~~A persistent daemon mode~~ / ~~wrap this as an MCP server~~ — done, see
  [MCP server](#mcp-server) above. The CLI still pays a fresh browser-launch
  cost per invocation; the MCP server does not.
- Caching layer so repeated fetches of the same URL in one session don't
  re-navigate at all
- A `--diff` mode: two screenshots in, a visual diff out, for regression
  checking UI changes

## License

MIT
