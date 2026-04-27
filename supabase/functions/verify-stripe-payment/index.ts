// supabase/functions/verify-stripe-payment/index.ts

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, db_id } = await req.json()

    if (!session_id || !db_id) {
      throw new Error('Missing required fields: session_id, db_id')
    }

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }

    // Stripe Checkout Session 조회하여 결제 상태 확인
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
      },
    })

    const session = await response.json()

    if (!response.ok) {
      console.error('Stripe API Error:', session)
      return new Response(
        JSON.stringify({ error: session.error?.message || 'Failed to retrieve session' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 결제 상태 확인
    if (session.payment_status !== 'paid') {
      return new Response(
        JSON.stringify({ error: `Payment not completed. Status: ${session.payment_status}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // 메타데이터의 order_id와 db_id 일치 확인
    if (session.metadata?.order_id && String(session.metadata.order_id) !== String(db_id)) {
      return new Response(
        JSON.stringify({ error: 'Order ID mismatch' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // ★★ 결제 검증 완료 → DB 업데이트 + Google Drive 동기화 (서버 사이드)
    // 클라이언트에서도 success.html이 DB 업데이트하지만, 사용자가 탭 닫는 경우 대비
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      if (supabaseUrl && supabaseKey && db_id) {
        // DB 상태 업데이트
        await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${db_id}`, {
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
            payment_method: 'Stripe Card',
            toss_payment_key: session_id,
          }),
        })

        // Drive 동기화 트리거 (fire-and-forget)
        fetch(`${supabaseUrl}/functions/v1/sync-order-to-drive`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({ order_id: db_id }),
        }).then(r => r.json())
          .then(d => console.log('[drive sync] verify-stripe trigger:', d?.skipped || d?.customer_folder_url || d))
          .catch(e => console.warn('[drive sync] verify-stripe fetch failed:', e?.message || e))
      }
    } catch (e: any) {
      console.warn('[verify-stripe] post-success update failed:', e?.message || e)
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Function Error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})