-- 카카오 채널 친구 상태 테이블
-- 전화번호별 카카오 비즈니스 채널 친구 여부를 저장합니다.
-- 실행: Supabase 대시보드 → SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS kakao_channel_friends (
  phone TEXT PRIMARY KEY,           -- 정규화된 전화번호 (예: 01012345678)
  is_friend BOOLEAN,                -- TRUE=친구, FALSE=비친구, NULL=미확인
  last_checked_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_kakao_channel_friends_is_friend ON kakao_channel_friends(is_friend);
