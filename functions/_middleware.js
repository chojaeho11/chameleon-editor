// Cloudflare Pages Function — 서버사이드 SEO 메타태그 주입
// Google 크롤러가 첫 HTML 응답에서 올바른 메타태그를 볼 수 있도록

const HOME_SEO = {
  JP: {
    title: 'カメレオンプリンティング - エコ展示・ポップアップストア印刷 & 無料デザインエディター',
    desc: 'ハニカムボード、ファブリック印刷、アクリルグッズ、バナー、看板、パッケージまで。無料エディターでデザインから印刷まで一括対応。出店も可能なグローバル印刷プラットフォーム。',
    keywords: 'カメレオンプリンティング,ハニカムボード,ファブリック印刷,ポップアップストア,等身大パネル,展示ブース,エコ印刷,バックウォール,アクリル印刷,バナースタンド,無料エディター,オンライン印刷,UV印刷,Tシャツ印刷'
  },
  US: {
    title: 'Chameleon Printing - Eco Display & Pop-up Store Printing with Free Design Editor',
    desc: 'Honeycomb boards, fabric printing, acrylic goods, banners, signs & packaging. Free online design editor like Canva. Global print marketplace - sell your products worldwide.',
    keywords: 'chameleon printing,honeycomb board,honeycomb board printing,exhibition booth,exhibition booth display,fabric printing,pop-up store,display printing,life-size cutout,backwall design,eco printing,acrylic print,banner stand,free design editor,online printing,UV printing,custom printing,trade show display'
  }
};

