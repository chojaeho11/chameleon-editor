-- Service hub chat log table
CREATE TABLE IF NOT EXISTS community_chat_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id text NOT NULL,
    role text NOT NULL, -- 'user' or 'ai'
    message text NOT NULL,
    lang text DEFAULT 'ko',
    created_at timestamptz DEFAULT NOW()
);
ALTER TABLE community_chat_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ccl_select" ON community_chat_log;
CREATE POLICY "ccl_select" ON community_chat_log FOR SELECT USING (true);
DROP POLICY IF EXISTS "ccl_insert" ON community_chat_log;
CREATE POLICY "ccl_insert" ON community_chat_log FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_ccl_session ON community_chat_log(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ccl_created ON community_chat_log(created_at DESC);
