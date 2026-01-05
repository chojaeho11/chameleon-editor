// supabase/functions/cancel-toss-payment/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Deno.serve는 별도 import 없이 바로 사용 가능한 내장 함수입니다.
Deno.serve(async (req) => {
  // 1. CORS Preflight 처리 (브라우저 접근 허용)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. 요청 데이터 받기
    const { paymentKey, cancelReason } = await req.json()

    // 3. 환경변수 확인
    const secretKey = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY')
    if (!secretKey) {
      throw new Error('TOSS_PAYMENTS_SECRET_KEY가 설정되지 않았습니다.')
    }

    // 4. 토스 API 호출 (Basic Auth)
    const basicAuth = btoa(secretKey + ':')

    const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancelReason: cancelReason || '관리자 취소' }),
    })

    const data = await response.json()

    // 5. 토스 에러 응답 처리
    if (!response.ok) {
      console.error('Toss API Error:', data)
      return new Response(
        JSON.stringify({ error: data.message || '취소 실패', code: data.code }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    // 6. 성공 응답
    return new Response(
      JSON.stringify({ success: true, data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || '알 수 없는 오류가 발생했습니다.' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})