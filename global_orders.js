import { sb } from "./global_config.js?v=279";
import { showLoading } from "./global_common.js?v=279";

// [추천인] 무통장입금 확인 시 추천인 적립
async function creditReferralBonus(orderId) {
    try {
        const { data: order } = await sb.from('orders').select('request_note, total_amount, manager_name').eq('id', orderId).maybeSingle();
        if (!order || !order.request_note) return;
        const match = order.request_note.match(/##REF:([^:]+):([^#]+)##/);
        if (!match) return;
        const referrerId = match[1];

        // 중복 적립 방지
        const { data: existing } = await sb.from('wallet_logs')
            .select('id').eq('user_id', referrerId)
            .eq('type', 'referral_bonus').ilike('description', `%##${orderId}##%`).maybeSingle();
        if (existing) return;

        const bonusAmount = Math.floor(order.total_amount * 0.05);
        if (bonusAmount <= 0) return;

        const buyerName = order.manager_name || '고객';

        const { data: pf } = await sb.from('profiles').select('deposit').eq('id', referrerId).single();
        const newDeposit = (parseInt(pf?.deposit || 0)) + bonusAmount;
        await sb.from('profiles').update({ deposit: newDeposit }).eq('id', referrerId);
        await sb.from('wallet_logs').insert({
            user_id: referrerId, type: 'referral_bonus',
            amount: bonusAmount, description: `##REFERRAL##${buyerName}##${orderId}##`
        });
        console.log(`[추천인] 적립 완료: ${referrerId} +${bonusAmount}KRW (주문: ${orderId})`);
    } catch (e) {
        console.error('[추천인] 적립 오류:', e);
    }
}

let currentOrderStatus = '전체';
let currentPage = 1;
const itemsPerPage = 10;

// ================================================================
// [고객소통 요청] admin_note에 ##CONTACT_REQ## / ##CONTACT_DONE## 마커 사용
// ================================================================
const CONTACT_REQ_MARKER = '##CONTACT_REQ##';
const CONTACT_DONE_MARKER = '##CONTACT_DONE##';
const HIGH_VALUE_THRESHOLD = 1000000; // 100만원 이상 고액주문

function hasContactRequest(adminNote) {
    return adminNote && adminNote.includes(CONTACT_REQ_MARKER);
}
function hasContactDone(adminNote) {
    return adminNote && adminNote.includes(CONTACT_DONE_MARKER);
}
function cleanContactMarkers(note) {
    return (note || '').replace(CONTACT_REQ_MARKER, '').replace(CONTACT_DONE_MARKER, '').trim();
}

window.requestContact = async (orderId) => {
    // 소통요청 모달 생성
    let modal = document.getElementById('contactReqModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'contactReqModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;width:400px;max-width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:17px;font-weight:800;">📞 소통요청 — 주문 #${orderId}</h3>
                <button onclick="document.getElementById('contactReqModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">&times;</button>
            </div>
            <div style="display:flex;gap:4px;margin-bottom:14px;">
                <button class="crTab active" data-tab="manager" onclick="switchCRTab('manager')" style="flex:1;padding:8px;border:2px solid #7c3aed;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#7c3aed;color:#fff;">매니저 소통요청</button>
                <button class="crTab" data-tab="hq" onclick="switchCRTab('hq')" style="flex:1;padding:8px;border:2px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;background:#fff;color:#475569;">본사 처리</button>
            </div>
            <div id="crTabManager">
                <div style="font-size:13px;color:#475569;margin-bottom:10px;">담당 매니저에게 고객 소통을 요청합니다.</div>
                <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
                    <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1.5px solid #f59e0b;border-radius:10px;cursor:pointer;background:#fffbeb;" onclick="this.querySelector('input').checked=true">
                        <input type="radio" name="crManager" value="아무나" checked style="accent-color:#f59e0b;"> <b>아무나</b> <span style="font-size:11px;color:#92400e;">(먼저 받는 매니저가 처리)</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;" onclick="this.querySelector('input').checked=true">
                        <input type="radio" name="crManager" value="은미" style="accent-color:#7c3aed;"> <b>은미</b> 매니저
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;" onclick="this.querySelector('input').checked=true">
                        <input type="radio" name="crManager" value="성희" style="accent-color:#7c3aed;"> <b>성희</b> 매니저
                    </label>
                    <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;" onclick="this.querySelector('input').checked=true">
                        <input type="radio" name="crManager" value="지숙" style="accent-color:#7c3aed;"> <b>지숙</b> 매니저
                    </label>
                </div>
                <textarea id="crReason" rows="2" placeholder="소통 요청 사유 (선택)" style="width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;resize:vertical;"></textarea>
                <button onclick="submitContactReq('${orderId}','manager')" style="width:100%;margin-top:10px;padding:10px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;">매니저에게 소통 요청</button>
            </div>
            <div id="crTabHq" style="display:none;">
                <div style="font-size:13px;color:#475569;margin-bottom:10px;">본사에서 직접 처리합니다.</div>
                <textarea id="crHqNote" rows="2" placeholder="처리 내용 메모 (선택)" style="width:100%;padding:8px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:13px;box-sizing:border-box;font-family:inherit;resize:vertical;"></textarea>
                <button onclick="submitContactReq('${orderId}','hq')" style="width:100%;margin-top:10px;padding:10px;background:#0ea5e9;color:#fff;border:none;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;">본사 직접 처리</button>
            </div>
        </div>
    `;
};

window.switchCRTab = (tab) => {
    document.getElementById('crTabManager').style.display = tab === 'manager' ? '' : 'none';
    document.getElementById('crTabHq').style.display = tab === 'hq' ? '' : 'none';
    document.querySelectorAll('#contactReqModal .crTab').forEach(b => {
        const isActive = b.dataset.tab === tab;
        b.style.background = isActive ? (tab === 'manager' ? '#7c3aed' : '#0ea5e9') : '#fff';
        b.style.color = isActive ? '#fff' : '#475569';
        b.style.borderColor = isActive ? (tab === 'manager' ? '#7c3aed' : '#0ea5e9') : '#e2e8f0';
    });
};

window.submitContactReq = async (orderId, type) => {
    const { data: order } = await sb.from('orders').select('admin_note').eq('id', orderId).single();
    let note = cleanContactMarkers(order?.admin_note);
    const timestamp = new Date().toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });

    if (type === 'manager') {
        const mgr = document.querySelector('input[name="crManager"]:checked')?.value || '은미';
        const reason = document.getElementById('crReason')?.value?.trim() || '';
        note = CONTACT_REQ_MARKER + `[소통요청 ${timestamp}] ${mgr}매니저 지정${reason ? ' / ' + reason : ''}\n` + note;
    } else {
        const hqNote = document.getElementById('crHqNote')?.value?.trim() || '';
        note = CONTACT_DONE_MARKER + `[본사처리 ${timestamp}]${hqNote ? ' ' + hqNote : ''}\n` + note;
    }

    const { error } = await sb.from('orders').update({ admin_note: note }).eq('id', orderId);
    document.getElementById('contactReqModal').style.display = 'none';
    if (error) { showToast('저장 실패: ' + error.message, 'error'); return; }
    showToast(type === 'manager' ? `매니저 소통요청 완료` : `본사 직접 처리 완료`, 'success');
    loadOrders();
};

window.completeContact = async (orderId) => {
    if (!confirm('고객소통을 완료 처리하시겠습니까?')) return;
    const { data: order } = await sb.from('orders').select('admin_note').eq('id', orderId).single();
    let note = cleanContactMarkers(order?.admin_note);
    const timestamp = new Date().toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
    note = CONTACT_DONE_MARKER + `[소통완료 ${timestamp}]\n` + note;
    const { error } = await sb.from('orders').update({ admin_note: note }).eq('id', orderId);
    if (error) { showToast('소통 완료 저장 실패: ' + error.message, 'error'); return; }
    showToast(`주문 #${orderId} 고객소통 완료 처리됨`, 'success');
    loadOrders();
    // 콜백 섹션이 열려있으면 새로고침
    const cbSec = document.getElementById('sec-callback');
    if (cbSec && cbSec.classList.contains('active')) window.loadCallbackList('pending');
};

// [고객소통 요청 리스트] 콜백 섹션용
window.loadCallbackList = async (filter = 'pending') => {
    const tbody = document.getElementById('callbackListBody');
    if (!tbody) return;

    // 필터 버튼 스타일
    ['cbFilterPending', 'cbFilterDone', 'cbFilterHigh'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.classList.remove('btn-primary'); btn.classList.add('btn-outline'); }
    });
    const activeBtn = document.getElementById(filter === 'pending' ? 'cbFilterPending' : filter === 'done' ? 'cbFilterDone' : 'cbFilterHigh');
    if (activeBtn) { activeBtn.classList.remove('btn-outline'); activeBtn.classList.add('btn-primary'); }

    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">로딩 중...</td></tr>';

    try {
        let query = sb.from('orders')
            .select('id, manager_name, phone, total_amount, admin_note, status, created_at')
            .not('status', 'in', '("취소됨","임시작성","관리자차단")')
            .order('created_at', { ascending: false })
            .limit(50);

        if (filter === 'pending') {
            query = query.like('admin_note', '%##CONTACT_REQ##%');
        } else if (filter === 'done') {
            query = query.like('admin_note', '%##CONTACT_DONE##%');
        } else if (filter === 'high') {
            query = query.gte('total_amount', HIGH_VALUE_THRESHOLD);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:30px; color:#94a3b8;">해당 항목이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(order => {
            const isReq = hasContactRequest(order.admin_note);
            const isDone = hasContactDone(order.admin_note);
            const isHigh = (order.total_amount || 0) >= HIGH_VALUE_THRESHOLD;
            const memoText = cleanContactMarkers(order.admin_note).replace(/\n/g, '<br>');
            const statusLabel = isReq ? '<span style="color:#ef4444;font-weight:bold;">대기중</span>' : isDone ? '<span style="color:#15803d;font-weight:bold;">완료</span>' : '-';

            let actionHtml = '';
            if (isReq) {
                actionHtml = `<button class="btn btn-sm" style="background:#15803d;color:#fff;font-size:11px;padding:4px 8px;" onclick="completeContact('${order.id}')">완료처리</button>`;
            } else if (!isDone) {
                actionHtml = `<button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px;color:#7c3aed;border-color:#c4b5fd;" onclick="requestContact('${order.id}')">소통요청</button>`;
            } else {
                actionHtml = `<span style="font-size:11px;color:#94a3b8;">처리완료</span>`;
            }

            tbody.innerHTML += `<tr style="${isHigh ? 'background:#fffbeb;' : ''}">
                <td style="font-weight:bold;color:#4f46e5;">${order.id} ${isHigh ? '<span style="font-size:9px;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;padding:1px 4px;border-radius:6px;">💎</span>' : ''}</td>
                <td>${order.manager_name || '-'}</td>
                <td>${order.phone || '-'}</td>
                <td style="text-align:right;font-weight:bold;">${(order.total_amount || 0).toLocaleString()}원</td>
                <td style="font-size:12px;color:#475569;max-width:300px;overflow:hidden;text-overflow:ellipsis;">${memoText || '-'}</td>
                <td style="text-align:center;">${statusLabel}</td>
                <td style="text-align:center;">${actionHtml}</td>
            </tr>`;
        });
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">${e.message}</td></tr>`;
    }
};

// ================================================================
// [자동 다운로드] File System Access API — 소재별 폴더 직접 저장
// ================================================================
let _autoDownloadActive = false;
let _autoDownloadTimer = null;
let _autoDownloadLastChecked = null;
const _autoDownloadedIds = new Set();
const AUTO_DL_INTERVAL = 300000; // 5분
let _materialCache = {};
let _rootDirHandle = null; // File System Access API 루트 폴더 핸들

const MATERIAL_LABELS = {
    honeycomb_10: '허니콤보드 화크 10mm', honeycomb_16: '허니콤보드 화화 16mm',
    fomax_3: '포맥스 3mm', fomax_5: '포맥스 5mm',
    foam_5: '폼보드 5mm', foam_10: '폼보드 10mm',
    banner: '현수막천', print: '인쇄물',
    acrylic_3: '투명아크릴 3mm', acrylic_5: '투명아크릴 5mm',
    pet_fabric: '패트천', ad_other: '기타 광고소재', transparent: '투명용지'
};

let _addonNameCache = {}; // addon code → display name

async function _loadMaterialCache() {
    const { data } = await sb.from('admin_products').select('code, name, material, category').limit(10000);
    if (data) {
        _materialCache = {};
        // code → material 매핑 + category → material 매핑 (폴백) + name → material 매핑 (코드 없는 주문용)
        data.forEach(p => {
            if (p.material) {
                _materialCache[p.code] = p.material;
                if (p.name) _materialCache['_name_' + p.name] = p.material;
                if (p.category && !_materialCache['_cat_' + p.category]) {
                    _materialCache['_cat_' + p.category] = p.material;
                }
            }
        });
        console.log('[자동다운] 소재 캐시 로드:', Object.keys(_materialCache).length, '건', _materialCache);
    }
    // 옵션명 캐시
    const { data: addons } = await sb.from('admin_addons').select('code, name');
    if (addons) {
        _addonNameCache = {};
        addons.forEach(a => { _addonNameCache[a.code] = a.name; });
    }
}

// 하위 폴더 핸들 가져오기 (없으면 생성)
async function _getSubDir(parent, name) {
    return await parent.getDirectoryHandle(name, { create: true });
}

// 폴더에 파일 쓰기
async function _writeFile(dirHandle, fileName, blob) {
    const safe = fileName.replace(/[\\/:*?"<>|]/g, '_');
    const fh = await dirHandle.getFileHandle(safe, { create: true });
    const writable = await fh.createWritable();
    await writable.write(blob);
    await writable.close();
}

window.toggleAutoDownload = async () => {
    if (!_autoDownloadActive) {
        // 켜기: 먼저 폴더 선택
        if (!window.showDirectoryPicker) {
            showToast('이 브라우저는 폴더 저장을 지원하지 않습니다. Chrome을 사용해주세요.', 'error');
            return;
        }
        try {
            _rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        } catch (e) {
            // 사용자가 취소
            return;
        }
        _autoDownloadActive = true;
        const btn = document.getElementById('autoDownloadBtn');
        const status = document.getElementById('autoDownloadStatus');
        btn.textContent = '📥 자동다운 ON';
        btn.style.background = '#dcfce7';
        btn.style.borderColor = '#22c55e';
        btn.style.color = '#15803d';
        status.style.display = 'inline';
        status.textContent = '소재 DB 로딩...';
        await _loadMaterialCache();
        status.textContent = '대기중...';
        _autoDownloadLastChecked = new Date().toISOString();
        _runAutoDownloadCheck();
        _autoDownloadTimer = setInterval(_runAutoDownloadCheck, AUTO_DL_INTERVAL);
    } else {
        // 끄기
        _autoDownloadActive = false;
        const btn = document.getElementById('autoDownloadBtn');
        const status = document.getElementById('autoDownloadStatus');
        btn.textContent = '📥 자동다운 OFF';
        btn.style.background = '';
        btn.style.borderColor = '';
        btn.style.color = '';
        status.style.display = 'none';
        if (_autoDownloadTimer) { clearInterval(_autoDownloadTimer); _autoDownloadTimer = null; }
    }
};

// 수동 즉시 다운로드 (단일 주문) — ZIP 폴백
window.autoDownloadOrder = async (orderId) => {
    const { data: order } = await sb.from('orders')
        .select('id, files, manager_name, created_at, items, phone, address, request_note, total_amount, status, delivery_target_date, site_code, installation_time')
        .eq('id', orderId).single();
    if (!order) { showToast('주문을 찾을 수 없습니다.', 'error'); return; }
    if (Object.keys(_materialCache).length === 0) await _loadMaterialCache();

    if (_rootDirHandle) {
        await _saveOrderToFolder(order);
        showToast('폴더 저장 완료', 'success');
    } else {
        await _buildAndDownloadZip(order);
        showToast('ZIP 다운로드 완료', 'success');
    }
};

window.manualDownloadSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast('선택된 주문이 없습니다.', 'warn'); return; }

    // 폴더 미선택 시 폴더 선택 프롬프트
    if (!_rootDirHandle) {
        try {
            _rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
        } catch (e) {
            showToast('폴더를 선택해주세요.', 'warn');
            return;
        }
    }

    if (Object.keys(_materialCache).length === 0) await _loadMaterialCache();

    showToast(`${ids.length}건 다운로드 시작...`, 'info');
    let ok = 0, fail = 0;
    for (const id of ids) {
        try {
            const { data: order } = await sb.from('orders')
                .select('id, files, manager_name, created_at, items, phone, address, request_note, total_amount, status, delivery_target_date, site_code, installation_time')
                .eq('id', id).single();
            if (!order) { fail++; continue; }
            const files = (order.files || []).filter(f => f.url && f.type !== '_error_log');
            if (files.length === 0) { continue; }

            await _saveOrderToFolder(order);
            ok++;
        } catch (e) {
            console.error('[수동다운] 오류:', id, e);
            fail++;
        }
    }
    const msg = `${ok}건 저장 완료` + (fail > 0 ? `, ${fail}건 실패` : '');
    showToast(msg, fail > 0 ? 'warn' : 'success');
};

async function _runAutoDownloadCheck() {
    if (!_autoDownloadActive || !_rootDirHandle) return;
    const status = document.getElementById('autoDownloadStatus');
    try {
        let query = sb.from('orders')
            .select('id, files, manager_name, created_at, items, phone, address, request_note, total_amount, status, delivery_target_date, site_code, installation_time')
            .neq('status', '임시작성').neq('status', '관리자차단')
            .not('status', 'in', '("취소요청","취소됨")')
            .order('created_at', { ascending: false })
            .limit(20);

        if (_autoDownloadLastChecked) {
            query = query.gte('created_at', _autoDownloadLastChecked);
        }

        const { data: orders, error } = await query;
        if (error) { console.error('[자동다운] 조회 오류:', error); return; }

        let saveCount = 0;
        for (const order of (orders || [])) {
            if (_autoDownloadedIds.has(order.id)) continue;
            const files = (order.files || []).filter(f => f.url && f.type !== '_error_log');
            if (files.length === 0) continue;

            await _saveOrderToFolder(order);
            _autoDownloadedIds.add(order.id);
            saveCount++;
        }

        _autoDownloadLastChecked = new Date().toISOString();
        const now = new Date().toLocaleTimeString();
        if (saveCount > 0) {
            status.textContent = `${now} - ${saveCount}건 저장완료`;
            status.style.color = '#22c55e';
            showToast(`${saveCount}건 주문 파일 자동 저장 완료`, 'success');
        } else {
            status.textContent = `${now} 체크완료`;
            status.style.color = '#64748b';
        }
    } catch (err) {
        console.error('[자동다운] 오류:', err);
        const status = document.getElementById('autoDownloadStatus');
        status.textContent = '오류 발생';
        status.style.color = '#ef4444';
    }
}