const PRODUCT_SEO = {
  honeycomb: {
    JP: { title: 'ハニカムボード印刷 - エコ紙ディスプレイ | カメレオンプリンティング', desc: 'エコハニカムボードのカスタム印刷。ポップアップストア・展示ブース・店舗ディスプレイに最適。無料オンラインエディターでデザイン可能。', keywords: 'ハニカムボード,ハニカムボード印刷,紙ディスプレイ,ポップアップストア,エコ展示,展示ブース' },
    US: { title: 'Honeycomb Board Printing - Eco Paper Display | Chameleon Printing', desc: 'Custom eco-friendly honeycomb board printing. Perfect for pop-up stores, exhibition booths & retail displays. Free online design editor included.', keywords: 'honeycomb board,honeycomb board printing,honeycomb board exhibition booth,paper display,pop-up store display,eco display,exhibition booth,trade show display,retail display board,eco-friendly display board,custom exhibition display' }
  },
  'fabric-print': {
    JP: { title: 'ファブリック印刷 - 高画質布印刷 | カメレオンプリンティング', desc: '高画質ファブリック（布）カスタム印刷。バックウォール・フォトゾーン・背景幕に最適。無料デザインエディター付き。', keywords: 'ファブリック印刷,布印刷,バックウォール,フォトゾーン,背景幕,タペストリー印刷' },
    US: { title: 'Fabric Printing - High Quality Custom Cloth Print | Chameleon Printing', desc: 'High-resolution custom fabric printing. Ideal for backwalls, photo zones, backdrops & banners. Free online design editor available.', keywords: 'fabric printing,cloth printing,backwall,photo zone,backdrop printing,custom fabric,banner printing' }
  },
  'paper-stand': {
    JP: { title: '紙什器 制作 - エコPOPディスプレイ | カメレオンプリンティング', desc: 'エコ紙什器のカスタム制作。スーパー・コンビニ・店舗の陳列台に最適。無料エディターでデザイン、全国配送対応。', keywords: '紙什器,紙ディスプレイ,POP什器,店舗什器,エコ什器,段ボールディスプレイ' },
    US: { title: 'Paper Display Stand - Eco Cardboard POP Display | Chameleon Printing', desc: 'Custom eco-friendly paper display stands. Perfect for retail POP displays, stores & supermarkets. Free design editor, nationwide delivery.', keywords: 'paper display stand,cardboard display,POP display,retail display,eco display stand,point of purchase' }
  },
  'paper-furniture': {
    JP: { title: '紙家具 制作 - エコ段ボール家具 | カメレオンプリンティング', desc: 'エコ紙家具のカスタム制作。展示・イベント・ポップアップストア用テーブル・椅子・棚。軽量で丈夫な段ボール家具。', keywords: '紙家具,段ボール家具,エコ家具,展示家具,ポップアップストア家具,イベント家具' },
    US: { title: 'Paper Furniture - Eco Cardboard Furniture | Chameleon Printing', desc: 'Custom eco-friendly paper furniture. Tables, chairs & shelves for exhibitions, events & pop-up stores. Lightweight yet strong cardboard furniture.', keywords: 'paper furniture,cardboard furniture,eco furniture,exhibition furniture,pop-up store furniture,event furniture' }
  },
  'foamex-print': {
    JP: { title: 'フォーレックス印刷 - PVCフォームボード | カメレオンプリンティング', desc: '高品質フォーレックス（PVCフォームボード）カスタム印刷。看板・案内板・インテリア・展示用。無料デザインエディター付き。', keywords: 'フォーレックス印刷,PVCフォームボード,フォーレックス看板,案内板印刷,PVC印刷' },
    US: { title: 'Foamex Printing - PVC Foam Board Print | Chameleon Printing', desc: 'High-quality Foamex (PVC foam board) custom printing. Perfect for signs, displays, interior decor & exhibitions. Free design editor.', keywords: 'foamex printing,PVC foam board,foamex sign,foam board printing,PVC printing,display board' }
  },
  'foamboard-print': {
    JP: { title: 'フォームボード印刷 - スチレンボード | カメレオンプリンティング', desc: 'フォームボード（スチレンボード）カスタム印刷。展示・案内・POP・フォトゾーンに最適。無料エディター、全国配送。', keywords: 'フォームボード印刷,スチレンボード,展示ボード,POPボード,パネル印刷' },
    US: { title: 'Foam Board Printing - Custom Display Board | Chameleon Printing', desc: 'Custom foam board printing for exhibitions, signage, POP displays & photo zones. Free online editor, lamination options, fast delivery.', keywords: 'foam board printing,foam board display,styrene board,POP display board,exhibition board,custom foam board' }
  },
  goods: {
    JP: { title: 'アクリルグッズ制作 - キーホルダー・フォトカード | カメレオンプリンティング', desc: 'アクリルグッズのカスタム制作。キーホルダー・フォトカード・アクリルスタンド・バッジ。無料エディターでデザイン可能。', keywords: 'アクリルグッズ,アクリルキーホルダー,フォトカード,アクリルスタンド,バッジ制作,グッズ制作' },
    US: { title: 'Acrylic Goods - Keychains, Photo Cards & Stands | Chameleon Printing', desc: 'Custom acrylic goods. Keychains, photo cards, acrylic stands & badges. Design with free online editor, small orders welcome.', keywords: 'acrylic goods,acrylic keychain,photo card,acrylic stand,acrylic badge,custom goods,merchandise' }
  },
  'foamex-stand': {
    JP: { title: 'フォーレックスディスプレイ - PVC什器 | カメレオンプリンティング', desc: 'フォーレックス（PVC）什器のカスタム制作。店舗陳列・商品ディスプレイ・展示会用。耐久性に優れたPVC素材。', keywords: 'フォーレックス什器,PVC什器,PVCディスプレイ,店舗什器,展示会什器' },
    US: { title: 'Foamex Display Stand - PVC Product Display | Chameleon Printing', desc: 'Custom Foamex (PVC) display stands. Ideal for retail, product displays & exhibitions. Durable PVC material, free design editor.', keywords: 'foamex display,PVC display stand,retail display,product display,PVC stand,exhibition display' }
  },
  'biz-print': {
    JP: { title: '名刺印刷 & 印刷物制作 | カメレオンプリンティング', desc: '高級名刺・チラシ・パンフレット・リーフレットのカスタム印刷。無料オンラインエディター、多様な用紙・加工オプション。', keywords: '名刺印刷,チラシ印刷,パンフレット,リーフレット,印刷物制作,名刺制作' },
    US: { title: 'Business Card & Print Materials | Chameleon Printing', desc: 'Premium business cards, flyers, brochures & leaflets. Design with free online editor, various paper & finishing options, fast delivery.', keywords: 'business card printing,flyer printing,brochure,leaflet,print materials,custom business card' }
  },
  'roll-blind': {
    JP: { title: 'ロールブラインド オーダーメイド | カメレオンプリンティング', desc: 'オーダーメイドロールブラインド印刷。店舗・オフィス・カフェのインテリア、広告用ロールスクリーン。無料エディター付き。', keywords: 'ロールブラインド,ロールスクリーン,オーダーブラインド,広告ロールブラインド,インテリアブラインド' },
    US: { title: 'Custom Roll Blinds - Printed Roller Shades | Chameleon Printing', desc: 'Custom printed roll blinds & roller shades. For stores, offices, cafes & advertising. Design with free editor, any size available.', keywords: 'roll blind,roller shade,custom blind,printed blind,advertising blind,window blind printing' }
  },
  'home-interior': {
    JP: { title: 'ホームインテリア印刷 - 壁紙・キャンバス | カメレオンプリンティング', desc: 'カスタムホームインテリア印刷。ポスター・キャンバス・壁紙・額縁制作。無料エディターでオリジナルインテリア。', keywords: 'ホームインテリア,カスタムポスター,キャンバス印刷,壁紙印刷,インテリア額縁' },
    US: { title: 'Home Interior Printing - Canvas, Poster & Wall Art | Chameleon Printing', desc: 'Custom home interior printing. Posters, canvas prints, wallpaper & framed art. Design your own decor with free online editor.', keywords: 'home interior,canvas printing,custom poster,wall art,wallpaper printing,framed art,home decor' }
  },
  'promo-items': {
    JP: { title: '販促品 制作 - ノベルティ・記念品 | カメレオンプリンティング', desc: '企業販促品・記念品・ノベルティのカスタム制作。マグカップ・タンブラー・ボールペン・エコバッグなど。少量注文OK。', keywords: '販促品,ノベルティ,記念品制作,企業販促品,オリジナルグッズ,名入れグッズ' },
    US: { title: 'Promotional Items - Custom Branded Merchandise | Chameleon Printing', desc: 'Custom promotional items & branded merchandise. Mugs, tumblers, pens, tote bags & more. Free design editor, small orders welcome.', keywords: 'promotional items,branded merchandise,corporate gifts,custom mugs,promotional products,branded goods' }
  },
  'flexible-package': {
    JP: { title: '軟包装 印刷 - 食品・化粧品パウチ | カメレオンプリンティング', desc: 'カスタム軟包装（パウチ・袋）印刷。食品・化粧品・健康食品のパッケージに最適。多様な素材・サイズ対応。', keywords: '軟包装,パウチ印刷,食品包装,化粧品包装,カスタムパッケージ,袋印刷' },
    US: { title: 'Flexible Packaging - Custom Pouch & Bag Printing | Chameleon Printing', desc: 'Custom flexible packaging printing. Pouches & bags for food, cosmetics & supplements. Various materials & sizes, small to large runs.', keywords: 'flexible packaging,pouch printing,food packaging,cosmetic packaging,custom packaging,bag printing' }
  },
  'box-package': {
    JP: { title: 'ボックスパッケージ制作 - カスタム箱印刷 | カメレオンプリンティング', desc: 'カスタムボックスパッケージ印刷制作。商品箱・ギフトボックス・配送箱。無料エディターでデザイン、少量注文対応。', keywords: 'ボックス制作,カスタム箱,商品箱,ギフトボックス,パッケージ印刷,箱印刷' },
    US: { title: 'Box Packaging - Custom Printed Boxes | Chameleon Printing', desc: 'Custom printed box packaging. Product boxes, gift boxes & shipping boxes. Free design editor, small quantities available.', keywords: 'box packaging,custom boxes,product box,gift box,printed boxes,packaging design,shipping box' }
  },
  'shopping-bag': {
    JP: { title: 'ショッピングバッグ制作 - 紙袋・不織布バッグ | カメレオンプリンティング', desc: 'カスタムショッピングバッグ印刷。紙袋・不織布バッグ・エコバッグ。ブランドロゴ印刷、多様なサイズ対応。', keywords: 'ショッピングバッグ,紙袋制作,不織布バッグ,エコバッグ,カスタムバッグ,ブランドバッグ' },
    US: { title: 'Shopping Bags - Custom Paper & Non-woven Bags | Chameleon Printing', desc: 'Custom printed shopping bags. Paper bags, non-woven bags & tote bags. Brand logo printing, various sizes, small to bulk orders.', keywords: 'shopping bag,paper bag,non-woven bag,tote bag,custom bag,branded bag,eco bag' }
  },
  'acrylic-print': {
    JP: { title: 'アクリル印刷 - UVアクリル看板 | カメレオンプリンティング', desc: '高品質アクリルUV印刷。看板・ネームプレート・案内板・インテリア小物。無料エディター、多様な厚さ・サイズ。', keywords: 'アクリル印刷,アクリル看板,UVアクリル,アクリル案内板,ネームプレート' },
    US: { title: 'Acrylic Printing - UV Acrylic Signs & Displays | Chameleon Printing', desc: 'High-quality acrylic UV printing. Signs, nameplates, information boards & interior decor. Free design editor, various sizes.', keywords: 'acrylic printing,acrylic sign,UV acrylic,acrylic display,nameplate,acrylic board' }
  },
  'banner-stand': {
    JP: { title: 'バナースタンド - X型・ロールアップバナー | カメレオンプリンティング', desc: 'バナースタンドのカスタム制作。X型バナー・ロールアップバナー。展示会・イベント・店舗プロモーション用。', keywords: 'バナースタンド,Xバナー,ロールアップバナー,展示会バナー,イベントバナー' },
    US: { title: 'Banner Stands - X-Banner & Roll-up Banner | Chameleon Printing', desc: 'Custom banner stands. X-banners, roll-up banners & display stands. For trade shows, events & retail. Free design editor.', keywords: 'banner stand,X-banner,roll-up banner,trade show banner,event banner,display stand,retractable banner' }
  },
  standee: {
    JP: { title: '等身大パネル制作 - ライフサイズスタンディー | カメレオンプリンティング', desc: '等身大パネル（ライフサイズパネル）のカスタム制作。アイドル・キャラクター・イベント用。無料エディター付き。', keywords: '等身大パネル,ライフサイズパネル,スタンディー,アイドルパネル,キャラクターパネル' },
    US: { title: 'Life-Size Standee - Custom Cutout Display | Chameleon Printing', desc: 'Custom life-size standees & cutout displays. For celebrities, characters, events & promotions. Free design editor, high-quality UV print.', keywords: 'life-size standee,standee,cutout display,life-size cutout,cardboard standee,promotional standee' }
  },
  'rubber-magnet': {
    JP: { title: 'ラバーマグネット制作 - カスタムマグネット | カメレオンプリンティング', desc: 'カスタムラバーマグネット印刷。冷蔵庫マグネット・販促・記念品・観光土産。無料エディター、少量注文OK。', keywords: 'ラバーマグネット,カスタムマグネット,冷蔵庫マグネット,販促マグネット,記念品マグネット' },
    US: { title: 'Rubber Magnets - Custom Fridge Magnets | Chameleon Printing', desc: 'Custom rubber magnet printing. Fridge magnets for promotions, souvenirs & gifts. Free design editor, small quantities available.', keywords: 'rubber magnet,fridge magnet,custom magnet,promotional magnet,souvenir magnet' }
  },
  placard: {
    JP: { title: 'プラカード制作 - 応援・イベント | カメレオンプリンティング', desc: 'カスタムプラカード印刷。応援プラカード・イベント・撮影用。無料エディター、少量から大量まで対応。', keywords: 'プラカード,応援プラカード,イベントプラカード,撮影プラカード,カスタムプラカード' },
    US: { title: 'Placards - Custom Signs & Event Cards | Chameleon Printing', desc: 'Custom printed placards & signs. For cheering, events, photo shoots & weddings. Free design editor, any quantity.', keywords: 'placard,custom sign,event card,cheering sign,wedding sign,photo prop' }
  },
  'sheet-print': {
    JP: { title: 'シート印刷 - ステッカー・ラベル | カメレオンプリンティング', desc: 'カスタムシート印刷。ステッカー・ラベル・デカール・車両ラッピング。無料エディター、多様な素材・サイズ。', keywords: 'シート印刷,ステッカー印刷,ラベル印刷,デカール,車両ラッピング' },
    US: { title: 'Sheet Printing - Custom Stickers & Labels | Chameleon Printing', desc: 'Custom sheet printing. Stickers, labels, decals & vehicle wraps. Free design editor, various materials & sizes.', keywords: 'sheet printing,sticker printing,label printing,decal,vehicle wrap,custom sticker' }
  },
  'flex-sign': {
    JP: { title: 'フレックス看板 - 屋外広告サイン | カメレオンプリンティング', desc: 'フレックス看板のカスタム制作。店舗・ビル・屋外広告サイン。耐候性に優れた素材、大型サイズ対応。', keywords: 'フレックス看板,屋外看板,広告看板,店舗看板,ビル看板,サイン制作' },
    US: { title: 'Flex Signs - Outdoor Advertising Signs | Chameleon Printing', desc: 'Custom flex signs for outdoor advertising. Store fronts, buildings & commercial signs. Weather-resistant, large formats available.', keywords: 'flex sign,outdoor sign,advertising sign,store sign,building sign,commercial sign' }
  },
  'uv-print': {
    JP: { title: 'UV印刷 - 高品質UVプリント | カメレオンプリンティング', desc: 'UV印刷専門。アクリル・金属・木材・ガラスなど多様な素材にダイレクト印刷。鮮明な発色、高耐久UVプリント。', keywords: 'UV印刷,UVプリント,アクリルUV印刷,金属印刷,ガラス印刷,素材印刷' },
    US: { title: 'UV Printing - Direct Print on Any Surface | Chameleon Printing', desc: 'Professional UV printing service. Direct printing on acrylic, metal, wood, glass & more. Vivid colors, durable UV ink technology.', keywords: 'UV printing,UV print,acrylic UV print,metal printing,glass printing,direct printing' }
  },
  'tshirt-print': {
    JP: { title: 'Tシャツ印刷 - オリジナルTシャツ制作 | カメレオンプリンティング', desc: 'カスタムTシャツ印刷。団体Tシャツ・ユニフォーム・イベントTシャツ。無料エディター、1枚から注文可能。', keywords: 'Tシャツ印刷,オリジナルTシャツ,団体Tシャツ,ユニフォーム,イベントTシャツ' },
    US: { title: 'T-Shirt Printing - Custom Apparel & Team Wear | Chameleon Printing', desc: 'Custom t-shirt printing. Team wear, uniforms, event shirts & couple tees. Free design editor, order from 1 piece.', keywords: 't-shirt printing,custom t-shirt,team wear,uniform printing,apparel printing,custom clothing' }
  },
  'blackout-blind': {
    JP: { title: '遮光ブラインド オーダーメイド | カメレオンプリンティング', desc: 'オーダーメイド遮光ブラインド印刷。店舗・オフィス・家庭用。99%遮光、カスタムサイズ、無料エディター。', keywords: '遮光ブラインド,オーダーブラインド,遮光ロールブラインド,インテリアブラインド' },
    US: { title: 'Blackout Blinds - Custom Printed | Chameleon Printing', desc: 'Custom printed blackout blinds. For stores, offices & homes. 99% light blocking, custom sizes, free design editor.', keywords: 'blackout blind,blackout roller blind,custom blind,light blocking blind,printed blind' }
  },
  curtain: {
    JP: { title: 'カーテン オーダーメイド - 印刷カーテン | カメレオンプリンティング', desc: 'オーダーメイドカーテン印刷。インテリア・店舗・イベント用フォトカーテン。多様な生地、カスタムサイズ対応。', keywords: 'オーダーカーテン,カーテン印刷,フォトカーテン,インテリアカーテン,イベントカーテン' },
    US: { title: 'Custom Curtains - Printed Photo Curtains | Chameleon Printing', desc: 'Custom printed curtains. For interior, stores & events. Photo curtains with various fabrics, custom sizes, free design editor.', keywords: 'custom curtain,printed curtain,photo curtain,interior curtain,event curtain' }
  }
};

