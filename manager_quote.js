// manager_quote.js v=1 (2026-05-14)
// 관리자/매니저용 — 상담 완료된 고객에게 결제창 URL 을 생성
// orders 테이블에 payment_status='상담대기' 로 insert 하면
// 고객이 cafe2626.com/?quote=<id> 로 접속 시 메인 홈에 결제 배너 자동 표시
// (index.html 의 pendingQuoteBanner 가 처리)

import { sb } from './global_config.js?v=435';

// ─── State ──────────────────────────────────────────────
let _mqRows = [];      // [{ code, name, qty, price }, ...]
let _mqFiles = [];     // [File, ...] — newly added files (Edit 모드에서 추가)
let _mqExistingFiles = []; // [{name, url, type}, ...] — 수정 모드의 기존 파일
let _mqRowSeq = 0;
let _mqEditOrderId = null;   // null = 신규 생성, 값 있으면 UPDATE 모드

// 작업이 시작되어 수정 잠금되는 상태 집합 (사용자 요청: 칼선작업 이전까지만 수정 가능)
const LOCKED_STATUSES = new Set(['칼선작업', '제작중', '완료됨', '발송완료', '배송완료']);

// 2026-07-16: 견적 품목별 디자인의뢰 (최연두 제보) — 체크 시 design_requests 자동 생성 + 주문 연결.
//   기본 3만원, 1만원 단위 조절. 디자이너 정산 70% (본사 수수료 30%) — 디자이너 보드가 [FREE_REQ] 를 파싱.
const MQ_DREQ_DEFAULT = 30000;
const MQ_DREQ_STEP = 10000;
const MQ_DREQ_PAYOUT_RATE = 0.7;

// ─── Utilities ──────────────────────────────────────────
function fmtKR(n) { return (Number(n) || 0).toLocaleString('ko-KR') + '원'; }
function $(id) { return document.getElementById(id); }
function esc(s) {
    return String(s || '').replace(/[<>"'&]/g, function (c) {
        return ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '&': '&amp;' })[c];
    });
}

// ─── Open / close ───────────────────────────────────────
window.openMgrQuoteCreator = function () {
    _resetModal();
    _mqEditOrderId = null;
    $('mqCreateBtn').innerHTML = '⚡ 결제창 생성하기';
    document.querySelector('#mgrQuoteCreatorModal h2').textContent = '📝 고객 결제창 만들기';
    window._mqAddRow();
    $('mgrQuoteCreatorModal').style.display = 'flex';
};

function _resetModal() {
    _mqRows = [];
    _mqFiles = [];
    _mqExistingFiles = [];
    _mqRowSeq = 0;
    $('mqCustName').value = '';
    $('mqCustPhone').value = '';
    $('mqMemo').value = '';
    $('mqResultBox').style.display = 'none';
    $('mqCreateBtn').disabled = false;
    $('mqFileList').innerHTML = '';
    $('mqFiles').value = '';
    $('mqItemsList').innerHTML = '';
}