// ── 핵심: 주문을 선택한 폴더에 소재별로 분류 저장 ──
async function _saveOrderToFolder(order) {
    const files = (order.files || []).filter(f => f.url && f.type !== '_error_log');
    const items = order.items || [];
    const safeName = (order.manager_name || 'unknown').replace(/[\\/:*?"<>|]/g, '_');
    const orderFolderName = `${order.id}_${safeName}`;

    // 소재 분류
    const sheetFiles = files.filter(f => f.type === 'order_sheet');
    const quoteFiles = files.filter(f => f.type === 'quotation');
    const customerFiles = files.filter(f => f.type !== 'order_sheet' && f.type !== 'quotation');
    console.log(`[자동다운] 주문 #${order.id}: 전체파일 ${files.length}개, 고객파일 ${customerFiles.length}개`, customerFiles.map(f => f.type + ':' + f.name));

    const itemMaterials = items.map(item => {
        const code = item.product?.code || item.productCode || '';
        const cat = item.product?.category || '';
        const prodName = item.productName || item.product?.name || '';
        let mat = _materialCache[code] || item.product?.material || _materialCache['_cat_' + cat] || _materialCache['_name_' + prodName] || '';
        console.log(`[자동다운] 소재매칭: code=${code}, name=${prodName}, mat=${mat||'미분류'}`);
        const label = mat ? (MATERIAL_LABELS[mat] || mat.replace(/_/g, ' ')) : '미분류';
        return { item, material: mat, label };
    });

    const materialGroups = {};
    itemMaterials.forEach(im => {
        if (!materialGroups[im.label]) materialGroups[im.label] = [];
        materialGroups[im.label].push(im);
    });

    const matLabels = Object.keys(materialGroups);
    const targetLabels = matLabels.length > 0 ? matLabels : ['미분류'];

    for (const matLabel of targetLabels) {
        const matDir = await _getSubDir(_rootDirHandle, matLabel);

        // 작업지시서 → 소재폴더/작업지시서/
        if (sheetFiles.length > 0) {
            const sheetDir = await _getSubDir(matDir, '작업지시서');
            for (const f of sheetFiles) {
                try {
                    const blob = await _fetchFileBlob(f.url);
                    if (blob) await _writeFile(sheetDir, `${orderFolderName}_${f.name || 'sheet'}`, blob);
                } catch (e) { console.error('[자동다운] 작업지시서 저장실패:', f.name, e); }
            }
        }

        // 견적서 → 소재폴더/견적서/
        if (quoteFiles.length > 0) {
            const quoteDir = await _getSubDir(matDir, '견적서');
            for (const f of quoteFiles) {
                try {
                    const blob = await _fetchFileBlob(f.url);
                    if (blob) await _writeFile(quoteDir, `${orderFolderName}_${f.name || 'quote'}`, blob);
                } catch (e) { console.error('[자동다운] 견적서 저장실패:', f.name, e); }
            }
        }

        // 고객 파일 → 소재폴더 루트
        for (const f of customerFiles) {
            try {
                const blob = await _fetchFileBlob(f.url);
                if (blob) {
                    await _writeFile(matDir, `${orderFolderName}_${f.name || 'file'}`, blob);
                } else {
                    console.error(`[자동다운] 다운로드 실패 (blob=null): ${f.name}`, f.url);
                }
            } catch (e) { console.error('[자동다운] 파일 저장실패:', f.name, e); }
        }

        // 작업메모 PNG
        const matItems = materialGroups[matLabel] || [];
        const memoBlob = await _generateWorkMemo(order, matItems, matLabel);
        if (memoBlob) await _writeFile(matDir, `${orderFolderName}_작업메모.png`, memoBlob);
    }
}

// ── ZIP 폴백 (폴더 미선택 시 수동 다운로드용) ──
async function _buildAndDownloadZip(order) {
    const zip = new JSZip();
    const safeName = (order.manager_name || 'unknown').replace(/[\\/:*?"<>|]/g, '_');
    const zipName = `${order.id}_${safeName}`;
    const files = (order.files || []).filter(f => f.url && f.type !== '_error_log');
    const items = order.items || [];

    const sheetFiles = files.filter(f => f.type === 'order_sheet');
    const quoteFiles = files.filter(f => f.type === 'quotation');
    const customerFiles = files.filter(f => f.type !== 'order_sheet' && f.type !== 'quotation');

    const itemMaterials = items.map(item => {
        const code = item.product?.code || item.productCode || '';
        const cat = item.product?.category || '';
        const prodName = item.productName || item.product?.name || '';
        let mat = _materialCache[code] || item.product?.material || _materialCache['_cat_' + cat] || _materialCache['_name_' + prodName] || '';
        const label = mat ? (MATERIAL_LABELS[mat] || mat.replace(/_/g, ' ')) : '미분류';
        return { item, material: mat, label };
    });
    const materialGroups = {};
    itemMaterials.forEach(im => {
        if (!materialGroups[im.label]) materialGroups[im.label] = [];
        materialGroups[im.label].push(im);
    });
    const matLabels = Object.keys(materialGroups);
    const targetLabels = matLabels.length > 0 ? matLabels : ['미분류'];

    for (const matLabel of targetLabels) {
        // 작업지시서 → 소재폴더/작업지시서/
        for (const f of sheetFiles) {
            try { const blob = await _fetchFileBlob(f.url); if (blob) zip.file(`${matLabel}/작업지시서/${f.name || 'sheet'}`, blob); } catch (e) {}
        }
        // 견적서 → 소재폴더/견적서/
        for (const f of quoteFiles) {
            try { const blob = await _fetchFileBlob(f.url); if (blob) zip.file(`${matLabel}/견적서/${f.name || 'quote'}`, blob); } catch (e) {}
        }
        // 고객파일 → 소재폴더 루트
        for (const f of customerFiles) {
            try {
                const blob = await _fetchFileBlob(f.url);
                if (blob) zip.file(`${matLabel}/${f.name || 'file'}`, blob);
            } catch (e) { console.error('[자동다운] ZIP 파일 추가 실패:', f.name, e); }
        }
        const matItems = materialGroups[matLabel] || [];
        const memoBlob = await _generateWorkMemo(order, matItems, matLabel);
        if (memoBlob) zip.file(`${matLabel}/작업메모.png`, memoBlob);
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${zipName}.zip`);
}

async function _fetchFileBlob(url) {
    try {
        const res = await fetch(url, { mode: 'cors' });
        if (!res.ok) {
            console.warn('[자동다운] fetch 응답 오류:', res.status, url);
            return null;
        }
        return await res.blob();
    } catch (e) {
        // CORS 또는 네트워크 실패 → XHR 폴백
        console.warn('[자동다운] fetch 실패, XHR 시도:', url);
        return await new Promise(resolve => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.onload = () => resolve(xhr.status === 200 ? xhr.response : null);
            xhr.onerror = () => { console.error('[자동다운] XHR도 실패:', url); resolve(null); };
            xhr.send();
        });
    }
}

// 옵션 코드 → 표시명 변환
function _resolveAddonName(code) {
    if (_addonNameCache[code]) return _addonNameCache[code];
    const stripped = code.replace(/^opt_/, '');
    if (_addonNameCache[stripped]) return _addonNameCache[stripped];
    if (_addonNameCache['opt_' + code]) return _addonNameCache['opt_' + code];
    return stripped.replace(/_/g, ' ');
}

// ── 작업메모 이미지 (Canvas → Blob) ──
async function _generateWorkMemo(order, matItems, matLabel) {
    try {
        const canvas = document.createElement('canvas');
        const W = 700, lineH = 28;
        const items = matItems.map(m => m.item);
        const rowCount = Math.max(items.length, 1);

        // 옵션 줄 수 미리 계산 (제품타입/티셔츠/블라인드 포함)
        let optLineCount = 0;
        for (const item of items) {
            if (item.product?._artworkType) optLineCount++;
            if (item.product?._tshirtColorName) optLineCount++;
            if (item.product?._tshirtSize) optLineCount++;
            if (item.product?._blindSide) optLineCount++;
            if (item.selectedAddons && typeof item.selectedAddons === 'object') {
                optLineCount += Object.keys(item.selectedAddons).filter(k => item.selectedAddons[k]).length;
            }
        }

        // 높이 넉넉하게 (상단 테이블 + 하단 상세 + QR + 이미지)
        const imgH = 200; // 각 아이템 이미지 높이
        const H = 60 + 180 + 40 + rowCount * lineH + optLineCount * 22 + 60 + rowCount * 50 + optLineCount * 18 + 80 + 180 + 50 + rowCount * (imgH + 30);
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        // 배경
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // 헤더 바 — 국가별 색상
        const site = order.site_code || 'KR';
        const headerColor = site === 'JP' ? '#dc2626' : site === 'US' ? '#eab308' : '#1e293b';
        const headerTextColor = site === 'US' ? '#1e293b' : '#ffffff';
        ctx.fillStyle = headerColor;
        ctx.fillRect(0, 0, W, 56);
        ctx.fillStyle = headerTextColor;
        ctx.font = 'bold 24px Pretendard, sans-serif';
        ctx.fillText(`작업지시 - 주문 #${order.id}`, 18, 38);
        // 국가 뱃지
        const siteLabel = site === 'JP' ? '🇯🇵 JP' : site === 'US' ? '🇺🇸 US' : '🇰🇷 KR';
        ctx.font = 'bold 14px Pretendard, sans-serif';
        ctx.fillText(siteLabel, W - 70, 38);

        // 주문 기본 정보
        let y = 76;
        ctx.fillStyle = '#334155';
        ctx.font = '15px Pretendard, sans-serif';
        ctx.fillText(`고객명: ${order.manager_name || '-'}`, 18, y); y += 24;
        ctx.fillText(`연락처: ${order.phone || '-'}`, 18, y); y += 24;
        ctx.fillText(`주문일: ${order.created_at ? new Date(order.created_at).toLocaleString('ko-KR') : '-'}`, 18, y); y += 24;

        // 배송일 + 설치시간
        if (order.delivery_target_date) {
            ctx.font = 'bold 15px Pretendard, sans-serif';
            ctx.fillStyle = '#dc2626';
            let deliveryStr = `배송일: ${order.delivery_target_date}`;
            if (order.installation_time) deliveryStr += ` (설치 ${order.installation_time})`;
            ctx.fillText(deliveryStr, 18, y); y += 24;
        }

        // 소재
        ctx.font = 'bold 15px Pretendard, sans-serif';
        ctx.fillStyle = '#7c3aed';
        ctx.fillText(`소재: ${matLabel}`, 18, y); y += 24;

        // 요청사항
        ctx.fillStyle = '#334155';
        ctx.font = '14px Pretendard, sans-serif';
        if (order.request_note) {
            const note = order.request_note.replace(/##REF:[^#]+##/, '').trim();
            if (note) { ctx.fillText(`요청사항: ${note.substring(0, 60)}`, 18, y); y += 24; }
        }

        // 구분선
        y += 8;
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(W - 18, y); ctx.stroke();
        y += 14;

        // 상품 테이블 헤더
        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(18, y, W - 36, 30);
        ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(18, y, W - 36, 30);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 13px Pretendard, sans-serif';
        ctx.fillText('상품명', 28, y + 20);
        ctx.fillText('수량', 420, y + 20);
        ctx.fillText('크기', 510, y + 20);
        y += 36;

        // 상품 행
        for (const item of items) {
            const pName = (item.product?.name || '-').substring(0, 35);
            const qty = item.qty || 1;
            const wMm = item.product?.w_mm || item.w_mm || 0;
            const hMm = item.product?.h_mm || item.h_mm || 0;
            const size = wMm && hMm ? `${Math.round(wMm)}x${Math.round(hMm)}mm` : '-';

            ctx.fillStyle = '#334155';
            ctx.font = '14px Pretendard, sans-serif';
            ctx.fillText(pName, 28, y + 6);

            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 18px Pretendard, sans-serif';
            ctx.fillText(`${qty}개`, 420, y + 6);

            ctx.fillStyle = '#334155';
            ctx.font = '13px Pretendard, sans-serif';
            ctx.fillText(size, 510, y + 6);
            y += lineH + 4;

            // ★ 제품 타입 (패브릭/캔버스/티셔츠 등)
            const _typeNames = { fabric:'패브릭인쇄', canvas:'캔버스액자', paper:'종이포스터', acrylic:'아크릴액자', blind:'롤블라인드', mug:'머그컵', tshirt:'티셔츠인쇄', sticker:'스티커', cushion:'쿠션', keyring:'키링' };
            const _aType = item.product?._artworkType;
            if (_aType && _typeNames[_aType]) {
                ctx.font = 'bold 13px Pretendard, sans-serif';
                ctx.fillStyle = '#4f46e5';
                ctx.fillText(`  ▸ 제품종류: ${_typeNames[_aType]}`, 40, y + 2);
                y += 22;
            }
            // ★ 티셔츠 색상/사이즈
            if (item.product?._tshirtColorName) {
                ctx.font = '12px Pretendard, sans-serif';
                ctx.fillStyle = '#7c3aed';
                ctx.fillText(`  ▸ 티셔츠 컬러: ${item.product._tshirtColorName}`, 40, y + 2);
                y += 22;
            }
            if (item.product?._tshirtSize) {
                ctx.font = '12px Pretendard, sans-serif';
                ctx.fillStyle = '#7c3aed';
                ctx.fillText(`  ▸ 티셔츠 사이즈: ${item.product._tshirtSize}`, 40, y + 2);
                y += 22;
            }
            // ★ 블라인드 방향
            if (item.product?._blindSide) {
                ctx.font = '12px Pretendard, sans-serif';
                ctx.fillStyle = '#0284c7';
                ctx.fillText(`  ▸ 내림손잡이: ${item.product._blindSide === 'left' ? '좌측' : '우측'}`, 40, y + 2);
                y += 22;
            }

            // 옵션 상세
            if (item.selectedAddons && typeof item.selectedAddons === 'object') {
                const keys = Object.keys(item.selectedAddons).filter(k => item.selectedAddons[k]);
                if (keys.length > 0) {
                    for (const k of keys) {
                        const addonName = _resolveAddonName(k);
                        const addonVal = item.selectedAddons[k];
                        const qtyStr = (item.addonQuantities && item.addonQuantities[k]) ? ` x${item.addonQuantities[k]}` : '';
                        const valStr = (typeof addonVal === 'string' && addonVal !== 'true' && addonVal !== true && addonVal.length < 30) ? `: ${addonVal}` : '';
                        ctx.font = '12px Pretendard, sans-serif';
                        ctx.fillStyle = '#6366f1';
                        ctx.fillText(`  ▸ ${addonName}${valStr}${qtyStr}`, 40, y + 2);
                        y += 22;
                    }
                }
            }
        }
        if (items.length === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '13px Pretendard, sans-serif';
            ctx.fillText('(아이템 정보 없음)', 28, y + 6);
            y += lineH;
        }

        // ── 주문 상세 요약 (상품별 수량/옵션/크기) ──
        y += 12;
        ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(W - 18, y); ctx.stroke();
        y += 16;

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 14px Pretendard, sans-serif';
        ctx.fillText('📋 주문 상세', 18, y); y += 24;

        for (const item of items) {
            const pName = (item.product?.name || '-').substring(0, 40);
            const qty = item.qty || 1;
            const wMm = item.product?.w_mm || item.w_mm || 0;
            const hMm = item.product?.h_mm || item.h_mm || 0;
            const sizeStr = wMm && hMm ? `${Math.round(wMm)}×${Math.round(hMm)}mm` : '';
            const wallCount = item.wallCount || 0;

            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 13px Pretendard, sans-serif';
            ctx.fillText(`• ${pName}`, 28, y);
            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 15px Pretendard, sans-serif';
            ctx.fillText(`× ${qty}`, 450, y);
            y += 20;

            // 크기/벽수
            if (sizeStr || wallCount) {
                ctx.fillStyle = '#475569';
                ctx.font = '12px Pretendard, sans-serif';
                let detailStr = '';
                if (sizeStr) detailStr += `크기: ${sizeStr}`;
                if (wallCount) detailStr += (detailStr ? '  |  ' : '') + `벽 ${wallCount}개`;
                ctx.fillText(`  ${detailStr}`, 40, y);
                y += 18;
            }

            // ★ 제품 타입/티셔츠/블라인드 정보
            const _tn2 = { fabric:'패브릭인쇄', canvas:'캔버스액자', paper:'종이포스터', acrylic:'아크릴액자', blind:'롤블라인드', mug:'머그컵', tshirt:'티셔츠인쇄', sticker:'스티커', cushion:'쿠션', keyring:'키링' };
            if (item.product?._artworkType && _tn2[item.product._artworkType]) {
                ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 12px Pretendard, sans-serif';
                ctx.fillText(`    ▸ 제품종류: ${_tn2[item.product._artworkType]}`, 40, y); y += 18;
            }
            if (item.product?._tshirtColorName) {
                ctx.fillStyle = '#7c3aed'; ctx.font = '12px Pretendard, sans-serif';
                ctx.fillText(`    ▸ 컬러: ${item.product._tshirtColorName}`, 40, y); y += 18;
            }
            if (item.product?._tshirtSize) {
                ctx.fillStyle = '#7c3aed'; ctx.font = '12px Pretendard, sans-serif';
                ctx.fillText(`    ▸ 사이즈: ${item.product._tshirtSize}`, 40, y); y += 18;
            }
            if (item.product?._blindSide) {
                ctx.fillStyle = '#0284c7'; ctx.font = '12px Pretendard, sans-serif';
                ctx.fillText(`    ▸ 내림손잡이: ${item.product._blindSide === 'left' ? '좌측' : '우측'}`, 40, y); y += 18;
            }

            // 옵션 목록
            if (item.selectedAddons && typeof item.selectedAddons === 'object') {
                const keys = Object.keys(item.selectedAddons).filter(k => item.selectedAddons[k]);
                for (const k of keys) {
                    const addonName = _resolveAddonName(k);
                    const addonVal = item.selectedAddons[k];
                    const qtyStr = (item.addonQuantities && item.addonQuantities[k]) ? ` ×${item.addonQuantities[k]}` : '';
                    const valStr = (typeof addonVal === 'string' && addonVal !== 'true' && addonVal !== k && addonVal.length < 30) ? `: ${addonVal}` : '';
                    ctx.fillStyle = '#6366f1';
                    ctx.font = '12px Pretendard, sans-serif';
                    ctx.fillText(`    ▸ ${addonName}${valStr}${qtyStr}`, 40, y);
                    y += 18;
                }
            }
            y += 6;
        }

        // 총 금액
        ctx.fillStyle = '#334155';
        ctx.font = '13px Pretendard, sans-serif';
        ctx.fillText(`총 금액: ${(order.total_amount || 0).toLocaleString()}원`, 28, y);
        y += 20;

        // 배송일
        if (order.delivery_target_date) {
            ctx.fillStyle = '#dc2626';
            ctx.font = 'bold 13px Pretendard, sans-serif';
            let dlvStr = `배송일: ${order.delivery_target_date}`;
            if (order.installation_time) dlvStr += `  |  설치: ${order.installation_time}`;
            ctx.fillText(dlvStr, 28, y);
            y += 20;
        }

        // 구분선
        y += 8;
        ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(W - 18, y); ctx.stroke();
        y += 18;

        // QR코드
        const qrSize = 130;
        try {
            const qrContent = [
                `주문 #${order.id}`,
                `고객: ${order.manager_name || '-'}`,
                `연락처: ${order.phone || '-'}`,
                `소재: ${matLabel}`,
                order.delivery_target_date ? `배송일: ${order.delivery_target_date}` : '',
                order.installation_time ? `설치시간: ${order.installation_time}` : '',
            ].filter(Boolean).join('\n');
            const qrDataUrl = await QRCode.toDataURL(qrContent, { width: qrSize, margin: 1 });
            const qrImg = new Image();
            await new Promise((res, rej) => { qrImg.onload = res; qrImg.onerror = rej; qrImg.src = qrDataUrl; });
            ctx.drawImage(qrImg, W - qrSize - 28, y, qrSize, qrSize);
        } catch (e) {
            console.error('[자동다운] QR 생성 실패:', e);
        }

        // QR 왼쪽에 주문번호/상태
        ctx.fillStyle = '#334155';
        ctx.font = 'bold 13px Pretendard, sans-serif';
        ctx.fillText(`주문번호: #${order.id}`, 28, y + 20);
        ctx.font = '13px Pretendard, sans-serif';
        ctx.fillText(`상태: ${order.status || '-'}`, 28, y + 42);
        ctx.fillText(`소재: ${matLabel}`, 28, y + 64);
        y += qrSize + 10;

        // ★ 아이템별 디자인 시안 이미지
        for (const item of items) {
            // 이미지 URL 후보: thumb > originalUrl > uploadedFiles > product.img
            let imgUrl = item.thumb || item.originalUrl;
            if (!imgUrl && item.uploadedFiles && item.uploadedFiles[0]) {
                imgUrl = item.uploadedFiles[0].thumb || item.uploadedFiles[0].originalUrl;
            }
            if (!imgUrl && item.product?.img) imgUrl = item.product.img;
            if (!imgUrl) continue;

            try {
                y += 10;
                ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 0.5;
                ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(W - 18, y); ctx.stroke();
                y += 10;

                ctx.fillStyle = '#64748b';
                ctx.font = 'bold 11px Pretendard, sans-serif';
                ctx.fillText(`< 디자인 시안 - ${(item.product?.name || '').substring(0, 30)} >`, 28, y);
                y += 14;

                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = rej;
                    const ts = imgUrl.includes('?') ? '&t=' + Date.now() : '?t=' + Date.now();
                    img.src = imgUrl + ts;
                });

                const maxW = W - 60;
                const maxH = imgH;
                let dw = img.width, dh = img.height;
                if (dw > maxW) { dh = dh * maxW / dw; dw = maxW; }
                if (dh > maxH) { dw = dw * maxH / dh; dh = maxH; }
                const imgX = (W - dw) / 2;

                ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1;
                ctx.strokeRect(imgX - 2, y - 2, dw + 4, dh + 4);
                ctx.drawImage(img, imgX, y, dw, dh);
                y += dh + 10;
            } catch(e) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = '11px Pretendard, sans-serif';
                ctx.fillText('(이미지 로드 실패)', 28, y);
                y += 20;
            }
        }

        // 하단 푸터
        y += 10;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px Pretendard, sans-serif';
        ctx.fillText(`Chameleon Printing - ${new Date().toLocaleString('ko-KR')}`, 18, y);
        y += 20;

        // ★ 실제 사용한 높이로 캔버스 잘라내기 (빈 공간 제거)
        const finalH = Math.min(y, H);
        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = W;
        trimmedCanvas.height = finalH;
        const trimCtx = trimmedCanvas.getContext('2d');
        trimCtx.drawImage(canvas, 0, 0);

        return await new Promise(resolve => trimmedCanvas.toBlob(resolve, 'image/png'));
    } catch (e) {
        console.error('[자동다운] 작업메모 생성 실패:', e);
        return null;
    }
}

// window에 노출 (별도 페이지에서 사이드바 nav 접근용)
Object.defineProperty(window, 'currentOrderStatus', { get: () => currentOrderStatus, set: v => { currentOrderStatus = v; } });
Object.defineProperty(window, 'currentPage', { get: () => currentPage, set: v => { currentPage = v; } });
let currentMgrOrderId = null;
let currentMgrFiles = [];
let staffList = [];

// [VIP 주문]
window.loadVipOrders = async () => {
    const tbody = document.getElementById('vipOrderListBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;"><div class="spinner"></div></td></tr>';

    try {
        const { data, error } = await sb.from('vip_orders')
            .select('id, created_at, status, customer_name, customer_phone, memo, files, preferred_manager')
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:30px; color:#999;">접수된 VIP 주문이 없습니다.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        data.forEach(item => {
            const realFiles = item.files ? item.files.filter(f => f.type !== '_error_log') : [];
            let filesHtml = realFiles.length ? realFiles.map(f => `<a href="${f.url}" target="_blank" class="btn btn-outline btn-sm" style="margin:2px;">💾 ${f.name}</a>`).join('') : '<span style="color:#ccc;">파일 없음</span>';

            // 상태 + 관리 버튼
            let statusBadge = '';
            let actionHtml = '';
            const st = item.status || '';
            if (st.includes('상담중:')) {
                const who = st.replace('상담중:', '').trim();
                statusBadge = `<span class="badge" style="background:#dbeafe;color:#1d4ed8;font-weight:bold;">💬 ${who} 상담중</span>`;
                actionHtml = `<button class="btn btn-sm" style="background:#15803d;color:#fff;border:none;font-size:11px;" onclick="updateVipStatus(${item.id},'확인됨')">✅ 완료</button>
                              <button class="btn btn-sm" style="background:#94a3b8;color:#fff;border:none;font-size:11px;margin-top:3px;" onclick="updateVipStatus(${item.id},'대기중')">↩ 대기</button>`;
            } else if (st === '확인됨') {
                statusBadge = `<span class="badge" style="background:#dcfce7;color:#15803d;">✅ 완료</span>`;
                actionHtml = `<button class="btn btn-outline btn-sm" style="font-size:11px;" onclick="updateVipStatus(${item.id},'대기중')">↩ 대기로</button>`;
            } else {
                statusBadge = `<span class="badge" style="background:#fee2e2;color:#ef4444;">대기중</span>`;
                actionHtml = `<button class="btn btn-primary btn-sm" style="font-size:11px;" onclick="openVipAssignModal(${item.id})">확인</button>`;
            }

            tbody.innerHTML += `
                <tr style="${st === '대기중' || st === 'quote' ? 'background:#fff7ed;' : ''}">
                    <td><input type="checkbox" class="vip-chk" value="${item.id}"></td>
                    <td>${new Date(item.created_at).toLocaleString()}</td>
                    <td><span class="badge">${item.preferred_manager || '미지정'}</span></td>
                    <td style="font-weight:bold;">${item.customer_name}</td>
                    <td>${item.customer_phone}</td>
                    <td style="font-size:13px; color:#475569;">${item.memo || '-'}</td>
                    <td>${filesHtml}</td>
                    <td style="text-align:center;">${statusBadge}</td>
                    <td style="text-align:center;">${actionHtml}</td>
                </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    }
};

window.updateVipStatus = async (id, newStatus) => {
    const { error } = await sb.from('vip_orders').update({ status: newStatus }).eq('id', id);
    if (!error) loadVipOrders();
};

window.openVipAssignModal = (id) => {
    let modal = document.getElementById('vipAssignModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'vipAssignModal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;width:360px;max-width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:16px;font-weight:800;">📞 상담 담당자 선택</h3>
                <button onclick="document.getElementById('vipAssignModal').style.display='none'" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">&times;</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
                <button onclick="assignVipConsultant(${id},'은미')" style="padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-size:14px;font-weight:600;text-align:left;">👩 <b>은미</b> 매니저</button>
                <button onclick="assignVipConsultant(${id},'성희')" style="padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-size:14px;font-weight:600;text-align:left;">👩 <b>성희</b> 매니저</button>
                <button onclick="assignVipConsultant(${id},'지숙')" style="padding:12px;border:1.5px solid #e2e8f0;border-radius:10px;background:#fff;cursor:pointer;font-size:14px;font-weight:600;text-align:left;">👩 <b>지숙</b> 매니저</button>
                <button onclick="assignVipConsultant(${id},'본사')" style="padding:12px;border:1.5px solid #0ea5e9;border-radius:10px;background:#f0f9ff;cursor:pointer;font-size:14px;font-weight:600;text-align:left;">🏢 <b>본사</b> 직접 처리</button>
            </div>
        </div>
    `;
};

window.assignVipConsultant = async (id, name) => {
    const newStatus = '상담중: ' + name;
    const { error } = await sb.from('vip_orders').update({ status: newStatus }).eq('id', id);
    document.getElementById('vipAssignModal').style.display = 'none';
    if (error) { showToast('변경 실패: ' + error.message, 'error'); return; }
    showToast(`${name} 상담 배정 완료`, 'success');
    loadVipOrders();
};

window.deleteSelectedVipOrders = async () => {
    const checks = document.querySelectorAll('.vip-chk:checked');
    if (checks.length === 0) { showToast("선택된 항목이 없습니다.", "warn"); return; }
    if (!confirm(`${checks.length}건을 삭제하시겠습니까?`)) return;
    const ids = Array.from(checks).map(c => c.value);
    const { error } = await sb.from('vip_orders').delete().in('id', ids);
    if (!error) loadVipOrders();
};

// [통합 주문 로드]
window.loadOrders = async () => {
    const tbody = document.getElementById('orderListBody');
    if (!tbody) return;

    showLoading(true);
    window.updateActionButtons();
    
    try {
        const searchKeyword = document.getElementById('orderSearchInput').value.trim();
        const siteFilter = document.getElementById('filterSite').value;
        const managerFilter = document.getElementById('filterManager')?.value || 'all';
        const deliveryDateFilter = document.getElementById('filterDeliveryDate').value;
        const orderDateFilter = document.getElementById('filterOrderDate').value;

        // 스태프 목록 로드 (색상 표시용)
        if(staffList.length === 0) {
            const { data } = await sb.from('admin_staff').select('id, name, role, color');
            staffList = data || [];
            // 매니저 필터 드롭다운 채우기
            const filterMgr = document.getElementById('filterManager');
            if (filterMgr) {
                const managers = staffList.filter(s => s.role === 'manager');
                managers.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name;
                    filterMgr.appendChild(opt);
                });
            }
        }

        let query = sb.from('orders')
            .select('id, status, total_amount, items, created_at, payment_status, payment_method, toss_payment_key, discount_amount, manager_name, phone, address, request_note, delivery_target_date, site_code, staff_manager_id, staff_driver_id, files, user_id, depositor_name, admin_note, receipt_info', { count: 'exact' })
            .order('created_at', { ascending: false });

        // [핵심 2] 임시작성 및 관리자차단 건 숨김
        query = query.neq('status', '임시작성').neq('status', '관리자차단');

        // 필터 적용 (고도몰 스타일 세부 탭)
        if (currentOrderStatus === '전체') {
            query = query.not('status', 'in', '("취소요청","취소됨")');
        } else if (currentOrderStatus === '입금대기') {
            query = query.in('status', ['접수됨', '파일처리중', '접수대기', '제작준비']);
            query = query.not('payment_status', 'in', '("결제완료","입금확인")');
        } else if (currentOrderStatus === '결제완료') {
            query = query.in('status', ['접수됨', '파일처리중', '접수대기', '제작준비']);
            query = query.in('payment_status', ['결제완료', '입금확인']);
        } else if (currentOrderStatus === '칼선작업') {
            query = query.in('status', ['칼선작업', '제작중']);
        } else if (currentOrderStatus === '완료됨') {
            query = query.in('status', ['완료됨', '완료', '구매확정']);
        } else if (currentOrderStatus === '배송') {
            query = query.in('status', ['발송완료', '배송완료']);
        } else if (currentOrderStatus === '취소요청') {
            query = query.eq('status', '취소요청');
        } else if (currentOrderStatus === '주문취소') {
            query = query.eq('status', '취소됨').eq('payment_status', '주문취소');
        } else if (currentOrderStatus === '취소됨') {
            query = query.eq('status', '취소됨').eq('payment_status', '환불완료');
        } else if (currentOrderStatus === '환불대기') {
            query = query.eq('status', '취소됨').in('payment_status', ['환불대기', '본사승인']);
        } else if (currentOrderStatus === '환불실패') {
            query = query.eq('status', '취소됨').eq('payment_status', '환불실패');
        }

        if (deliveryDateFilter) query = query.eq('delivery_target_date', deliveryDateFilter);
        if (orderDateFilter) query = query.gte('created_at', orderDateFilter + 'T00:00:00').lte('created_at', orderDateFilter + 'T23:59:59');
        if (searchKeyword) {
            const isNum = /^\d+$/.test(searchKeyword);
            if (isNum) {
                query = query.or(`manager_name.ilike.%${searchKeyword}%,phone.ilike.%${searchKeyword}%,depositor_name.ilike.%${searchKeyword}%,id.eq.${searchKeyword}`);
            } else {
                query = query.or(`manager_name.ilike.%${searchKeyword}%,phone.ilike.%${searchKeyword}%,depositor_name.ilike.%${searchKeyword}%`);
            }
        }
        if (siteFilter !== 'all') query = query.eq('site_code', siteFilter);
        if (managerFilter === 'none') query = query.is('staff_manager_id', null);
        else if (managerFilter !== 'all') query = query.eq('staff_manager_id', managerFilter);

        const from = (currentPage - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;
        const { data, error, count } = await query.range(from, to);

        if (error) throw error;

        // 페이징 UI
        const pageLabel = document.getElementById('pageLabel');
        if(pageLabel) pageLabel.innerText = `Page ${currentPage} / ${Math.ceil((count||0)/itemsPerPage) || 1}`;
        const sumCount = document.getElementById('sumCount');
        if(sumCount) sumCount.innerText = (count || 0) + '건';
        // 매출 합계 (현재 페이지 기준)
        const sumRevenue = document.getElementById('sumRevenue');
        if(sumRevenue && data) {
            const total = data.reduce((acc, o) => acc + (o.total_amount || 0), 0);
            sumRevenue.innerText = total.toLocaleString() + '원';
        }

        tbody.innerHTML = '';
        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" style="text-align:center; padding:30px;">주문이 없습니다.</td></tr>';
            if(sumRevenue) sumRevenue.innerText = '0원';
            showLoading(false); return;
        }

        data.forEach(order => {
            const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
            const total = order.total_amount || 0;
            const site = order.site_code || 'KR';

            // 통화 변환 헬퍼 (DB는 KRW 기준 저장)
            const currRates = { KR: 1, JP: 0.1, US: 0.001, CN: 0.05, AR: 0.001, ES: 0.001, DE: 0.001, FR: 0.001, STORE: 1, GODO: 1 };
            const currSymbols = { KR: '', JP: '¥', US: '$', CN: '¥', AR: '﷼', ES: '€', STORE: '', GODO: '' };
            const rate = currRates[site] || 1;
            const sym = currSymbols[site] || '';
            const fmtAmt = (krw) => {
                const v = site === 'ES' ? (krw * rate).toFixed(2) : Math.round(krw * rate);
                if (site === 'KR' || site === 'STORE' || site === 'GODO') return Number(v).toLocaleString();
                if (site === 'AR') return `${Number(v).toLocaleString()} ﷼`;
                return `${sym}${Number(v).toLocaleString()}`;
            };
            
            // [스태프 선택] 배경색 꽉 차게 변경된 함수 사용
            const managerOpts = createStaffSelectHTML(order.id, 'manager', order.staff_manager_id);
            const driverOpts = createStaffSelectHTML(order.id, 'driver', order.staff_driver_id);

            // 날짜 (월.일 + 배송일)
            const d = new Date(order.created_at);
            const orderDate = `${d.getMonth() + 1}.${d.getDate()}.`;
            let deliveryHtml = '';
            if (order.delivery_target_date) {
                const dd = new Date(order.delivery_target_date);
                const delDate = `${dd.getMonth() + 1}.${dd.getDate()}`;
                deliveryHtml = `<div style="font-size:11px; color:#e11d48; font-weight:bold; margin-top:2px; letter-spacing:-0.5px; cursor:pointer; text-decoration:underline dotted;" onclick="event.stopPropagation(); openDeliveryDateEdit('${order.id}','${order.delivery_target_date}')" title="클릭하여 배송일 변경">(배)${delDate}</div>`;
            } else {
                deliveryHtml = `<div style="font-size:10px; color:#94a3b8; cursor:pointer; margin-top:2px;" onclick="event.stopPropagation(); openDeliveryDateEdit('${order.id}','')" title="배송일 지정">+배송일</div>`;
            }

            // ═══ [결제 칼럼] 결제수단 + 결제확인 상태만 표시 ═══
            const pmLower = (order.payment_method || '').toLowerCase();
            const isEasyPay = pmLower.includes('카카오') || pmLower.includes('네이버') || pmLower.includes('토스페이') || pmLower.includes('삼성페이') || pmLower.includes('애플페이') || pmLower.includes('페이');
            const isGodo = pmLower.includes('고도몰');
            const isCard = pmLower.includes('카드') || pmLower.includes('card') || pmLower.includes('stripe') || pmLower.includes('간편결제') || isEasyPay || isGodo;
            const isBank = pmLower.includes('무통장') || pmLower.includes('bank');
            const isDeposit = pmLower.includes('예치금');
            const depositor = order.depositor_name || order.depositor || '';
            const isPaid = order.payment_status === '결제완료' || order.payment_status === '입금확인';

            let payHtml = '';
            if (isCard) {
                let label = '카드';
                if (pmLower.includes('stripe')) label = 'Stripe';
                else if (pmLower.includes('카카오')) label = '카카오페이';
                else if (pmLower.includes('네이버')) label = '네이버페이';
                else if (pmLower.includes('토스페이')) label = '토스페이';
                else if (pmLower.includes('삼성페이')) label = '삼성페이';
                else if (pmLower.includes('애플페이')) label = '애플페이';
                else if (pmLower.includes('고도몰')) label = '고도몰';
                payHtml = `<div style="font-size:11px;font-weight:bold;color:#2563eb;">💳 ${label}</div>`;
                payHtml += isPaid
                    ? `<div style="font-size:10px;color:#15803d;font-weight:bold;">승인완료</div>`
                    : `<div style="font-size:10px;color:#ef4444;">미결제</div>`;
            } else if (isDeposit) {
                payHtml = `<div style="font-size:11px;font-weight:bold;color:#7c3aed;">💰 예치금</div>`;
                if (isPaid) payHtml += `<div style="font-size:10px;color:#15803d;">확인</div>`;
            } else if (isBank) {
                payHtml = `<div style="font-size:11px;font-weight:bold;color:#d97706;">🏦 무통장</div>`;
                if (depositor) payHtml += `<div style="font-size:10px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55px;" title="${depositor}">${depositor}</div>`;
            } else {
                payHtml = `<div style="font-size:10px;color:#94a3b8;">-</div>`;
            }
            // 미결제 + 취소/요청 아닌 주문 → 입금/취소 버튼
            if (!isPaid && order.status !== '취소됨' && order.status !== '취소요청') {
                if (currentOrderStatus === '입금대기') {
                    payHtml += `<button class="btn" style="width:100%;margin-top:4px;font-size:12px;padding:6px 4px;font-weight:bold;border-radius:6px;background:#15803d;color:#fff;" onclick="openDepositModal('${order.id}','${(order.manager_name||'').replace(/'/g,"\\'")}',${order.total_amount||0})">입금 / 취소</button>`;
                } else {
                    payHtml += `<button class="btn btn-sm" style="width:100%;margin-top:2px;font-size:10px;padding:1px 3px;background:#15803d;color:#fff;" onclick="openDepositModal('${order.id}','${(order.manager_name||'').replace(/'/g,"\\'")}',${order.total_amount||0})">입금/취소</button>`;
                }
            } else if (isPaid && !isCard) {
                payHtml += `<div style="font-size:10px;color:#15803d;font-weight:bold;">확인됨</div>`;
            }
            // ★ 증빙 뱃지
            if (order.receipt_info && order.receipt_info.type && order.receipt_info.type !== 'none') {
                const ri = order.receipt_info;
                const rl = ri.type === 'tax_invoice' ? '📄세금계산서' : '🧾현금영수증';
                payHtml += `<div style="font-size:9px;color:#7c3aed;cursor:pointer;text-decoration:underline;margin-top:2px;" onclick="event.stopPropagation();window.openReceiptInfo('${order.id}')">${rl}</div>`;
            }

            // ═══ [상태 칼럼] 주문 진행상태만 깔끔하게 ═══
            let statusHtml = '';
            const st = order.status;
            if (st === '접수됨' || st === '파일처리중' || st === '접수대기' || st === '제작준비') {
                statusHtml = `<span class="badge" style="background:#dbeafe;color:#1d4ed8;font-weight:bold;">접수됨</span>`;
            } else if (st === '칼선작업' || st === '제작중') {
                statusHtml = `<span class="badge" style="background:#fef3c7;color:#92400e;font-weight:bold;">🔨 제작중</span>`;
            } else if (st === '완료됨' || st === '완료' || st === '구매확정') {
                statusHtml = `<span class="badge" style="background:#dcfce7;color:#15803d;font-weight:bold;">✅ 완료</span>`;
            } else if (st === '발송완료') {
                statusHtml = `<span class="badge" style="background:#d1fae5;color:#065f46;font-weight:bold;">🚚 발송</span>`;
            } else if (st === '배송완료') {
                statusHtml = `<span class="badge" style="background:#a7f3d0;color:#064e3b;font-weight:bold;">📦 배송완료</span>`;
            } else if (st === '취소요청') {
                statusHtml = `<span class="badge" style="background:#fff7ed;color:#ea580c;font-weight:bold;border:1px solid #fed7aa;">❌ 취소요청</span>`;
            } else if (st === '취소됨') {
                const refSt = order.payment_status;
                if (refSt === '환불완료') {
                    statusHtml = `<span class="badge" style="background:#f0fdf4;color:#15803d;font-weight:bold;border:1px solid #bbf7d0;">✅ 환불완료</span>`;
                } else if (refSt === '환불대기') {
                    statusHtml = `<span class="badge" style="background:#fffbeb;color:#d97706;font-weight:bold;border:1px solid #fde68a;">⏳ 환불대기</span>`;
                } else if (refSt === '본사승인') {
                    statusHtml = `<span class="badge" style="background:#dbeafe;color:#1d4ed8;font-weight:bold;border:1px solid #93c5fd;">✅ 본사승인</span>`;
                } else if (refSt === '환불실패') {
                    statusHtml = `<span class="badge" style="background:#fef2f2;color:#dc2626;font-weight:bold;border:1px solid #fecaca;">❌ 환불실패</span>`;
                } else if (refSt === '주문취소') {
                    statusHtml = `<span class="badge" style="background:#fee2e2;color:#dc2626;font-weight:bold;border:1px solid #fecaca;">🚫 주문취소</span>`;
                } else {
                    statusHtml = `<span class="badge" style="background:#fee2e2;color:#dc2626;">취소됨</span>`;
                }
            } else {
                statusHtml = `<span class="badge">${st}</span>`;
            }

            // [고객소통] 소통 요청/완료 상태 + 고액주문 뱃지
            let contactHtml = '';
            const isHighValue = total >= HIGH_VALUE_THRESHOLD;
            const isContactReq = hasContactRequest(order.admin_note);
            const isContactDone = hasContactDone(order.admin_note);

            if (isHighValue && !isContactReq && !isContactDone) {
                contactHtml += `<div style="margin-bottom:3px;"><span style="display:inline-block;font-size:9px;font-weight:bold;background:linear-gradient(135deg,#f59e0b,#ef4444);color:#fff;padding:1px 5px;border-radius:8px;animation:pulse-badge 1.5s infinite;">💎 고액</span></div>`;
            }
            const isHqProcessing = isContactDone && (order.admin_note || '').includes('[본사처리');
            if (isContactReq) {
                // admin_note에서 매니저 이름 추출
                const mgrMatch = (order.admin_note || '').match(/\[소통요청[^\]]*\]\s*(아무나|은미|성희|지숙)매니저/);
                const reqMgr = mgrMatch ? mgrMatch[1] : '';
                const reqLabel = reqMgr === '아무나' ? '아무나 소통요청' : reqMgr ? reqMgr + '님 소통요청' : '📞 소통중';
                contactHtml += `<button class="btn" style="width:100%;font-size:9px;padding:2px 4px;background:#ef4444;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer;margin-bottom:2px;line-height:1.3;" onclick="event.stopPropagation();completeContact('${order.id}')">${reqLabel}</button>`;
            } else if (isContactDone && isHqProcessing) {
                contactHtml += `<div style="font-size:9px;color:#0369a1;font-weight:bold;background:#e0f2fe;padding:2px 4px;border-radius:4px;margin-bottom:2px;line-height:1.3;">🏢 본사처리중</div>`;
            } else if (isContactDone) {
                contactHtml += `<div style="font-size:9px;color:#15803d;font-weight:bold;">✅ 소통완료</div>`;
            }
            if (!isContactReq) {
                contactHtml += `<button class="btn btn-outline" style="width:100%;font-size:9px;padding:1px 3px;border-radius:4px;color:#7c3aed;border-color:#c4b5fd;cursor:pointer;" onclick="event.stopPropagation();requestContact('${order.id}')">📞 소통요청</button>`;
            }

            // [파일 버튼] — 파일 없으면 경고 표시 (_error_log 제외)
            const fCount = order.files ? order.files.filter(f => f.type !== '_error_log').length : 0;
            const fileIcon = fCount === 0 ? '⚠️' : '📂';
            const fileBtnStyle = fCount === 0 ? 'width:100%; padding:2px 0; font-size:12px; height:24px; background:#fef2f2; border-color:#fca5a5; color:#dc2626;' : 'width:100%; padding:2px 0; font-size:12px; height:24px;';
            const fileBtn = `<button class="btn btn-outline" style="${fileBtnStyle}" onclick="openFileModal('${order.id}')" title="파일목록">${fileIcon} ${fCount}</button>`;
            const zipBtn = fCount > 0 ? `<button class="btn btn-outline" style="width:100%; padding:2px 0; font-size:12px; height:24px; margin-top:2px; background:#f0fdf4; border-color:#86efac;" onclick="autoDownloadOrder('${order.id}')" title="ZIP 다운로드">📦 ZIP</button>` : '';
            const addBtn = `<label class="btn btn-sky" style="width:100%; padding:2px 0; font-size:12px; height:24px; margin-top:2px; display:inline-flex; align-items:center; justify-content:center; cursor:pointer;" title="파일추가"><i class="fa-solid fa-plus"></i><input type="file" style="display:none;" onchange="uploadFileDirect('${order.id}', this)"></label>`;

            // [렌더링]
            tbody.innerHTML += `
                <tr>
                    <td style="text-align:center;"><input type="checkbox" class="row-chk" value="${order.id}"></td>
                    <td style="text-align:center;"><span class="badge-site ${site.toLowerCase()}" style="cursor:pointer;" onclick="fixSiteCode('${order.id}')" title="클릭하여 변경">${site === 'STORE' ? '스토어' : site === 'GODO' ? '고도몰' : site}</span>${(pmLower.includes('stripe') && site === 'KR') ? '<div style="font-size:9px;color:#ef4444;">⚠️오류?</div>' : ''}</td>
                    <td style="text-align:center; line-height:1.2;">
                        <span style="color:#334155;">${orderDate}</span>
                        ${deliveryHtml}
                    </td>
                    <td><b style="cursor:pointer;color:#4f46e5;text-decoration:underline;" onclick="openCustomerInfo('${order.user_id || ''}','${(order.manager_name||'').replace(/'/g,"\\'")}','${order.phone||''}')">${order.manager_name}</b><br><span style="font-size:11px; color:#666;">${order.phone}</span></td>
                    
                    <td style="text-align:center; font-size:12px; color:#64748b; font-weight:bold; position:relative;">
                        <div>${order.id}</div>
                        <div style="cursor:pointer;margin-top:2px;" onclick="event.stopPropagation();openOrderMemo('${order.id}')" title="${(order.admin_note||'').replace(/"/g,'&quot;').replace(/\n/g,' ')}">
                            ${order.admin_note ? '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:#ef4444;color:#fff;font-size:10px;line-height:18px;text-align:center;font-weight:bold;">✉</span>' : '<span style="font-size:14px;opacity:0.3;">💬</span>'}
                        </div>
                    </td>
                    
                    <td style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${items.length ? items.map(i => `${i.productName || '상품'} (${i.qty})`).join(', ') : '주문 내역 없음'}">${items.length ? items.map(i => `<div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">- ${i.productName || '상품'} (${i.qty})</div>`).join('') : '<div style="color:#ef4444;font-weight:bold;">⚠️ 내역없음</div>'}</td>
                    
                    <td style="text-align:right;">${fmtAmt(total)}</td>
                    <td style="text-align:right; color:#ef4444;">${fmtAmt(order.discount_amount || 0)}</td>
                    <td style="text-align:right; color:#d97706;">${fmtAmt(order.used_deposit || 0)}</td>
                    <td style="text-align:right; font-weight:bold; color:#15803d;">${fmtAmt(order.actual_payment || total)}</td>
                    <td>${managerOpts} <div style="margin-top:2px;">${driverOpts}</div></td>
                    
                    <td style="padding:2px 4px;">${fileBtn}${zipBtn}${addBtn}</td>

                    <td style="text-align:center; line-height:1.3; padding:2px;">${payHtml}</td>
                    <td style="text-align:center; padding:2px;">${statusHtml}</td>
                    <td style="text-align:center; padding:2px; min-width:60px;">${contactHtml}</td>
                </tr>`;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="14" style="text-align:center; color:red;">${e.message}</td></tr>`;
    } finally {
        showLoading(false);
        updateCancelReqBadge();
    }
};
function createStaffSelectHTML(orderId, role, selectedId) {
    let opts = `<option value="">미지정</option>`;
    
    // 기본 스타일 (미지정 상태)
    let style = `background-color: #ffffff; color: #334155; border: 1px solid #e2e8f0;`;

    const filteredStaff = staffList.filter(s => s.role === role);
    
    filteredStaff.forEach(s => {
        const isSelected = String(s.id) === String(selectedId);
        if (isSelected && s.color) {
            // 선택된 스태프가 있으면 배경색을 스태프 색상으로, 글자는 흰색으로 변경
            style = `background-color: ${s.color}; color: #ffffff; border: 1px solid ${s.color}; font-weight:bold;`;
        }
        opts += `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${s.name}</option>`;
    });

    // this를 넘겨서 요소 자체를 제어함
    return `<select class="staff-select" style="${style}" onchange="updateOrderStaff('${orderId}', '${role}', this)">
                ${opts}
            </select>`;
}
// [사이트 코드 수정] 관리자가 site_code를 직접 변경
window.fixSiteCode = async (orderId) => {
    const newCode = prompt('사이트 코드 변경 (KR / JP / US / STORE / GODO):', '');
    if (!newCode) return;
    const code = newCode.trim().toUpperCase();
    if (!['KR', 'JP', 'US', 'CN', 'AR', 'ES', 'STORE', 'GODO'].includes(code)) { showToast('KR, JP, US, STORE, GODO 등 입력', "warn"); return; }
    const { error } = await sb.from('orders').update({ site_code: code }).eq('id', orderId);
    if (error) { showToast('변경 실패: ' + error.message, "error"); return; }
    showToast(`주문 #${orderId} → ${code} 변경 완료`, "success");
    loadOrders();
};

window.filterOrders = (status, btn) => {
    currentOrderStatus = status;
    // 모든 탭 버튼 비활성화 (2줄 모두)
    document.querySelectorAll('#sec-orders [id^="btnFilter"]').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-outline');
        b.style.fontWeight = '';
    });
    if(btn) {
        btn.classList.remove('btn-outline');
        btn.classList.add('btn-primary');
        btn.style.fontWeight = 'bold';
    }
    currentPage = 1;
    loadOrders();
};

window.toggleAll = (el) => { document.querySelectorAll('.row-chk').forEach(c => c.checked = el.checked); };
window.resetPage = () => { currentPage = 1; };
window.changePage = (step) => { if(currentPage + step > 0) { currentPage += step; loadOrders(); } };

window.updateActionButtons = () => {
    const div = document.getElementById('action-buttons');
    if(!div) return;
    const s = currentOrderStatus;
    if (s === '입금대기') {
        div.innerHTML = `<button class="btn btn-success" onclick="confirmDepositSelected()">일괄 입금처리</button><button class="btn btn-danger" onclick="cancelDepositSelected()">🚫 주문취소</button><button class="btn" onclick="sendFileErrorSelected()" style="background:#f59e0b;color:#fff;font-weight:bold;">⚠️ 파일에러</button>`;
    } else if (s === '결제완료') {
        div.innerHTML = `<button class="btn btn-primary" onclick="changeStatusSelected('칼선작업')">작업시작</button><button class="btn btn-danger" onclick="adminCancelSelected()">❌ 주문취소</button><button class="btn" onclick="sendFileErrorSelected()" style="background:#f59e0b;color:#fff;font-weight:bold;">⚠️ 파일에러</button>`;
    } else if (s === '칼선작업') {
        div.innerHTML = `<button class="btn btn-success" onclick="downloadBulkFiles()">다운로드</button><button class="btn btn-vip" onclick="changeStatusSelected('완료됨')">완료처리</button><button class="btn btn-danger" onclick="adminCancelSelected()">❌ 주문취소</button><button class="btn" onclick="sendFileErrorSelected()" style="background:#f59e0b;color:#fff;font-weight:bold;">⚠️ 파일에러</button>`;
    } else if (s === '완료됨') {
        div.innerHTML = `<button class="btn btn-primary" onclick="changeStatusSelected('발송완료')">발송처리</button><button class="btn btn-danger" onclick="adminCancelSelected()">❌ 주문취소</button>`;
    } else if (s === '배송') {
        div.innerHTML = `<button class="btn btn-outline" onclick="changeStatusSelected('배송완료')">배송완료</button><button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else if (s === '취소요청') {
        div.innerHTML = `<button class="btn btn-success" onclick="approveCancelSelected()" style="font-weight:bold;">💳 카드 취소승인</button><button class="btn" onclick="completeCashRefundSelected()" style="font-weight:bold;background:#d97706;color:white;">💰 현금 환불완료</button><button class="btn btn-outline" onclick="rejectCancelSelected()" style="font-weight:bold;">🔙 취소거절</button>`;
    } else if (s === '주문취소') {
        div.innerHTML = `<button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else if (s === '취소됨') {
        div.innerHTML = `<button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else if (s === '환불대기') {
        div.innerHTML = `<button class="btn btn-success" onclick="approveRefundHQ()" style="font-weight:bold;">✅ 본사승인 (카드=PG환불, 무통장=승인만)</button><button class="btn" onclick="completeRefundSelected()" style="font-weight:bold;background:#2563eb;color:white;">💰 환불완료 (경리팀 송금 후)</button><button class="btn btn-outline" onclick="rejectRefundSelected()" style="font-weight:bold;">🔙 환불거절</button>`;
    } else if (s === '환불실패') {
        div.innerHTML = `<button class="btn btn-warning" onclick="retryRefundSelected()" style="background:#dc2626;color:white;">🔄 환불 재시도</button><button class="btn btn-danger" onclick="deleteOrdersSelected(true)">영구삭제</button>`;
    } else {
        // 전체 탭
        div.innerHTML = `<button class="btn btn-danger" onclick="adminCancelSelected()">❌ 주문취소</button><button class="btn" onclick="sendFileErrorSelected()" style="background:#f59e0b;color:#fff;font-weight:bold;">⚠️ 파일에러</button><button class="btn btn-danger" onclick="deleteOrdersSelected(true)" style="margin-left:4px;">선택 삭제</button>`;
    }
    // 모든 탭에 공통 버튼 추가
    div.innerHTML += `<button class="btn" onclick="manualDownloadSelected()" style="background:#0ea5e9;color:white;margin-left:6px;">📥 수동다운</button>`;
    div.innerHTML += `<button class="btn" onclick="photoUploadSelected()" style="background:#10b981;color:white;margin-left:4px;">📷 제작사진</button>`;
    div.innerHTML += `<button class="btn" onclick="inquirySelected()" style="background:#8b5cf6;color:white;margin-left:4px;">💬 문의답변</button>`;
};

window.photoUploadSelected = () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length !== 1) { showToast("사진 업로드할 주문 1건만 선택하세요.", "warn"); return; }
    window.openProductionPhotoUpload(parseInt(ids[0]));
};

window.inquirySelected = () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length !== 1) { showToast("문의 답변할 주문 1건만 선택하세요.", "warn"); return; }
    window.openAdminInquiryPanel(parseInt(ids[0]));
};

window.changeStatusSelected = async (status) => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if(ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    await sb.from('orders').update({ status }).in('id', ids);

    // ★ 완료 상태 전환 시 작품 판매 수익 정산 (partner_settlements → 예치금 지급)
    const completedStates = ['완료됨', '발송완료', '배송완료', '구매확정'];
    if (completedStates.includes(status)) {
        for (const orderId of ids) {
            try { await processArtworkSettlement(orderId); } catch(e) { console.error('정산 실패:', orderId, e); }
        }
    }

    loadOrders();
};

// ★ 작품 판매 수익 정산: partner_settlements에서 pending 건 찾아 예치금 지급
async function processArtworkSettlement(orderId) {
    const { data: settlements } = await sb.from('partner_settlements')
        .select('*')
        .eq('order_id', orderId)
        .eq('settlement_status', 'pending');
    if (!settlements || settlements.length === 0) return;

    for (const s of settlements) {
        const commissionKRW = s.commission_amount || 0;
        if (commissionKRW <= 0 || !s.partner_id) continue;

        // 1. 파트너 예치금 증가
        const { data: pf } = await sb.from('profiles').select('deposit').eq('id', s.partner_id).single();
        if (!pf) continue;
        const newDeposit = (pf.deposit || 0) + commissionKRW;
        await sb.from('profiles').update({ deposit: newDeposit }).eq('id', s.partner_id);

        // 2. 거래 내역 기록
        await sb.from('wallet_logs').insert({
            user_id: s.partner_id,
            type: 'artwork_revenue',
            amount: commissionKRW,
            description: `작품 판매 수익 (주문: ${orderId}, 상품: ${s.item_code || ''})`
        });

        // 3. 정산 완료 처리
        await sb.from('partner_settlements').update({
            settlement_status: 'completed'
        }).eq('id', s.id);
    }
    console.log(`✅ 주문 ${orderId} 작품 정산 완료 (${settlements.length}건)`);
}

// [환불 헬퍼] 단건 환불 처리 — 여러 함수에서 공유
async function refundSingleOrder(id, reason = '관리자 취소') {
    const { data: order } = await sb.from('orders')
        .select('payment_method, toss_payment_key, total_amount, discount_amount, user_id')
        .eq('id', id).single();
    if (!order) throw new Error('주문 조회 실패');

    const pm = (order.payment_method || '').toLowerCase();
    const isCard = pm.includes('카드') || pm.includes('card') || pm.includes('간편') || pm.includes('페이') || pm.includes('pay');
    const isStripe = pm.includes('stripe');
    const isDeposit = pm.includes('예치금');
    let newPaymentStatus = '환불완료';

    // PG 환불
    if ((isCard || isStripe) && order.toss_payment_key) {
        if (isStripe) {
            const { data, error } = await sb.functions.invoke('cancel-stripe-payment', {
                body: { session_id: order.toss_payment_key, cancelReason: reason }
            });
            if (error || (data && data.error)) throw new Error((data && data.error) || error?.message);
        } else {
            const { data, error } = await sb.functions.invoke('cancel-toss-payment', {
                body: { paymentKey: order.toss_payment_key, cancelReason: reason }
            });
            if (error || (data && data.error)) throw new Error((data && data.error) || error?.message);
        }
    } else if ((isCard || isStripe) && !order.toss_payment_key) {
        // 결제 시도 중 중단된 건 — PG 결제가 완료되지 않았으므로 환불 불필요
        newPaymentStatus = '환불완료';
    } else if (isDeposit && order.user_id) {
        const { data: pf } = await sb.from('profiles').select('deposit').eq('id', order.user_id).single();
        if (pf) {
            await sb.from('profiles').update({ deposit: (pf.deposit || 0) + (order.total_amount || 0) }).eq('id', order.user_id);
            await sb.from('wallet_logs').insert({
                user_id: order.user_id, type: 'refund_cancel',
                amount: order.total_amount || 0,
                description: `${reason} 환불 (주문번호: ${id})`
            });
        }
    } else {
        newPaymentStatus = '환불대기';
    }

    // 마일리지 복원
    if (order.discount_amount > 0 && order.user_id) {
        const { data: pf } = await sb.from('profiles').select('mileage').eq('id', order.user_id).single();
        if (pf) {
            await sb.from('profiles').update({ mileage: (pf.mileage || 0) + order.discount_amount }).eq('id', order.user_id);
            await sb.from('wallet_logs').insert({
                user_id: order.user_id, type: 'refund_mileage',
                amount: order.discount_amount,
                description: `${reason} 마일리지 복원 (주문번호: ${id})`
            });
        }
    }

    return newPaymentStatus;
}

// [취소승인] 취소요청 탭에서 환불 처리
window.approveCancelSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 취소를 승인하고 환불을 진행하시겠습니까?`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            const newPaymentStatus = await refundSingleOrder(id, '취소 승인');
            await sb.from('orders').update({ status: '취소됨', payment_status: newPaymentStatus }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} refund error:`, e);
            await sb.from('orders').update({ status: '취소됨', payment_status: '환불실패' }).eq('id', id);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`취소승인 완료: 성공 ${successCount}건${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [취소거절] 취소요청을 접수됨으로 복원
window.rejectCancelSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 취소 요청을 거절하시겠습니까?\n주문이 '접수됨' 상태로 복원됩니다.`)) return;

    await sb.from('orders').update({ status: '접수됨' }).in('id', ids);
    showToast(`${ids.length}건 취소 거절 처리 완료`, 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [관리자 직접 취소] 선택된 주문을 관리자가 직접 취소 (카드=PG환불, 현금/무통장=상태만 변경)
window.adminCancelSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }

    // 선택 주문의 결제수단 확인
    const { data: orders } = await sb.from('orders')
        .select('id, payment_method, toss_payment_key, total_amount')
        .in('id', ids);

    let cardCount = 0, cashCount = 0;
    if (orders) {
        orders.forEach(o => {
            const pm = (o.payment_method || '').toLowerCase();
            if (pm.includes('카드') || pm.includes('card') || pm.includes('stripe')) cardCount++;
            else cashCount++;
        });
    }

    let msg = `주문취소를 누르면 카드사에 자동환불을 요청합니다.\n${ids.length}건의 주문을 취소하시겠습니까?`;
    if (cashCount > 0) msg += `\n\n💰 현금/무통장 ${cashCount}건은 별도 환불이 필요합니다.`;

    if (!confirm(msg)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            const newPaymentStatus = await refundSingleOrder(id, '관리자 직접 취소');
            await sb.from('orders').update({ status: '취소됨', payment_status: newPaymentStatus }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} cancel error:`, e);
            // 카드 환불 실패 시
            await sb.from('orders').update({ status: '취소됨', payment_status: '환불실패' }).eq('id', id);
            failCount++;
        }
    }
    showLoading(false);

    let resultMsg = `주문취소 완료: 성공 ${successCount}건`;
    if (failCount > 0) resultMsg += `, 환불실패 ${failCount}건 (환불실패 탭에서 재시도)`;
    showToast(resultMsg, failCount > 0 ? 'warn' : 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [현금 환불완료] 무통장/현금 주문 — 관리자가 직접 송금 후 완료 처리 (PG 호출 없음)
window.completeCashRefundSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건을 현금 환불완료 처리하시겠습니까?\n(이미 고객에게 송금을 완료한 후 눌러주세요)`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            // 마일리지 복원만 처리 (PG 환불 없음)
            const { data: order } = await sb.from('orders').select('discount_amount, user_id').eq('id', id).single();
            if (order && order.discount_amount > 0 && order.user_id) {
                const { data: pf } = await sb.from('profiles').select('mileage').eq('id', order.user_id).single();
                if (pf) {
                    await sb.from('profiles').update({ mileage: (pf.mileage || 0) + order.discount_amount }).eq('id', order.user_id);
                    await sb.from('wallet_logs').insert({
                        user_id: order.user_id, type: 'refund_mileage',
                        amount: order.discount_amount,
                        description: `현금 환불완료 마일리지 복원 (주문번호: ${id})`
                    });
                }
            }
            await sb.from('orders').update({ status: '취소됨', payment_status: '환불완료' }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} cash refund error:`, e);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`현금 환불완료: ${successCount}건 처리${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [환불 재시도] 환불실패 건 재처리
window.retryRefundSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 환불을 재시도하시겠습니까?`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            const newPaymentStatus = await refundSingleOrder(id, '환불 재시도');
            await sb.from('orders').update({ payment_status: newPaymentStatus }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} retry refund error:`, e);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`환불 재시도: 성공 ${successCount}건${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    loadOrders();
};

// [본사승인] 환불대기 건에 대해 PG 환불 API 호출 (카드) 또는 상태만 변경 (현금)
window.approveRefundHQ = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건을 본사승인 처리하시겠습니까?\n(카드 결제건은 PG 환불이 자동 진행됩니다)`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            const { data: order } = await sb.from('orders')
                .select('payment_status, payment_method, toss_payment_key, total_amount, user_id')
                .eq('id', id).single();
            if (!order || order.payment_status !== '환불대기') continue;

            const pm = (order.payment_method || '').toLowerCase();
            const isCard = pm.includes('카드') || pm.includes('card') || pm.includes('간편') || pm.includes('페이') || pm.includes('pay');
            const isStripe = pm.includes('stripe');

            // 카드/간편결제건: PG 환불 API 호출
            if ((isCard || isStripe) && order.toss_payment_key) {
                try {
                    if (isStripe) {
                        const { data, error } = await sb.functions.invoke('cancel-stripe-payment', {
                            body: { session_id: order.toss_payment_key, cancelReason: '본사승인 환불' }
                        });
                        if (error || (data && data.error)) throw new Error((data && data.error) || error?.message);
                    } else {
                        const { data, error } = await sb.functions.invoke('cancel-toss-payment', {
                            body: { paymentKey: order.toss_payment_key, cancelReason: '본사승인 환불' }
                        });
                        if (error || (data && data.error)) throw new Error((data && data.error) || error?.message);
                    }
                    // PG 취소 성공 → 바로 환불완료 + 마일리지 복원
                    if (order.discount_amount > 0 && order.user_id) {
                        try {
                            const { data: pf } = await sb.from('profiles').select('mileage').eq('id', order.user_id).single();
                            if (pf) {
                                await sb.from('profiles').update({ mileage: (pf.mileage || 0) + order.discount_amount }).eq('id', order.user_id);
                                await sb.from('wallet_logs').insert({
                                    user_id: order.user_id, type: 'refund_mileage',
                                    amount: order.discount_amount,
                                    description: `환불완료 마일리지 복원 (주문번호: ${id})`
                                });
                            }
                        } catch(me) { console.error('마일리지 복원 오류:', me); }
                    }
                    await sb.from('orders').update({ payment_status: '환불완료', status: '취소됨' }).eq('id', id);
                    successCount++;
                } catch (pgErr) {
                    console.error(`Order ${id} PG refund error:`, pgErr);
                    await sb.from('orders').update({ payment_status: '환불실패' }).eq('id', id);
                    failCount++;
                }
            } else {
                // 현금/무통장/예치금/기타: 본사승인 상태로 변경 (경리팀이 환불완료 별도 처리)
                await sb.from('orders').update({ payment_status: '본사승인' }).eq('id', id);
                successCount++;
            }
        } catch (e) {
            console.error(`Order ${id} approve error:`, e);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`환불처리: ${successCount}건 완료${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [환불완료] 본사승인 건에 대해 최종 환불완료 처리 + 마일리지 복원
window.completeRefundSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건을 환불완료 처리하시겠습니까?\n(경리팀 확인 후 눌러주세요)`)) return;

    showLoading(true);
    let successCount = 0, failCount = 0;
    for (const id of ids) {
        try {
            const { data: order } = await sb.from('orders')
                .select('payment_status, discount_amount, user_id')
                .eq('id', id).single();
            if (!order || order.payment_status !== '본사승인') {
                showToast(`주문 ${id}: 본사승인 상태가 아닙니다.`, 'warn');
                continue;
            }

            // 마일리지 복원
            if (order.discount_amount > 0 && order.user_id) {
                const { data: pf } = await sb.from('profiles').select('mileage').eq('id', order.user_id).single();
                if (pf) {
                    await sb.from('profiles').update({ mileage: (pf.mileage || 0) + order.discount_amount }).eq('id', order.user_id);
                    await sb.from('wallet_logs').insert({
                        user_id: order.user_id, type: 'refund_mileage',
                        amount: order.discount_amount,
                        description: `환불완료 마일리지 복원 (주문번호: ${id})`
                    });
                }
            }

            await sb.from('orders').update({ payment_status: '환불완료' }).eq('id', id);
            successCount++;
        } catch (e) {
            console.error(`Order ${id} complete refund error:`, e);
            failCount++;
        }
    }
    showLoading(false);
    showToast(`환불완료: ${successCount}건 처리${failCount > 0 ? `, 실패 ${failCount}건` : ''}`, failCount > 0 ? 'warn' : 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [환불거절] 환불대기 건을 접수됨+결제완료로 복원
window.rejectRefundSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건의 환불 요청을 거절하시겠습니까?\n주문이 '접수됨/결제완료' 상태로 복원됩니다.`)) return;

    showLoading(true);
    for (const id of ids) {
        try {
            const { data: order } = await sb.from('orders')
                .select('payment_status').eq('id', id).single();
            if (!order || order.payment_status !== '환불대기') continue;
            await sb.from('orders').update({ status: '접수됨', payment_status: '결제완료' }).eq('id', id);
        } catch (e) {
            console.error(`Order ${id} reject refund error:`, e);
        }
    }
    showLoading(false);
    showToast(`${ids.length}건 환불거절 처리 완료`, 'success');
    updateCancelReqBadge();
    loadOrders();
};

