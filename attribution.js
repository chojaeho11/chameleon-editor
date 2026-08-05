// attribution.js — 2026-08-05: 주문별 유입경로(어트리뷰션) 캡처.
//   랜딩 시 gclid/utm/네이버광고/리퍼러로 채널을 판정해 first-touch(최초 의미유입) + last-touch(구매직전 유입)를
//   localStorage(_attr_v1)에 영구 저장(sessionStorage는 탭 닫으면 소실 → 광고 클릭 유실됨).
//   결제 시 window.getOrderAttribution() 으로 주문에 부착. 대시보드 기본 = last-touch(사장님 지정).
//   ※ 내부이동/봇은 저장 안 함. index.html getTrafficSource 로직과 동일 분류, 단 독립 동작(어느 페이지든 로드 가능).
(function () {
  'use strict';
  var LS = '_attr_v1';
  // 채널 우선순위 — first-touch 승격 판정에 사용(광고/검색이 직접/외부보다 '의미있는' 유입)
  var PRI = { '광고-구글': 5, '광고-네이버': 5, '광고-야후': 5, '광고-기타': 5, 'QR': 4, '자연검색': 4, 'SNS': 3, '외부사이트': 2, '즐겨찾기·직접': 1 };

  function classify() {
    try {
      var ua = (navigator.userAgent || '').toLowerCase();
      if (!ua || ua.length < 20 || navigator.webdriver === true) return null;
      if (/bot\b|bot\/|crawler|spider|headless|prerender|lighthouse|python|curl\/|wget\/|axios|scrapy|slurp|bytespider|ahrefs|semrush|facebookexternalhit|petalbot/.test(ua)) return null;

      var p = new URLSearchParams(location.search);
      var us = (p.get('utm_source') || '').toLowerCase();
      var cpc = p.get('utm_medium') === 'cpc';
      var camp = p.get('utm_campaign') || p.get('n_campaign_type') || '';
      var kw = p.get('utm_term') || p.get('n_query') || p.get('query') || '';

      var gclid = p.has('gclid') || p.has('gbraid') || p.has('wbraid');
      var naverAd = p.has('na_click_id') || p.has('n_campaign_type') || p.has('nclid') || p.has('n_media') || p.has('n_query');

      // 광고 파라미터 → 세션 저장(리다이렉트로 파라미터 유실 대비, getTrafficSource 와 동일 키)
      if (gclid || naverAd || cpc || us === 'ad') {
        try {
          sessionStorage.setItem('_ch_ad_source', gclid ? 'google' : (naverAd || us === 'naver') ? 'naver' : us === 'yahoo' ? 'yahoo' : (us || 'other'));
          sessionStorage.setItem('_ch_ad_campaign', camp);
          sessionStorage.setItem('_ch_ad_keyword', kw);
        } catch (e) {}
      }

      if (gclid || (us === 'google' && cpc)) return { channel: '광고-구글', campaign: camp, keyword: kw, source: gclid ? 'gclid' : 'utm' };
      if (naverAd || (us === 'naver' && cpc)) return { channel: '광고-네이버', campaign: camp, keyword: kw, source: 'naver' };
      if (p.has('yclid') || (us === 'yahoo' && cpc)) return { channel: '광고-야후', campaign: camp, keyword: kw, source: 'yahoo' };
      if (cpc || us === 'ad') return { channel: '광고-기타', campaign: camp, keyword: kw, source: us || 'cpc' };
      if (us === 'qr' || (p.get('utm_medium') || '').toLowerCase() === 'qr' || p.has('qr')) return { channel: 'QR', campaign: camp, source: 'qr' };

      var ref = document.referrer || '';
      // 광고 랜딩 후 리다이렉트로 리퍼러/파라미터가 사라진 경우 세션복원
      try {
        var sa = sessionStorage.getItem('_ch_ad_source');
        if (sa && !ref) {
          return { channel: sa === 'google' ? '광고-구글' : sa === 'naver' ? '광고-네이버' : sa === 'yahoo' ? '광고-야후' : '광고-기타',
                   campaign: sessionStorage.getItem('_ch_ad_campaign') || '', keyword: sessionStorage.getItem('_ch_ad_keyword') || '', source: '세션복원' };
        }
      } catch (e) {}

      if (!ref) return { channel: '즐겨찾기·직접', source: 'direct' };
      var host = '';
      try { host = new URL(ref).hostname.toLowerCase(); } catch (e) { return { channel: '외부사이트', source: 'ref' }; }
      var rp; try { rp = new URL(ref).searchParams; } catch (e) { rp = new URLSearchParams(''); }

      // 내부 이동 — 저장 안 함
      if (/cafe2626\.com|cafe0101\.com|cafe3355\.com|chameleon\.design|cotton-print|cotton-printer|hexa-board/.test(host)) return null;

      if (/googleads\.|doubleclick\.net|googlesyndication\./.test(host)) return { channel: '광고-구글', source: '리퍼러' };
      if (/searchad\.naver|ad\.search\.naver|ade\.naver/.test(host)) return { channel: '광고-네이버', source: '리퍼러' };
      if (host.indexOf('google.') >= 0) {
        if (rp.has('aclk')) return { channel: '광고-구글', source: '리퍼러' };
        return { channel: '자연검색', sub: 'google', keyword: rp.get('q') || '' };
      }
      if (host.indexOf('naver.') >= 0) {
        if (rp.has('ad_id') || rp.has('nclick') || rp.has('tqa') || rp.has('where_ad')) return { channel: '광고-네이버', source: '리퍼러' };
        return { channel: '자연검색', sub: 'naver', keyword: rp.get('query') || '' };
      }
      if (/daum\.|kakao\./.test(host)) return { channel: '자연검색', sub: 'daum' };
      if (host.indexOf('bing.') >= 0) return { channel: '자연검색', sub: 'bing', keyword: rp.get('q') || '' };
      if (host.indexOf('yahoo.') >= 0) {
        if (rp.has('yclid')) return { channel: '광고-야후', source: '리퍼러' };
        return { channel: '자연검색', sub: 'yahoo', keyword: rp.get('p') || '' };
      }
      if (/instagram|ig\.me|facebook|fb\.com|fb\.me|m\.me|youtube|youtu\.be|tiktok|twitter|t\.co|x\.com|line\.me|liff\.line|pinterest|threads\.net|reddit|redd\.it|kakaocorp/.test(host)) return { channel: 'SNS', sub: host };
      return { channel: '외부사이트', source: host };
    } catch (e) { return null; }
  }

  function load() { try { return JSON.parse(localStorage.getItem(LS) || 'null') || {}; } catch (e) { return {}; } }
  function save(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  function stamp(c) {
    return { channel: c.channel, sub: c.sub || '', campaign: c.campaign || '', keyword: c.keyword || '', source: c.source || '',
             landing: (location.pathname + location.search).slice(0, 300), ts: new Date().toISOString() };
  }
  function capture() {
    var c = classify();
    if (!c) return;                 // 내부이동/봇 → 저장 안 함
    var st = load();
    var cur = stamp(c);
    st.last = cur;                  // last-touch: 매 (외부)방문마다 갱신 = 구매직전 유입
    if (!st.first) st.first = cur;  // first-touch: 최초 1회
    else if ((PRI[c.channel] || 0) > (PRI[st.first.channel] || 0) && (PRI[st.first.channel] || 0) <= 2) st.first = cur; // 첫 방문이 직접/외부였다가 광고/검색 오면 승격
    save(st);
  }

  // 결제 시 주문에 부착. attribution_channel = last-touch(대시보드 기본). 상세는 jsonb.
  window.getOrderAttribution = function () {
    var st = load();
    if (!st.last && !st.first) return {};
    var last = st.last || st.first;
    return { attribution_channel: (last && last.channel) || '미확인', attribution: { first: st.first || null, last: st.last || null } };
  };

  try { capture(); } catch (e) {}
})();
