// Cloudflare Pages Worker — Rewrite OG meta tags based on hostname
// Crawlers (KakaoTalk, LINE, Facebook, Twitter) don't execute JS,
// so we must rewrite the HTML at the edge level.

const OG_DATA = {
  'cafe0101.com': {
    lang: 'ja',
    siteName: 'カメレオンプリンティング',
    title: 'カメレオンプリンティング - エコ展示・ポップアップストア印刷 & 無料デザインエディター',
    description: 'ハニカムボード、ファブリック印刷、ポップアップストア専門。無料エディターで等身大パネル・バックウォールのデザインから印刷まで一括対応。',
    url: 'https://www.cafe0101.com/',
  },
  'cafe3355.com': {
    lang: 'en',
    siteName: 'Chameleon Printing',
    title: 'Chameleon Printing - Eco Display & Pop-up Store Printing with Free Design Editor',
    description: 'Honeycomb boards, fabric printing, pop-up store displays. Free online editor for life-size cutouts, backwalls, and custom printing solutions.',
    url: 'https://www.cafe3355.com/',
  },
};

function getSiteData(hostname) {
  for (const [domain, data] of Object.entries(OG_DATA)) {
    if (hostname.includes(domain)) return data;
  }
  return null; // KR site or unknown — no rewrite
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const response = await env.ASSETS.fetch(request);

    // Only rewrite HTML responses
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return response;

    const siteData = getSiteData(url.hostname);
    if (!siteData) return response; // KR site, keep original Korean

    // Rewrite OG/meta tags using HTMLRewriter
    return new HTMLRewriter()
      // <html lang>
      .on('html', {
        element(el) { el.setAttribute('lang', siteData.lang); }
      })
      // <title>
      .on('title', {
        element(el) { el.setInnerContent(siteData.title); }
      })
      // meta name="description"
      .on('meta[name="description"]', {
        element(el) { el.setAttribute('content', siteData.description); }
      })
      // OG tags
      .on('meta[property="og:site_name"]', {
        element(el) { el.setAttribute('content', siteData.siteName); }
      })
      .on('meta[property="og:title"]', {
        element(el) { el.setAttribute('content', siteData.title); }
      })
      .on('meta[property="og:description"]', {
        element(el) { el.setAttribute('content', siteData.description); }
      })
      .on('meta[property="og:url"]', {
        element(el) { el.setAttribute('content', siteData.url); }
      })
      // Twitter Card
      .on('meta[name="twitter:title"]', {
        element(el) { el.setAttribute('content', siteData.title); }
      })
      .on('meta[name="twitter:description"]', {
        element(el) { el.setAttribute('content', siteData.description); }
      })
      // Canonical URL
      .on('link[rel="canonical"]', {
        element(el) { el.setAttribute('href', siteData.url); }
      })
      .transform(response);
  }
};