// [뱃지 카운트 업데이트] — 취소요청 + 입금대기
async function updateCancelReqBadge() {
    try {
        // 취소요청 카운트
        const { count: cancelCount } = await sb.from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', '취소요청');
        const badge = document.getElementById('cancelReqCount');
        if (badge) {
            badge.textContent = cancelCount || 0;
            badge.style.display = (cancelCount > 0) ? 'inline' : 'none';
        }
        // 입금대기 카운트
        const { count: depositCount } = await sb.from('orders')
            .select('id', { count: 'exact', head: true })
            .in('status', ['접수됨', '파일처리중', '접수대기', '제작준비'])
            .not('payment_status', 'in', '("결제완료","입금확인")');
        const dBadge = document.getElementById('depositWaitCount');
        if (dBadge) {
            dBadge.textContent = depositCount || 0;
            dBadge.style.display = (depositCount > 0) ? 'inline' : 'none';
        }
        // 환불대기 카운트 (환불대기 + 본사승인)
        const { count: refundWaitCount } = await sb.from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', '취소됨')
            .in('payment_status', ['환불대기', '본사승인']);
        const rwBadge = document.getElementById('refundWaitCount');
        if (rwBadge) {
            rwBadge.textContent = refundWaitCount || 0;
            rwBadge.style.display = (refundWaitCount > 0) ? 'inline' : 'none';
        }
        // 고객소통 요청 카운트
        const { count: contactCount } = await sb.from('orders')
            .select('id', { count: 'exact', head: true })
            .like('admin_note', '%##CONTACT_REQ##%')
            .not('status', 'in', '("취소됨","임시작성","관리자차단")');
        const cBadge = document.getElementById('contactReqCount');
        if (cBadge) {
            cBadge.textContent = contactCount || 0;
            cBadge.style.display = (contactCount > 0) ? 'inline' : 'none';
        }
        const cbBadge = document.getElementById('callbackBadge');
        if (cbBadge) {
            cbBadge.textContent = contactCount || 0;
            cbBadge.style.display = (contactCount > 0) ? 'inline' : 'none';
        }
    } catch (e) { /* ignore */ }
}
window.updateCancelReqBadge = updateCancelReqBadge;

