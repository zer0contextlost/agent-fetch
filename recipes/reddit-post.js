'use strict';

// old.reddit.com is server-rendered (cheap, reliable). www.reddit.com is a
// client-rendered React app that often throws an interstitial/consent wall
// at logged-out headless browsers — prefer old.reddit.com URLs when you
// have a choice; this recipe falls back to a best-effort generic scrape
// on www.reddit.com but the structured comment tree only works on old.

module.exports = {
  name: 'reddit-post',
  description: 'Structured {title, body, comments[]} for a single reddit post/comments page.',

  async prep(context) {
    // Reddit's own NSFW self-attestation age gate — this is the cookie set
    // by clicking "yes, continue" on the interstitial, not a bot-detection
    // bypass.
    await context.addCookies([{ name: 'over18', value: '1', domain: '.reddit.com', path: '/' }]);
  },

  async extract(page) {
    return page.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const isOld = location.hostname.startsWith('old.');
      if (isOld) {
        const title = clean(document.querySelector('a.title')?.textContent);
        const body = clean(document.querySelector('.usertext-body .md')?.textContent);
        const comments = Array.from(document.querySelectorAll('.commentarea .comment'))
          .slice(0, 40)
          .map((c) => ({
            author: clean(c.querySelector('.author')?.textContent),
            score: clean(c.querySelector('.score.unvoted')?.textContent),
            text: clean(c.querySelector('.usertext-body .md')?.textContent),
          }))
          .filter((c) => c.text);
        return { title, body, comments };
      }
      const title = clean(document.querySelector('h1')?.textContent);
      const body = clean(
        document.querySelector('[data-testid="post-content"]')?.textContent || document.body.innerText
      ).slice(0, 4000);
      return { title, body, comments: [] };
    });
  },
};