// 리다이렉트 매핑 (_redirects 파일의 규칙을 미들웨어에서 처리)
const REWRITES = {
  '/board': '/board.html',
  '/mypage': '/mypage.html',
  '/success': '/success.html',
  '/fail': '/fail.html',
  '/partner': '/partner.html'
};
const REDIRECTS_301 = ['/en.html', '/jp.html', '/en', '/jp', '/index.html', '/index'];

export async function onRequest(context) {
  const { request, next, env } = context;
  const url = new URL(request.url);

  // 정적 파일은 패스스루 (JS, CSS, 이미지, 폰트, 데이터 등)
  if (/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|xml|txt|map|mp4|webm|pdf|zip|webp|avif)$/i.test(url.pathname)) {
    return next();
  }

  // 301 리다이렉트 처리
  if (REDIRECTS_301.includes(url.pathname)) {
    return Response.redirect(new URL('/' + url.search, url.origin), 301);
  }

  // 클린 URL 리라이트 처리 (board → board.html 등)
  const rewriteTo = REWRITES[url.pathname];
  if (rewriteTo) {
    const rewriteUrl = new URL(rewriteTo, url.origin);
    rewriteUrl.search = url.search;
    const rewriteReq = new Request(rewriteUrl.toString(), request);
    return next(rewriteReq);
  }

  // SPA 경로 판별: 제품 코드이거나 루트 경로면 index.html을 서빙
  const path = url.pathname.replace(/^\/|\/$/g, '').replace(/\.html$/, '');
  const isProductPath = !!PRODUCT_SEO[path];
  const isRoot = path === '';
  const isSpaPath = isProductPath || isRoot;

  let response;
  if (isSpaPath && !isRoot) {
    // 제품 경로 → index.html 직접 서빙 (404.html 방지)
    const indexUrl = new URL('/index.html', url.origin);
    response = await env.ASSETS.fetch(new Request(indexUrl.toString(), {
      method: 'GET',
      headers: request.headers
    }));
  } else {
    response = await next();
  }

  // HTML 응답만 처리
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  // 도메인으로 국가 판별
  const hostname = url.hostname;
  const cc = hostname.includes('cafe0101') ? 'JP' : 'US';

  // URL 경로로 제품 판별 (path는 위에서 이미 선언됨)
  const productSeo = PRODUCT_SEO[path] && PRODUCT_SEO[path][cc];
  const homeSeo = HOME_SEO[cc];
  const seo = productSeo || (path === '' ? homeSeo : null);

  // SEO 데이터 없으면 원본 그대로 반환
  if (!seo) {
    return response;
  }

  // canonical & OG URL
  const domain = cc === 'JP' ? 'https://www.cafe0101.com' : 'https://www.cafe3355.com';
  const pageUrl = path ? `${domain}/${path}` : `${domain}/`;

  // HTMLRewriter로 메타태그 주입
  return new HTMLRewriter()
    .on('title', {
      element(el) { el.setInnerContent(seo.title); }
    })
    .on('meta[name="description"]', {
      element(el) { el.setAttribute('content', seo.desc); }
    })
    .on('meta[name="keywords"]', {
      element(el) { el.setAttribute('content', seo.keywords); }
    })
    .on('meta[property="og:title"]', {
      element(el) { el.setAttribute('content', seo.title); }
    })
    .on('meta[property="og:description"]', {
      element(el) { el.setAttribute('content', seo.desc); }
    })
    .on('meta[property="og:url"]', {
      element(el) { el.setAttribute('content', pageUrl); }
    })
    .on('meta[property="og:site_name"]', {
      element(el) { el.setAttribute('content', cc === 'JP' ? 'カメレオンプリンティング' : 'Chameleon Printing'); }
    })
    .on('meta[name="twitter:title"]', {
      element(el) { el.setAttribute('content', seo.title); }
    })
    .on('meta[name="twitter:description"]', {
      element(el) { el.setAttribute('content', seo.desc); }
    })
    .on('link[rel="canonical"]', {
      element(el) { el.setAttribute('href', pageUrl); }
    })
    .on('html', {
      element(el) { el.setAttribute('lang', cc === 'JP' ? 'ja' : 'en'); }
    })
    .transform(response);
}
