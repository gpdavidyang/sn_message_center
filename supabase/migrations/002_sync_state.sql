-- HubSpot 동기화 상태 추적 테이블
CREATE TABLE IF NOT EXISTS hubspot_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'idle',  -- idle, in_progress, completed, failed
  synced_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hubspot_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sync state" ON hubspot_sync_state
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_hubspot_sync_state_user_id ON hubspot_sync_state(user_id);
