import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  try {
    const payload = await req.json();
    console.log("▶ 페이엑션 원본 데이터:", JSON.stringify(payload));

    // 1. 금액 정리 (쉼표 제거)
    const rawAmt = payload.amount || payload.trx_amt || 0;
    const cleanAmt = typeof rawAmt === 'string' ? parseInt(rawAmt.replace(/,/g, '')) : rawAmt;
    
    // 2. 입금자명 찾기 (중요: print_content가 통장 메모/입금자명입니다)
    // 페이엑션은 보통 'print_content'에 이름을 담아 보냅니다.
    const senderName = 
        payload.print_content || 
        payload.depositor || 
        payload.depositor_name || 
        payload.sender_name || 
        payload.sender ||
        "이름미상";

    const transaction = {
      depositor: senderName.trim(), // 앞뒤 공백 제거
      amount: cleanAmt,
      transaction_date: payload.transaction_date || payload.date || new Date().toISOString(),
      bank_name: '국민은행'
    };

    console.log(`▶ 저장될 데이터: [${transaction.depositor}] ${transaction.amount}원`);

    // 3. 중복 방지
    const { data: exist } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('transaction_date', transaction.transaction_date)
      .eq('amount', transaction.amount)
      .eq('depositor', transaction.depositor)
      .single();

    if (exist) {
      return new Response(JSON.stringify({ message: "Already exists" }), { headers: { "Content-Type": "application/json" } });
    }

    // 4. DB 저장
    const { data: insertedData, error: insertError } = await supabase
      .from('bank_transactions')
      .insert([transaction])
      .select()
      .single();

    if (insertError) throw insertError;

    // ============================================================
    // ★ 자동 매칭 로직 (이름과 금액이 같으면 주문 상태 변경)
    // ============================================================
    const { data: matchedOrder } = await supabase
      .from('orders')
      .select('id, total_amount, manager_name')
      .eq('manager_name', transaction.depositor) // ★ 이름이 같아야 함!
      .eq('total_amount', transaction.amount)    // ★ 금액이 같아야 함!
      .neq('payment_status', '결제완료')
      .single();

    let matched = false;
    if (matchedOrder) {
      console.log(`✅ 매칭 성공! 주문자: ${matchedOrder.manager_name}`);
      
      // 주문 상태 '결제완료'로 변경
      await supabase.from('orders').update({ 
          payment_status: '결제완료', 
          payment_method: '무통장입금(자동)',
          status: '제작준비' 
      }).eq('id', matchedOrder.id);

      // 입금 내역도 '매칭됨'으로 변경
      await supabase.from('bank_transactions').update({ 
          match_status: 'matched', 
          matched_order_id: matchedOrder.id 
      }).eq('id', insertedData.id);
      
      matched = true;
    }

    return new Response(
      JSON.stringify({ message: "Success", matched }),
      { headers: { "Content-Type": "application/json" } },
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});