// 매니저 견적 주문 수정 모드로 모달 열기
window.openMgrQuoteEditor = async function (orderId) {
    if (!orderId) return;
    _resetModal();
    try {
        var { data: order, error } = await sb
            .from('orders')
            .select('id, manager_name, phone, items, files, request_note, total_amount, status, payment_status, admin_note')
            .eq('id', orderId)
            .single();
        if (error || !order) { alert('주문을 찾을 수 없습니다: ' + (error?.message || orderId)); return; }
        // 잠긴 상태면 안내 후 중단
        if (LOCKED_STATUSES.has(order.status)) {
            alert('이 주문은 이미 ' + order.status + ' 단계로 진행되어 수정할 수 없습니다.\n('
                + Array.from(LOCKED_STATUSES).join(' / ') + ' 단계는 수정 잠금)');
            return;
        }
        _mqEditOrderId = order.id;
        $('mqCustName').value = order.manager_name || '';
        $('mqCustPhone').value = order.phone || '';
        // admin_note 에서 메모 추출 (있으면)
        var memoMatch = (order.admin_note || '').match(/^메모: (.*)$/m);
        $('mqMemo').value = memoMatch ? memoMatch[1] : (order.request_note || '');
        // items → rows
        (order.items || []).forEach(function (it) {
            _mqRowSeq++;
            _mqRows.push({
                rid: 'mq_r_' + _mqRowSeq,
                code: (it.product && it.product.code) || '',
                name: (it.product && it.product.name) || it.productName || '상품',
                qty: it.qty || 1,
                price: it.price || (it.product && it.product.price) || 0,
                // 2026-07-16: 수정 모드에서도 디자인의뢰 체크/금액 복원 (이미 생성된 의뢰 id 는 보존)
                dreq: !!(it.designRequest && it.designRequest.request_id),
                dreqFee: (it.designRequest && Number(it.designRequest.fee)) || MQ_DREQ_DEFAULT,
                dreqId: (it.designRequest && it.designRequest.request_id) || null,
                _product: it.product
            });
        });
        if (_mqRows.length === 0) window._mqAddRow();
        else _renderRows();
        // 기존 파일들 (시스템 PDF 제외)
        _mqExistingFiles = (order.files || []).filter(function (f) {
            return f && f.url && f.type !== 'order_sheet' && f.type !== 'quotation' && f.type !== '_error_log';
        });
        _renderFileList();
        // UI 모드 전환
        $('mqCreateBtn').innerHTML = '💾 수정 사항 저장';
        document.querySelector('#mgrQuoteCreatorModal h2').textContent = '✏️ 주문 수정 (#' + order.id.substring(0, 8) + ')';
        $('mgrQuoteCreatorModal').style.display = 'flex';
    } catch (e) {
        console.error('[manager_quote] edit load failed:', e);
        alert('주문 로드 실패: ' + (e.message || e));
    }
};

function _renderFileList() {
    var list = $('mqFileList');
    if (!list) return;
    var existingHtml = _mqExistingFiles.map(function (f, idx) {
        return '<div style="display:flex; align-items:center; gap:8px; padding:4px 0;">' +
            '<a href="' + esc(f.url) + '" target="_blank" style="flex:1; font-size:12px; color:#1d4ed8;">📎 ' + esc(f.name) + '</a>' +
            '<button type="button" onclick="window._mqRemoveExistingFile(' + idx + ')" style="padding:2px 8px; background:#fee2e2; color:#b91c1c; border:none; border-radius:4px; font-size:10px; cursor:pointer;">제거</button>' +
            '</div>';
    }).join('');
    var newHtml = _mqFiles.length
        ? '<div style="margin-top:6px; font-size:11px; color:#15803d;">+ 추가 업로드: ' + _mqFiles.map(function (f) { return esc(f.name); }).join(', ') + '</div>'
        : '';
    list.innerHTML = existingHtml + newHtml;
}

window._mqRemoveExistingFile = function (idx) {
    _mqExistingFiles.splice(idx, 1);
    _renderFileList();
};

// ─── Item rows ──────────────────────────────────────────
window._mqAddRow = function () {
    _mqRowSeq++;
    var rid = 'mq_r_' + _mqRowSeq;
    // 2026-07-16: dreq(디자인의뢰 여부) + dreqFee(디자인비, 1만원 단위 · 기본 3만원)
    _mqRows.push({ rid: rid, code: '', name: '', qty: 1, price: 0, dreq: false, dreqFee: MQ_DREQ_DEFAULT });
    _renderRows();
};

