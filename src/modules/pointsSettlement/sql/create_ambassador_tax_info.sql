-- 앰버서더 세무정보 테이블
-- 주민등록번호는 AES-256-GCM으로 암호화하여 저장
-- 수집 목적: 세금 처리 (세무)

CREATE TABLE IF NOT EXISTS ambassador_tax_info (
  ambassador_id   INTEGER PRIMARY KEY REFERENCES ambassador_profile(id),
  entity_type     VARCHAR(20) NOT NULL CHECK (entity_type IN ('individual', 'business')),

  -- 개인: 이름 + 암호화된 주민등록번호
  name            VARCHAR(100),
  encrypted_ssn   TEXT,          -- AES-256-GCM 암호화된 주민등록번호 (hex)
  ssn_iv          VARCHAR(64),   -- 초기화 벡터 (hex)
  ssn_auth_tag    VARCHAR(64),   -- 인증 태그 (hex)

  -- 사업자: 상호명 + 사업자등록번호
  business_name   VARCHAR(200),
  business_number VARCHAR(20),   -- 10자리 숫자 (평문, 공개정보)

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ambassador_tax_info_type ON ambassador_tax_info(entity_type);