// [일괄 입금처리] 입금대기 탭에서 사용
window.confirmDepositSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if (!confirm(`${ids.length}건을 입금처리 하시겠습니까?`)) return;
    for (const id of ids) {
        await sb.from('orders').update({ payment_status: '결제완료' }).eq('id', id);
        await creditReferralBonus(id);
    }
    showToast(`${ids.length}건 입금처리 완료`, 'success');
    loadOrders();
};

// ★ 공통 모달 — 사유 입력 팝업
function _showReasonModal(title, emoji, placeholder, btnText, btnColor) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:20000;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
            <div style="background:#fff;border-radius:16px;padding:28px;width:440px;max-width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <h3 style="margin:0 0 6px;font-size:18px;">${emoji} ${title}</h3>
                <p style="margin:0 0 16px;font-size:13px;color:#64748b;">고객에게 전달할 메시지를 입력해주세요.</p>
                <textarea id="_reasonInput" rows="3" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;font-size:14px;resize:vertical;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e2e8f0'"></textarea>
                <div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">
                    <button onclick="this.closest('div[style]').parentElement.remove();window._reasonResolve(null);" style="padding:10px 20px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-size:13px;color:#64748b;">닫기</button>
                    <button onclick="window._reasonResolve(document.getElementById('_reasonInput').value);this.closest('div[style]').parentElement.remove();" style="padding:10px 20px;border:none;background:${btnColor};color:#fff;border-radius:8px;cursor:pointer;font-size:13px;font-weight:bold;">${btnText}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        window._reasonResolve = resolve;
        document.getElementById('_reasonInput').focus();
    });
}