function _renderRows() {
    var list = $('mqItemsList');
    if (!list) return;
    list.innerHTML = _mqRows.map(function (r) {
        var _on = !!r.dreq;
        return (
            '<div data-rid="' + r.rid + '" style="display:grid; grid-template-columns:120px 1fr 70px 110px 30px; gap:6px; align-items:center;">' +
              '<input type="text" placeholder="상품코드 (선택)" value="' + esc(r.code) + '" data-fld="code" oninput="window._mqRowChange(this)" onblur="window._mqLookupProduct(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px;">' +
              '<input type="text" placeholder="상품명 *" value="' + esc(r.name) + '" data-fld="name" oninput="window._mqRowChange(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px;">' +
              '<input type="number" min="1" placeholder="수량" value="' + (r.qty || 1) + '" data-fld="qty" oninput="window._mqRowChange(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px; text-align:center;">' +
              '<input type="number" min="0" placeholder="단가 (원)" value="' + (r.price || 0) + '" data-fld="price" oninput="window._mqRowChange(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px; text-align:right;">' +
              '<button type="button" onclick="window._mqRemoveRow(\'' + r.rid + '\')" style="width:28px; height:28px; padding:0; background:#fee2e2; color:#b91c1c; border:none; border-radius:6px; cursor:pointer; font-size:14px;">×</button>' +
            '</div>' +
            // 2026-07-16: 디자인의뢰 체크 — 체크 시 이 품목에 대한 design_requests 가 자동 생성되고
            //   고객 결제 시 디자인의뢰 게시판(designer board)에 자동 등록됨. 디자이너 정산 70%.
            '<div data-rid="' + r.rid + '" style="display:flex; align-items:center; gap:8px; margin:2px 0 8px 126px; font-size:12px; color:#334155;">' +
              '<label style="display:inline-flex; align-items:center; gap:5px; cursor:pointer;">' +
                '<input type="checkbox" data-fld="dreq"' + (_on ? ' checked' : '') + ' onchange="window._mqRowChange(this)" style="width:15px; height:15px; accent-color:#4338ca; cursor:pointer;">' +
                '<span>🎨 디자인의뢰 포함</span>' +
              '</label>' +
              '<span style="display:' + (_on ? 'inline-flex' : 'none') + '; align-items:center; gap:5px;">' +
                '<input type="number" min="10000" step="10000" data-fld="dreqFee" value="' + (r.dreqFee || MQ_DREQ_DEFAULT) + '" onchange="window._mqRowChange(this)" oninput="window._mqRowChange(this)" style="width:104px; padding:5px 8px; border:1.5px solid #c7d2fe; border-radius:6px; font-size:12px; text-align:right;">' +
                '<span style="color:#64748b;">원 (1만원 단위) · 디자이너 정산 ' + fmtKR(Math.floor((Number(r.dreqFee) || MQ_DREQ_DEFAULT) * 0.7)) + '</span>' +
              '</span>' +
            '</div>'
        );
    }).join('');
    _recalcTotal();
}

window._mqRowChange = function (inp) {
    var row = inp.closest('[data-rid]'); if (!row) return;
    var rid = row.getAttribute('data-rid');
    var fld = inp.getAttribute('data-fld');
    var v = inp.value;
    var _needRerender = false;
    for (var i = 0; i < _mqRows.length; i++) {
        if (_mqRows[i].rid === rid) {
            if (fld === 'qty' || fld === 'price') _mqRows[i][fld] = parseInt(v, 10) || 0;
            else if (fld === 'dreq') {                       // 2026-07-16: 디자인의뢰 체크 토글
                _mqRows[i].dreq = !!inp.checked;
                if (_mqRows[i].dreq && !_mqRows[i].dreqFee) _mqRows[i].dreqFee = MQ_DREQ_DEFAULT;
                _needRerender = true;                          // 금액칸 노출/숨김 갱신
            }
            else if (fld === 'dreqFee') {                     // 1만원 단위로 반올림 (최소 1만원)
                var _f = parseInt(v, 10) || 0;
                _mqRows[i].dreqFee = Math.max(MQ_DREQ_STEP, Math.round(_f / MQ_DREQ_STEP) * MQ_DREQ_STEP);
            }
            else _mqRows[i][fld] = v;
            break;
        }
    }
    if (_needRerender) _renderRows();
    else _recalcTotal();
};

window._mqRemoveRow = function (rid) {
    _mqRows = _mqRows.filter(function (r) { return r.rid !== rid; });
    if (_mqRows.length === 0) window._mqAddRow();
    else _renderRows();
};

// 상품코드 입력 시 admin_products 에서 자동 조회 (이름 자동 채우기)
window._mqLookupProduct = async function (inp) {
    var code = (inp.value || '').trim();
    if (!code) return;
    var row = inp.closest('[data-rid]'); if (!row) return;
    var rid = row.getAttribute('data-rid');
    try {
        var { data, error } = await sb.from('admin_products').select('code, name, name_jp, name_us, price, width_mm, height_mm, img_url').eq('code', code).maybeSingle();
        if (error || !data) return;
        for (var i = 0; i < _mqRows.length; i++) {
            if (_mqRows[i].rid === rid) {
                if (!_mqRows[i].name) _mqRows[i].name = data.name;
                if (!_mqRows[i].price || _mqRows[i].price === 0) _mqRows[i].price = Number(data.price) || 0;
                _mqRows[i]._product = data; // 캐시 — orders.items 에 저장 시 사용
                break;
            }
        }
        _renderRows();
    } catch (e) { console.warn('[manager_quote] product lookup failed:', e); }
};

