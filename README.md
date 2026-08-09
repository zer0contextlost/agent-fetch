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
agent-fetch <url> --wait 2000            extra settle time in ms after load (default 800)
agent-fetch <url> --recipe reddit-post   structured JSON via a named recipe
agent-fetch <url> --screenshot out.png   save a PNG instead of extracting content
agent-fetch <url> --screenshot out.png --full-page   capture the whole scrollable page
agent-fetch --list-recipes               show available recipes
```

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
const { fetchPage } = require('agent-fetch');

const html = await fetchPage('https://example.com', { html: true });
const posts = await fetchPage('https://old.reddit.com/r/selfhosted', { recipeName: 'reddit-list', limit: 5 });
```

## Why this exists

Built while operating a homelab through an AI agent — the agent kept
needing to read pages its sandboxed fetch tool couldn't reach, or verify a
UI change by actually looking at it instead of reasoning about CSS in the
abstract. Generalized out of that private tool into something anyone
running an agent against real infrastructure would want.

## Roadmap

- Caching layer so repeated fetches in one debugging session don't
  relaunch Chromium each time
- A `--diff` mode: two screenshots in, a visual diff out, for regression
  checking UI changes
- Wrap this as an MCP server so agents can call it as a tool directly
  instead of shelling out to a CLI

## License

MIT
