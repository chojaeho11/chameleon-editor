// manager_quote.js v=1 (2026-05-14)
// 관리자/매니저용 — 상담 완료된 고객에게 결제창 URL 을 생성
// orders 테이블에 payment_status='상담대기' 로 insert 하면
// 고객이 cafe2626.com/?quote=<id> 로 접속 시 메인 홈에 결제 배너 자동 표시
// (index.html 의 pendingQuoteBanner 가 처리)

import { sb } from './global_config.js?v=434';

// ─── State ──────────────────────────────────────────────
let _mqRows = [];      // [{ code, name, qty, price }, ...]
let _mqFiles = [];     // [File, ...] — newly added files (Edit 모드에서 추가)
let _mqExistingFiles = []; // [{name, url, type}, ...] — 수정 모드의 기존 파일
let _mqRowSeq = 0;
let _mqEditOrderId = null;   // null = 신규 생성, 값 있으면 UPDATE 모드

// 작업이 시작되어 수정 잠금되는 상태 집합 (사용자 요청: 칼선작업 이전까지만 수정 가능)
const LOCKED_STATUSES = new Set(['칼선작업', '제작중', '완료됨', '발송완료', '배송완료']);

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
    _mqRows.push({ rid: rid, code: '', name: '', qty: 1, price: 0 });
    _renderRows();
};

function _renderRows() {
    var list = $('mqItemsList');
    if (!list) return;
    list.innerHTML = _mqRows.map(function (r) {
        return (
            '<div data-rid="' + r.rid + '" style="display:grid; grid-template-columns:120px 1fr 70px 110px 30px; gap:6px; align-items:center;">' +
              '<input type="text" placeholder="상품코드 (선택)" value="' + esc(r.code) + '" data-fld="code" oninput="window._mqRowChange(this)" onblur="window._mqLookupProduct(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px;">' +
              '<input type="text" placeholder="상품명 *" value="' + esc(r.name) + '" data-fld="name" oninput="window._mqRowChange(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px;">' +
              '<input type="number" min="1" placeholder="수량" value="' + (r.qty || 1) + '" data-fld="qty" oninput="window._mqRowChange(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px; text-align:center;">' +
              '<input type="number" min="0" placeholder="단가 (원)" value="' + (r.price || 0) + '" data-fld="price" oninput="window._mqRowChange(this)" style="padding:7px 9px; border:1.5px solid #e5e7eb; border-radius:6px; font-size:12px; text-align:right;">' +
              '<button type="button" onclick="window._mqRemoveRow(\'' + r.rid + '\')" style="width:28px; height:28px; padding:0; background:#fee2e2; color:#b91c1c; border:none; border-radius:6px; cursor:pointer; font-size:14px;">×</button>' +
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
    for (var i = 0; i < _mqRows.length; i++) {
        if (_mqRows[i].rid === rid) {
            if (fld === 'qty' || fld === 'price') _mqRows[i][fld] = parseInt(v, 10) || 0;
            else _mqRows[i][fld] = v;
            break;
        }
    }
    _recalcTotal();
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

function _recalcTotal() {
    var total = _mqRows.reduce(function (sum, r) { return sum + (Number(r.qty) || 0) * (Number(r.price) || 0); }, 0);
    $('mqTotal').textContent = fmtKR(total);
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
    var total = validRows.reduce(function (sum, r) { return sum + (Number(r.qty) || 0) * (Number(r.price) || 0); }, 0);
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

        // 2) items[] 구성 (orders.items 형식, 기존 simple_order/order.js 와 호환)
        var items = validRows.map(function (r) {
            var prod = r._product || {};
            return {
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