// 2026-07-16: 합계 = 품목합 + 디자인의뢰비(체크된 행). 디자인비는 건당 1건 (수량 곱하지 않음).
function _mqRowsTotal() {
    return _mqRows.reduce(function (sum, r) {
        var _line = (Number(r.qty) || 0) * (Number(r.price) || 0);
        if (r.dreq) _line += (Number(r.dreqFee) || MQ_DREQ_DEFAULT);
        return sum + _line;
    }, 0);
}
function _recalcTotal() {
    var total = _mqRowsTotal();
    var _dq = _mqRows.filter(function (r) { return r.dreq; });
    var _dSum = _dq.reduce(function (s, r) { return s + (Number(r.dreqFee) || MQ_DREQ_DEFAULT); }, 0);
    $('mqTotal').textContent = fmtKR(total) + (_dq.length ? '  (디자인의뢰 ' + _dq.length + '건 ' + fmtKR(_dSum) + ' 포함)' : '');
}

// ─── File picker ────────────────────────────────────────
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'mqFiles') {
        _mqFiles = Array.from(e.target.files || []);
        // 수정 모드면 기존 파일 + 새 파일 함께 표시, 신규는 새 파일만
        if (_mqEditOrderId) {
            _renderFileList();
        } else {
            $('mqFileList').innerHTML = _mqFiles.length
                ? _mqFiles.map(function (f) { return '📄 ' + esc(f.name) + ' <span style="color:#9ca3af;">(' + (f.size / 1024).toFixed(1) + ' KB)</span>'; }).join('<br>')
                : '';
        }
    }
});

