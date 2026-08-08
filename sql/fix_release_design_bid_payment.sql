-- 2026-08-08 (버그#17 재접수): 본사의뢰 '완료→지급' 이 안 끝나던 문제 완전 해결.
--   증상: bid 는 'released'(디자이너 지급 완료)인데 design_requests.status 가 'in_progress' 로 남아
--         계속 '진행중'에 뜸. 원인: 매니저의 클라이언트측 design_requests UPDATE 가 RLS 로 막힘.
--   해결: 릴리즈 RPC(SECURITY DEFINER, RLS 무관)가 지급 + 의뢰완료까지 원자적으로 처리. 멱등.
--         상태 'paid'(즉시지급 등) 도 릴리즈 허용, 이미 released 면 재지급 없이 의뢰완료만 보장.
CREATE OR REPLACE FUNCTION public.release_design_bid_payment(_bid_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    _bid record;
BEGIN
    SELECT * INTO _bid FROM public.design_bids WHERE id = _bid_id;
    IF _bid.id IS NULL THEN
        RAISE EXCEPTION 'Bid not found';
    END IF;
    IF _bid.designer_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only the designer can release their own bid';
    END IF;

    -- 아직 지급 전이면 지급(릴리즈). 이미 released 면 재지급하지 않고 통과(멱등, 이중지급 방지).
    IF _bid.payment_status <> 'released' THEN
        IF _bid.payment_status NOT IN ('completed_pending_files', 'paid') THEN
            RAISE EXCEPTION 'Bid is not in a releasable state (current: %)', _bid.payment_status;
        END IF;
        UPDATE public.design_bids
            SET payment_status = 'released', released_at = NOW()
            WHERE id = _bid_id;
        UPDATE public.designer_profiles
            SET wallet_balance = wallet_balance + _bid.price,
                total_earnings = COALESCE(total_earnings, 0) + _bid.price
            WHERE id = _bid.designer_id;
        INSERT INTO public.design_payment_logs (bid_id, request_id, event, amount, actor_id, note)
            VALUES (_bid_id, _bid.request_id, 'released', _bid.price, auth.uid(), 'Final archive uploaded');
    END IF;

    -- ★ 지급 여부와 무관하게 의뢰를 완료 상태로 확정 (RLS 로 막히던 클라이언트 UPDATE 대체).
    --   design_requests 엔 completed_at 컬럼이 없음(updated_at 만 존재) — 기존 클라이언트가 completed_at 을
    --   넣어 UPDATE 전체가 400 으로 거부돼 '진행중'에 남던 것도 이 버그의 원인이었다.
    UPDATE public.design_requests
        SET status = 'completed',
            updated_at = NOW()
        WHERE id = _bid.request_id AND status <> 'completed';
END;
$function$;
