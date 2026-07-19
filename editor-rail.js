/* ============================================================================
 * editor-rail.js — 공용 에디터 에셋 레일 (검색 + 사진/벡터/요소/장식 + 배경 + 전체보기 팝업)
 * index.html(simple_order.js) + cotton_print.html(패브릭) 공유. 한 곳 고치면 양쪽 반영.
 * simple_order.js 15325-16055 에서 추출(2026-07-08). 외부 의존성은 EditorRail.init(cfg) 로 주입.
 *   cfg: { getSb, tr, getProduct, isFlatPrint, isBannerCode, showToast, scope, iconsPath }
 * 캔버스는 window._meAddImage / _meLoadTemplate / _meAddSplitBg (mini-editor.js 전역) 호출.
 * ==========================================================================*/
(function(){
    'use strict';
    // 2026-07-15: 기본 tr 을 호스트 언어 인식형으로. cotton_print.html 이 railHtml() 을 init() 보다
    //   먼저 호출해 기본 tr(ko 고정)로 탭이 한국어로 굳던 문제(템플릿/사진/벡터/요소/장식/검색/전체보기) fix.
    function _railDefaultTr(ko, ja, en){
        try {
            var _h = (location.hostname || '').toLowerCase();
            if (_h.indexOf('cafe0101') >= 0 || _h.indexOf('cotton-printer') >= 0) return ja || ko;
            if (_h.indexOf('cafe3355') >= 0 || _h.indexOf('chameleon.design') >= 0) return en || ko;
        } catch (e) {}
        return ko;
    }
    var _cfg = {
        getSb:        function(){ return window.sb || null; },
        tr:           _railDefaultTr,
        getProduct:   function(){ return null; },
        isFlatPrint:  function(){ return false; },
        isBannerCode: function(){ return false; },
        showToast:    function(){},
        scope:        'body',
        iconsPath:    './canvas-icons.js?v=435'
    };

    // 전체보기 팝업 HTML — 페이지에 #soQdLibPopup 없으면 body 에 1회 주입.
    function _popupHtml(){
        return '<div id="soQdLibPopup" class="so-overlay" style="display:none; position:fixed; inset:0; z-index:200000; background:rgba(0,0,0,0.65); align-items:center; justify-content:center; padding:20px;">' +
  '<div style="background:#fff; border-radius:16px; width:100%; max-width:880px; max-height:88vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 60px -16px rgba(0,0,0,0.5);">' +
    '<div style="padding:18px 24px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; gap:14px;">' +
      '<div style="font-size:17px; font-weight:900; color:#0f172a; flex:1; min-width:0;" id="soQdLibTitle">' + _cfg.tr('라이브러리','ライブラリ','Library') + '</div>' +
      '<button onclick="document.getElementById(\'soQdLibPopup\').style.display=\'none\'" aria-label="' + _cfg.tr('닫기','閉じる','Close') + '" style="flex-shrink:0; width:44px; height:44px; border-radius:50%; background:#f1f5f9; border:1.5px solid #cbd5e1; cursor:pointer; font-size:22px; line-height:1; color:#0f172a; font-weight:700; display:flex; align-items:center; justify-content:center;">×</button>' +
    '</div>' +
    '<div style="display:flex; gap:6px; padding:12px 24px; border-bottom:1px solid #f1f5f9; flex-wrap:wrap;">' +
      '<button type="button" id="soQdLibTabTpl" class="qd-lib-tab active" onclick="window._soQdLibSwitch(\'template\')"><i class="fa-solid fa-swatchbook"></i> ' + _cfg.tr('템플릿','テンプレート','Templates') + '</button>' +
      '<button type="button" id="soQdLibTabEl" class="qd-lib-tab" onclick="window._soQdLibSwitch(\'element\')"><i class="fa-solid fa-shapes"></i> ' + _cfg.tr('요소','要素','Elements') + '</button>' +
      '<button type="button" id="soQdLibTabDc" class="qd-lib-tab" onclick="window._soQdLibSwitch(\'decoration\')"><i class="fa-solid fa-star"></i> ' + _cfg.tr('장식','装飾','Decorations') + '</button>' +
      '<input type="search" id="soQdLibSearch" placeholder="' + _cfg.tr('검색','検索','Search') + '" oninput="window._soQdLibSearch && window._soQdLibSearch(this.value)" style="flex:1; min-width:140px; margin-left:auto; padding:8px 12px; border:1px solid #e2e8f0; border-radius:8px; font-family:inherit; font-size:13px; outline:none;">' +
    '</div>' +
    '<div id="soQdLibGrid" style="flex:1; overflow-y:auto; padding:16px 24px; display:grid; gap:10px; align-content:start;">' +
      '<div style="grid-column:1/-1; text-align:center; padding:40px; color:#94a3b8; font-size:13px;">' + _cfg.tr('탭을 선택해주세요','タブを選択','Select a tab') + '</div>' +
    '</div>' +
    '<div id="soQdLibPager" style="display:none; padding:12px 24px; border-top:1px solid #f1f5f9; align-items:center; justify-content:center; gap:14px;">' +
      '<button type="button" id="soQdLibPrev" class="qd-lib-pager-btn" onclick="window._soQdLibPage && window._soQdLibPage(-1)"><i class="fa-solid fa-chevron-left"></i></button>' +
      '<span id="soQdLibPageInfo" style="font-size:13px; font-weight:800; color:#475569; min-width:60px; text-align:center;">1 / 1</span>' +
      '<button type="button" id="soQdLibNext" class="qd-lib-pager-btn" onclick="window._soQdLibPage && window._soQdLibPage(1)"><i class="fa-solid fa-chevron-right"></i></button>' +
    '</div>' +
  '</div>' +
'</div>';
    }
    function _injectPopupHtml(){
        try {
            if (document.getElementById('soQdLibPopup')) return;
            var d = document.createElement('div');
            d.innerHTML = _popupHtml();
            while (d.firstChild) document.body.appendChild(d.firstChild);
        } catch(e){ console.warn('[EditorRail] popup inject fail', e); }
    }

    // 레일 aside 마크업 (패브릭 등에서 EditorRail.railHtml() 로 삽입 — 그리드/에디터 mount 는 페이지가 감쌈).
    function _railHtml(){
        return '<aside class="qd-rail">' +
  '<div class="qd-rail-tabs">' +
    '<button type="button" class="qd-rail-tab" data-rail-tab="design_tpl" onclick="window._soQdRailSwitch && window._soQdRailSwitch(\'design_tpl\')"><span>' + _cfg.tr('템플릿','テンプレ','Template') + '</span></button>' +
    '<button type="button" class="qd-rail-tab" data-rail-tab="template" onclick="window._soQdRailSwitch && window._soQdRailSwitch(\'template\')"><span>' + _cfg.tr('사진','写真','Photo') + '</span></button>' +
    '<button type="button" class="qd-rail-tab active" data-rail-tab="vector" onclick="window._soQdRailSwitch && window._soQdRailSwitch(\'vector\')"><span>' + _cfg.tr('벡터','ベクター','Vector') + '</span></button>' +
    '<button type="button" class="qd-rail-tab" data-rail-tab="element" onclick="window._soQdRailSwitch && window._soQdRailSwitch(\'element\')"><span>' + _cfg.tr('요소','要素','Elem') + '</span></button>' +
    '<button type="button" class="qd-rail-tab" data-rail-tab="decoration" onclick="window._soQdRailSwitch && window._soQdRailSwitch(\'decoration\')"><span>' + _cfg.tr('장식','装飾','Deco') + '</span></button>' +
  '</div>' +
  '<input type="search" id="soQdRailSearch" placeholder="' + _cfg.tr('검색','検索','Search') + '" oninput="window._soQdRailSearch && window._soQdRailSearch(this.value)" class="qd-rail-search">' +
  '<div class="qd-rail-thumbs" id="soQdRailThumbs">' +
    '<div class="qd-rail-thumb loading">' + _cfg.tr('로딩…','読み込み…','Loading…') + '</div>' +
    '<div class="qd-rail-thumb loading">' + _cfg.tr('로딩…','読み込み…','Loading…') + '</div>' +
    '<div class="qd-rail-thumb loading">' + _cfg.tr('로딩…','読み込み…','Loading…') + '</div>' +
    '<div class="qd-rail-thumb loading">' + _cfg.tr('로딩…','読み込み…','Loading…') + '</div>' +
  '</div>' +
  '<div class="qd-rail-pager" id="soQdRailPager" style="display:flex; align-items:center; justify-content:space-between; padding:6px 0;">' +
    '<button type="button" class="qd-rail-pager-btn" id="soQdRailPrev" onclick="window._soQdRailPage && window._soQdRailPage(-1)" style="width:auto; padding:8px 18px; border-radius:8px;">‹ ' + _cfg.tr('이전','前へ','Prev') + '</button>' +
    '<span class="qd-rail-pager-info" id="soQdRailPageInfo">1 / 1</span>' +
    '<button type="button" class="qd-rail-pager-btn" id="soQdRailNext" onclick="window._soQdRailPage && window._soQdRailPage(1)" style="width:auto; padding:8px 18px; border-radius:8px;">' + _cfg.tr('다음','次へ','Next') + ' ›</button>' +
  '</div>' +
  '<button type="button" class="qd-rail-more" onclick="window._soQdRailMore && window._soQdRailMore()">' + _cfg.tr('전체보기 →','すべて見る →','See all →') + '</button>' +
'</aside>';
    }

    // ===== 이하 simple_order.js 15325-16055 추출(외부 의존성 _cfg 로 치환) =====
        var _libActiveTab = 'template';
        var _libSearchDebounce = null;
        var _libCurrentItems = [];   // 현재 탭/검색의 전체 items
        var _libCurrentPage = 0;     // 0-based
        var _LIB_PER_PAGE = 6;
        var _LIB_FETCH_MAX = 50;     // 한 번에 가져올 행 수 (5페이지 분)
        var _libCache = {};          // key = tab + '|' + search, value = items[]

        // 탭별 카테고리 매핑 (mainEditor loadSideBarTemplates 와 일치)
        var _LIB_CATEGORIES = {
            template:   ['user_vector', 'user_image', 'photo-bg'],
            element:    ['vector', 'graphic', 'transparent-graphic', 'pattern'],
            decoration: null  // ORNAMENTS 배열 사용 (canvas-icons.js)
        };

        // "템플릿보기 / 요소보기 / 장식보기" — 팝업 모달 오픈
        window._soQdOpenLib = function(subPanelId) {
            var tabMap = { 'sub-template':'template', 'sub-element':'element', 'sub-icon':'decoration' };
            var tab = tabMap[subPanelId] || 'template';
            var popup = document.getElementById('soQdLibPopup');
            if (!popup) return;
            popup.style.display = 'flex';
            window._soQdLibSwitch(tab);
        };

        // 2026-06-15: 좌측 사이드바 (qd-rail) — 4개 페이지 + 탭 + 검색 + 이전/다음. 전체보기는 기존 팝업 재사용.
        // 2026-07-19: 기본 활성 탭 — vector (사장님 요청: 템플릿 대신 벡터가 먼저 보이게)
        var _railTab = 'vector';
        var _railSearch = '';
        var _railSearchDebounce = null;
        var _railAllItems = [];
        var _railPage = 0;
        var _RAIL_PER_PAGE = 5;  // v669: 5열 × 1행 = 5개 (1:1 비율)
        window._soQdRailSwitch = async function(tab) {
            _railTab = tab;
            _railPage = 0;
            // 탭 전환 시 검색어 초기화
            var sIn = document.getElementById('soQdRailSearch');
            if (sIn) sIn.value = '';
            _railSearch = '';
            // 2026-06-15: rail 탭 변경 시 popup 의 활성 탭 변수도 동기화 →
            //   _soQdLibPick 가 'template' 일 때만 fillCanvas=true, 요소/장식은 작게 중앙 배치되도록.
            _libActiveTab = tab;
            document.querySelectorAll((_cfg.scope + ' .qd-rail-tab')).forEach(function(b){
                b.classList.toggle('active', b.getAttribute('data-rail-tab') === tab);
            });
            await _soQdRailLoad();
        };
        window._soQdRailSearch = function(q) {
            if (_railSearchDebounce) clearTimeout(_railSearchDebounce);
            _railSearchDebounce = setTimeout(async function(){
                _railSearch = q || '';
                _railPage = 0;
                await _soQdRailLoad();
            }, 250);
        };
        window._soQdRailPage = function(delta) {
            var maxPage = Math.max(0, Math.ceil(_railAllItems.length / _RAIL_PER_PAGE) - 1);
            var p = _railPage + (delta || 0);
            if (p < 0) p = 0;
            if (p > maxPage) p = maxPage;
            _railPage = p;
            if (_railTab === 'background') { _renderBgPage(); _updateRailPager(); }
            else { _renderRailPage(); }
        };
        window._soQdRailMore = function() {
            var mp = { template:'sub-template', element:'sub-element', decoration:'sub-icon' };
            window._soQdOpenLib && window._soQdOpenLib(mp[_railTab] || 'sub-template');
        };
        // 2026-06-16: 배경 탭 — 30개 색상 조합 프리셋.
        //   kind: 'tb' (위 2/3 light + 아래 1/3 dark), 'lr' (좌 2/3 + 우 1/3), '3' (3등분 세로 strip).
        //   분포: tb 18 / lr 6 / 3 6 (각 20% 확률 컨셉).
        //   클릭 → 사각형 2~3개가 캔버스에 추가, 각각 드래그·리사이즈 가능.
        var _BG_PRESETS = [
            { kind:'tb', colors:['#fef3c7','#92400e'] },
            { kind:'tb', colors:['#dbeafe','#1e3a8a'] },
            { kind:'tb', colors:['#fce7f3','#831843'] },
            { kind:'tb', colors:['#dcfce7','#064e3b'] },
            { kind:'tb', colors:['#ede9fe','#4c1d95'] },
            { kind:'lr', colors:['#fee2e2','#7f1d1d'] },
            { kind:'tb', colors:['#fff7ed','#9a3412'] },
            { kind:'3',  colors:['#fef3c7','#fb923c','#92400e'] },
            { kind:'tb', colors:['#fef9c3','#854d0e'] },
            { kind:'tb', colors:['#e0f2fe','#1e40af'] },
            { kind:'lr', colors:['#fce7f3','#9f1239'] },
            { kind:'tb', colors:['#ecfccb','#365314'] },
            { kind:'3',  colors:['#dbeafe','#60a5fa','#1e3a8a'] },
            { kind:'tb', colors:['#f5f5f4','#1c1917'] },
            { kind:'tb', colors:['#fae8ff','#86198f'] },
            { kind:'lr', colors:['#fef9c3','#78350f'] },
            { kind:'tb', colors:['#f5f3ff','#6d28d9'] },
            { kind:'3',  colors:['#fce7f3','#f472b6','#831843'] },
            { kind:'tb', colors:['#ffedd5','#9a3412'] },
            { kind:'tb', colors:['#f1f5f9','#334155'] },
            { kind:'lr', colors:['#fef3c7','#78350f'] },
            { kind:'tb', colors:['#ecfeff','#155e75'] },
            { kind:'tb', colors:['#fafaf9','#44403c'] },
            { kind:'3',  colors:['#dcfce7','#4ade80','#064e3b'] },
            { kind:'tb', colors:['#fafaf9','#57534e'] },
            { kind:'lr', colors:['#f0fdf4','#14532d'] },
            { kind:'tb', colors:['#f0f9ff','#0c4a6e'] },
            { kind:'3',  colors:['#fef9c3','#fb923c','#991b1b'] },
            { kind:'tb', colors:['#fffbeb','#b45309'] },
            { kind:'3',  colors:['#ede9fe','#a78bfa','#4c1d95'] }
        ];
        function _bgThumbHtml(p, idx) {
            var c = p.colors || [];
            var inner = '';
            if (p.kind === 'tb') {
                inner = '<div style="position:absolute; left:0; right:0; top:0; bottom:33%; background:' + c[0] + ';"></div>'
                      + '<div style="position:absolute; left:0; right:0; top:67%; bottom:0; background:' + c[1] + ';"></div>';
            } else if (p.kind === 'lr') {
                inner = '<div style="position:absolute; top:0; bottom:0; left:0; right:33%; background:' + c[0] + ';"></div>'
                      + '<div style="position:absolute; top:0; bottom:0; left:67%; right:0; background:' + c[1] + ';"></div>';
            } else {
                inner = '<div style="position:absolute; top:0; bottom:0; left:0; width:33.33%; background:' + c[0] + ';"></div>'
                      + '<div style="position:absolute; top:0; bottom:0; left:33.33%; width:33.34%; background:' + c[1] + ';"></div>'
                      + '<div style="position:absolute; top:0; bottom:0; left:66.67%; width:33.33%; background:' + c[2] + ';"></div>';
            }
            return '<div class="qd-rail-thumb" data-bg-preset="' + idx + '" style="position:relative; overflow:hidden;">' + inner + '</div>';
        }
        function _renderBgPage() {
            var grid = document.getElementById('soQdRailThumbs');
            if (!grid) return;
            var start = _railPage * _RAIL_PER_PAGE;
            var page = _BG_PRESETS.slice(start, start + _RAIL_PER_PAGE);
            grid.innerHTML = page.map(function(p, i){ return _bgThumbHtml(p, start + i); }).join('');
            grid.querySelectorAll('[data-bg-preset]').forEach(function(el){
                el.addEventListener('click', function(){
                    var i = parseInt(el.getAttribute('data-bg-preset'), 10);
                    if (!isNaN(i) && typeof window._soQdAddSplitBg === 'function') window._soQdAddSplitBg(i);
                });
            });
        }
        window._soQdAddSplitBg = function(idx) {
            var p = _BG_PRESETS[idx];
            if (!p) return;
            if (typeof window._meAddSplitBg === 'function') window._meAddSplitBg({ kind:p.kind, colors:p.colors });
        };
        async function _soQdRailLoad() {
            var grid = document.getElementById('soQdRailThumbs');
            if (!grid) return;
            // 배경 탭은 동기 — 즉시 페이지 렌더. pager 는 _BG_PRESETS 전체 길이로 계산.
            if (_railTab === 'background') {
                _railAllItems = _BG_PRESETS;  // pager 가 길이 참조
                _renderBgPage();
                _updateRailPager();
                // 배경 탭은 전체보기 버튼 비활성 — 30개 전부 페이저로 탐색.
                var moreBtn = document.querySelector((_cfg.scope + ' .qd-rail-more'));
                if (moreBtn) moreBtn.style.display = 'none';
                return;
            } else {
                var moreBtn2 = document.querySelector((_cfg.scope + ' .qd-rail-more'));
                if (moreBtn2) moreBtn2.style.display = '';
            }
            // v679: 로딩 placeholder 도 _RAIL_PER_PAGE 와 일치 (5개)
            var _loadStr = '<div class="qd-rail-thumb loading">' + _cfg.tr('로딩…','読み込み…','Loading…') + '</div>';
            var _loadHtml = ''; for (var _li=0; _li<_RAIL_PER_PAGE; _li++) _loadHtml += _loadStr;
            grid.innerHTML = _loadHtml;
            // 장식 탭은 canvas-icons.js lazy load
            if (_railTab === 'decoration' && !window.ORNAMENTS) {
                try { await import(_cfg.iconsPath); } catch(e) { console.warn('[rail icons import]', e); }
            }
            // 2026-06-19 v644: vector / design_tpl 탭 — admin_templates 에서 직접 fetch
            if (_railTab === 'vector' || _railTab === 'design_tpl') {
                try {
                    var sb = _cfg.getSb();
                    var targetType = _railTab === 'vector' ? 'vector' : 'template';
                    var q = sb.from('admin_templates')
                        .select('id, name, thumbnail_url, background_url, asset_url, asset_type, slots, keywords, product_category, product_code')
                        .eq('status', 'approved')
                        .order('id', { ascending: false });
                    // design_tpl: asset_type='template' OR asset_type IS NULL (legacy templates with slots)
                    // vector: asset_type='vector'
                    if (targetType === 'vector') q = q.eq('asset_type', 'vector');
                    else q = q.or('asset_type.eq.template,asset_type.is.null');
                    var resp = await q;
                    if (resp.error) throw resp.error;
                    var rows = resp.data || [];
                    // 2026-06-19 v665: 템플릿은 해당 제품 한정 노출 — product_code 일치 OR (product_code 없음 + 같은 카테고리)
                    if (targetType === 'template' && _cfg.getProduct()) {
                        var curCode = _cfg.getProduct().code;
                        var curCat = _cfg.getProduct().category;
                        // 2026-06-28: 평면인쇄 제품군(광고인쇄+상업인쇄+가벽, 명함 제외)은 템플릿 공유.
                        var _curFlat = _cfg.isFlatPrint(_cfg.getProduct());
                        rows = rows.filter(function(r){
                            if (r.product_code && r.product_code === curCode) return true;
                            // 2026-06-27: 배너 10종은 템플릿 공유 — 어느 배너 템플릿이든 모든 배너 제품에서 노출.
                            if (_cfg.isBannerCode(curCode) && _cfg.isBannerCode(r.product_code)) return true;
                            // 2026-06-28: 평면인쇄 그룹 공유 — 현재 제품도 템플릿 제품도 평면인쇄면 노출.
                            if (_curFlat && _cfg.isFlatPrint({ code: r.product_code, category: r.product_category, name: '', name_us: '' })) return true;
                            if (!r.product_code && r.product_category === curCat) return true;
                            return false;
                        });
                    }
                    // 사이트 언어 keyword 필터
                    var siteLang = (function(){
                        var h = (location.hostname || '').toLowerCase();
                        if (h.indexOf('cafe0101')>=0) return 'ja';
                        if (h.indexOf('cafe3355')>=0 || h.indexOf('hexa-board')>=0) return 'en';
                        return 'ko';
                    })();
                    var search = (_railSearch || '').toLowerCase().trim();
                    if (search) {
                        rows = rows.filter(function(r){
                            if ((r.name || '').toLowerCase().indexOf(search) >= 0) return true;
                            if (r.keywords && typeof r.keywords === 'object') {
                                var langs = ['ko','ja','en','fr','ar'];
                                for (var li=0; li<langs.length; li++) {
                                    var v = String(r.keywords[langs[li]] || '').toLowerCase();
                                    if (v && v.indexOf(search) >= 0) return true;
                                }
                            }
                            return false;
                        });
                    }
                    _railAllItems = rows.map(function(r){
                        return {
                            id: r.id,
                            thumb_url: r.thumbnail_url || r.background_url || r.asset_url || '',
                            data_url: r.asset_url || r.background_url || '',
                            title: r.name || '',
                            _row: r,
                            _isTemplate: targetType === 'template'
                        };
                    });
                    // v687: design_tpl 탭이 비어 있으면 photo(_fetchLib 'template') 콘텐츠로 폴백.
                    //   "템플릿이 아직 없는 제품" 도 빈 공간 대신 사진이 표시되도록.
                    //   vector 탭은 폴백 안 함 (벡터 0개면 그대로 0개 노출).
                    if (_railTab === 'design_tpl' && _railAllItems.length === 0) {
                        try {
                            var _fallbackPhotos = await _fetchLib('template', _railSearch);
                            if (_fallbackPhotos && _fallbackPhotos.length > 0) {
                                _railAllItems = _fallbackPhotos;
                                console.log('[rail design_tpl] fallback to photos:', _fallbackPhotos.length);
                            }
                        } catch(_fe) { console.warn('[rail design_tpl fallback]', _fe); }
                    }
                    _renderRailPage();
                    return;
                } catch(e) {
                    console.warn('[rail vector/design_tpl]', e);
                    grid.innerHTML = '<div class="qd-rail-thumb loading" style="grid-column:1/-1;">' + _cfg.tr('로드 실패','失敗','Failed') + '</div>';
                    _updateRailPager();
                    return;
                }
            }
            try {
                _railAllItems = await _fetchLib(_railTab, _railSearch);
                if (_railAllItems.length === 0) {
                    grid.innerHTML = '<div class="qd-rail-thumb loading" style="grid-column:1/-1;">' + _cfg.tr('항목 없음','空','None') + '</div>';
                    _updateRailPager();
                    return;
                }
                _renderRailPage();
                return;
            } catch (e) {
                console.warn('[qd rail load]', e);
                grid.innerHTML = '<div class="qd-rail-thumb loading" style="grid-column:1/-1;">' + _cfg.tr('로드 실패','失敗','Failed') + '</div>';
                _updateRailPager();
            }
        }
        function _updateRailPager() {
            var pager = document.getElementById('soQdRailPager');
            var info = document.getElementById('soQdRailPageInfo');
            var prev = document.getElementById('soQdRailPrev');
            var next = document.getElementById('soQdRailNext');
            var totalPages = Math.max(1, Math.ceil(_railAllItems.length / _RAIL_PER_PAGE));
            if (info) info.textContent = (_railPage + 1) + ' / ' + totalPages;
            if (prev) prev.disabled = (_railPage <= 0);
            if (next) next.disabled = (_railPage >= totalPages - 1);
            // v667: 항상 표시 (1페이지여도 사용자가 다음 페이지 있는지 확인 가능)
            if (pager) pager.style.display = 'flex';
        }
        function _renderRailPage() {
            var grid = document.getElementById('soQdRailThumbs');
            if (!grid) return;
            var start = _railPage * _RAIL_PER_PAGE;
            var top = _railAllItems.slice(start, start + _RAIL_PER_PAGE);
            if (top.length === 0) {
                grid.innerHTML = '<div class="qd-rail-thumb loading" style="grid-column:1/-1;">' + _cfg.tr('항목 없음','空','None') + '</div>';
                _updateRailPager();
                return;
            }
            // 2026-06-15: 클릭 시 고해상도 URL 로 캔버스에 추가 — popup 의 _resolveImgUrl 과 동일 로직.
            //   썸네일 표시는 thumb_url (작고 빠름) / 캔버스 추가는 data_url (고해상도, Fabric JSON 이면 첫 image src 추출).
            function _railResolveImgUrl(it) {
                var data = String(it && it.data_url || '').trim();
                if (!data) return (it && it.thumb_url) || '';
                var first = data.charAt(0);
                if (first === '{' || first === '[') {
                    try {
                        var parsed = JSON.parse(data);
                        var objs = parsed.objects || (Array.isArray(parsed) ? parsed : []);
                        for (var i = 0; i < objs.length; i++) {
                            if (objs[i] && objs[i].type === 'image' && objs[i].src) return objs[i].src;
                        }
                    } catch (e) { console.warn('[rail resolveImg] JSON parse fail'); }
                    return (it && it.thumb_url) || '';
                }
                return data;
            }
            grid.innerHTML = top.map(function(it, _idx){
                if (it && it.__ornament) {
                    var sv = String(it.svg || '');
                    if (it.color && sv.indexOf('fill="currentColor"') >= 0) {
                        sv = sv.replace(/fill="currentColor"/g, 'fill="' + it.color + '"');
                    }
                    return '<div class="qd-rail-thumb" data-rail-orn="' + it.idx + '">' + sv + '</div>';
                }
                // v644: 디자인 템플릿 / 벡터 항목 — 별도 클릭 처리
                // v665: 템플릿 썸네일은 전체 디자인이 보이도록 object-fit:contain (cover 면 가로 비율 잘림)
                if (it._row) {
                    var thumb = it.thumb_url || '';
                    var dataAttr = it._isTemplate ? 'data-rail-tpl="' + it._row.id + '"' : 'data-rail-vec="' + (it.data_url || '') + '"';
                    var fitStyle = it._isTemplate ? 'object-fit:contain; background:#f8fafc;' : '';
                    return '<div class="qd-rail-thumb" ' + dataAttr + ' title="' + (it.title || '').replace(/"/g, '&quot;') + '" style="' + (it._isTemplate ? 'background:#f8fafc;' : '') + '"><img src="' + thumb + '" alt="" style="' + fitStyle + '"></div>';
                }
                var thumbUrl = it.thumb_url || it.data_url || '';
                var fullUrl = _railResolveImgUrl(it);
                return '<div class="qd-rail-thumb" data-rail-url="' + encodeURI(fullUrl) + '"><img src="' + thumbUrl + '" alt=""></div>';
            }).join('');
            grid.querySelectorAll('[data-rail-url]').forEach(function(el){
                el.addEventListener('click', function(){
                    var u = decodeURI(el.getAttribute('data-rail-url') || '');
                    if (u && window._soQdLibPick) window._soQdLibPick(u);
                });
            });
            // v644: 디자인 템플릿 클릭 → _meLoadTemplate 으로 전체 디자인 로드
            grid.querySelectorAll('[data-rail-tpl]').forEach(function(el){
                el.addEventListener('click', async function(){
                    var tplId = parseInt(el.getAttribute('data-rail-tpl'), 10);
                    if (!tplId) return;
                    try {
                        var sb = _cfg.getSb();
                        var resp = await sb.from('admin_templates').select('*').eq('id', tplId).single();
                        if (resp.error || !resp.data) throw resp.error || new Error('not found');
                        if (typeof window._meLoadTemplate === 'function') window._meLoadTemplate(resp.data);
                    } catch(e) { alert('템플릿 로드 실패: ' + (e.message || e)); }
                });
            });
            // v644: 벡터 클릭 → _meAddImage 로 캔버스에 단순 추가
            grid.querySelectorAll('[data-rail-vec]').forEach(function(el){
                el.addEventListener('click', function(){
                    var u = el.getAttribute('data-rail-vec') || '';
                    if (u && typeof window._meAddImage === 'function') window._meAddImage(u, { fitCanvas: false });
                });
            });
            grid.querySelectorAll('[data-rail-orn]').forEach(function(el){
                el.addEventListener('click', function(){
                    var idx = parseInt(el.getAttribute('data-rail-orn'), 10);
                    if (isNaN(idx)) return;
                    // 2026-06-15 fix: _soQdLibPickOrnament resolves the SVG via _libCurrentItems[idx],
                    //   but the rail uses _railAllItems. Sync the popup's array so the shared pick logic
                    //   finds the right item. Popup's own _loadLibItems resets _libCurrentItems on open.
                    _libCurrentItems = _railAllItems;
                    if (window._soQdLibPickOrnament) window._soQdLibPickOrnament(idx);
                });
            });
            _updateRailPager();
        }
        // 모달 열릴 때 초기 로드 — _soQdSetup 같은 곳에서 호출되도록 노출.
        window._soQdRailInit = function() {
            // 2026-06-15: 진입 시 _libActiveTab 도 rail 초기 탭 ('template') 으로 동기화 → fillCanvas 분기 일관.
            _libActiveTab = _railTab;
            _soQdRailLoad();
        };

        // 탭 전환 (장식 탭은 canvas-icons.js 의 ORNAMENTS 가 필요 → lazy import)
        window._soQdLibSwitch = async function(tab) {
            _libActiveTab = tab;
            ['template','element','decoration'].forEach(function(t){
                var btn = document.getElementById('soQdLibTab' + (t==='template'?'Tpl':t==='element'?'El':'Dc'));
                if (btn) btn.classList.toggle('active', t === tab);
            });
            var title = document.getElementById('soQdLibTitle');
            if (title) title.textContent = (tab==='template' ? _cfg.tr('템플릿','テンプレート','Templates')
                                            : tab==='element' ? _cfg.tr('要素','要素','Elements')
                                            : _cfg.tr('장식','装飾','Decorations'));
            var search = document.getElementById('soQdLibSearch');
            if (search) search.value = '';
            // 2026-06-14: 장식 탭 첫 진입 시 canvas-icons.js lazy load (메인 에디터를 안 거쳐도 동작)
            if (tab === 'decoration' && !window.ORNAMENTS) {
                var grid = document.getElementById('soQdLibGrid');
                if (grid) grid.innerHTML = '<div class="qd-lib-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> ' + _cfg.tr('장식 라이브러리 로드중...','装飾を読み込み中...','Loading decorations...') + '</div>';
                try { await import(_cfg.iconsPath); } catch(e) { console.warn('[qd-icons import]', e); }
            }
            _loadLibItems('');
        };

        // 검색 (디바운스)
        window._soQdLibSearch = function(q) {
            if (_libSearchDebounce) clearTimeout(_libSearchDebounce);
            _libSearchDebounce = setTimeout(function(){ _loadLibItems(q || ''); }, 250);
        };

        // 페이지 변경 (-1 prev / +1 next)
        window._soQdLibPage = function(delta) {
            var maxPage = Math.max(0, Math.ceil(_libCurrentItems.length / _LIB_PER_PAGE) - 1);
            var p = _libCurrentPage + (delta || 0);
            if (p < 0) p = 0;
            if (p > maxPage) p = maxPage;
            _libCurrentPage = p;
            _renderCurrentPage();
        };

        // 2026-06-27: 미니에디터 '그림 변경 → 요소에서 고르기' — 요소·클립아트 미니 팝업 (작은 썸네일, 빠름).
        //   onPick(highResUrl) 콜백으로 선택 결과 전달. _fetchLib('element') 재사용.
        window._soOpenObjPicker = async function (onPick) {
            var old = document.getElementById('soObjPickerModal'); if (old) old.remove();
            // 2026-06-27: 데스크탑 4열×2행(8개), 모바일 2열×3행(6개 — 4행이면 이미지가 잘려서 6개로). 더 찾으려면 검색.
            var _isMobileObj = (window.innerWidth <= 600);
            var _cols = _isMobileObj ? 2 : 4;
            var _MAX_OBJ = _isMobileObj ? 6 : 8;
            var ov = document.createElement('div');
            ov.id = 'soObjPickerModal';
            ov.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:2147483600; display:flex; align-items:center; justify-content:center; padding:16px; font-family:inherit;';
            var box = document.createElement('div');
            box.style.cssText = 'background:#fff; border-radius:16px; width:min(640px,95vw); max-height:86vh; display:flex; flex-direction:column; overflow:hidden;';
            box.innerHTML =
                '<div style="padding:14px 18px; border-bottom:1px solid #eef2f7;">' +
                    '<div style="font-size:15px; color:#0f172a; margin-bottom:10px;">' + _cfg.tr('요소에서 고르기', '要素から選ぶ', 'Pick an element') + '</div>' +
                    '<div style="display:flex; align-items:center; gap:8px;">' +
                        '<input type="search" id="soObjPickerSearch" placeholder="' + _cfg.tr('검색어 입력 후 Enter', 'キーワード入力後Enter', 'Type then Enter') + '" style="flex:1; min-width:0; padding:9px 10px; border:1px solid #e2e8f0; border-radius:8px; font-size:13px; font-family:inherit;">' +
                        '<button type="button" id="soObjPickerSearchBtn" style="border:none; background:#4338ca; color:#fff; border-radius:8px; padding:9px 14px; font-size:13px; cursor:pointer; font-family:inherit; white-space:nowrap; flex:0 0 auto;">' + _cfg.tr('검색', '検索', 'Search') + '</button>' +
                        '<button type="button" id="soObjPickerClose" style="border:none; background:#f1f5f9; color:#475569; border-radius:8px; padding:9px 14px; font-size:13px; cursor:pointer; font-family:inherit; white-space:nowrap; flex:0 0 auto;">' + _cfg.tr('닫기', '閉じる', 'Close') + '</button>' +
                    '</div>' +
                '</div>' +
                '<div id="soObjPickerGrid" style="flex:1; overflow-y:auto; padding:14px; display:grid; grid-template-columns:repeat(' + _cols + ', 1fr); gap:10px; align-content:start;"></div>' +
                '<div style="padding:10px 18px; display:flex; align-items:center; justify-content:center; gap:14px; border-top:1px solid #eef2f7;">' +
                    '<button type="button" id="soObjPickerPrev" style="border:1px solid #e2e8f0; background:#fff; color:#475569; border-radius:8px; padding:8px 18px; font-size:13px; cursor:pointer; font-family:inherit;">' + _cfg.tr('이전', '前へ', 'Prev') + '</button>' +
                    '<span id="soObjPickerInfo" style="font-size:12.5px; color:#64748b; min-width:50px; text-align:center;">1 / 1</span>' +
                    '<button type="button" id="soObjPickerNext" style="border:1px solid #e2e8f0; background:#fff; color:#475569; border-radius:8px; padding:8px 18px; font-size:13px; cursor:pointer; font-family:inherit;">' + _cfg.tr('다음', '次へ', 'Next') + '</button>' +
                '</div>';
            ov.appendChild(box); document.body.appendChild(ov);
            function close() { ov.remove(); }
            // 2026-06-27: 모바일 — 여는 터치의 잔여 click 이 배경을 닫던 문제. pointerdown(배경에서 시작) 으로만 닫음.
            ov.addEventListener('pointerdown', function (e) { if (e.target === ov) close(); });
            box.querySelector('#soObjPickerClose').onclick = close;
            var grid = box.querySelector('#soObjPickerGrid');
            var info = box.querySelector('#soObjPickerInfo');
            var prevB = box.querySelector('#soObjPickerPrev');
            var nextB = box.querySelector('#soObjPickerNext');
            var _all = [], _page = 0;
            function _resolve(it) {
                var data = String(it && it.data_url || '').trim();
                if (!data) return (it && it.thumb_url) || '';
                var c0 = data.charAt(0);
                if (c0 === '{' || c0 === '[') {
                    try { var p = JSON.parse(data); var objs = p.objects || (Array.isArray(p) ? p : []); for (var i = 0; i < objs.length; i++) { if (objs[i] && objs[i].type === 'image' && objs[i].src) return objs[i].src; } } catch (_) {}
                    return (it && it.thumb_url) || '';
                }
                return data;
            }
            function _msg(t) { grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; font-size:12px; padding:22px;">' + t + '</div>'; }
            function renderPage() {
                var totalPages = Math.max(1, Math.ceil(_all.length / _MAX_OBJ));
                if (_page >= totalPages) _page = totalPages - 1;
                if (_page < 0) _page = 0;
                var pageItems = _all.slice(_page * _MAX_OBJ, _page * _MAX_OBJ + _MAX_OBJ);
                if (!pageItems.length) {
                    _msg(_cfg.tr('항목 없음', '空', 'None'));
                } else {
                    grid.innerHTML = pageItems.map(function (it, i) {
                        var t = it.thumb_url || it.data_url || '';
                        return '<button type="button" data-i="' + i + '" style="aspect-ratio:1/1; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; background:#fff; cursor:pointer; padding:0;"><img src="' + t + '" loading="lazy" style="width:100%; height:100%; object-fit:cover; display:block;"></button>';
                    }).join('');
                    grid.querySelectorAll('button[data-i]').forEach(function (b) {
                        b.onclick = function () {
                            var it = pageItems[parseInt(b.dataset.i, 10)];
                            var url = _resolve(it);
                            close();
                            if (typeof onPick === 'function') onPick(url);
                        };
                    });
                }
                if (info) info.textContent = (_page + 1) + ' / ' + totalPages;
                [prevB, nextB].forEach(function (b, idx) {
                    if (!b) return;
                    var dis = idx === 0 ? (_page <= 0) : (_page >= totalPages - 1);
                    b.disabled = dis; b.style.opacity = dis ? '0.4' : '1'; b.style.cursor = dis ? 'default' : 'pointer';
                });
            }
            async function loadItems(search) {
                _msg(_cfg.tr('로딩…', '読み込み…', 'Loading…'));
                if (info) info.textContent = '…';
                var items = [];
                try { items = await _fetchLib('element', search); } catch (e) { console.warn('[objpicker]', e); }
                _all = items || [];
                _page = 0;
                renderPage();
            }
            if (prevB) prevB.onclick = function () { if (_page > 0) { _page--; renderPage(); grid.scrollTop = 0; } };
            if (nextB) nextB.onclick = function () { if (_page < Math.ceil(_all.length / _MAX_OBJ) - 1) { _page++; renderPage(); grid.scrollTop = 0; } };
            var se = box.querySelector('#soObjPickerSearch');
            var seBtn = box.querySelector('#soObjPickerSearchBtn');
            function doSearch() { loadItems((se.value || '').trim()); }
            if (seBtn) seBtn.onclick = doSearch;
            // 2026-06-27: 글자 칠 때마다 검색하지 않고, Enter(또는 검색 버튼) 눌렀을 때만 검색. (한글 IME 조합 중 Enter 무시)
            if (se) se.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); doSearch(); } });
            loadItems('');
        };

        async function _fetchLib(tab, search) {
            var cacheKey = tab + '|' + (search || '').trim();
            if (_libCache[cacheKey]) return _libCache[cacheKey];

            // 장식 (decoration) — Supabase 아닌 ORNAMENTS SVG 배열 사용
            if (tab === 'decoration') {
                var ornaments = window.ORNAMENTS || [];
                if (search && search.trim()) {
                    var q = search.trim().toLowerCase();
                    ornaments = ornaments.filter(function(o){
                        return (o.cat || '').toLowerCase().indexOf(q) >= 0 ||
                               (o.tags || []).join(' ').toLowerCase().indexOf(q) >= 0;
                    });
                }
                var mapped = ornaments.map(function(o, idx){
                    return { __ornament: true, idx: idx, svg: o.svg, color: o.color, cat: o.cat };
                });
                _libCache[cacheKey] = mapped;
                return mapped;
            }

            var sb = _cfg.getSb();
            if (!sb) return [];
            var cats = _LIB_CATEGORIES[tab];
            if (!cats) return [];
            try {
                // mainEditor loadSideBarTemplates 와 동일 — status=approved + is_featured 우선
                var q2 = sb.from('library')
                    .select('id, thumb_url, data_url, title, category, product_key, tags, is_featured')
                    .eq('status', 'approved')
                    .in('category', cats)
                    .or('product_key.eq.custom,product_key.is.null,product_key.eq.""')
                    .order('is_featured', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false })
                    .limit(_LIB_FETCH_MAX);
                if (search && search.trim()) q2 = q2.ilike('tags', '%' + search.trim() + '%');
                // 2026-06-27: element 탭 — library 와 admin_templates 두 쿼리를 병렬 실행 (순차 대기로 로딩 느리던 것 개선).
                var qA = null;
                if (tab === 'element') {
                    qA = sb.from('admin_templates')
                        .select('id, name, thumbnail_url, background_url, asset_url, asset_type, keywords')
                        .eq('status', 'approved')
                        .in('asset_type', ['image', 'logo'])
                        .order('id', { ascending: false })
                        .limit(_LIB_FETCH_MAX);
                }
                var _libResults = await Promise.all(qA ? [q2, qA] : [q2]);
                var r = _libResults[0];
                var data = (r && r.data) || [];

                // v690/v694: 디자이너 자산 (admin_templates asset_type='image'/'logo') 은 element 탭에만 노출.
                //   v690 에서 사진 탭에도 노출되던 문제 fix — 사진 탭은 photo-bg(실제 사진)만.
                if (tab === 'element' && qA) {
                    try {
                        var rA = _libResults[1];
                        var rowsA = (rA && rA.data) || [];
                        // 검색어 필터 (5개 언어 keywords + name)
                        var s = (search || '').trim().toLowerCase();
                        if (s) {
                            rowsA = rowsA.filter(function(rw){
                                if ((rw.name || '').toLowerCase().indexOf(s) >= 0) return true;
                                if (rw.keywords && typeof rw.keywords === 'object') {
                                    var kk = ['ko','ja','en','fr','ar'];
                                    for (var ki=0; ki<kk.length; ki++) {
                                        var v = String(rw.keywords[kk[ki]] || '').toLowerCase();
                                        if (v && v.indexOf(s) >= 0) return true;
                                    }
                                }
                                return false;
                            });
                        }
                        var assetItems = rowsA.map(function(rw){
                            return {
                                id: 'at-' + rw.id,
                                thumb_url: rw.thumbnail_url || rw.background_url || rw.asset_url || '',
                                data_url: rw.asset_url || rw.background_url || rw.thumbnail_url || '',
                                title: rw.name || '',
                                category: rw.asset_type,
                                is_featured: false
                            };
                        });
                        data = assetItems.concat(data);  // 신규 자산이 위쪽에 노출
                    } catch(aE) { console.warn('[qd lib admin_templates merge]', aE); }
                }

                _libCache[cacheKey] = data;
                return data;
            } catch(e) { console.warn('[qd lib fetch]', e); return []; }
        }

        async function _loadLibItems(search) {
            var grid = document.getElementById('soQdLibGrid');
            var pager = document.getElementById('soQdLibPager');
            if (grid) grid.innerHTML = '<div class="qd-lib-loading"><i class="fa-solid fa-circle-notch fa-spin"></i> ' + _cfg.tr('불러오는 중...','読み込み中...','Loading...') + '</div>';
            if (pager) pager.classList.add('hidden');
            _libCurrentItems = await _fetchLib(_libActiveTab, search);
            _libCurrentPage = 0;
            _renderCurrentPage();
        }

        function _renderCurrentPage() {
            var grid = document.getElementById('soQdLibGrid');
            var pager = document.getElementById('soQdLibPager');
            var pageInfo = document.getElementById('soQdLibPageInfo');
            var prevBtn = document.getElementById('soQdLibPrev');
            var nextBtn = document.getElementById('soQdLibNext');
            if (!grid) return;
            if (!_libCurrentItems.length) {
                grid.innerHTML = '<div class="qd-lib-empty">' + _cfg.tr('결과가 없습니다','見つかりませんでした','No results') + '</div>';
                if (pager) pager.classList.add('hidden');
                return;
            }
            var totalPages = Math.ceil(_libCurrentItems.length / _LIB_PER_PAGE);
            var start = _libCurrentPage * _LIB_PER_PAGE;
            var pageItems = _libCurrentItems.slice(start, start + _LIB_PER_PAGE);
            // 2026-06-14: data-url 에 URL 을 안전하게 저장 (HTML 속성 이스케이프).
            function _attrEsc(s) {
                return String(s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            }
            // data_url 처리:
            //   - 일반 이미지 URL → 그대로 사용 (고해상도)
            //   - Fabric JSON 인 경우 → objects 배열에서 첫 image 의 src 추출 (메인 배경, 고해상도)
            //   - 추출 실패하면 thumb_url 로 폴백 (저해상도지만 동작 보장)
            function _resolveImgUrl(it) {
                var data = (it.data_url || '').trim();
                if (!data) return it.thumb_url || '';
                var first = data.charAt(0);
                if (first === '{' || first === '[') {
                    // Fabric JSON — 첫 image object 의 src 추출
                    try {
                        var parsed = JSON.parse(data);
                        var objs = parsed.objects || (Array.isArray(parsed) ? parsed : []);
                        for (var i = 0; i < objs.length; i++) {
                            if (objs[i] && objs[i].type === 'image' && objs[i].src) {
                                return objs[i].src;
                            }
                        }
                    } catch(_pe) { console.warn('[qd resolveImg] JSON parse failed'); }
                    return it.thumb_url || '';
                }
                return data;  // 일반 URL
            }
            grid.innerHTML = pageItems.map(function(it, i){
                var globalIdx = start + i;
                if (it.__ornament) {
                    var svgInline = it.color ? it.svg : it.svg.replace(/currentColor/g, '#000');
                    return '<div class="qd-lib-thumb qd-lib-ornament" data-ornament-idx="' + globalIdx + '" style="padding:10px;">' +
                           '<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">' + svgInline + '</div>' +
                           '</div>';
                }
                var thumb = _attrEsc(it.thumb_url || it.data_url || '');
                var full = _attrEsc(_resolveImgUrl(it));
                return '<div class="qd-lib-thumb" data-url="' + full + '">' +
                       '<img src="' + thumb + '" loading="lazy" onerror="this.style.opacity=0.3">' +
                       '</div>';
            }).join('');
            // 클릭 핸들러를 안전하게 바인딩 (인라인 onclick 사용 X)
            grid.querySelectorAll('.qd-lib-thumb[data-url]').forEach(function(el){
                el.addEventListener('click', function(){
                    window._soQdLibPick(el.getAttribute('data-url'));
                });
            });
            grid.querySelectorAll('.qd-lib-thumb[data-ornament-idx]').forEach(function(el){
                el.addEventListener('click', function(){
                    window._soQdLibPickOrnament(parseInt(el.getAttribute('data-ornament-idx'), 10));
                });
            });
            // 인라인 SVG 사이즈 보정
            grid.querySelectorAll('.qd-lib-ornament svg').forEach(function(svg){
                svg.style.width = '100%'; svg.style.height = '100%'; svg.style.maxWidth = '100%'; svg.style.maxHeight = '100%';
            });
            // 페이지네이션 표시
            if (pager) {
                if (totalPages > 1) {
                    pager.classList.remove('hidden');
                    if (pageInfo) pageInfo.textContent = (_libCurrentPage + 1) + ' / ' + totalPages;
                    if (prevBtn) prevBtn.disabled = (_libCurrentPage === 0);
                    if (nextBtn) nextBtn.disabled = (_libCurrentPage >= totalPages - 1);
                } else {
                    pager.classList.add('hidden');
                }
            }
        }

        // 일반 썸네일 클릭 → 미니에디터에 고해상도 이미지 추가.
        //   템플릿: 대지 꽉 채우기 + 제일 뒤. 요소: 일반 중앙 배치 (드래그/리사이즈 가능)
        window._soQdLibPick = function(url) {
            if (!url) return;
            try {
                if (typeof window._meAddImage === 'function') {
                    var opts = (_libActiveTab === 'template') ? { fillCanvas: true, toBack: true } : {};
                    window._meAddImage(url, opts);
                    if (typeof _cfg.showToast === 'function') {
                        _cfg.showToast(_cfg.tr('대지에 추가되었습니다','キャンバスに追加','Added to canvas'), 'success');
                    }
                } else {
                    console.warn('[qd lib pick] _meAddImage not loaded yet');
                }
            } catch(e) { console.warn('[qd lib pick]', e); }
            var popup = document.getElementById('soQdLibPopup');
            if (popup) popup.style.display = 'none';
        };

        // 장식 SVG 클릭 → data URL 로 변환해 미니에디터에 추가
        window._soQdLibPickOrnament = function(idx) {
            try {
                var item = _libCurrentItems[idx];
                if (!item || !item.svg) return;
                var svgStr = item.color ? item.svg : item.svg.replace(/currentColor/g, '#000');
                // SVG 에 width/height 명시 — naturalWidth 0 방지
                if (!/<svg[^>]*\swidth=/.test(svgStr)) {
                    svgStr = svgStr.replace(/<svg/, '<svg width="400" height="400"');
                }
                // xmlns 보강 (없으면 일부 브라우저가 로드 실패)
                if (!/xmlns=/.test(svgStr)) {
                    svgStr = svgStr.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
                }
                var dataUrl = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgStr);
                if (typeof window._meAddImage === 'function') {
                    window._meAddImage(dataUrl, {});  // 장식은 일반 모드 (중앙, 드래그 가능)
                    if (typeof _cfg.showToast === 'function') {
                        _cfg.showToast(_cfg.tr('장식이 추가되었습니다','装飾を追加しました','Decoration added'), 'success');
                    }
                }
            } catch(e) { console.warn('[qd lib ornament]', e); }
            var popup = document.getElementById('soQdLibPopup');
            if (popup) popup.style.display = 'none';
        };

    // ===== 공개 API =====
    window.EditorRail = {
        init: function(cfg){
            if (cfg) { for (var k in cfg) { if (cfg[k] != null) _cfg[k] = cfg[k]; } }
            _injectPopupHtml();
        },
        reload: function(){ try { if (typeof window._soQdRailInit === 'function') window._soQdRailInit(); } catch(e){ console.warn('[EditorRail] reload', e); } },
        railHtml: function(){ return _railHtml(); },
        popupHtml: function(){ return _popupHtml(); }
    };
})();
