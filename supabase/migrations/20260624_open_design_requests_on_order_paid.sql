-- 2026-06-24: design_fee 주문이 결제완료되면 design_requests 를 payment_pending -> open 으로 전환.
--
-- WHY: 새 디자인 주문 모델은 design_requests 기준 (design_bids 폐기). 고객이 디자인비를 결제하면
--   design_requests(status=payment_pending) + orders(items[].category=design_fee, design_request_id) 생성.
--   카드결제는 success.html 프론트 로직이 의뢰를 open 으로 바꿔주지만, success.html 을 거치지 않는 결제
--   (개인결제창/매니저견적 커스텀주문, 무통장입금, 관리자 수동 입금확인)는 의뢰가 payment_pending 에
--   멈춰서 designer-board(open/claimed 만 표시)에 영원히 안 뜬다.
--   => 결제완료 시 항상 open 전환을 보장하는 서버측 트리거로 해결 (구 design_bids 트리거의 design_requests 판).

-- 1) 트리거 함수
CREATE OR REPLACE FUNCTION public.tg_open_design_requests_on_order_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _item jsonb;
    _req_id uuid;
BEGIN
    -- payment_status 가 실제로 바뀌지 않은 UPDATE 는 무시
    IF TG_OP = 'UPDATE'
       AND NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
        RETURN NEW;
    END IF;

    IF NEW.payment_status IS DISTINCT FROM '결제완료' THEN
        RETURN NEW;
    END IF;

    IF NEW.items IS NULL THEN
        RETURN NEW;
    END IF;

    FOR _item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
        _req_id := NULL;
        BEGIN
            -- 3가지 형태 지원: flat design_request_id / flat _designRequestId / 중첩 designRequest.request_id
            _req_id := NULLIF(_item->>'design_request_id', '')::uuid;
            IF _req_id IS NULL THEN
                _req_id := NULLIF(_item->>'_designRequestId', '')::uuid;
            END IF;
            IF _req_id IS NULL THEN
                _req_id := NULLIF(_item->'designRequest'->>'request_id', '')::uuid;
            END IF;
        EXCEPTION WHEN OTHERS THEN _req_id := NULL; END;

        IF _req_id IS NULL THEN CONTINUE; END IF;

        -- payment_pending 인 것만 open 으로 (이후 단계 claimed/completed 등은 절대 되돌리지 않음)
        UPDATE public.design_requests
            SET status = 'open'
            WHERE id = _req_id
              AND status = 'payment_pending';
    END LOOP;

    RETURN NEW;
END;
$$;

-- 2) 트리거
DROP TRIGGER IF EXISTS trg_orders_open_design_requests ON public.orders;
CREATE TRIGGER trg_orders_open_design_requests
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.tg_open_design_requests_on_order_paid();

-- 3) 백필 — 이미 결제완료됐는데 payment_pending 에 멈춘 기존 의뢰 복구
DO $$
DECLARE
    _order record;
    _item jsonb;
    _req_id uuid;
BEGIN
    FOR _order IN
        SELECT id, items FROM public.orders
        WHERE payment_status = '결제완료' AND items IS NOT NULL
    LOOP
        FOR _item IN SELECT * FROM jsonb_array_elements(_order.items) LOOP
            _req_id := NULL;
            BEGIN
                _req_id := NULLIF(_item->>'design_request_id', '')::uuid;
                IF _req_id IS NULL THEN
                    _req_id := NULLIF(_item->>'_designRequestId', '')::uuid;
                END IF;
                IF _req_id IS NULL THEN
                    _req_id := NULLIF(_item->'designRequest'->>'request_id', '')::uuid;
                END IF;
            EXCEPTION WHEN OTHERS THEN _req_id := NULL; END;
            IF _req_id IS NULL THEN CONTINUE; END IF;

            UPDATE public.design_requests
                SET status = 'open'
                WHERE id = _req_id AND status = 'payment_pending';
        END LOOP;
    END LOOP;
END;
$$;

-- 4) 검증 — 백필 후에도 payment_pending 으로 남은 의뢰 = 아직 미결제 건 (정상)
SELECT status, count(*) FROM public.design_requests WHERE country = 'KR' GROUP BY status ORDER BY status;
