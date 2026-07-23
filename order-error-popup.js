/* ============================================================
 * order-error-popup.js — 관리자 알림 / 주문에러 팝업 (고객 접속 시)
 * 2026-07-16 신규.
 *
 * 무엇:
 *   관리자가 [⚠️ 주문에러] 로 보낸 메시지를 고객이 접속했을 때 팝업으로 보여준다.
 *   (마이페이지가 아니라 접속 즉시 — 그 고객에게만)
 *   - 한국어 원문은 content, 번역본은 content_ja / content_en 에 저장돼 있다 (global_orders.js 가 발송 시 번역).
 *   - kind='file_error' 면 팝업에서 바로 파일 재접수 가능 → 재접수 전까진 접속할 때마다 다시 뜬다.
 *
 * 왜 별도 파일:
 *   원래 index.html 안에 checkUnreadMessages 가 있었는데 window.currentUser + 모듈스코프 sb 에 묶여 있어
 *   패브릭 사이트(cotton_print / cotton_designer — config.js·login.js 를 안 씀)에서 재사용이 불가능했다.
 *   → 의존성 없는 평범한 script 하나로 빼서 메인/패브릭이 공유한다.
 *
 * 로드: index.html · cotton_print.html · cotton_designer.html
 * 트리거: config.js 의 updateUserSession → window.checkUnreadMessages() (이름 그대로 유지)
 *         + 이 파일 자체 DOMContentLoaded 폴백 (패브릭엔 updateUserSession 이 없음)
 * ============================================================ */
