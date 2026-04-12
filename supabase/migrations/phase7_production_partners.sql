-- Phase 7: Production Partners registration table
-- Partners = printing/installation companies worldwide that can fulfil orders

CREATE TABLE IF NOT EXISTS public.production_partners (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Company info
    company_name text NOT NULL,
    country text NOT NULL,
    city text,
    address text NOT NULL,
    contact_name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    website text,

    -- Capabilities: array of category codes + sub-items
    -- Format: [{"category":"honeycomb","items":["wall","banner","standee"]}, ...]
    capabilities jsonb DEFAULT '[]',
    capabilities_note text,  -- free text about equipment, max sizes, etc.

    -- Tax & banking (frozen at registration time)
    legal_name text,
    tax_id_type text,  -- 'personal' | 'business'
    tax_id text,
    bank_name text,
    bank_holder text,
    bank_account text,
    swift_bic text,
    iban text,
    routing_number text,
    bank_address text,
    payout_currency text DEFAULT 'KRW',

    -- Platform agreement
    agreed_5pct boolean NOT NULL DEFAULT false,

    -- Workflow
    status text NOT NULL DEFAULT 'pending', -- pending | verified | active | suspended
    verified_at timestamptz,
    verified_by uuid,
    admin_note text,

    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- RLS: anyone can insert (registration is open), own rows readable
ALTER TABLE production_partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_insert" ON production_partners FOR INSERT WITH CHECK (true);
CREATE POLICY "pp_select_own" ON production_partners FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pp_select_admin" ON production_partners FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "pp_update_own" ON production_partners FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admin RPC for approving partners
CREATE OR REPLACE FUNCTION admin_approve_production_partner(_partner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM public._require_admin();
    UPDATE production_partners SET status = 'active', verified_at = NOW(), verified_by = auth.uid() WHERE id = _partner_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_approve_production_partner(uuid) TO authenticated;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION touch_production_partner_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_pp_updated_at BEFORE UPDATE ON production_partners FOR EACH ROW EXECUTE FUNCTION touch_production_partner_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pp_country ON production_partners(country);
CREATE INDEX IF NOT EXISTS idx_pp_status ON production_partners(status);
CREATE INDEX IF NOT EXISTS idx_pp_user ON production_partners(user_id);
