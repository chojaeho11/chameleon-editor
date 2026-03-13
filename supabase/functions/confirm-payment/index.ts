// supabase/functions/confirm-payment/index.ts
// Toss Payments 결제 승인 (confirm) API 호출

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { paymentKey, orderId, amount, dbId } = await req.json()

    if (!paymentKey || !orderId || !amount) {
      throw new Error('Missing required parameters: paymentKey, orderId, amount')
    }

    const secretKey = Deno.env.get('TOSS_PAYMENTS_SECRET_KEY')
    if (!secretKey) {
      throw new Error('TOSS_PAYMENTS_SECRET_KEY is not configured')
    }

    // Toss 결제 승인 API 호출
    const basicAuth = btoa(secretKey + ':')
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Toss Confirm Error:', data)
      return new Response(
        JSON.stringify({ error: data.message || 'Payment confirmation failed', code: data.code }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // 결제 승인 성공 — DB 업데이트 (paymentKey 저장)
    if (dbId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

      if (supabaseUrl && supabaseKey) {
        await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${dbId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            status: '접수됨',
            payment_status: '결제완료',
            payment_method: '카드/간편결제',
            toss_payment_key: paymentKey,
          }),
        })
      }
    }

    return new Response(
      JSON.stringify({ success: true, paymentKey: data.paymentKey || paymentKey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Confirm Payment Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
