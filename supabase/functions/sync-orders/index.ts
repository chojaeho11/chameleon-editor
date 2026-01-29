import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseKey);
    const ordersToUpsert = [];

    // ==========================================
    // 네이버 설정 (오타 확인 필수!)
    // ==========================================
    const NAVER_ID = "4qFHbzVCy8Kzeig4YbHYGA";
    const NAVER_SECRET = "$2a$04$8uVxYY404xsGzL94yrp9Hu";

    // 1. 토큰 발급 시도
    const tokenRes = await fetch(`https://api.commerce.naver.com/external/v1/oauth2/token?client_id=${NAVER_ID}&client_secret=${NAVER_SECRET}&grant_type=client_credentials&type=SELF`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
    });

    // [디버그] 토큰 실패 시 에러 내용 반환
    if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`네이버 로그인 실패(토큰): ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (accessToken) {
        // 2. 주문 조회 (최근 60분으로 설정 - 테스트용)
        // 네이버는 24시간 이상의 과거 데이터 조회를 막는 경우가 있습니다.
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        
        const orderRes = await fetch(`https://api.commerce.naver.com/external/v1/pay-provider/smartstore/v1/product-orders/last-changed-statuses?lastChangedFrom=${oneHourAgo}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // [디버그] 주문 조회 실패 시 에러 내용 반환
        if (!orderRes.ok) {
            const errText = await orderRes.text();
            throw new Error(`주문 조회 실패: ${errText}`);
        }
        
        const orderData = await orderRes.json();
        const list = orderData.data?.lastChangeStatuses || [];

        // 3. 데이터 매핑
        for (const item of list) {
            let myStatus = '접수됨';
            // 상태 변환 로직
            switch (item.productOrderStatus) {
                case 'PAYED': myStatus = '접수됨'; break;
                case 'DISPATCHED': 
                case 'DELIVERY_COMPLETED': 
                case 'PURCHASE_DECIDED': myStatus = '완료됨'; break;
                case 'CANCELED': case 'RETURNED': myStatus = '취소/반품'; break;
                default: myStatus = '접수됨';
            }

            ordersToUpsert.push({
                platform: 'NAVER',
                site_code: 'KR',
                platform_order_id: item.productOrderId,
                manager_name: '네이버고객', 
                status: myStatus,
                product_name: '스마트스토어 주문', 
                total_amount: 0, 
                created_at: new Date().toISOString()
            });
        }
    }

    // 4. DB 저장
    if (ordersToUpsert.length > 0) {
        const { error } = await supabase
            .from('orders')
            .upsert(ordersToUpsert, { onConflict: 'platform, platform_order_id' });
        if (error) throw new Error(`DB 저장 실패: ${error.message}`);
    }

    // 성공 메시지 (조회된 시간 표시)
    return new Response(
      JSON.stringify({ 
          message: `성공! (최근 1시간 내 변동된 주문 ${ordersToUpsert.length}건)`, 
          count: ordersToUpsert.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    // 에러 발생 시 상세 내용을 브라우저로 보냄
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
    })
  }
})