(function () {
    'use strict';

    var SB_URL = 'https://qinvtnhiidtmrzosyvys.supabase.co';
    var SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbnZ0bmhpaWR0bXJ6b3N5dnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMDE3NjQsImV4cCI6MjA3ODc3Nzc2NH0.3z0f7R4w3bqXTOMTi19ksKSeAkx8HOOTONNSos8Xz8Y';
    var AUTH_KEY = 'sb-qinvtnhiidtmrzosyvys-auth-token';   // 메인/패브릭 세션 공유 — 반드시 동일해야 함
    var BUCKET = 'design';

    // ── supabase 클라이언트 (기존 것 우선 — 중복 GoTrueClient 는 OAuth 레이스를 유발)
    function getSb() {
        if (window.sb) return window.sb;
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            window.sb = window.supabase.createClient(SB_URL, SB_KEY, {
                auth: { persistSession: true, storage: localStorage, storageKey: AUTH_KEY }
            });
            return window.sb;
        }
        return null;
    }

    async function getUserId(sb) {
        if (window.currentUser && window.currentUser.id) return window.currentUser.id;
        try {
            var r = await sb.auth.getSession();
            return (r && r.data && r.data.session && r.data.session.user && r.data.session.user.id) || null;
        } catch (e) { return null; }
    }

    // ── 언어: 메인은 CURRENT_LANG, 패브릭은 __PS_LANG / __CD_LANG, 없으면 hostname
    //   (index.html 이 쓰던 SITE_CONFIG.LANG 은 site-config.js 에 존재하지 않는 키였다 → 항상 한국어로 떨어지던 버그)
    function getLang() {
        var l = window.CURRENT_LANG || window.__PS_LANG || window.__CD_LANG || '';
        if (!l) {
            var h = location.hostname;
            if (h.indexOf('cafe0101') >= 0 || h.indexOf('cotton-printer.com') >= 0) l = 'ja';
            else if (h.indexOf('cafe3355') >= 0 || h.indexOf('chameleon.design') >= 0) l = 'en';
            else l = 'kr';
        }
        if (l === 'ko') l = 'kr';
        if (l === 'jp') l = 'ja';
        if (l === 'us') l = 'en';
        return l;
    }

    var T = {
        kr: { title: '알림', ok: '확인했습니다', reupload: '파일 다시 접수', uploading: '업로드 중...',
              done: '파일이 다시 접수되었습니다. 확인 후 연락드리겠습니다.',
              fail: '업로드에 실패했습니다. 잠시 후 다시 시도해주세요.', order: '주문번호' },
        ja: { title: 'お知らせ', ok: '確認しました', reupload: 'ファイルを再入稿', uploading: 'アップロード中...',
              done: 'ファイルを再入稿しました。確認後ご連絡いたします。',
              fail: 'アップロードに失敗しました。しばらくしてからもう一度お試しください。', order: 'ご注文番号' },
        en: { title: 'Notifications', ok: 'Got it', reupload: 'Re-upload file', uploading: 'Uploading...',
              done: 'Your file has been re-submitted. We will contact you after review.',
              fail: 'Upload failed. Please try again in a moment.', order: 'Order' }
    };
    function t(lang) { return T[lang] || T.en || T.kr; }   // 2026-07-23: 한/일 외 언어는 영어로

    function esc(s) {
        return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // 언어별 본문 — 번역본이 없으면 한국어 원문으로 폴백
    function pickContent(m, lang) {
        if (lang === 'ja' && m.content_ja) return m.content_ja;
        if (lang === 'en' && m.content_en) return m.content_en;
        return m.content || '';
    }

    // ── 메인 진입점. 이름은 기존 그대로 (config.js:377 이 이 이름으로 호출)
    //   config.js 트리거 + 이 파일의 boot() 폴백이 동시에 부를 수 있어 2중 가드(_busy + DOM).
    var _busy = false;
    window.checkUnreadMessages = async function () {
        var sb = getSb();
        if (!sb || _busy) return;
        if (document.getElementById('msgPopupOverlay')) return;   // 중복 방지 (탭 재포커스 시 SIGNED_IN 재발생)
        _busy = true;
        try {
            var uid = await getUserId(sb);
            if (!uid) return;

            // 안 읽은 메시지 + 미해결 파일에러(확인만 눌렀어도 파일 올릴 때까진 계속 노출)
            var res = await sb.from('messages')
                .select('id, content, content_ja, content_en, kind, order_id, resolved_at, created_at')
                .eq('user_id', uid)
                .or('is_read.eq.false,and(kind.eq.file_error,resolved_at.is.null)')
                .order('created_at', { ascending: false })
                .limit(5);
            if (res.error || !res.data || res.data.length === 0) return;
            if (document.getElementById('msgPopupOverlay')) return;   // await 중에 다른 호출이 띄웠을 수 있음

            renderPopup(res.data, getLang());
        } catch (e) { console.warn('[order-error-popup] 메시지 확인 실패:', e); }
        finally { _busy = false; }
    };

    function renderPopup(data, lang) {
        var L = t(lang);
        var overlay = document.createElement('div');
        overlay.id = 'msgPopupOverlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:30000;display:flex;align-items:center;justify-content:center;';
        overlay.onclick = function (e) { if (e.target === overlay) overlay.remove(); };

        var msgsHtml = '';
        data.forEach(function (m) {
            var d = new Date(m.created_at);
            var dateStr = (d.getMonth() + 1) + '/' + d.getDate() + ' ' + d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
            // kind 가 없는 레거시 메시지는 본문의 [파일에러] 마커로 판정
            var isFileErr = m.kind === 'file_error' || (!m.kind && (m.content || '').indexOf('[파일에러]') >= 0);
            var isErr = isFileErr || m.kind === 'order_error';
            var icon = isErr ? '⚠️' : '📢';
            var border = isErr ? '#f59e0b' : '#6366f1';
            var canReupload = (m.kind === 'file_error') && m.order_id && !m.resolved_at;

            msgsHtml += '<div style="background:#fff;border-left:4px solid ' + border + ';padding:14px 16px;border-radius:8px;margin-bottom:8px;">' +
                '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">' + icon + ' ' + dateStr +
                (m.order_id ? ' · ' + L.order + ' ' + esc(m.order_id) : '') + '</div>' +
                '<div style="font-size:14px;color:#1e293b;white-space:pre-wrap;line-height:1.5;">' + esc(pickContent(m, lang)) + '</div>' +
                (canReupload
                    ? '<div style="margin-top:10px;">' +
                      '<label style="display:inline-block;padding:9px 14px;background:#f59e0b;color:#fff;border-radius:8px;font-size:13px;cursor:pointer;">' +
                      L.reupload +
                      '<input type="file" data-oe-msg="' + esc(m.id) + '" data-oe-order="' + esc(m.order_id) + '" style="display:none;">' +
                      '</label>' +
                      '<span class="oe-status" data-oe-status="' + esc(m.id) + '" style="margin-left:9px;font-size:12px;color:#64748b;"></span>' +
                      '</div>'
                    : '') +
                '</div>';
        });

        overlay.innerHTML = '<div style="background:#fff;border-radius:20px;padding:0;width:440px;max-width:92%;box-shadow:0 25px 80px rgba(0,0,0,0.3);overflow:hidden;" onclick="event.stopPropagation()">' +
            '<div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:20px 24px;color:#fff;">' +
            '<div style="font-size:18px;font-weight:800;display:flex;align-items:center;gap:8px;">🔔 ' + L.title +
            ' <span style="background:rgba(255,255,255,0.3);font-size:12px;padding:2px 8px;border-radius:20px;">' + data.length + '</span></div>' +
            '</div>' +
            '<div style="padding:20px 24px;max-height:60vh;overflow-y:auto;">' + msgsHtml + '</div>' +
            '<div style="padding:16px 24px;border-top:1px solid #f1f5f9;text-align:center;">' +
            '<button id="oeAckBtn" style="width:100%;padding:14px;border:none;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;border-radius:12px;font-size:15px;font-weight:bold;cursor:pointer;">' + L.ok + '</button>' +
            '</div></div>';

        document.body.appendChild(overlay);

        var ids = data.map(function (m) { return m.id; });
        overlay.querySelector('#oeAckBtn').onclick = function () {
            window._markMessagesRead(ids);
            overlay.remove();
        };
        overlay.querySelectorAll('input[data-oe-msg]').forEach(function (inp) {
            inp.onchange = function () { handleReupload(inp, lang); };
        });
    }

    window._markMessagesRead = async function (ids) {
        var sb = getSb();
        if (!sb || !ids || !ids.length) return;
        try { await sb.from('messages').update({ is_read: true }).in('id', ids); }
        catch (e) { console.warn('[order-error-popup] 읽음 처리 실패:', e); }
    };

    // ── 파일 재접수: 업로드 → 주문의 파일 교체 → 메시지 해결 처리
    async function handleReupload(input, lang) {
        var L = t(lang);
        var sb = getSb();
        var file = input.files && input.files[0];
        if (!sb || !file) return;
        var msgId = input.getAttribute('data-oe-msg');
        var orderId = input.getAttribute('data-oe-order');
        var statusEl = document.querySelector('[data-oe-status="' + msgId + '"]');
        var setStatus = function (txt, color) { if (statusEl) { statusEl.textContent = txt; statusEl.style.color = color || '#64748b'; } };

        input.disabled = true;
        setStatus(L.uploading);
        try {
            // 1) 업로드 (simple_order.js 의 uploadFileGeneric 규칙과 동일한 경로/파일명 정규화)
            var ts = Date.now() + '_' + Math.floor(Math.random() * 10000);
            var safeName = (file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
            var path = 'simple_order/reupload_' + orderId + '_' + ts + '_' + safeName;
            var up = await sb.storage.from(BUCKET).upload(path, file);
            if (up.error) throw up.error;
            var url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

            // 2) 주문에 반영 — 원본 URL 은 admin_note 에 남겨 복구 가능하게 (스토리지 원본은 지우지 않음)
            var od = await sb.from('orders').select('items, files, admin_note').eq('id', orderId).single();
            if (od.error) throw od.error;
            var items = Array.isArray(od.data.items) ? od.data.items : [];
            var files = Array.isArray(od.data.files) ? od.data.files : [];
            var oldUrl = '';

            if (items.length === 1) {
                // 단일 품목 — 그 품목의 파일을 교체
                oldUrl = items[0].file_url || items[0].fileUrl || '';
                items[0].file_url = url;
                items[0].filePath = path;
                items[0].fileName = file.name;
                items[0].mimeType = file.type || 'application/octet-stream';
                items[0]._reuploaded_at = new Date().toISOString();
                // files[] 에서 기존 원본 항목을 같은 자리에 교체
                var idx = files.findIndex(function (f) { return f && f.url && oldUrl && f.url === oldUrl; });
                var entry = { name: file.name, url: url, type: 'reupload' };
                if (idx >= 0) files[idx] = entry; else files.push(entry);
            } else {
                // 다품목 — 어느 품목인지 알 수 없으므로 교체하지 않고 추가 (직원이 작업지시서에서 교체)
                files.push({ name: file.name, url: url, type: 'reupload' });
            }

            var note = (od.data.admin_note || '');
            var noteLine = '[파일재접수] 주문 ' + orderId + ' · ' + file.name + ' → ' + url
                + (oldUrl ? '\n  (교체된 원본: ' + oldUrl + ')' : (items.length > 1 ? '\n  (다품목 주문 — 어느 품목인지 미지정, 직원이 작업지시서에서 교체 필요)' : ''));
            var upd = await sb.from('orders').update({
                items: items, files: files, admin_note: note ? note + '\n' + noteLine : noteLine
            }).eq('id', orderId);
            if (upd.error) throw upd.error;

            // 3) 메시지 해결 처리 → 다음 접속부터 안 뜸
            await sb.from('messages').update({ resolved_at: new Date().toISOString(), is_read: true }).eq('id', msgId);

            setStatus('✓ ' + L.done, '#059669');
            if (input.parentElement) input.parentElement.style.display = 'none';
        } catch (e) {
            console.warn('[order-error-popup] 재접수 실패:', e);
            setStatus(L.fail, '#dc2626');
            input.disabled = false;
            input.value = '';
        }
    }

    // ── 자체 트리거 폴백 — 패브릭 사이트엔 config.js(updateUserSession) 가 없다.
    //   메인에서는 config.js 가 로그인 직후 호출하므로 여기서 또 불러도 중복 가드에 걸려 무해.
    function boot() { setTimeout(function () { try { window.checkUnreadMessages(); } catch (e) {} }, 2000); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
