'use strict';

// Listing pages (subreddit fronts, /top, /new, search results) are only
// reliably scrapeable on old.reddit.com's server-rendered markup.

module.exports = {
  name: 'reddit-list',
  description: 'Structured [{title, url, score, numComments}] for a subreddit/listing page. Use --limit N (default 10).',

  async prep(context) {
    await context.addCookies([{ name: 'over18', value: '1', domain: '.reddit.com', path: '/' }]);
  },

  async extract(page, { limit = 10 } = {}) {
    return page.evaluate((limit) => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      return Array.from(document.querySelectorAll('#siteTable > .thing:not(.promoted)'))
        .slice(0, limit)
        .map((el) => {
          const titleEl = el.querySelector('a.title');
          const permalink = el.getAttribute('data-permalink');
          return {
            title: clean(titleEl?.textContent),
            url: permalink ? `https://old.reddit.com${permalink}` : clean(titleEl?.href),
            score: clean(el.querySelector('.score.unvoted')?.textContent),
            numComments: clean(el.querySelector('.comments')?.textContent),
          };
        })
        .filter((p) => p.title);
    }, limit);
  },
};
