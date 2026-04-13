// 관리자 안전거래 송금 처리
import { sb } from "./global_config.js?v=294";

window.loadSafeTxAdmin = async function(filter){
    filter = filter || 'received';
    const box = document.getElementById('safeTxList');
    if(!box) return;
    box.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">로딩 중...</div>';

    let q = sb.from('community_safe_transactions').select('*').order('created_at',{ascending:false});
    if (filter !== 'all') q = q.eq('status', filter);
    const { data: txs, error } = await q;
    if (error) { box.innerHTML = `<div style="color:#ef4444;padding:20px;">오류: ${error.message}</div>`; return; }
    if (!txs || txs.length === 0) { box.innerHTML = `<div style="padding:30px;text-align:center;color:#64748b;">해당 상태의 거래가 없습니다</div>`; return; }

    // 관련 정보 일괄 조회
    const itemIds = [...new Set(txs.map(t=>t.item_id).filter(Boolean))];
    const userIds = [...new Set(txs.flatMap(t=>[t.buyer_id,t.seller_id]).filter(Boolean))];
    const [itemRes, profRes] = await Promise.all([
        sb.from('community_secondhand').select('id,title,price').in('id',itemIds),
        sb.from('profiles').select('id,username,email,phone,bank_name,account_holder,account_number').in('id',userIds)
    ]);
    const itemMap = {}; (itemRes.data||[]).forEach(i=>itemMap[i.id]=i);
    const profMap = {}; (profRes.data||[]).forEach(p=>profMap[p.id]=p);

    const statusLabel = {
        pending_payment:{txt:'결제 대기',color:'#64748b'},
        paid:{txt:'결제완료',color:'#f59e0b'},
        received:{txt:'수령확인 · 송금대기',color:'#6366f1'},
        settled:{txt:'송금완료',color:'#10b981'},
        cancelled:{txt:'취소',color:'#ef4444'}
    };

    box.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
            <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                <th style="padding:10px;text-align:left;">일시</th>
                <th style="padding:10px;text-align:left;">상품</th>
                <th style="padding:10px;text-align:left;">판매자</th>
                <th style="padding:10px;text-align:left;">계좌</th>
                <th style="padding:10px;text-align:right;">금액</th>
                <th style="padding:10px;text-align:right;">수수료 5%</th>
                <th style="padding:10px;text-align:right;">송금액</th>
                <th style="padding:10px;text-align:center;">상태</th>
                <th style="padding:10px;text-align:center;">처리</th>
            </tr>
        </thead>
        <tbody>
            ${txs.map(tx=>{
                const item = itemMap[tx.item_id] || {title:'(삭제됨)'};
                const seller = profMap[tx.seller_id] || {};
                const buyer = profMap[tx.buyer_id] || {};
                const sl = statusLabel[tx.status] || {txt:tx.status,color:'#64748b'};
                const payoutAmt = (tx.amount||0) - (tx.fee||0);
                const bankStr = (seller.bank_name||seller.account_number) ? `${seller.bank_name||'?'} ${seller.account_number||'?'}<br><span style="color:#64748b;">${seller.account_holder||''}</span>` : '<span style="color:#ef4444;">계좌 미등록</span>';
                const actions = tx.status === 'received'
                    ? `<button class="btn btn-primary btn-sm" onclick="markSafeTxPaid('${tx.id}',${payoutAmt},'${encodeURIComponent(seller.bank_name||'')}','${encodeURIComponent(seller.account_number||'')}','${encodeURIComponent(seller.account_holder||'')}')">💸 송금완료 표시</button>`
                    : tx.status === 'paid'
                        ? `<button class="btn btn-outline btn-sm" onclick="markSafeTxReceived('${tx.id}')">수령완료 강제처리</button>`
                        : '-';
                return `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:8px;">${new Date(tx.created_at).toLocaleString()}</td>
                    <td style="padding:8px;"><b>${(item.title||'').replace(/</g,'&lt;')}</b><br><span style="color:#94a3b8;font-size:11px;">#${tx.item_id}</span></td>
                    <td style="padding:8px;">${seller.username||'(미등록)'}<br><span style="color:#64748b;font-size:11px;">${seller.phone||seller.email||''}</span></td>
                    <td style="padding:8px;font-size:12px;">${bankStr}</td>
                    <td style="padding:8px;text-align:right;">${(tx.amount||0).toLocaleString()}원</td>
                    <td style="padding:8px;text-align:right;color:#b45309;">${(tx.fee||0).toLocaleString()}</td>
                    <td style="padding:8px;text-align:right;font-weight:800;color:#10b981;">${payoutAmt.toLocaleString()}원</td>
                    <td style="padding:8px;text-align:center;"><span style="color:${sl.color};font-weight:700;">${sl.txt}</span></td>
                    <td style="padding:8px;text-align:center;">${actions}</td>
                </tr>`;
            }).join('')}
        </tbody>
    </table>`;
};

window.markSafeTxPaid = async function(txId, payoutAmt, bankEnc, accEnc, holderEnc){
    const bank = decodeURIComponent(bankEnc), acc = decodeURIComponent(accEnc), holder = decodeURIComponent(holderEnc);
    if (!bank || !acc) { alert('판매자 계좌 정보가 없습니다. 먼저 판매자에게 계좌 등록을 요청하세요.'); return; }
    if (!confirm(`${holder} (${bank} ${acc})로\n${payoutAmt.toLocaleString()}원 송금 완료 처리할까요?\n\n실제 은행 송금을 먼저 진행한 후 이 버튼을 누르세요.`)) return;
    const memo = prompt('송금 메모 (은행 이체 내역/참고):', '') || '';
    const { error } = await sb.from('community_safe_transactions').update({
        status: 'settled',
        payout_sent_at: new Date().toISOString(),
        payout_memo: memo,
        seller_payout_amount: payoutAmt
    }).eq('id', txId);
    if (error) { alert('실패: ' + error.message); return; }
    alert('✅ 송금완료 처리됨');
    loadSafeTxAdmin('received');
};

window.markSafeTxReceived = async function(txId){
    if (!confirm('강제로 수령확인 처리하시겠습니까? (구매자 대신 관리자가 확인)')) return;
    const { error } = await sb.from('community_safe_transactions').update({
        status: 'received',
        received_confirmed_at: new Date().toISOString()
    }).eq('id', txId);
    if (error) { alert('실패: ' + error.message); return; }
    alert('수령확인 처리됨');
    loadSafeTxAdmin('paid');
};