// ★ 고객 메시지 전송 헬퍼
async function _sendCustomerMessage(orderId, msgContent) {
    try {
        const { data: order, error: oErr } = await sb.from('orders').select('user_id').eq('id', orderId).single();
        if (oErr) { console.warn('주문 조회 실패:', oErr.message); return; }
        if (order?.user_id) {
            const { error: iErr } = await sb.from('messages').insert({
                user_id: order.user_id,
                sender: 'admin',
                content: msgContent,
                is_read: false
            });
            if (iErr) console.warn('메시지 저장 실패:', iErr.message);
        }
    } catch(e) { console.warn('알림 발송 실패:', e); }
}

// [주문취소] 입금대기 탭 — 결제 취소 + 고객 메시지
window.cancelDepositSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }

    const reason = await _showReasonModal(
        `주문 취소 (${ids.length}건)`, '🚫',
        '예: 입금 미확인으로 자동 취소되었습니다.',
        '주문취소 + 환불처리', '#ef4444'
    );
    if (reason === null) return;

    const cancelMsg = reason.trim() || '주문이 취소되었습니다.';
    let successCount = 0, failCount = 0;

    for (const id of ids) {
        try {
            // PG 결제건이면 자동 환불
            const newPaymentStatus = await refundSingleOrder(id, cancelMsg);
            await sb.from('orders').update({
                status: '취소됨',
                payment_status: newPaymentStatus,
                admin_note: cancelMsg
            }).eq('id', id);
            await _sendCustomerMessage(id, `[주문취소] 주문번호 ${id}\n${cancelMsg}`);
            successCount++;
        } catch(e) {
            console.error(`Order ${id} cancel error:`, e);
            // 결제 환불 실패해도 주문은 취소 처리
            await sb.from('orders').update({
                status: '취소됨',
                payment_status: '주문취소',
                admin_note: cancelMsg
            }).eq('id', id);
            await _sendCustomerMessage(id, `[주문취소] 주문번호 ${id}\n${cancelMsg}`);
            failCount++;
        }
    }
    showToast(`${successCount}건 취소완료${failCount > 0 ? `, ${failCount}건 환불실패(수동처리 필요)` : ''}`, failCount > 0 ? 'warn' : 'success');
    loadOrders();
    updateCancelReqBadge();
};

// [파일에러] 주문 취소 없이 고객에게 파일 오류 메시지만 전송
window.sendFileErrorSelected = async () => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if (ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }

    const msg = await _showReasonModal(
        `파일에러 알림 (${ids.length}건)`, '⚠️',
        '예: 업로드하신 파일의 해상도가 낮습니다. 300dpi 이상의 파일로 다시 업로드해주세요.',
        '파일에러 메시지 전송', '#f59e0b'
    );
    if (msg === null) return;

    const errorMsg = msg.trim() || '업로드하신 파일에 문제가 있습니다. 확인 후 다시 업로드해주세요.';

    let ok = 0;
    for (const id of ids) {
        try {
            // admin_note에 파일에러 기록
            const { data: existing } = await sb.from('orders').select('admin_note').eq('id', id).single();
            const prevNote = existing?.admin_note || '';
            const newNote = prevNote ? `${prevNote}\n[파일에러] ${errorMsg}` : `[파일에러] ${errorMsg}`;
            await sb.from('orders').update({ admin_note: newNote }).eq('id', id);
            await _sendCustomerMessage(id, `[파일에러] 주문번호 ${id}\n${errorMsg}\n\n파일을 수정하여 다시 업로드해주세요.`);
            ok++;
        } catch(e) { console.warn('파일에러 처리 실패:', id, e); }
    }
    showToast(`${ok}건 파일에러 알림 전송 완료`, 'success');
    loadOrders();
};

// ★ 주문 메모 열기/수정
window.openOrderMemo = async (orderId) => {
    const { data: order } = await sb.from('orders').select('admin_note, id').eq('id', orderId).single();
    const currentNote = order?.admin_note || '';

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:20000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:16px;padding:24px;width:420px;max-width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">
            <h3 style="margin:0 0 4px;font-size:16px;">📝 주문 메모 (${orderId})</h3>
            <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">관리자/스태프 간 공유 메모</p>
            <textarea id="_memoInput" rows="4" style="width:100%;box-sizing:border-box;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px;font-size:14px;resize:vertical;outline:none;font-family:inherit;" onfocus="this.style.borderColor='#6366f1'" onblur="this.style.borderColor='#e2e8f0'">${currentNote}</textarea>
            <div style="display:flex;gap:8px;margin-top:12px;justify-content:space-between;">
                <button onclick="document.getElementById('_memoInput').value='';sb.from('orders').update({admin_note:null}).eq('id','${orderId}').then(()=>{showToast('메모 삭제됨','success');this.closest('div[style*=fixed]').remove();loadOrders();});" style="padding:8px 16px;border:1px solid #fca5a5;background:#fff;border-radius:8px;cursor:pointer;font-size:12px;color:#ef4444;">삭제</button>
                <div style="display:flex;gap:8px;">
                    <button onclick="this.closest('div[style*=fixed]').remove();" style="padding:8px 16px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;cursor:pointer;font-size:12px;color:#64748b;">닫기</button>
                    <button onclick="const v=document.getElementById('_memoInput').value;sb.from('orders').update({admin_note:v||null}).eq('id','${orderId}').then(()=>{showToast('메모 저장됨','success');this.closest('div[style*=fixed]').remove();loadOrders();});" style="padding:8px 16px;border:none;background:#6366f1;color:#fff;border-radius:8px;cursor:pointer;font-size:12px;font-weight:bold;">저장</button>
                </div>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    const ta = document.getElementById('_memoInput');
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
};

window.deleteOrdersSelected = async (force) => {
    const ids = Array.from(document.querySelectorAll('.row-chk:checked')).map(c => c.value);
    if(ids.length === 0) { showToast("선택된 주문이 없습니다.", "warn"); return; }
    if(!confirm(`${ids.length}건의 주문을 삭제하시겠습니까?`)) return;
    try {
        // 외래키 참조 테이블 먼저 삭제
        for (const id of ids) {
            await sb.from('order_items').delete().eq('order_id', id).then(() => {});
            await sb.from('partner_settlements').delete().eq('order_id', id).then(() => {});
            // 스토리지 파일 삭제 시도
            try {
                const { data: files } = await sb.storage.from('orders').list(`${id}`);
                if (files && files.length > 0) {
                    const paths = files.map(f => `${id}/${f.name}`);
                    await sb.storage.from('orders').remove(paths);
                }
            } catch(e) {}
        }
        const { error } = await sb.from('orders').delete().in('id', ids);
        if (error) {
            console.error('주문 삭제 실패:', error);
            showToast(`삭제 실패: ${error.message}`, 'error');
        } else {
            showToast(`${ids.length}건 삭제 완료`, 'success');
        }
    } catch(e) {
        console.error('삭제 오류:', e);
        showToast('삭제 중 오류가 발생했습니다.', 'error');
    }
    loadOrders();
};

// [파일 관리]
window.openFileModal = async (id) => {
    currentMgrOrderId = id;
    const { data } = await sb.from('orders').select('files').eq('id', id).single();
    currentMgrFiles = (data?.files || []).filter(f => f.type !== '_error_log');
    renderFileList();
    document.getElementById('fileManagerModal').style.display = 'flex';
};
window.closeFileModal = () => document.getElementById('fileManagerModal').style.display = 'none';

function renderFileList() {
    const list = document.getElementById('fileMgrList');
    list.innerHTML = currentMgrFiles.map((f, i) => {
        const isCutline = f.type === 'cutline';
        const isImage = f.url && (f.url.match(/\.(png|jpg|jpeg|webp)(\?|$)/i) || isCutline);
        const icon = isCutline ? '✂️' : f.type === 'customer_file' ? '📎' : f.type === 'order_sheet' ? '📋' : f.type === 'quotation' ? '💰' : '📄';
        const badge = isCutline ? '<span style="background:#ef4444;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;">칼선</span>' : '';
        const preview = isImage ? `<div style="margin:4px 0;"><img src="${f.url}" style="max-width:120px;max-height:80px;border:1px solid #e2e8f0;border-radius:4px;cursor:pointer;" onclick="window.open('${f.url}','_blank')"></div>` : '';
        return `<div class="file-item-row" style="flex-direction:column;align-items:flex-start;">
            <div style="display:flex;align-items:center;width:100%;justify-content:space-between;">
                <a href="${f.url}" target="_blank">${icon} ${f.name}${badge}</a>
                <button class="btn btn-danger btn-sm" onclick="deleteFileFromOrder(${i})">삭제</button>
            </div>
            ${preview}
        </div>`;
    }).join('') || '<div style="padding:10px; text-align:center;">파일 없음</div>';
}

window.uploadFileToOrder = async () => {
    const input = document.getElementById('fileMgrInput');
    if(!input.files[0]) return;
    const file = input.files[0];
    const path = `orders/${currentMgrOrderId}/${Date.now()}_${file.name}`;
    await sb.storage.from('orders').upload(path, file);
    const { data } = sb.storage.from('orders').getPublicUrl(path);
    currentMgrFiles.push({ name: file.name, url: data.publicUrl, type: 'admin_added' });
    await sb.from('orders').update({ files: currentMgrFiles }).eq('id', currentMgrOrderId);
    renderFileList();
    input.value = '';
};

window.deleteFileFromOrder = async (idx) => {
    if(!confirm('삭제하시겠습니까?')) return;
    currentMgrFiles.splice(idx, 1);
    await sb.from('orders').update({ files: currentMgrFiles }).eq('id', currentMgrOrderId);
    renderFileList();
};

window.uploadFileDirect = async (orderId, input) => {
    if(!input.files[0]) return;
    const file = input.files[0];
    const { data: order } = await sb.from('orders').select('files').eq('id', orderId).single();
    const files = order.files || [];
    
    const path = `orders/${orderId}/${Date.now()}_${file.name}`;
    await sb.storage.from('orders').upload(path, file);
    const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
    
    files.push({ name: file.name, url: urlData.publicUrl, type: 'admin_added' });
    await sb.from('orders').update({ files }).eq('id', orderId);
    showToast('업로드 완료', "success");
    loadOrders();
};

// ================================================================
// [문서 복구] 견적서/작업지시서 재생성 (옵션+이미지 포함 완전판)
// ================================================================
async function loadJsPDF() {
    if (window.jspdf) return;
    await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
    });
}

let _rcFontCache = null;
const _FONT_NAME = 'NanumGothic';
async function _rcLoadFont(doc) {
    if (!_rcFontCache) {
        const res = await fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf', { mode: 'cors' });
        _rcFontCache = await res.arrayBuffer();
    }
    const bytes = new Uint8Array(_rcFontCache);
    let bin = ''; for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    if (!doc.existsFileInVFS(_FONT_NAME + '.ttf')) {
        doc.addFileToVFS(_FONT_NAME + '.ttf', window.btoa(bin));
        doc.addFont(_FONT_NAME + '.ttf', _FONT_NAME, 'normal');
        doc.addFont(_FONT_NAME + '.ttf', _FONT_NAME, 'bold');
    }
    doc.setFont(_FONT_NAME);
}

function _dt(doc, text, x, y, opts = {}, color = '#000000') {
    if (!text) return;
    const hex = color.replace('#', '');
    doc.setTextColor(parseInt(hex.substring(0,2),16), parseInt(hex.substring(2,4),16), parseInt(hex.substring(4,6),16));
    doc.setFont(_FONT_NAME, opts.weight || 'normal');
    if (opts.fontSize) doc.setFontSize(opts.fontSize);
    doc.text(String(text), x, y, opts);
}

function _dc(doc, x, y, w, h, text, align = 'center', fontSize = 9, isHeader = false) {
    doc.setFontSize(fontSize);
    if (isHeader) { doc.setFillColor(240,240,240); doc.rect(x,y,w,h,'F'); }
    doc.setDrawColor(0); doc.setLineWidth(0.1); doc.rect(x,y,w,h);
    doc.setTextColor(0,0,0); doc.setFont(_FONT_NAME, isHeader ? 'bold' : 'normal');
    const tx = align==='left' ? x+2 : (align==='right' ? x+w-2 : x+w/2);
    if (Array.isArray(text)) {
        const totalH = (text.length-1) * fontSize * 0.45 * 1.15;
        doc.text(text, tx, y+(h/2)-(totalH/2)+(fontSize/3.5), { align, lineHeightFactor:1.15 });
    } else {
        doc.text(String(text), tx, y+(h/2)+(fontSize/3.5), { align, maxWidth: w-4 });
    }
}

// 이미지 URL → dataURL 변환 (CORS 안전)
function _rcLoadImage(url, timeoutMs = 10000) {
    return new Promise(resolve => {
        if (!url) return resolve(null);
        const timer = setTimeout(() => resolve(null), timeoutMs);
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            clearTimeout(timer);
            try {
                let w = img.width, h = img.height;
                const MAX = 1500;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                    else { w = Math.round(w * MAX / h); h = MAX; }
                }
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', 0.85));
            } catch(e) { resolve(null); }
        };
        img.onerror = () => { clearTimeout(timer); resolve(null); };
        img.src = url;
    });
}

// addon DB 로드 (관리자 페이지용)
let _rcAddonDB = null;
async function _rcLoadAddons() {
    if (_rcAddonDB) return _rcAddonDB;
    const { data } = await sb.from('addons').select('*');
    _rcAddonDB = {};
    if (data) data.forEach(a => { _rcAddonDB[a.code] = a; });
    return _rcAddonDB;
}

// ───── 견적서 (옵션 포함) ─────
async function generateRecoveryQuotation(order, addonDB) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });
    await _rcLoadFont(doc);

    doc.setFontSize(26);
    _dt(doc, '견 적 서', 105, 22, { align:'center', weight:'bold' });
    doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(15,28,195,28);

    doc.setFontSize(10);
    _dt(doc, '[ 수신자 ]', 15, 35);
    _dt(doc, `성   명 :  ${order.manager_name||'-'}`, 15, 43);
    _dt(doc, `연 락 처 :  ${order.phone||'-'}`, 15, 49);
    _dt(doc, `주   소 :  ${order.address||'-'}`, 15, 55, { maxWidth:85 });

    const pL = ['등록번호','상      호','대      표','주      소','업      태','연 락 처'];
    const pV = ['470-81-02808','(주)카멜레온프린팅','조재호','경기 화성시 우정읍 한말길 72-2','제조업 / 서비스업','031-366-1984'];
    pL.forEach((l,i) => {
        _dc(doc, 105, 32+i*7, 20, 7, l, 'center', 9, true);
        _dc(doc, 125, 32+i*7, 70, 7, pV[i], 'left', 9, false);
    });

    // 직인
    try {
        const sr = await fetch('https://gdadmin.signmini.com/data/etc/stampImage');
        const sb2 = await sr.blob();
        const sd = await new Promise(r => { const rd = new FileReader(); rd.onloadend = () => r(rd.result); rd.readAsDataURL(sb2); });
        if (sd) doc.addImage(sd, 'PNG', 170, 40, 14, 14);
    } catch(e){}

    let y = 85;
    const cols = [10,50,40,20,30,30];
    ['No','품목명','규격/옵션','수량','단가','금액'].forEach((h,i) => {
        let cx = 15; for(let j=0;j<i;j++) cx+=cols[j];
        _dc(doc, cx, y, cols[i], 8, h, 'center', 10, true);
    });
    y += 8;

    let totalAmt = 0, no = 1;
    (order.items||[]).forEach(item => {
        if (!item.product) return;
        let pName = item.product.name || '-';
        if (item.wallCount && item.wallCount > 1) pName += ` (${item.wallCount}벽)`;
        else if (item.pageCount && item.pageCount > 1) pName += ` (${item.pageCount}면)`;

        const price = item.product.price || 0;
        const qty = item.qty || 1;
        const pTotal = price * qty;
        totalAmt += pTotal;

        const wMm = item.product.w_mm || item.product.width_mm || 0;
        const hMm = item.product.h_mm || item.product.height_mm || 0;
        const optLabel = (wMm && hMm) ? `${Math.round(wMm)}x${Math.round(hMm)}mm` : '기본 사양';

        const split = doc.splitTextToSize(pName, cols[1]-4);
        const rh = Math.max(8, 4 + split.length * 5);
        let cx = 15;
        _dc(doc, cx, y, cols[0], rh, String(no++), 'center'); cx+=cols[0];
        _dc(doc, cx, y, cols[1], rh, split, 'left'); cx+=cols[1];
        _dc(doc, cx, y, cols[2], rh, optLabel, 'left'); cx+=cols[2];
        _dc(doc, cx, y, cols[3], rh, String(qty), 'center'); cx+=cols[3];
        _dc(doc, cx, y, cols[4], rh, price.toLocaleString(), 'right'); cx+=cols[4];
        _dc(doc, cx, y, cols[5], rh, pTotal.toLocaleString(), 'right');
        y += rh;
        if (y > 260) { doc.addPage(); y = 20; }

        // ★ 옵션(addon) 렌더링
        if (item.selectedAddons) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = addonDB[code]; if (!add) return;
                const uQty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                const addPrice = add.price || 0;
                const aTotal = addPrice * uQty;
                totalAmt += aTotal;
                const addName = '└ ' + (add.display_name || add.name || code);
                const splitA = doc.splitTextToSize(addName, cols[1]-4);
                const ah = Math.max(8, 4 + splitA.length * 5);
                cx = 15;
                _dc(doc, cx, y, cols[0], ah, '', 'center'); cx+=cols[0];
                _dc(doc, cx, y, cols[1], ah, splitA, 'left', 8); cx+=cols[1];
                _dc(doc, cx, y, cols[2], ah, '추가 옵션', 'left', 8); cx+=cols[2];
                _dc(doc, cx, y, cols[3], ah, String(uQty), 'center'); cx+=cols[3];
                _dc(doc, cx, y, cols[4], ah, addPrice.toLocaleString(), 'right'); cx+=cols[4];
                _dc(doc, cx, y, cols[5], ah, aTotal.toLocaleString(), 'right');
                y += ah;
                if (y > 260) { doc.addPage(); y = 20; }
            });
        }
    });

    y += 5;
    const discount = order.discount_amount || 0;
    const finalAmt = totalAmt - discount;
    const vat = Math.floor(finalAmt / 11);
    const supply = finalAmt - vat;

    _dt(doc, '공급가액 :', 105, y+5, {align:'right'}); _dt(doc, supply.toLocaleString()+'원', 195, y+5, {align:'right'}); y+=6;
    _dt(doc, '부 가 세 :', 105, y+5, {align:'right'}); _dt(doc, vat.toLocaleString()+'원', 195, y+5, {align:'right'}); y+=6;
    if (discount > 0) {
        _dt(doc, '할인/마일리지 :', 105, y+5, {align:'right'}, '#ff0000');
        _dt(doc, '-'+discount.toLocaleString()+'원', 195, y+5, {align:'right'}, '#ff0000'); y+=6;
    }
    y+=2; doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(85,y,195,y); y+=8;
    _dt(doc, '합계금액 (VAT포함)', 105, y, {align:'right', weight:'bold'});
    doc.setFontSize(14);
    _dt(doc, finalAmt.toLocaleString()+'원', 195, y, {align:'right', weight:'bold'}, '#1a237e');
    doc.setFontSize(10);
    _dt(doc, '위와 같이 청구(영수)합니다.', 105, 250, {align:'center'});
    _dt(doc, new Date(order.created_at||Date.now()).toLocaleDateString(), 105, 262, {align:'center'});
    return doc.output('blob');
}

