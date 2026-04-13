// 1:1 사용자 채팅 위젯 (전문가/판매자 등에게 문의)
// 사용법:
//   await UserChat.open({ sb, currentUser, otherUserId, otherName, topic, otherAvatarUrl })
(function(){
    let modalEl = null;
    let currentChatId = null;
    let pollTimer = null;

    function ensureModal(){
        if (modalEl) return modalEl;
        modalEl = document.createElement('div');
        modalEl.id = 'userChatModal';
        modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;display:none;align-items:center;justify-content:center;padding:0;';
        modalEl.innerHTML = `
            <div style="background:#fff;width:100%;max-width:480px;height:80vh;max-height:720px;border-radius:20px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
                <div style="padding:14px 18px;border-bottom:1px solid #f1f5f9;background:linear-gradient(135deg,#fef3c7,#fef9c3);display:flex;align-items:center;gap:12px;">
                    <img id="ucPartnerAva" src="" style="width:36px;height:36px;border-radius:50%;background:#fde68a;object-fit:cover;">
                    <div style="flex:1;min-width:0;">
                        <div id="ucPartnerName" style="font-weight:900;font-size:14px;color:#78350f;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">상대</div>
                        <div id="ucTopic" style="font-size:11px;color:#92400e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></div>
                    </div>
                    <button id="ucClose" style="background:none;border:none;font-size:24px;cursor:pointer;color:#92400e;line-height:1;">×</button>
                </div>
                <div id="ucMessages" style="flex:1;overflow-y:auto;padding:14px;background:#fffbeb;display:flex;flex-direction:column;gap:8px;"></div>
                <div style="padding:10px 14px;border-top:1px solid #f1f5f9;background:#fff;display:flex;gap:8px;">
                    <input id="ucInput" type="text" placeholder="메시지 입력..." style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:999px;font-size:14px;font-family:inherit;outline:none;">
                    <button id="ucSend" style="padding:10px 18px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;border:none;border-radius:999px;font-weight:800;cursor:pointer;font-family:inherit;">전송</button>
                </div>
            </div>`;
        document.body.appendChild(modalEl);

        modalEl.querySelector('#ucClose').addEventListener('click', ()=>{ closeChat(); });
        modalEl.addEventListener('click', e=>{ if(e.target===modalEl) closeChat(); });
        return modalEl;
    }

    function closeChat(){
        if (modalEl) modalEl.style.display='none';
        if (pollTimer) { clearInterval(pollTimer); pollTimer=null; }
        currentChatId = null;
    }

    function fmtTime(ts){
        const d = new Date(ts);
        const now = new Date();
        const sameDay = d.toDateString() === now.toDateString();
        return sameDay ? d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : d.toLocaleDateString();
    }

    async function loadMessages(sb, chatId, currentUser){
        const { data } = await sb.from('user_chat_messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true }).limit(200);
        const box = document.getElementById('ucMessages');
        if (!box) return;
        box.innerHTML = (data||[]).map(m=>{
            const mine = m.sender_id === currentUser.id;
            const align = mine ? 'flex-end' : 'flex-start';
            const bg = mine ? 'linear-gradient(135deg,#fbbf24,#f59e0b)' : '#fff';
            const color = mine ? '#fff' : '#0f172a';
            const border = mine ? 'none' : '1px solid #e2e8f0';
            return `<div style="display:flex;justify-content:${align};">
                <div style="max-width:75%;padding:10px 14px;border-radius:18px;background:${bg};color:${color};border:${border};font-size:14px;line-height:1.5;word-break:break-word;">
                    ${(m.body||'').replace(/[<>&]/g, c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}
                    <div style="font-size:10px;opacity:0.7;margin-top:4px;">${fmtTime(m.created_at)}</div>
                </div>
            </div>`;
        }).join('') || '<div style="text-align:center;color:#94a3b8;padding:30px;font-size:13px;">첫 메시지를 보내보세요 👋</div>';
        box.scrollTop = box.scrollHeight;
    }

    async function findOrCreateChat(sb, currentUser, otherUserId, topic){
        // sorted pair으로 unique 보장
        const [a,b] = [currentUser.id, otherUserId].sort();
        const { data: existing } = await sb.from('user_chats').select('*')
            .eq('user_a', a).eq('user_b', b)
            .eq('topic', topic || '')
            .maybeSingle();
        if (existing) return existing.id;
        const { data: created, error } = await sb.from('user_chats').insert({
            user_a: a, user_b: b, topic: topic || ''
        }).select('id').single();
        if (error) throw error;
        return created.id;
    }

    async function send(sb, currentUser){
        const inp = document.getElementById('ucInput');
        const body = (inp.value||'').trim();
        if (!body || !currentChatId) return;
        inp.value = '';
        const { error } = await sb.from('user_chat_messages').insert({
            chat_id: currentChatId, sender_id: currentUser.id, body
        });
        if (error) { alert('메시지 전송 실패: ' + error.message); inp.value = body; return; }
        await sb.from('user_chats').update({ last_message_at: new Date().toISOString() }).eq('id', currentChatId);
        await loadMessages(sb, currentChatId, currentUser);
    }

    async function open(opts){
        const { sb, currentUser, otherUserId, otherName, topic, otherAvatarUrl } = opts;
        if (!currentUser) { alert('로그인이 필요합니다'); return; }
        if (currentUser.id === otherUserId) { alert('본인과는 채팅할 수 없습니다'); return; }
        ensureModal();
        document.getElementById('ucPartnerName').textContent = otherName || '상대';
        document.getElementById('ucTopic').textContent = topic || '';
        const ava = otherAvatarUrl || (window.CMAvatar ? window.CMAvatar.urlFor({avatar_url:otherAvatarUrl}, otherUserId) : '');
        document.getElementById('ucPartnerAva').src = ava || '';
        modalEl.style.display = 'flex';

        try {
            currentChatId = await findOrCreateChat(sb, currentUser, otherUserId, topic);
            await loadMessages(sb, currentChatId, currentUser);
            // 폴링 (3초마다 새 메시지)
            if (pollTimer) clearInterval(pollTimer);
            pollTimer = setInterval(()=> loadMessages(sb, currentChatId, currentUser), 3000);
        } catch(e) {
            alert('채팅 열기 실패: ' + (e.message||e));
            closeChat();
            return;
        }

        // 입력/전송 핸들러 (재바인딩 방지)
        const inp = document.getElementById('ucInput');
        const btn = document.getElementById('ucSend');
        const sendFn = ()=> send(sb, currentUser);
        btn.onclick = sendFn;
        inp.onkeydown = e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendFn(); } };
        setTimeout(()=> inp.focus(), 100);
    }

    window.UserChat = { open, close: closeChat };
})();
