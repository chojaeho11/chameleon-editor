-- ═══════════════════════════════════════════════════════════════
-- Phase 3a follow-up: DB trigger to mark design_bids as paid
-- when the linked order's payment_status becomes '결제완료'.
-- ═══════════════════════════════════════════════════════════════
-- Why: card payments via PG go through success.html which calls
-- mark_design_bid_paid client-side. But bank-transfer (무통장입금)
-- orders are confirmed manually by admin in order_management.html
-- and never visit success.html. We need a server-side guarantee.
--
-- This trigger fires whenever orders.payment_status transitions to
-- '결제완료', iterates the items JSONB, and marks any design_bids
-- referenced via the new _designBidId field as paid.
--
-- The back-fill block at the bottom handles existing orders that
-- were already approved but whose items predate the _designBidId
-- field (we use the product.code 'design_fee_<8charPrefix>' fallback).

-- ──────────────────────────────────────────────────────────
-- 1) Trigger function
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_mark_design_bids_paid_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _item jsonb;
    _bid_id uuid;
    _code text;
    _prefix text;
    _req_id uuid;
    _bid_price bigint;
    _request_id uuid;
BEGIN
    -- Only fire on transition to '결제완료'
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
        _bid_id := NULL;
        _request_id := NULL;

        -- Path 1: explicit _designBidId field (new flow, from order.js update)
        BEGIN
            _bid_id := NULLIF(_item->>'_designBidId', '')::uuid;
        EXCEPTION WHEN OTHERS THEN _bid_id := NULL; END;

        -- Path 2: fallback — extract from product.code prefix 'design_fee_xxxxxxxx'
        IF _bid_id IS NULL THEN
            _code := _item->'product'->>'code';
            IF _code IS NOT NULL AND position('design_fee_' in _code) = 1 THEN
                _prefix := substring(_code from 12);
                IF length(_prefix) >= 4 THEN
                    SELECT id, selected_bid_id INTO _req_id, _bid_id
                        FROM public.design_requests
                        WHERE id::text ILIKE _prefix || '%'
                        LIMIT 1;
                END IF;
            END IF;
        END IF;

        IF _bid_id IS NULL THEN CONTINUE; END IF;

        -- Look up bid info
        SELECT price, request_id INTO _bid_price, _request_id
            FROM public.design_bids
            WHERE id = _bid_id;
        IF _request_id IS NULL THEN CONTINUE; END IF;

        -- Mark as paid only if currently pending (don't downgrade later states)
        UPDATE public.design_bids
            SET payment_status = 'paid',
                payment_method = COALESCE(payment_method, 'cart'),
                paid_order_id = COALESCE(paid_order_id, NEW.id),
                paid_at = COALESCE(paid_at, NOW())
            WHERE id = _bid_id
              AND (payment_status IS NULL OR payment_status = 'pending');

        -- Audit log (best-effort)
        BEGIN
            INSERT INTO public.design_payment_logs
                (bid_id, request_id, event, method, amount, actor_id, note)
                VALUES
                (_bid_id, _request_id, 'paid', 'cart', _bid_price, NEW.user_id,
                 'Auto-paid via order #' || NEW.id || ' (trigger)');
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;

    RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────
-- 2) Trigger
-- ──────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_orders_mark_design_bids_paid ON public.orders;
CREATE TRIGGER trg_orders_mark_design_bids_paid
AFTER INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.tg_mark_design_bids_paid_on_order();

-- ──────────────────────────────────────────────────────────
-- 3) One-time back-fill for existing 결제완료 orders
-- ──────────────────────────────────────────────────────────
-- Iterates every existing order with payment_status='결제완료', extracts
-- any design_bid links from items, and marks bids as paid (idempotent).
DO $$
DECLARE
    _order record;
    _item jsonb;
    _bid_id uuid;
    _code text;
    _prefix text;
    _req_id uuid;
    _bid_price bigint;
    _request_id uuid;
BEGIN
    FOR _order IN
        SELECT id, user_id, items
        FROM public.orders
        WHERE payment_status = '결제완료'
          AND items IS NOT NULL
    LOOP
        FOR _item IN SELECT * FROM jsonb_array_elements(_order.items) LOOP
            _bid_id := NULL;

            -- Path 1: _designBidId
            BEGIN
                _bid_id := NULLIF(_item->>'_designBidId', '')::uuid;
            EXCEPTION WHEN OTHERS THEN _bid_id := NULL; END;

            -- Path 2: code prefix fallback
            IF _bid_id IS NULL THEN
                _code := _item->'product'->>'code';
                IF _code IS NOT NULL AND position('design_fee_' in _code) = 1 THEN
                    _prefix := substring(_code from 12);
                    IF length(_prefix) >= 4 THEN
                        SELECT selected_bid_id INTO _bid_id
                            FROM public.design_requests
                            WHERE id::text ILIKE _prefix || '%'
                            LIMIT 1;
                    END IF;
                END IF;
            END IF;

            IF _bid_id IS NULL THEN CONTINUE; END IF;

            SELECT price, request_id INTO _bid_price, _request_id
                FROM public.design_bids
                WHERE id = _bid_id;
            IF _request_id IS NULL THEN CONTINUE; END IF;

            UPDATE public.design_bids
                SET payment_status = 'paid',
                    payment_method = COALESCE(payment_method, 'cart'),
                    paid_order_id = COALESCE(paid_order_id, _order.id),
                    paid_at = COALESCE(paid_at, NOW())
                WHERE id = _bid_id
                  AND (payment_status IS NULL OR payment_status = 'pending');

            BEGIN
                INSERT INTO public.design_payment_logs
                    (bid_id, request_id, event, method, amount, actor_id, note)
                    VALUES
                    (_bid_id, _request_id, 'paid', 'cart', _bid_price, _order.user_id,
                     'Back-fill from order #' || _order.id);
            EXCEPTION WHEN OTHERS THEN NULL; END;
        END LOOP;
    END LOOP;
END;
$$;