// ───── 작업지시서 (옵션+이미지 포함) ─────
async function generateRecoveryOrderSheet(order, addonDB) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'p', unit:'mm', format:'a4' });
    await _rcLoadFont(doc);

    const items = order.items || [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.product) continue;
        if (i > 0) doc.addPage();

        // 네이비 헤더
        doc.setFillColor(26,35,126); doc.rect(0,0,210,20,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(22);
        doc.setFont(_FONT_NAME,'bold'); doc.text('작 업 지 시 서', 105, 14, {align:'center'});

        // 주문 정보
        const startY = 30, boxH = 50;
        doc.setTextColor(0); doc.setDrawColor(0); doc.setLineWidth(0.4); doc.rect(15,startY,180,boxH);
        doc.setFontSize(10);
        let cy = startY + 8;
        _dt(doc, `주 문 번 호 :  ${order.id||'-'}`, 20, cy, {weight:'bold'});
        _dt(doc, `접 수 일 자 :  ${new Date(order.created_at||Date.now()).toLocaleDateString()}`, 80, cy);
        doc.setDrawColor(200); doc.setLineWidth(0.1); doc.line(20,cy+3,130,cy+3); cy+=8;
        doc.setFontSize(11);
        _dt(doc, `주   문   자 :  ${order.manager_name||'-'}`, 20, cy); cy+=6;
        _dt(doc, `연   락   처 :  ${order.phone||'-'}`, 20, cy); cy+=6;
        _dt(doc, '배 송 주 소 :', 20, cy); doc.setFontSize(10); _dt(doc, order.address||'-', 45, cy, {maxWidth:90}); cy+=10;
        doc.setFontSize(11);
        _dt(doc, '요 청 사 항 :', 20, cy);
        // 추천인 태그 제거
        let reqNote = (order.request_note || '없음').replace(/\n?##REF:[^#]+##/g, '').trim() || '없음';
        _dt(doc, reqNote, 45, cy, {maxWidth:130, weight:'bold'}, '#1d4ed8');

        // 배송 희망일
        let dateStr = '미지정';
        if (order.delivery_target_date) {
            const parts = order.delivery_target_date.split('-');
            dateStr = parts.length===3 ? `${parts[1]}.${parts[2]}` : order.delivery_target_date;
        }
        doc.setFontSize(12);
        _dt(doc, '배송 희망일', 165, startY+12, {align:'center', weight:'bold'}, '#ff0000');
        doc.setFontSize(42);
        _dt(doc, dateStr, 165, startY+32, {align:'center', weight:'bold'}, '#ff0000');
        doc.setDrawColor(255,0,0); doc.setLineWidth(0.5); doc.roundedRect(135,startY+5,55,35,3,3);

        // 담당자 바
        const staffY = startY + boxH + 5;
        doc.setFillColor(255,247,237); doc.setDrawColor(249,115,22); doc.setLineWidth(0.3);
        doc.rect(15,staffY,180,14,'FD');
        doc.setFontSize(10);
        _dt(doc, '배송책임자 : 서용규 (010-8272-3017)   |   제작책임자 : 변지웅 (010-5512-5366)', 105, staffY+8.5, {align:'center',weight:'bold'}, '#c2410c');

        // 제품 사양
        const prodY = staffY + 20;
        doc.setFillColor(240,240,240); doc.setDrawColor(0); doc.setLineWidth(0.1);
        doc.rect(15,prodY,180,10,'FD');
        doc.setTextColor(0); doc.setFontSize(11);
        _dt(doc, '제 작 사 양', 20, prodY+7, {weight:'bold'});
        _dt(doc, `수량: ${item.qty||1}개`, 185, prodY+7, {align:'right',weight:'bold'}, '#ff0000');

        const infoY = prodY + 18;
        doc.setFontSize(16);
        let prodName = item.product.name || '-';
        if (item.wallCount && item.wallCount > 1) prodName += ` (${item.wallCount}벽)`;
        _dt(doc, prodName, 20, infoY, {weight:'bold'});
        doc.setFontSize(11);
        let optY = infoY + 8;

        const wMm = item.product.w_mm || item.product.width_mm || 0;
        const hMm = item.product.h_mm || item.product.height_mm || 0;
        if (wMm && hMm) {
            _dt(doc, `사이즈 : ${Math.round(wMm)} x ${Math.round(hMm)} mm`, 25, optY, {}, '#555555');
            optY += 6;
        }

        // ★ 소재 표시
        const _itemCode = item.product.code || '';
        const _itemCat = item.product.category || '';
        const _itemMat = _materialCache[_itemCode] || item.product?.material || _materialCache['_cat_' + _itemCat] || '';
        if (_itemMat) {
            const _matDisplay = MATERIAL_LABELS[_itemMat] || _itemMat.replace(/_/g, ' ');
            _dt(doc, `소  재 : ${_matDisplay}`, 25, optY, {weight:'bold'}, '#7c3aed');
            optY += 6;
        }

        // ★ 옵션 표시
        if (item.selectedAddons && Object.keys(item.selectedAddons).length > 0) {
            Object.values(item.selectedAddons).forEach(code => {
                const add = addonDB[code]; if (!add) return;
                const qty = (item.addonQuantities && item.addonQuantities[code]) || 1;
                _dt(doc, `• ${add.display_name || add.name || code} (x${qty})`, 25, optY);
                optY += 6;
            });
        } else {
            _dt(doc, '• 기본 사양', 25, optY); optY += 6;
        }

        // ★ 디자인 미리보기 (썸네일/원본 이미지)
        const imgBoxY = optY + 5;
        const footerY = 255;
        const imgBoxH = footerY - imgBoxY - 5;
        doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(15,imgBoxY,180,imgBoxH);
        doc.setFontSize(9); doc.setTextColor(136,136,136);
        doc.text('< 디자인 시안 확인 >', 105, imgBoxY-2, {align:'center'});

        // 이미지 로드 시도: thumb → originalUrl
        let imgData = null;
        if (item.thumb) {
            imgData = await _rcLoadImage(item.thumb);
        }
        if (!imgData && item.originalUrl) {
            imgData = await _rcLoadImage(item.originalUrl);
        }

        if (imgData) {
            try {
                let fmt = 'PNG'; if (imgData.startsWith('data:image/jpeg')) fmt = 'JPEG';
                const imgProps = doc.getImageProperties(imgData);
                const innerW = 176, innerH = imgBoxH - 4;
                let w = innerW, h = (imgProps.height * w) / imgProps.width;
                if (h > innerH) { h = innerH; w = (imgProps.width * h) / imgProps.height; }
                doc.addImage(imgData, fmt, 105-(w/2), imgBoxY+(imgBoxH/2)-(h/2), w, h);
            } catch(e) {}
        } else {
            doc.setTextColor(180,180,180); doc.setFontSize(12);
            doc.text('이미지 없음 (파일 별도 확인)', 105, imgBoxY + imgBoxH/2, {align:'center'});
        }
    }

    if (items.length === 0) {
        _dt(doc, '주문 항목 없음', 105, 100, {align:'center'});
    }
    return doc.output('blob');
}

// ───── 복구 실행 (기존 복구 문서 삭제 후 재생성) ─────
window.recoverMissingDocs = async () => {
    const logEl = document.getElementById('recoveryLog');
    if (logEl) logEl.innerHTML = '';
    const log = (msg) => { console.log(msg); if (logEl) logEl.innerHTML += msg + '<br>'; };

    log('🔍 주문 조회 중...');

    const { data: orders, error } = await sb.from('orders')
        .select('id, manager_name, phone, address, request_note, delivery_target_date, created_at, items, files, total_amount, discount_amount, site_code')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) { log('❌ 조회 실패: ' + error.message); return; }

    // 모든 주문에서 견적서/작업지시서 누락 또는 복구본(recovery) 찾기
    const targets = orders.filter(o => {
        const files = (o.files || []).filter(f => f.type !== '_error_log');
        const hasRealOrderSheet = files.some(f => f.type === 'order_sheet' && f.url && !f.url.includes('recovery'));
        const hasRealQuotation = files.some(f => f.type === 'quotation' && f.url && !f.url.includes('recovery'));
        const hasRecovery = files.some(f => f.url && f.url.includes('recovery'));
        return !hasRealOrderSheet || !hasRealQuotation || hasRecovery;
    });

    if (targets.length === 0) { log('✅ 모든 주문에 정상 문서가 존재합니다.'); return; }
    log(`📋 ${targets.length}건 대상 (누락 또는 이전 복구본 교체)`);

    targets.forEach(o => {
        const files = (o.files||[]).filter(f => f.type !== '_error_log');
        const types = files.map(f => f.type + (f.url?.includes('recovery')?' (복구)':'')).join(', ');
        log(`  📌 ${o.id} [${o.manager_name||'-'}] : ${types||'없음'}`);
    });

    if (!confirm(`${targets.length}건의 견적서/작업지시서를 (재)생성하시겠습니까?\n기존 복구본은 삭제 후 새로 만듭니다.`)) {
        log('⏹ 취소됨'); return;
    }

    await loadJsPDF();
    log('📦 jsPDF 로드 완료');

    const addonDB = await _rcLoadAddons();
    log(`📦 옵션 DB 로드 완료 (${Object.keys(addonDB).length}개)`);
    if (Object.keys(_materialCache).length === 0) await _loadMaterialCache();

    let success = 0, fail = 0;
    for (const order of targets) {
        try {
            // 기존 복구본 제거, 정상 파일만 유지
            const cleanFiles = (order.files||[]).filter(f =>
                f.type !== '_error_log' &&
                f.type !== 'order_sheet' &&
                f.type !== 'quotation'
            );
            // 정상본(recovery가 아닌)은 유지
            const origOS = (order.files||[]).find(f => f.type === 'order_sheet' && f.url && !f.url.includes('recovery'));
            const origQ = (order.files||[]).find(f => f.type === 'quotation' && f.url && !f.url.includes('recovery'));

            const updatedFiles = [...cleanFiles];
            if (origOS) updatedFiles.push(origOS);
            if (origQ) updatedFiles.push(origQ);

            // 견적서 재생성
            if (!origQ) {
                const blob = await generateRecoveryQuotation(order, addonDB);
                if (blob) {
                    const ts = Date.now();
                    const path = `orders/${order.id}/quotation_recovery_${ts}.pdf`;
                    const { error: upErr } = await sb.storage.from('orders').upload(path, blob, { upsert: true });
                    if (!upErr) {
                        const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                        updatedFiles.push({ name: '견적서.pdf', url: urlData.publicUrl, type: 'quotation' });
                        log(`  ✅ ${order.id} 견적서`);
                    } else { log(`  ⚠️ ${order.id} 견적서 업로드 실패`); }
                }
            }

            // 작업지시서 재생성
            if (!origOS) {
                const blob = await generateRecoveryOrderSheet(order, addonDB);
                if (blob) {
                    const ts = Date.now();
                    const path = `orders/${order.id}/order_sheet_recovery_${ts}.pdf`;
                    const { error: upErr } = await sb.storage.from('orders').upload(path, blob, { upsert: true });
                    if (!upErr) {
                        const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                        updatedFiles.push({ name: '작업지시서.pdf', url: urlData.publicUrl, type: 'order_sheet' });
                        log(`  ✅ ${order.id} 작업지시서`);
                    } else { log(`  ⚠️ ${order.id} 작업지시서 업로드 실패`); }
                }
            }

            await sb.from('orders').update({ files: updatedFiles }).eq('id', order.id);
            success++;
        } catch (e) {
            log(`  ❌ ${order.id} 오류: ${e.message}`);
            fail++;
        }
    }

    log(`\n🎉 완료! 성공: ${success}건, 실패: ${fail}건`);
    log('새로고침하면 반영됩니다.');
};

// ================================================================

window.loadBankdaList = async () => {
    const startInput = document.getElementById('bankStartDate');
    const endInput = document.getElementById('bankEndDate');
    
    // 1. 날짜가 비어있으면 '이번 달 1일 ~ 오늘'로 자동 설정
    if (!startInput.value || !endInput.value) {
        const now = new Date();
        const krNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const todayStr = krNow.toISOString().split('T')[0];
        const year = krNow.getFullYear();
        const month = String(krNow.getMonth() + 1).padStart(2, '0');
        const firstDayStr = `${year}-${month}-01`;
        startInput.value = firstDayStr;
        endInput.value = todayStr;
    }

    const start = startInput.value;
    const end = endInput.value;
    const tbody = document.getElementById('bankListBody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><div class="spinner"></div> 로딩 중...</td></tr>';

    try {
        // [수정] select('*') 로 변경하여 컬럼 오류 방지
        // 은행거래 + 미결제 주문을 병렬 조회
        const [txsRes, ordersRes] = await Promise.all([
            sb.from('bank_transactions')
                .select('*')
                .gte('transaction_date', start + 'T00:00:00')
                .lte('transaction_date', end + 'T23:59:59')
                .order('transaction_date', { ascending: false }),
            sb.from('orders')
                .select('id, manager_name, phone, total_amount, payment_status, created_at')
                .gte('created_at', start + 'T00:00:00')
                .neq('payment_status', '결제완료')
                .neq('payment_status', '입금확인')
        ]);

        const { data: txs, error } = txsRes;
        if (error) throw error;
        const { data: orders } = ordersRes;

        tbody.innerHTML = '';
        if (!txs || txs.length === 0) { 
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:30px;">기간 내 입금 내역이 없습니다.</td></tr>'; 
            return; 
        }

        let autoMatchList = [];

        txs.forEach(tx => {
            // [디버깅] 콘솔창(F12)을 확인해보세요. 실제 데이터에 이름이 어디 들어있는지 확인용입니다.
            console.log("Bank TX:", tx); 

            // [수정] 가능한 모든 이름 필드를 다 검사
            const displayName = tx.bk_jukyo || tx.input_name || tx.depositor || tx.sender || tx.content || tx.description || '이름미상';

            const matchOrder = orders ? orders.find(o => {
                const orderName = (o.manager_name || '').replace(/\s/g, ''); 
                const bankName = String(displayName).replace(/\s/g, '');
                return orderName === bankName && Math.abs((o.total_amount || 0) - tx.amount) < 100;
            }) : null;

            let statusBadge = '<span class="badge" style="background:#f1f5f9; color:#94a3b8;">미매칭</span>';
            let actionBtn = `<button class="btn btn-sm btn-outline" onclick="matchOrderManual('${tx.id}', '${displayName}')">수동 연결</button>`;

            if (tx.match_status === 'matched') {
                statusBadge = `<span class="badge" style="background:#e0e7ff; color:#3730a3;">연결됨</span>`;
                actionBtn = `<span style="font-size:11px; color:#aaa;">완료</span>`;
            } 
            else if (matchOrder) {
                statusBadge = `<span class="badge" style="background:#dcfce7; color:#166534; font-weight:bold;">✅ 매칭가능</span>`;
                actionBtn = `<button class="btn btn-success btn-sm" onclick="matchOrderManual('${tx.id}', '${displayName}', '${matchOrder.id}')">연결 (${matchOrder.manager_name})</button>`;
                autoMatchList.push({ txId: tx.id, orderId: matchOrder.id });
            }

            tbody.innerHTML += `
                <tr>
                    <td>${new Date(tx.transaction_date).toLocaleString()}</td>
                    <td style="font-weight:bold; color:#0f172a;">${displayName}</td>
                    <td style="text-align:right; font-weight:bold;">${tx.amount.toLocaleString()}원</td>
                    <td>${tx.bank_name || '-'}</td>
                    <td style="text-align:center;">${statusBadge}</td>
                    <td style="text-align:center;">${actionBtn}</td>
                </tr>`;
        });

        const existingBtn = document.getElementById('btnAutoMatch');
        if(existingBtn) existingBtn.remove();
        
        if(autoMatchList.length > 0) {
            const table = document.querySelector('#sec-bankda table');
            const btnHtml = `
                <div id="btnAutoMatch" style="margin-bottom:10px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#166534; font-weight:bold;">✨ ${autoMatchList.length}건 자동 매칭됨</span>
                    <button class="btn btn-success" onclick='executeAutoMatching(${JSON.stringify(autoMatchList)})'>🚀 일괄 연결하기</button>
                </div>`;
            table.insertAdjacentHTML('beforebegin', btnHtml);
        }

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red;">오류: ${e.message}</td></tr>`;
    }
};
// [일괄 자동매칭 실행]
window.executeAutoMatching = async (list) => {
    if(!confirm(`${list.length}건을 일괄 연결하시겠습니까?`)) return;
    showLoading(true);
    try {
        const updates = list.map(item => {
            const p1 = sb.from('orders').update({ payment_status: '결제완료', payment_method: '무통장입금' }).eq('id', item.orderId);
            const p2 = sb.from('bank_transactions').update({ match_status: 'matched', matched_order_id: item.orderId }).eq('id', item.txId);
            return Promise.all([p1, p2]);
        });
        await Promise.all(updates);
        // 추천인 적립 처리
        for (const item of list) {
            await creditReferralBonus(item.orderId);
        }
        showToast("완료되었습니다.", "success");
        loadBankdaList();
    } catch(e) { showToast("오류: " + e.message, "error"); } finally { showLoading(false); }
};

window.runBankdaScraping = async () => {
    if(!confirm("최신 내역을 가져오시겠습니까?")) return;
    showLoading(true);
    try {
        const { data, error } = await sb.functions.invoke('bank-scraper', { method: 'POST' });
        if(error) throw error;
        showToast(`업데이트 완료: ${data.message || '성공'}`, "success");
        loadBankdaList();
    } catch(e) { showToast("실패: " + e.message, "error"); } finally { showLoading(false); }
};

window.matchOrderManual = async (txId, name, suggestedId = '') => {
    const orderId = prompt(`[${name}] 입금건과 연결할 주문번호를 입력하세요.`, suggestedId);
    if(!orderId) return;
    try {
        await sb.from('orders').update({ payment_status: '결제완료', payment_method: '무통장입금' }).eq('id', orderId);
        await sb.from('bank_transactions').update({ match_status: 'matched', matched_order_id: orderId }).eq('id', txId);
        await creditReferralBonus(orderId); // 추천인 적립
        showToast("연결되었습니다.", "success");
        loadBankdaList();
    } catch(e) { showToast("오류: " + e.message, "error"); }
};

// [배송 스케줄 및 기사 배정]
// ── 관리자 달력 뷰 ──
let adminCalDate = null;
const ADMIN_SLOTS = ["08:00","10:00","12:00","14:00","16:00","18:00","20:00"];
const ADMIN_MAX_TEAMS = 3;

window.loadDailyTasks = async () => {
    if (!adminCalDate) {
        const now = new Date();
        const krNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        adminCalDate = new Date(krNow.getFullYear(), krNow.getMonth(), 1);
    }
    if (staffList.length === 0) {
        const { data } = await sb.from('admin_staff').select('id, name, role, color');
        staffList = data || [];
    }
    renderAdminCalendar();
};

window.adminCalChangeMonth = (delta) => {
    if (!adminCalDate) adminCalDate = new Date();
    adminCalDate.setMonth(adminCalDate.getMonth() + delta);
    renderAdminCalendar();
};

async function renderAdminCalendar() {
    const grid = document.getElementById('adminCalGrid');
    const titleEl = document.getElementById('adminCalTitle');
    if (!grid) return;

    const year = adminCalDate.getFullYear();
    const month = adminCalDate.getMonth();
    titleEl.textContent = `${year}년 ${month + 1}월`;

    // 월간 주문 데이터 조회
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0')}-01`;
    const endYear = month + 2 > 12 ? year + 1 : year;

    showLoading(true);
    let orders = [];
    try {
        const { data, error } = await sb.from('orders')
            .select('id, delivery_target_date, installation_time, total_amount, manager_name, phone, status')
            .gte('delivery_target_date', startDate)
            .lt('delivery_target_date', `${endYear}-${String(month + 2 > 12 ? 1 : month + 2).padStart(2, '0')}-01`);
        if (!error && data) orders = data;
    } catch (e) { console.error(e); }
    showLoading(false);

    // 날짜별 주문 그룹
    const ordersByDate = {};
    orders.forEach(o => {
        if (!ordersByDate[o.delivery_target_date]) ordersByDate[o.delivery_target_date] = [];
        ordersByDate[o.delivery_target_date].push(o);
    });

    grid.innerHTML = '';

    // 요일 헤더
    ['일','월','화','수','목','금','토'].forEach(d => {
        grid.innerHTML += `<div style="background:#f1f5f9; padding:8px; text-align:center; font-weight:bold; font-size:13px; color:${d==='일'?'#ef4444':d==='토'?'#3b82f6':'#334155'};">${d}</div>`;
    });

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    // 빈 칸
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div style="background:#fafafa; min-height:100px;"></div>`;
    }

    // 날짜 칸
    for (let d = 1; d <= lastDate; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOrders = ordersByDate[dateStr] || [];
        const installOrders = dayOrders.filter(o => o.installation_time);
        const deliveryOnly = dayOrders.filter(o => !o.installation_time);
        const isToday = dateStr === todayStr;
        const dow = new Date(year, month, d).getDay();

        // 슬롯별 팀 수 계산
        const slotTeams = {};
        ADMIN_SLOTS.forEach(s => slotTeams[s] = 0);
        installOrders.forEach(o => {
            const startIdx = ADMIN_SLOTS.indexOf(o.installation_time);
            if (startIdx === -1) return;
            const total = o.total_amount || 0;
            const slots = total >= 5000000 ? 7 : (total >= 3000000 ? 2 : 1);
            const endIdx = slots === 7 ? ADMIN_SLOTS.length : Math.min(startIdx + slots, ADMIN_SLOTS.length);
            for (let i = (slots === 7 ? 0 : startIdx); i < endIdx; i++) slotTeams[ADMIN_SLOTS[i]]++;
        });
        const hasFullSlot = ADMIN_SLOTS.some(s => slotTeams[s] >= ADMIN_MAX_TEAMS);
        const allFull = ADMIN_SLOTS.every(s => slotTeams[s] >= ADMIN_MAX_TEAMS);

        let badges = '';
        if (installOrders.length > 0) badges += `<div style="font-size:10px; background:${allFull?'#fecaca':'#ede9fe'}; color:${allFull?'#dc2626':'#6d28d9'}; border-radius:4px; padding:1px 5px; margin-top:2px;">🔧 ${installOrders.length}건</div>`;
        if (deliveryOnly.length > 0) badges += `<div style="font-size:10px; background:#dbeafe; color:#2563eb; border-radius:4px; padding:1px 5px; margin-top:2px;">🚚 ${deliveryOnly.length}건</div>`;

        const cellBg = isToday ? '#fffbeb' : (allFull ? '#fef2f2' : '#fff');
        const borderStyle = isToday ? 'border:2px solid #f59e0b;' : '';

        grid.innerHTML += `<div onclick="openAdminSlotModal('${dateStr}')" style="background:${cellBg}; min-height:100px; padding:6px; cursor:pointer; position:relative; ${borderStyle} transition:0.15s;" onmouseenter="this.style.background='#f0f4ff'" onmouseleave="this.style.background='${cellBg}'">
            <div style="font-weight:bold; font-size:14px; color:${dow===0?'#ef4444':dow===6?'#3b82f6':'#334155'}; ${isToday?'background:#f59e0b; color:white; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center;':''}">${d}</div>
            ${badges}
            ${hasFullSlot && !allFull ? '<div style="position:absolute; top:4px; right:4px; width:8px; height:8px; background:#f59e0b; border-radius:50;"></div>' : ''}
        </div>`;
    }
}

// ── 지역 판별 헬퍼 ──
function isMetroArea(address) {
    if (!address) return true;
    const metro = ['서울','경기','인천','성남','분당','수원','고양','용인','부천','안산','안양','화성','평택','시흥','파주','김포','광명','군포','하남','오산','이천','양주','구리','남양주','의정부','동두천','과천','양평','여주','가평','연천','포천','일산','판교','광교','동탄','위례','세종'];
    return metro.some(m => address.includes(m));
}
function isHoneycombOrder(order) {
    if (!order.items) return false;
    const items = Array.isArray(order.items) ? order.items : [];
    return items.some(item => {
        const cat = (item.category || item.product?.category || '').toLowerCase();
        const name = (item.productName || item.product?.name || '').toLowerCase();
        return cat.includes('honeycomb') || cat.includes('hc_') || name.includes('허니콤') || name.includes('honeycomb') || name.includes('ハニカムボード') || name.includes('ハニカム') || name.includes('リボード') || name.includes('re-board');
    });
}

// ── 관리자 날짜 클릭 팝업 ──
window.openAdminSlotModal = async (dateStr) => {
    const modal = document.getElementById('adminSlotModal');
    const titleEl = document.getElementById('adminSlotTitle');
    const content = document.getElementById('adminSlotContent');
    if (!modal) return;

    titleEl.textContent = `📅 ${dateStr} 설치/배송 스케줄`;
    modal.style.display = 'flex';
    content.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa-solid fa-spinner fa-spin"></i> 로딩중...</div>';

    const timeSelect = document.getElementById('adminSlotTime');
    if (timeSelect) timeSelect.innerHTML = ADMIN_SLOTS.map(s => `<option value="${s}">${s}</option>`).join('');
    window._adminSlotDate = dateStr;

    try {
        const { data: orders } = await sb.from('orders')
            .select('id, installation_time, total_amount, manager_name, phone, address, status, staff_driver_id, items, delivery_target_date')
            .eq('delivery_target_date', dateStr);
        const dayOrders = orders || [];

        // 슬롯별 팀 수 + 주문 매핑
        const slotTeams = {};
        const slotOrders = {};
        ADMIN_SLOTS.forEach(s => { slotTeams[s] = 0; slotOrders[s] = []; });

        const installOrders = dayOrders.filter(o => o.installation_time);
        installOrders.forEach(o => {
            const startIdx = ADMIN_SLOTS.indexOf(o.installation_time);
            if (startIdx === -1) return;
            const total = o.total_amount || 0;
            const slots = total >= 5000000 ? 7 : (total >= 3000000 ? 2 : 1);
            const endIdx = slots === 7 ? ADMIN_SLOTS.length : Math.min(startIdx + slots, ADMIN_SLOTS.length);
            for (let i = (slots === 7 ? 0 : startIdx); i < endIdx; i++) {
                slotTeams[ADMIN_SLOTS[i]]++;
                slotOrders[ADMIN_SLOTS[i]].push(o);
            }
        });

        // 일반 배송 분류
        const deliveryOnly = dayOrders.filter(o => !o.installation_time);
        const dlvHcMetro = deliveryOnly.filter(o => isHoneycombOrder(o) && isMetroArea(o.address));
        const dlvHcLocal = deliveryOnly.filter(o => isHoneycombOrder(o) && !isMetroArea(o.address));
        const dlvOtherMetro = deliveryOnly.filter(o => !isHoneycombOrder(o) && isMetroArea(o.address));
        const dlvOtherLocal = deliveryOnly.filter(o => !isHoneycombOrder(o) && !isMetroArea(o.address));

        // ── 2열 레이아웃 생성 ──
        let html = '<div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">';

        // ===== 좌측: 설치 시간 슬롯 =====
        html += '<div>';
        html += '<h4 style="margin:0 0 12px 0; font-size:17px; color:#6d28d9;"><i class="fa-solid fa-wrench"></i> 설치 예약 시간표</h4>';
        html += '<table style="width:100%; border-collapse:collapse; font-size:14px;">';
        html += '<thead><tr style="background:#f8fafc;"><th style="padding:10px; text-align:left;">시간</th><th style="padding:10px; text-align:center; width:70px;">팀</th><th style="padding:10px; text-align:left;">고객</th><th style="padding:10px; width:40px;"></th></tr></thead><tbody>';

        ADMIN_SLOTS.forEach((slot, idx) => {
            const endSlot = idx + 1 < ADMIN_SLOTS.length ? ADMIN_SLOTS[idx + 1] : '22:00';
            const used = slotTeams[slot] || 0;
            const isFull = used >= ADMIN_MAX_TEAMS;
            const barColor = isFull ? '#ef4444' : (used > 0 ? '#f59e0b' : '#22c55e');
            const bgColor = isFull ? '#fef2f2' : (used > 0 ? '#fffbeb' : '#fff');

            const uniqueOrders = [...new Map(slotOrders[slot].map(o => [o.id, o])).values()];
            let custHtml = uniqueOrders.map(o => {
                const info = getInstallationDisplayInfo(o);
                const isBlock = o.manager_name?.startsWith('[차단]');
                return `<div style="padding:2px 0; ${isBlock?'color:#94a3b8; font-style:italic;':''}">
                    <span style="font-weight:600;">${o.manager_name}</span>
                    ${!isBlock && o.phone ? `<span style="color:#6366f1; margin-left:4px;">${o.phone}</span>` : ''}
                    ${info ? `<span style="color:#6d28d9; font-size:12px;">(${info.duration})</span>` : ''}
                </div>`;
            }).join('') || '<span style="color:#cbd5e1;">-</span>';

            let removeHtml = uniqueOrders.map(o => `<button style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:14px; padding:2px 4px;" onclick="adminRemoveInstallation('${o.id}','${dateStr}')" title="제거">✕</button>`).join('');

            html += `<tr style="border-bottom:1px solid #f1f5f9; background:${bgColor};">
                <td style="padding:10px; font-weight:bold; white-space:nowrap; font-size:15px;">${slot}~${endSlot}</td>
                <td style="padding:10px; text-align:center;">
                    <div style="display:flex; gap:3px; justify-content:center;">${[0,1,2].map(i=>`<div style="width:14px; height:14px; border-radius:50%; background:${i<used?barColor:'#e2e8f0'};"></div>`).join('')}</div>
                </td>
                <td style="padding:10px;">${custHtml}</td>
                <td style="padding:10px; text-align:center;">${removeHtml}</td>
            </tr>`;
        });
        html += '</tbody></table></div>';

        // ===== 우측: 배송 목록 (분류별) =====
        html += '<div>';
        html += '<h4 style="margin:0 0 12px 0; font-size:17px; color:#2563eb;"><i class="fa-solid fa-truck-fast"></i> 배송 목록</h4>';

        // 시간지정 배송 (설치 시간 있는 건)
        const timedDelivery = installOrders.filter(o => !o.manager_name?.startsWith('[차단]'));
        if (timedDelivery.length > 0) {
            html += renderDeliveryGroup('⏰ 시간지정 설치', timedDelivery, '#6d28d9', '#ede9fe', true);
        }

        // 허니콤 수도권
        if (dlvHcMetro.length > 0) html += renderDeliveryGroup('🔧 허니콤보드 · 수도권', dlvHcMetro, '#7c3aed', '#f5f3ff');
        // 허니콤 지방
        if (dlvHcLocal.length > 0) html += renderDeliveryGroup('🔧 허니콤보드 · 지방', dlvHcLocal, '#9333ea', '#faf5ff');
        // 기타 수도권
        if (dlvOtherMetro.length > 0) html += renderDeliveryGroup('📦 기타제품 · 수도권', dlvOtherMetro, '#2563eb', '#eff6ff');
        // 기타 지방
        if (dlvOtherLocal.length > 0) html += renderDeliveryGroup('📦 기타제품 · 지방', dlvOtherLocal, '#0284c7', '#f0f9ff');

        if (deliveryOnly.length === 0 && timedDelivery.length === 0) {
            html += '<div style="text-align:center; padding:30px; color:#cbd5e1;">배송 건 없음</div>';
        }

        html += '</div></div>'; // grid 닫기

        content.innerHTML = html;
    } catch (e) {
        content.innerHTML = `<div style="color:red; padding:20px;">오류: ${e.message}</div>`;
    }
};