// ─── Create the quote (insert order) ─────────────────────
window._mqCreateQuote = async function (btn) {
    var name = ($('mqCustName').value || '').trim();
    var phone = ($('mqCustPhone').value || '').trim();
    var memo = ($('mqMemo').value || '').trim();

    if (!name) { alert('고객명을 입력해주세요.'); return; }
    if (_mqRows.length === 0 || !_mqRows.some(function (r) { return r.name && (Number(r.qty) || 0) > 0; })) {
        alert('최소 1개의 상품(상품명+수량) 을 입력해주세요.'); return;
    }
    var validRows = _mqRows.filter(function (r) { return r.name && (Number(r.qty) || 0) > 0; });
    // 2026-07-16: 합계에 디자인의뢰비 포함 (체크된 행, 건당 1건 — 수량 곱하지 않음)
    var total = validRows.reduce(function (sum, r) {
        var _line = (Number(r.qty) || 0) * (Number(r.price) || 0);
        if (r.dreq) _line += (Number(r.dreqFee) || MQ_DREQ_DEFAULT);
        return sum + _line;
    }, 0);
    if (total <= 0 && !confirm('합계가 0원 입니다. 그래도 결제창을 생성하시겠습니까? (고객에게 표시될 금액이 0원)')) return;

    btn.disabled = true;
    btn.innerHTML = '⏳ 처리 중...';

    try {
        var origLabel = '⚡ 결제창 생성하기';
        // 1) 파일 업로드 → Supabase storage 'orders' bucket
        var uploadedFiles = [];
        if (_mqFiles.length > 0) {
            btn.innerHTML = '📤 파일 업로드 중...';
            for (var i = 0; i < _mqFiles.length; i++) {
                var f = _mqFiles[i];
                var ts = Date.now();
                var safe = f.name.replace(/[^\w.\-]/g, '_');
                var path = 'manager_quotes/' + ts + '_' + i + '_' + safe;
                var { error: upErr } = await sb.storage.from('orders').upload(path, f, { upsert: false, contentType: f.type || 'application/octet-stream' });
                if (upErr) {
                    console.error('[manager_quote] file upload failed:', upErr);
                    alert('파일 업로드 실패: ' + f.name + '\n' + (upErr.message || upErr));
                    btn.disabled = false; btn.innerHTML = origLabel; return;
                }
                var { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                uploadedFiles.push({ name: f.name, url: urlData.publicUrl, type: f.type || 'application/octet-stream' });
            }
        }

        // 2026-07-16: 디자인의뢰 체크된 행 → design_requests 생성(payment_pending) 후 item 에 연결.
        //   고객이 결제하면 success.html 이 주문 items 의 designRequest.request_id 로 status='open' 으로 flip
        //   → 디자인의뢰 게시판(designer board)에 자동 노출. (본사의뢰와 동일 경로)
        //   기존에는 견적의 디자인의뢰가 '이름+금액' 일반 품목일 뿐이라 게시판에 아예 등록되지 않았음(최연두 제보).
        var _mqUid = null;
        try { var _u = await sb.auth.getUser(); _mqUid = _u?.data?.user?.id || null; } catch (e) {}
        if (validRows.some(function (r) { return r.dreq && !r.dreqId; })) btn.innerHTML = '🎨 디자인의뢰 등록 중...';
        for (var _di = 0; _di < validRows.length; _di++) {
            var _r = validRows[_di];
            if (!_r.dreq || _r.dreqId) continue;   // 미체크 or 이미 생성됨(수정모드) → skip
            var _fee = Math.max(MQ_DREQ_STEP, Number(_r.dreqFee) || MQ_DREQ_DEFAULT);
            var _payout = Math.floor(_fee * MQ_DREQ_PAYOUT_RATE);
            var _desc = '[' + (name || '고객') + ' · ' + (phone || '-') + ']\n'
                + '상품: ' + _r.name + (_r.code ? ' (' + _r.code + ')' : '') + '\n'
                + '수량: ' + (Number(_r.qty) || 1) + '\n'
                + (memo ? '요청사항: ' + memo + '\n' : '')
                + '※ 매니저 견적을 통한 디자인 의뢰\n\n'
                + '[FREE_REQ:{"customerPrice":' + _fee + ',"designerPayout":' + _payout + '}]';
            try {
                var _drIns = await sb.from('design_requests').insert({
                    customer_id: _mqUid,
                    title: '[매니저의뢰] ' + _r.name,
                    description: _desc,
                    category: '매니저견적',   // PAYOUT 맵에 없음 → FREE_REQ 메타의 70% 로 정산 표기됨
                    country: (window.SITE_CONFIG && window.SITE_CONFIG.COUNTRY) || 'KR',
                    phone: phone || null,
                    budget_min: _fee,
                    budget_max: _fee,
                    // 매니저가 올린 자료를 그대로 첨부 (디자이너가 참고) — 견적 단위라 전 행 공통
                    files: uploadedFiles.map(function (f) { return f.url; }),
                    status: 'payment_pending'   // 결제 시 success.html 이 'open' 으로 flip
                }).select('id').single();
                if (!_drIns.error && _drIns.data) _r.dreqId = _drIns.data.id;
                else throw (_drIns.error || new Error('unknown'));
            } catch (e) {
                // 조용히 실패하면 결제해도 게시판에 안 뜬다 → 매니저에게 알리고 중단
                console.error('[mq dreq insert]', e);
                alert('디자인의뢰 등록 실패: ' + _r.name + '\n' + ((e && e.message) || e)
                    + '\n\n결제창을 만들지 않았습니다. 다시 시도해주세요.');
                btn.disabled = false; btn.innerHTML = origLabel; return;
            }
        }

        // 2) items[] 구성 (orders.items 형식, 기존 simple_order/order.js 와 호환)
        var items = validRows.map(function (r) {
            var prod = r._product || {};
            var _it = {
                product: {
                    code: r.code || prod.code || '',
                    name: r.name,
                    name_jp: prod.name_jp || '',
                    name_us: prod.name_us || '',
                    price: Number(r.price) || 0,
                    w_mm: prod.width_mm || 0,
                    h_mm: prod.height_mm || 0,
                    img: prod.img_url || ''
                },
                productName: r.name,
                qty: Number(r.qty) || 1,
                price: Number(r.price) || 0,
                type: 'manager_quote',
                selectedAddons: {},
                addonQuantities: {}
            };
            // 2026-07-16: 디자인의뢰 연결 — success.html 이 이 request_id 로 결제 시 게시판에 올림
            if (r.dreq && r.dreqId) {
                _it.designRequest = { request_id: r.dreqId, fee: Math.max(MQ_DREQ_STEP, Number(r.dreqFee) || MQ_DREQ_DEFAULT) };
            }
            return _it;
        });

        // 3) 매니저 정보 (현재 로그인 admin) — admin_note 에 태그
        var managerEmail = '';
        try {
            var { data: sess } = await sb.auth.getUser();
            managerEmail = sess?.user?.email || '';
        } catch (e) {}
        var adminNote = '[MANAGER_QUOTE] manager=' + (managerEmail || 'unknown') + '\n'
            + (memo ? '메모: ' + memo + '\n' : '')
            + '고객 결제대기 — 카카오톡으로 결제 URL 전달 후 고객 결제 시 자동으로 작업지시서/Drive 동기화';

        // 4) orders insert or update
        btn.innerHTML = '💾 저장 중...';
        var newId;
        var allFiles = (_mqEditOrderId ? _mqExistingFiles.slice() : []).concat(uploadedFiles);

        if (_mqEditOrderId) {
            // 수정 모드 — 잠금 상태 재확인 (수정 모달 열린 사이 상태가 바뀌었을 수도)
            var { data: cur } = await sb.from('orders').select('status').eq('id', _mqEditOrderId).single();
            if (cur && LOCKED_STATUSES.has(cur.status)) {
                alert('이 주문은 이미 ' + cur.status + ' 단계로 진행되어 수정할 수 없습니다.');
                btn.disabled = false; btn.innerHTML = origLabel; return;
            }
            var updateRow = {
                manager_name: name,
                phone: phone,
                request_note: memo,
                total_amount: total,
                items: items,
                files: allFiles.length ? allFiles : null,
                admin_note: adminNote
            };
            var { error: upErr } = await sb.from('orders').update(updateRow).eq('id', _mqEditOrderId);
            if (upErr) {
                console.error('[manager_quote] update failed:', upErr);
                alert('주문 수정 실패: ' + (upErr.message || upErr));
                btn.disabled = false; btn.innerHTML = origLabel; return;
            }
            newId = _mqEditOrderId;
        } else {
            var orderRow = {
                order_date: new Date().toISOString(),
                manager_name: name,
                phone: phone,
                address: '',
                request_note: memo,
                status: '접수됨',
                payment_status: '상담대기',
                payment_method: null,
                total_amount: total,
                discount_amount: 0,
                items: items,
                site_code: 'KR',
                files: allFiles.length ? allFiles : null,
                admin_note: adminNote
            };
            var { data: inserted, error: insErr } = await sb.from('orders').insert([orderRow]).select().single();
            if (insErr) {
                console.error('[manager_quote] insert failed:', insErr);
                alert('주문 저장 실패: ' + (insErr.message || insErr));
                btn.disabled = false; btn.innerHTML = origLabel; return;
            }
            newId = inserted.id;
        }

        // 5) 결제 URL 표시 (도메인은 사이트 자동 감지)
        var domain = location.hostname.indexOf('cafe2626') >= 0 ? 'https://www.cafe2626.com'
                   : location.hostname.indexOf('cafe0101') >= 0 ? 'https://www.cafe0101.com'
                   : location.origin;
        var quoteUrl = domain + '/?quote=' + encodeURIComponent(newId);
        $('mqResultUrl').value = quoteUrl;
        $('mqResultBox').style.display = '';
        btn.innerHTML = _mqEditOrderId ? '✅ 수정 완료' : '✅ 생성 완료';
        // 주문 목록 새로고침
        if (typeof window.loadOrders === 'function') { try { window.loadOrders(); } catch (e) {} }
    } catch (e) {
        console.error('[manager_quote] save failed:', e);
        alert('저장 오류: ' + (e.message || e));
        btn.disabled = false;
        btn.innerHTML = _mqEditOrderId ? '💾 수정 사항 저장' : '⚡ 결제창 생성하기';
    }
};

// URL 복사
window._mqCopyUrl = async function (btn) {
    var inp = $('mqResultUrl');
    if (!inp) return;
    try {
        await navigator.clipboard.writeText(inp.value);
        var orig = btn.innerHTML;
        btn.innerHTML = '✓ 복사됨';
        setTimeout(function () { btn.innerHTML = orig; }, 1500);
    } catch (e) {
        // 폴백 — select + execCommand
        inp.select(); document.execCommand('copy');
        alert('URL이 복사되었습니다.');
    }
};

console.log('[manager_quote.js v=1] loaded');