function renderDeliveryGroup(title, orders, color, bg, showTime) {
    let html = `<div style="margin-bottom:14px;">
        <div style="font-size:15px; font-weight:bold; color:${color}; padding:8px 12px; background:${bg}; border-radius:6px 6px 0 0; border-left:3px solid ${color};">${title} (${orders.length}건)</div>
        <div style="border:1px solid #e2e8f0; border-top:none; border-radius:0 0 6px 6px;">`;
    orders.forEach(o => {
        const driver = staffList.find(s => s.id == o.staff_driver_id);
        const isDone = o.status === '배송완료' || o.status === '완료됨';
        const installInfo = showTime ? getInstallationDisplayInfo(o) : null;
        const region = isMetroArea(o.address) ? '수도권' : '지방';
        html += `<div style="padding:8px 12px; border-bottom:1px solid #f1f5f9; font-size:14px; ${isDone?'opacity:0.5;':''}">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="font-weight:600;">${o.manager_name}</span>
                    <span style="color:#6366f1; margin-left:6px;">${o.phone || ''}</span>
                    ${installInfo ? `<span style="background:#ede9fe; color:#6d28d9; padding:2px 6px; border-radius:3px; margin-left:6px; font-size:12px;">${installInfo.start}~${installInfo.end}</span>` : ''}
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                    ${driver ? `<span style="color:#059669; font-size:13px;">🚛${driver.name}</span>` : ''}
                    ${isDone ? '<span style="color:#22c55e;">✅</span>' : `<span style="color:#94a3b8; font-size:12px;">${o.status}</span>`}
                    <button style="background:#f0f4ff; border:1px solid #c7d2fe; color:#4f46e5; border-radius:4px; font-size:11px; padding:2px 6px; cursor:pointer; margin-left:4px;" onclick="openDeliveryDateEdit('${o.id}','${o.delivery_target_date||''}')" title="배송일 변경">📅변경</button>
                </div>
            </div>
            ${o.address ? `<div style="color:#64748b; font-size:12px; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${o.address}</div>` : ''}
        </div>`;
    });
    html += '</div></div>';
    return html;
}

// ── 관리자 설치 예약 제거 ──
window.adminRemoveInstallation = async (orderId, dateStr) => {
    if (!confirm('이 주문의 설치 시간 예약을 제거하시겠습니까?')) return;
    try {
        await sb.from('orders').update({ installation_time: null }).eq('id', orderId);
        showToast('설치 예약 제거 완료', 'success');
        openAdminSlotModal(dateStr);
        renderAdminCalendar();
    } catch (e) {
        showToast('제거 실패: ' + e.message, 'error');
    }
};

// ── 관리자 스케줄 차단 추가 ──
window.adminAddSlotBlock = async () => {
    const dateStr = window._adminSlotDate;
    const time = document.getElementById('adminSlotTime').value;
    const type = document.getElementById('adminSlotType').value;
    const memo = document.getElementById('adminSlotMemo').value || '관리자 차단';
    if (!dateStr || !time) return;

    try {
        const blocksToAdd = type === 'block_all' ? ADMIN_MAX_TEAMS : 1;
        for (let i = 0; i < blocksToAdd; i++) {
            await sb.from('orders').insert({
                delivery_target_date: dateStr,
                installation_time: time,
                total_amount: 1000000,
                manager_name: `[차단] ${memo}`,
                phone: '-',
                status: '관리자차단',
                payment_status: '-',
                items: [],
                site_code: 'KR'
            });
        }
        showToast(`${time} 슬롯 차단 완료 (${blocksToAdd}팀)`, 'success');
        document.getElementById('adminSlotMemo').value = '';
        openAdminSlotModal(dateStr);
        renderAdminCalendar();
    } catch (e) {
        showToast('차단 추가 실패: ' + e.message, 'error');
    }
};

// ── 배송일 변경 팝업 ──
window.openDeliveryDateEdit = (orderId, currentDate) => {
    // 간단한 팝업으로 날짜 선택
    const modal = document.createElement('div');
    modal.id = '_deliveryDateModal';
    modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; z-index:10000;';
    modal.innerHTML = `
        <div style="background:white; border-radius:12px; padding:24px; min-width:340px; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
            <h3 style="margin:0 0 16px 0; font-size:18px; color:#1e293b;">📅 배송일 변경</h3>
            <div style="margin-bottom:12px; color:#64748b; font-size:13px;">주문번호: <b style="color:#4f46e5;">${orderId}</b></div>
            <div style="margin-bottom:8px; font-size:13px; color:#64748b;">현재 배송일: <b style="color:#e11d48;">${currentDate || '미지정'}</b></div>
            <input type="date" id="_newDeliveryDate" value="${currentDate}" style="width:100%; padding:10px 12px; border:2px solid #e2e8f0; border-radius:8px; font-size:15px; margin-bottom:16px;">
            <div style="display:flex; gap:8px;">
                <button onclick="document.getElementById('_deliveryDateModal').remove()" style="flex:1; padding:10px; border:1px solid #e2e8f0; border-radius:8px; background:white; cursor:pointer; font-size:14px;">취소</button>
                <button onclick="_saveDeliveryDate('${orderId}')" style="flex:1; padding:10px; border:none; border-radius:8px; background:#4f46e5; color:white; cursor:pointer; font-size:14px; font-weight:bold;">변경</button>
                ${currentDate ? `<button onclick="_clearDeliveryDate('${orderId}')" style="padding:10px 14px; border:none; border-radius:8px; background:#ef4444; color:white; cursor:pointer; font-size:14px;">삭제</button>` : ''}
            </div>
            <div style="margin-top:12px; padding:10px; background:#fffbeb; border-radius:6px; font-size:12px; color:#92400e;">
                ⚠️ 배송일 변경 시 작업지시서가 새로 생성됩니다.
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

window._saveDeliveryDate = async (orderId) => {
    const newDate = document.getElementById('_newDeliveryDate').value;
    if (!newDate) { showToast('날짜를 선택해주세요.', 'warn'); return; }

    try {
        showLoading(true);
        // 1. 배송일 업데이트
        const { error } = await sb.from('orders').update({ delivery_target_date: newDate }).eq('id', orderId);
        if (error) throw error;

        // 2. 작업지시서 새로 생성
        try {
            await regenerateWorkOrder(orderId);
        } catch(e2) {
            console.warn('작업지시서 재생성 실패 (수동 생성 필요):', e2);
        }

        document.getElementById('_deliveryDateModal')?.remove();
        showToast(`배송일이 ${newDate}로 변경되었습니다. 작업지시서가 새로 생성됩니다.`, 'success');
        loadOrders();
        if (typeof renderAdminCalendar === 'function') renderAdminCalendar();
        // 캘린더 슬롯 모달이 열려있으면 새로고침
        if (window._adminSlotDate && document.getElementById('adminSlotModal')?.style.display === 'flex') {
            openAdminSlotModal(window._adminSlotDate);
        }
    } catch (e) {
        showToast('배송일 변경 실패: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
};

window._clearDeliveryDate = async (orderId) => {
    if (!confirm('배송일을 삭제하시겠습니까?')) return;
    try {
        showLoading(true);
        await sb.from('orders').update({ delivery_target_date: null }).eq('id', orderId);
        document.getElementById('_deliveryDateModal')?.remove();
        showToast('배송일이 삭제되었습니다.', 'success');
        loadOrders();
        if (typeof renderAdminCalendar === 'function') renderAdminCalendar();
        if (window._adminSlotDate && document.getElementById('adminSlotModal')?.style.display === 'flex') {
            openAdminSlotModal(window._adminSlotDate);
        }
    } catch (e) {
        showToast('삭제 실패: ' + e.message, 'error');
    } finally {
        showLoading(false);
    }
};

// 작업지시서 재생성 (배송일 변경 시)
async function regenerateWorkOrder(orderId) {
    const { data: order } = await sb.from('orders')
        .select('id, manager_name, phone, address, request_note, delivery_target_date, created_at, items, files, total_amount, discount_amount, site_code')
        .eq('id', orderId).single();
    if (!order) return;

    // addon DB 로드
    const { data: addons } = await sb.from('admin_addons').select('code, name, display_name');
    const addonDB = {};
    if (addons) addons.forEach(a => addonDB[a.code] = a);

    // jsPDF 로드 + 소재 캐시
    await loadJsPDF();
    if (Object.keys(_materialCache).length === 0) await _loadMaterialCache();

    // 기존 작업지시서를 '_old' 마크 (삭제 대신 보존)
    const files = order.files || [];
    const updatedFiles = files.map(f => {
        if (f.type === 'order_sheet') return { ...f, type: 'order_sheet_old', note: `배송일변경으로_교체_${new Date().toISOString().slice(0,10)}` };
        return f;
    });

    // 새 작업지시서 생성 (기존 복구 함수 재활용)
    const blob = await generateRecoveryOrderSheet(order, addonDB);
    if (blob) {
        const ts = Date.now();
        const path = `orders/${orderId}/order_sheet_${ts}.pdf`;
        const { error: upErr } = await sb.storage.from('orders').upload(path, blob, { upsert: true });
        if (!upErr) {
            const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
            updatedFiles.push({ type: 'order_sheet', url: urlData.publicUrl, name: '작업지시서.pdf', created_at: new Date().toISOString() });
        }
    }

    await sb.from('orders').update({ files: updatedFiles }).eq('id', orderId);
}

// [헬퍼] 배송 데이터 업데이트
window.updateTaskDB = async (orderId, field, value) => {
    const valToSave = value === "" ? null : value;
    try {
        const { error } = await sb.from('orders').update({ [field]: valToSave }).eq('id', orderId);
        if (error) throw error;
    } catch (e) {
        showToast("업데이트 실패: " + e.message, "error");
    }
};

// 설치 예약 정보 표시 헬퍼
function getInstallationDisplayInfo(order) {
    if (!order.installation_time) return null;
    const SLOTS = ["08:00","10:00","12:00","14:00","16:00","18:00","20:00"];
    const startIdx = SLOTS.indexOf(order.installation_time);
    if (startIdx === -1) return null;
    const total = order.total_amount || 0;
    let slots = total >= 5000000 ? 7 : (total >= 3000000 ? 2 : 1);
    const endIdx = Math.min(startIdx + slots, SLOTS.length);
    const endTime = endIdx < SLOTS.length ? SLOTS[endIdx] : '22:00';
    return {
        start: order.installation_time,
        end: endTime,
        duration: slots === 7 ? '종일' : `${slots * 2}시간`,
        slots: slots
    };
}

window.updateOrderStaff = async (id, role, selectEl) => {
    const val = selectEl.value;
    const field = role === 'manager' ? 'staff_manager_id' : 'staff_driver_id';

    // 매니저 지정 시 소통요청 여부 확인
    if (role === 'manager' && val) {
        const { data: order } = await sb.from('orders').select('admin_note').eq('id', id).single();
        const note = order?.admin_note || '';
        if (!note.includes(CONTACT_REQ_MARKER) && !note.includes(CONTACT_DONE_MARKER)) {
            showToast('⚠️ 아직 소통요청이 없습니다. 먼저 소통요청을 해주세요.', 'error');
            selectEl.value = '';
            selectEl.style.backgroundColor = '#ffffff';
            selectEl.style.color = '#334155';
            selectEl.style.border = '1px solid #e2e8f0';
            return;
        }
    }

    // 1. DB 업데이트 (비동기 처리하되 UI는 먼저 반응)
    sb.from('orders').update({ [field]: val || null }).eq('id', id).then(({ error }) => {
        if(error) showToast("담당자 변경 실패: " + error.message, "error");
    });

    // 2. 선택된 스태프 정보 찾기
    const staff = staffList.find(s => String(s.id) === String(val));
    
    // 3. UI 전체 색상 즉시 적용
    if (staff && staff.color) {
        selectEl.style.backgroundColor = staff.color;
        selectEl.style.color = '#ffffff'; // 배경이 진할 것으로 가정하고 글자는 흰색
        selectEl.style.borderColor = staff.color;
        selectEl.style.fontWeight = 'bold';
    } else {
        // 미지정 선택 시 기본 흰색 배경으로 복구
        selectEl.style.backgroundColor = '#ffffff';
        selectEl.style.color = '#334155';
        selectEl.style.borderColor = '#e2e8f0';
        selectEl.style.fontWeight = 'normal';
    }
};

// ═══ 증빙 정보 모달 ═══
window.openReceiptInfo = async (orderId) => {
    const { data: order } = await sb.from('orders').select('receipt_info, manager_name, total_amount').eq('id', orderId).single();
    const ri = order?.receipt_info;
    if (!ri || ri.type === 'none') { showToast('증빙 정보 없음', 'warn'); return; }
    const typeLabel = ri.type === 'tax_invoice' ? '📄 세금계산서' : ri.type === 'cash_receipt_biz' ? '🧾 현금영수증 (지출증빙)' : '🧾 현금영수증 (개인소득공제)';
    let html = `<div style="padding:24px; max-width:480px; margin:0 auto;">
        <h3 style="margin:0 0 16px; font-size:18px;">${typeLabel}</h3>
        <div style="background:#f8fafc; padding:16px; border-radius:10px; font-size:14px; line-height:2;">`;
    if (ri.type === 'tax_invoice') {
        html += `<b>사업자번호:</b> ${ri.biz_number||'-'}<br>
            <b>회사명:</b> ${ri.company_name||'-'}<br>
            <b>대표자명:</b> ${ri.rep_name||'-'}<br>
            <b>업태:</b> ${ri.biz_type||'-'}<br>
            <b>종목:</b> ${ri.biz_category||'-'}<br>
            <b>사업장주소:</b> ${ri.biz_address||'-'}<br>
            <b>이메일:</b> ${ri.email||'-'}`;
    } else {
        html += `<b>식별번호:</b> ${ri.id_number||'-'}`;
    }
    html += `</div><div style="margin-top:8px; font-size:12px; color:#666;">주문자: ${order.manager_name||'-'} / 금액: ${(order.total_amount||0).toLocaleString()}원</div>
        <button onclick="this.closest('.modal-bg').remove()" style="margin-top:16px; width:100%; padding:12px; background:#6366f1; color:#fff; border:none; border-radius:8px; font-size:15px; font-weight:bold; cursor:pointer;">닫기</button></div>`;
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `<div style="background:#fff;border-radius:16px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">${html}</div>`;
    modal.onclick = e => { if(e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
};

// ═══ 입금/취소 모달 ═══
window.openDepositModal = (orderId, customerName, totalAmount) => {
    const existing = document.getElementById('depositModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'depositModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:white;border-radius:16px;padding:28px 32px;width:420px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <h3 style="margin:0;font-size:18px;color:#1e293b;">주문 #${orderId}</h3>
                <button onclick="document.getElementById('depositModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">&times;</button>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:14px;margin-bottom:18px;">
                <div style="font-size:14px;color:#475569;"><b>${customerName}</b></div>
                <div style="font-size:18px;font-weight:bold;color:#1e293b;margin-top:4px;">${Number(totalAmount).toLocaleString()}원</div>
            </div>
            <div style="margin-bottom:16px;">
                <label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px;">메모 (선택)</label>
                <textarea id="depositMemo" rows="3" style="width:100%;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:13px;resize:none;box-sizing:border-box;" placeholder="입금자명, 취소사유 등 메모"></textarea>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="processDeposit('${orderId}','confirm')" style="flex:1;padding:14px;font-size:15px;font-weight:bold;border:none;border-radius:10px;cursor:pointer;background:#15803d;color:white;">💰 입금처리</button>
                <button onclick="processDeposit('${orderId}','cancel')" style="flex:1;padding:14px;font-size:15px;font-weight:bold;border:none;border-radius:10px;cursor:pointer;background:#dc2626;color:white;">✕ 취소처리</button>
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};

window.processDeposit = async (orderId, action) => {
    const memo = document.getElementById('depositMemo')?.value.trim() || '';
    const now = new Date().toLocaleString('ko-KR');
    const memoLine = memo ? `[${now}] ${memo}` : '';

    try {
        // 기존 request_note 가져오기
        const { data: ord } = await sb.from('orders').select('request_note').eq('id', orderId).maybeSingle();
        let noteArr = [];
        if (ord?.request_note) noteArr.push(ord.request_note);
        if (memoLine) noteArr.push(memoLine);

        if (action === 'confirm') {
            await sb.from('orders').update({
                payment_status: '결제완료',
                request_note: noteArr.length ? noteArr.join('\n') : ord?.request_note || null
            }).eq('id', orderId);
            await creditReferralBonus(orderId);
            showToast('입금처리 완료 → 결제완료', 'success');
        } else {
            const cancelNote = noteArr.length ? noteArr.join('\n') : (ord?.request_note || '');
            await sb.from('orders').update({
                status: '취소됨',
                payment_status: '주문취소',
                request_note: cancelNote ? cancelNote : '[관리자 취소]'
            }).eq('id', orderId);
            showToast('취소처리 완료', 'success');
        }
    } catch (e) {
        showToast('처리 실패: ' + e.message, 'error');
    }
    document.getElementById('depositModal')?.remove();
    loadOrders();
    updateCancelReqBadge();
};

// [수정됨] 월별 매출 정산 엑셀 다운로드 (결제일, 담당매니저 추가)
window.downloadMonthlyExcel = async () => {
    // 1. HTML에 있는 월 선택 박스(id="excelMonth") 값 가져오기
    const monthInput = document.getElementById('excelMonth');
    const siteFilter = document.getElementById('filterSite') ? document.getElementById('filterSite').value : 'all';

    // 월 선택이 안 되어있으면 오늘 날짜 기준으로 설정
    let targetYear, targetMonth;
    
    if (monthInput && monthInput.value) {
        [targetYear, targetMonth] = monthInput.value.split('-');
    } else {
        const now = new Date();
        targetYear = now.getFullYear();
        targetMonth = String(now.getMonth() + 1).padStart(2, '0');
    }

    // 2. 해당 월의 시작일(1일)과 마지막 날 계산
    const startDate = `${targetYear}-${targetMonth}-01`;
    const lastDay = new Date(targetYear, targetMonth, 0).getDate(); 
    const endDate = `${targetYear}-${targetMonth}-${lastDay}`;

    if(!confirm(`${targetYear}년 ${targetMonth}월 (${startDate} ~ ${endDate})\n전체 주문 데이터를 다운로드하시겠습니까?`)) return;
    showLoading(true);

    try {
        // [중요] 매니저 이름을 찾기 위해 스태프 목록이 비어있다면 먼저 로드
        if (staffList.length === 0) {
            const { data: sData } = await sb.from('admin_staff').select('id, name, role, color');
            staffList = sData || [];
        }

        // 3. 쿼리 구성
        let query = sb.from('orders')
            .select('id, status, total_amount, items, created_at, payment_status, payment_method, manager_name, phone, address, site_code, staff_manager_id, staff_driver_id, delivery_target_date')
            .gte('created_at', startDate + 'T00:00:00')
            .lte('created_at', endDate + 'T23:59:59')
            .order('created_at', { ascending: false });

        query = query.neq('status', '임시작성');

        if (siteFilter !== 'all') {
            query = query.eq('site_code', siteFilter);
        }

        const { data, error } = await query;
        if(error) throw error;

        if(!data || data.length === 0) {
            showToast("해당 기간에 조회된 주문 내역이 없습니다.", "info");
            showLoading(false);
            return;
        }

        // 4. 엑셀 데이터 매핑
        const excelData = data.map(o => {
            // 상품 목록 텍스트 변환
            let itemText = '';
            try {
                const items = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
                itemText = items.map(i => `${i.productName || '상품'}(${i.qty})`).join(', ');
            } catch(e) {}

            // [추가] 담당 매니저 이름 찾기
            const managerObj = staffList.find(s => s.id == o.staff_manager_id);
            const managerName = managerObj ? managerObj.name : '미지정';

            // [추가] 결제일 포맷팅 (payment_date 컬럼이 없으면 payment_updated_at 등을 사용하거나, 없으면 - 처리)
            // DB에 payment_date 컬럼이 있다면 그것을 쓰고, 없다면 상태 변경일을 쓰거나 빈칸 처리
            let payDate = '-';
            if (o.payment_date) {
                payDate = new Date(o.payment_date).toLocaleDateString();
            } else if (o.payment_status === '결제완료' || o.payment_status === '입금확인') {
                // 결제일 컬럼이 따로 없고 결제가 완료된 상태라면, 수정일(updated_at)을 임시로 사용하거나 빈칸
                // 여기서는 데이터가 있으면 표시하고 없으면 - 로 둡니다.
                payDate = o.updated_at ? new Date(o.updated_at).toLocaleDateString() : '-'; 
            }

            return {
                "주문번호": o.id,
                "사이트": o.site_code || 'KR',
                "주문일자": new Date(o.created_at).toLocaleDateString(),
                "결제일": payDate,           // [NEW] 결제일
                "담당매니저": managerName,   // [NEW] 담당 매니저
                "고객명": o.manager_name,
                "연락처": o.phone,
                "주문내역": itemText,
                "총금액": o.total_amount || 0,
                "할인액": o.discount_amount || 0,
                "실결제액": o.actual_payment || o.total_amount || 0,
                "결제상태": o.payment_status || '-',
                "현재상태": o.status,
                "배송요청일": o.delivery_target_date || '-'
            };
        });

        // 5. 엑셀 파일 생성 (SheetJS)
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);

        // 컬럼 너비 설정 (순서에 맞춰 조정)
        ws['!cols'] = [
            { wch: 8 },  // 주문번호
            { wch: 6 },  // 사이트
            { wch: 12 }, // 주문일자
            { wch: 12 }, // [NEW] 결제일
            { wch: 10 }, // [NEW] 담당매니저
            { wch: 10 }, // 고객명
            { wch: 15 }, // 연락처
            { wch: 40 }, // 주문내역
            { wch: 12 }, // 총금액
            { wch: 10 }, // 할인액
            { wch: 12 }, // 실결제액
            { wch: 10 }, // 결제상태
            { wch: 10 }, // 현재상태
            { wch: 12 }  // 배송요청일
        ];

        XLSX.utils.book_append_sheet(wb, ws, `${targetMonth}월_매출정산`);
        XLSX.writeFile(wb, `매출정산_${targetYear}_${targetMonth}.xlsx`);

    } catch (e) {
        console.error(e);
        showToast("다운로드 실패: " + e.message, "error");
    } finally {
        showLoading(false);
    }
};
// [추가] 입찰 본사 직권 처리 (파트너 입찰 막기)
// ============================================================
// [수동주문] 모달 열기/닫기 + 등록
// ============================================================
window.openManualOrderModal = () => {
    // order_management.html에서는 showSection으로 오버라이드됨
    // global_admin.html에서는 모달을 사용
    const modal = document.getElementById('manualOrderModal');
    if (modal && modal.querySelector('.modal-box')) {
        document.getElementById('moSource').value = 'STORE';
        document.getElementById('moName').value = '';
        document.getElementById('moPhone').value = '';
        document.getElementById('moAddress').value = '';
        document.getElementById('moItems').value = '';
        document.getElementById('moAmount').value = '';
        document.getElementById('moDelivery').value = '';
        document.getElementById('moNote').value = '';
        document.getElementById('moFiles').value = '';
        modal.style.display = 'flex';
    }
};

window.submitManualOrder = async () => {
    const source = document.getElementById('moSource').value;
    const name = document.getElementById('moName').value.trim();
    const phone = document.getElementById('moPhone').value.trim();
    const address = document.getElementById('moAddress').value.trim();
    const itemsText = document.getElementById('moItems').value.trim();
    const amount = parseInt(document.getElementById('moAmount').value) || 0;
    const delivery = document.getElementById('moDelivery').value;
    const note = document.getElementById('moNote').value.trim();
    const fileInput = document.getElementById('moFiles');

    if (!name) { alert('고객명을 입력하세요.'); return; }
    if (!itemsText) { alert('주문내역을 입력하세요.'); return; }
    if (amount <= 0) { alert('주문총액을 입력하세요.'); return; }

    showLoading(true);
    try {
        const sourceName = source === 'STORE' ? '스마트스토어' : '고도몰';
        const payMethod = source === 'STORE' ? '스토어결제' : '고도몰결제';

        // items를 JSON 배열로 변환 (줄 단위로 분리)
        const lines = itemsText.split('\n').filter(l => l.trim());
        const items = lines.map(line => ({ productName: line.trim(), qty: 1 }));

        // DB 주문 생성
        const { data: orderData, error } = await sb.from('orders').insert([{
            manager_name: name,
            phone: phone,
            address: address,
            request_note: note ? `[${sourceName}] ${note}` : `[${sourceName}]`,
            total_amount: amount,
            discount_amount: 0,
            items: items,
            status: '접수됨',
            payment_status: '결제완료',
            payment_method: payMethod,
            site_code: source,
            delivery_target_date: delivery || null,
            created_at: new Date().toISOString()
        }]).select();

        if (error) throw error;
        const orderId = orderData[0].id;

        // 파일 업로드
        if (fileInput.files.length > 0) {
            const files = [];
            for (const f of fileInput.files) {
                const ext = f.name.split('.').pop().toLowerCase();
                const safe = Date.now() + '-' + Math.random().toString(36).substr(2, 6) + '.' + ext;
                const path = `orders/${orderId}/${safe}`;
                const { error: upErr } = await sb.storage.from('orders').upload(path, f);
                if (!upErr) {
                    const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                    files.push({ name: f.name, url: urlData.publicUrl, type: 'admin_added' });
                }
            }
            if (files.length > 0) {
                await sb.from('orders').update({ files }).eq('id', orderId);
            }
        }

        document.getElementById('manualOrderModal').style.display = 'none';
        alert(`✅ ${sourceName} 수동주문이 등록되었습니다. (주문번호: ${orderId})`);
        loadOrders();
    } catch (e) {
        console.error('[수동주문] 오류:', e);
        alert('주문 등록 실패: ' + e.message);
    } finally {
        showLoading(false);
    }
};

// ═══════════════════════════════════════════════════════
// [고객 정보 팝업] — 마일리지, 예치금, 메모, 주문내역
// ═══════════════════════════════════════════════════════
window.openCustomerInfo = async function(userId, name, phone) {
    // 이미 모달이 있으면 제거
    let modal = document.getElementById('customerInfoModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'customerInfoModal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `<div style="background:white;border-radius:16px;width:700px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);"><div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;"><h3 style="margin:0;font-size:18px;">👤 고객 정보 — ${name}</h3><button onclick="document.getElementById('customerInfoModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#64748b;">✕</button></div><div id="customerInfoBody" style="padding:24px;"><div style="text-align:center;padding:40px;color:#94a3b8;">로딩중...</div></div></div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });

    const body = document.getElementById('customerInfoBody');

    try {
        // 1. 프로필 정보 (회원인 경우)
        let profile = null;
        if (userId) {
            const { data } = await sb.from('profiles').select('id, email, username, deposit, mileage, total_spend, admin_memo, created_at').eq('id', userId).maybeSingle();
            profile = data;
        }

        // 2. 해당 고객의 주문 내역 (이름+전화번호 기준)
        let orderQuery = sb.from('orders')
            .select('id, status, total_amount, created_at, payment_status, items, site_code, payment_method')
            .neq('status', '임시작성')
            .order('created_at', { ascending: false })
            .limit(30);
        if (userId) {
            orderQuery = orderQuery.eq('user_id', userId);
        } else {
            orderQuery = orderQuery.ilike('manager_name', name);
        }
        const { data: orders } = await orderQuery;

        // 3. 렌더링
        let html = '';

        // 고객 기본 정보
        html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">`;
        html += `<div style="background:#f8fafc;padding:14px 16px;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:11px;color:#64748b;margin-bottom:4px;">이름</div><div style="font-size:16px;font-weight:bold;">${name}</div></div>`;
        html += `<div style="background:#f8fafc;padding:14px 16px;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:11px;color:#64748b;margin-bottom:4px;">전화번호</div><div style="font-size:16px;font-weight:bold;">${phone || '-'}</div></div>`;
        if (profile) {
            html += `<div style="background:#eff6ff;padding:14px 16px;border-radius:10px;border:1px solid #bfdbfe;">
                <div style="font-size:11px;color:#3b82f6;margin-bottom:4px;">💰 마일리지</div>
                <div style="font-size:18px;font-weight:bold;color:#1d4ed8;" id="custMileageVal">${(profile.mileage || 0).toLocaleString()}원</div>
                <div style="display:flex;gap:4px;margin-top:8px;">
                    <input id="custMileageAmt" type="number" placeholder="금액" style="width:80px;border:1px solid #bfdbfe;border-radius:6px;padding:4px 6px;font-size:12px;">
                    <button onclick="adjustBalance('${userId}','mileage',1)" style="background:#2563eb;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">+ 지급</button>
                    <button onclick="adjustBalance('${userId}','mileage',-1)" style="background:#ef4444;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">- 차감</button>
                </div>
            </div>`;
            html += `<div style="background:#faf5ff;padding:14px 16px;border-radius:10px;border:1px solid #ddd6fe;">
                <div style="font-size:11px;color:#7c3aed;margin-bottom:4px;">🏦 예치금</div>
                <div style="font-size:18px;font-weight:bold;color:#6d28d9;" id="custDepositVal">${(profile.deposit || 0).toLocaleString()}원</div>
                <div style="display:flex;gap:4px;margin-top:8px;">
                    <input id="custDepositAmt" type="number" placeholder="금액" style="width:80px;border:1px solid #ddd6fe;border-radius:6px;padding:4px 6px;font-size:12px;">
                    <button onclick="adjustBalance('${userId}','deposit',1)" style="background:#7c3aed;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">+ 지급</button>
                    <button onclick="adjustBalance('${userId}','deposit',-1)" style="background:#ef4444;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;">- 차감</button>
                </div>
            </div>`;
            html += `<div style="background:#f0fdf4;padding:14px 16px;border-radius:10px;border:1px solid #bbf7d0;"><div style="font-size:11px;color:#15803d;margin-bottom:4px;">📊 총 주문액</div><div style="font-size:18px;font-weight:bold;color:#166534;">${(profile.total_spend || 0).toLocaleString()}원</div></div>`;
            html += `<div style="background:#f8fafc;padding:14px 16px;border-radius:10px;border:1px solid #e2e8f0;"><div style="font-size:11px;color:#64748b;margin-bottom:4px;">📧 이메일</div><div style="font-size:13px;word-break:break-all;">${profile.email || '-'}</div></div>`;
        } else {
            html += `<div style="grid-column:1/3;background:#fffbeb;padding:14px 16px;border-radius:10px;border:1px solid #fde68a;"><span style="color:#92400e;font-size:13px;">⚠️ 비회원 주문 — 마일리지/예치금 정보 없음</span></div>`;
        }
        html += `</div>`;

        // 메모
        const memoVal = profile?.admin_memo || '';
        html += `<div style="margin-bottom:20px;">`;
        html += `<div style="font-size:13px;font-weight:bold;margin-bottom:6px;">📝 관리자 메모</div>`;
        if (profile) {
            html += `<div style="display:flex;gap:8px;"><textarea id="custMemoInput" style="flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:13px;min-height:60px;resize:vertical;">${memoVal}</textarea><button onclick="saveCustomerMemo('${userId}')" style="background:#4f46e5;color:white;border:none;border-radius:8px;padding:8px 16px;cursor:pointer;font-size:13px;white-space:nowrap;">저장</button></div>`;
        } else {
            html += `<div style="color:#94a3b8;font-size:13px;padding:10px;background:#f8fafc;border-radius:8px;">비회원은 메모를 저장할 수 없습니다.</div>`;
        }
        html += `</div>`;

        // 주문 내역
        html += `<div style="font-size:13px;font-weight:bold;margin-bottom:8px;">📦 주문 내역 (최근 30건)</div>`;
        if (orders && orders.length > 0) {
            html += `<table style="width:100%;border-collapse:collapse;font-size:12px;">`;
            html += `<thead><tr style="background:#f1f5f9;"><th style="padding:6px 8px;text-align:left;">날짜</th><th style="padding:6px 8px;text-align:center;">주문번호</th><th style="padding:6px 8px;text-align:left;">주문내역</th><th style="padding:6px 8px;text-align:right;">금액</th><th style="padding:6px 8px;text-align:center;">상태</th></tr></thead><tbody>`;
            orders.forEach(o => {
                const d = new Date(o.created_at);
                const dt = `${d.getFullYear()}.${d.getMonth()+1}.${d.getDate()}`;
                const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
                const itemStr = items.map(i => i.productName || '상품').join(', ');
                const stColor = o.status.includes('취소') ? '#ef4444' : o.status.includes('완료') ? '#15803d' : '#334155';
                html += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:6px 8px;">${dt}</td><td style="padding:6px 8px;text-align:center;font-size:11px;color:#64748b;">${o.id}</td><td style="padding:6px 8px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${itemStr}">${itemStr}</td><td style="padding:6px 8px;text-align:right;font-weight:bold;">${(o.total_amount||0).toLocaleString()}</td><td style="padding:6px 8px;text-align:center;color:${stColor};font-weight:bold;">${o.status}</td></tr>`;
            });
            html += `</tbody></table>`;
        } else {
            html += `<div style="text-align:center;padding:20px;color:#94a3b8;">주문 내역이 없습니다.</div>`;
        }

        body.innerHTML = html;
    } catch (err) {
        console.error('Customer info error:', err);
        body.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;">오류: ${err.message}</div>`;
    }
};

window.saveCustomerMemo = async function(userId) {
    const memo = document.getElementById('custMemoInput').value;
    try {
        await sb.from('profiles').update({ admin_memo: memo }).eq('id', userId);
        alert('✅ 메모가 저장되었습니다.');
    } catch (err) {
        alert('저장 실패: ' + err.message);
    }
};

window.adjustBalance = async function(userId, field, direction) {
    const inputId = field === 'mileage' ? 'custMileageAmt' : 'custDepositAmt';
    const displayId = field === 'mileage' ? 'custMileageVal' : 'custDepositVal';
    const label = field === 'mileage' ? '마일리지' : '예치금';
    const amt = parseInt(document.getElementById(inputId).value);
    if (!amt || amt <= 0) { alert('금액을 입력해주세요.'); return; }

    const change = amt * direction;
    const action = direction > 0 ? '지급' : '차감';
    if (!confirm(`${label} ${amt.toLocaleString()}원을 ${action}하시겠습니까?`)) return;

    try {
        const { data: pf } = await sb.from('profiles').select(field).eq('id', userId).single();
        const current = pf[field] || 0;
        const newVal = current + change;
        if (newVal < 0) { alert(`${label}이 부족합니다. (현재: ${current.toLocaleString()}원)`); return; }

        await sb.from('profiles').update({ [field]: newVal }).eq('id', userId);

        // 트랜잭션 로그 기록
        await sb.from('transactions').insert({
            user_id: userId,
            type: `admin_${field}_${direction > 0 ? 'add' : 'deduct'}`,
            amount: change,
            description: `관리자 ${action}: ${amt.toLocaleString()}원`
        });

        document.getElementById(displayId).textContent = newVal.toLocaleString() + '원';
        document.getElementById(inputId).value = '';
        alert(`✅ ${label} ${amt.toLocaleString()}원 ${action} 완료 (잔액: ${newVal.toLocaleString()}원)`);
    } catch (err) {
        console.error('Balance adjust error:', err);
        alert('처리 실패: ' + err.message);
    }
};

// ============================================================
// ★ 제작사진 업로드 & 문의 답변 (주문 현황 트래커용)
// ============================================================

window.openProductionPhotoUpload = async function(orderId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = async () => {
        const files = Array.from(input.files).slice(0, 3);
        if (!files.length) return;
        showLoading(true);
        try {
            const urls = [];
            for (const f of files) {
                const ext = f.name.split('.').pop();
                const path = `production_photos/${orderId}_${Date.now()}_${Math.random().toString(36).substr(2,4)}.${ext}`;
                const { error: upErr } = await sb.storage.from('orders').upload(path, f, { upsert: true });
                if (upErr) { console.error(upErr); continue; }
                const { data: urlData } = sb.storage.from('orders').getPublicUrl(path);
                if (urlData) urls.push(urlData.publicUrl);
            }
            if (urls.length) {
                // 기존 사진에 추가
                const { data: order } = await sb.from('orders').select('production_photos').eq('id', orderId).maybeSingle();
                const existing = (order && order.production_photos) || [];
                const allPhotos = [...existing, ...urls].slice(0, 6); // 최대 6장
                await sb.from('orders').update({ production_photos: allPhotos }).eq('id', orderId);
                alert(`✅ ${urls.length}장 업로드 완료`);
                loadOrders();
            }
        } catch(e) { console.error(e); alert('업로드 실패: ' + e.message); }
        showLoading(false);
    };
    input.click();
};

window.openAdminInquiryPanel = async function(orderId) {
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.addEventListener('click', e => { if(e.target === ov) ov.remove(); });

    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:#fff;border-radius:16px;max-width:500px;width:100%;max-height:85vh;overflow-y:auto;padding:24px;position:relative;';
    ov.appendChild(wrap);
    document.body.appendChild(ov);

    // 주문 정보 로드
    const { data: order } = await sb.from('orders').select('id, manager_name, status, production_photos').eq('id', orderId).maybeSingle();
    const { data: inquiries } = await sb.from('order_inquiries').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
    const photos = (order && order.production_photos) || [];

    wrap.innerHTML = `
        <button onclick="this.closest('div[style*=inset]').remove()" style="position:absolute;top:12px;right:12px;border:none;background:none;font-size:20px;cursor:pointer;color:#94a3b8;">✕</button>
        <div style="font-size:16px;font-weight:900;margin-bottom:16px;">📋 주문 #${orderId} - ${order ? order.manager_name : ''}</div>

        <div style="margin-bottom:16px;">
            <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:6px;">📷 제작사진 (${photos.length}/6)</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
                ${photos.map((u,i) => `<div style="position:relative;"><img src="${u}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #e2e8f0;">
                    <button onclick="window.deleteProductionPhoto(${orderId},${i})" style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;background:#ef4444;color:#fff;border:none;font-size:10px;cursor:pointer;line-height:1;">✕</button></div>`).join('')}
            </div>
            <button onclick="window.openProductionPhotoUpload(${orderId}); this.closest('div[style*=inset]').remove();" style="padding:6px 14px;background:#3b82f6;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;">📷 사진 추가</button>
        </div>

        <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
            <div style="font-size:13px;font-weight:800;margin-bottom:10px;">💬 문의 / 답변</div>
            <div style="max-height:250px;overflow-y:auto;margin-bottom:12px;">
                ${(!inquiries || !inquiries.length) ? '<div style="font-size:12px;color:#94a3b8;text-align:center;padding:10px;">문의 내역 없음</div>' : inquiries.map(inq => `
                    <div style="margin-bottom:8px;padding:8px 10px;border-radius:8px;background:${inq.is_admin ? '#ede9fe' : '#f0f9ff'};font-size:12px;">
                        <div style="font-weight:700;color:${inq.is_admin ? '#7c3aed' : '#0369a1'};margin-bottom:2px;">${inq.is_admin ? '👨‍💼 관리자' : '👤 고객'}</div>
                        <div style="color:#334155;">${inq.message}</div>
                        <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${new Date(inq.created_at).toLocaleString('ko')}</div>
                    </div>
                `).join('')}
            </div>
            <div style="display:flex;gap:8px;">
                <input type="text" id="adminReplyInput_${orderId}" placeholder="관리자 답변 입력" style="flex:1;padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;outline:none;" onkeydown="if(event.key==='Enter') window.submitAdminReply(${orderId})">
                <button onclick="window.submitAdminReply(${orderId})" style="padding:8px 16px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;">답변</button>
            </div>
        </div>
    `;
};

window.submitAdminReply = async function(orderId) {
    const input = document.getElementById('adminReplyInput_' + orderId);
    const msg = input ? input.value.trim() : '';
    if (!msg) return;
    await sb.from('order_inquiries').insert({ order_id: orderId, message: msg, is_admin: true });
    input.value = '';
    // 팝업 새로고침
    document.querySelector('div[style*="inset:0"]')?.remove();
    window.openAdminInquiryPanel(orderId);
};

window.deleteProductionPhoto = async function(orderId, photoIndex) {
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;
    const { data: order } = await sb.from('orders').select('production_photos').eq('id', orderId).maybeSingle();
    const photos = (order && order.production_photos) || [];
    photos.splice(photoIndex, 1);
    await sb.from('orders').update({ production_photos: photos }).eq('id', orderId);
    document.querySelector('div[style*="inset:0"]')?.remove();
    window.openAdminInquiryPanel(orderId);
};
