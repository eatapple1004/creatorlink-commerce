-- 엠버서더 × 스토어별 Shopify 할인 price_rule_id 매핑 테이블
-- 멀티 스토어에서 같은 referral 코드를 각 스토어에 별도로 생성하므로
-- (ambassador_id, shop_domain) 조합마다 price_rule_id 를 따로 보관한다.

CREATE TABLE IF NOT EXISTS ambassador_store_discount (
  id SERIAL PRIMARY KEY,
  ambassador_id INTEGER NOT NULL REFERENCES ambassador_profile(id),
  shop_domain TEXT NOT NULL,
  shopify_price_rule_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (ambassador_id, shop_domain)
);

-- 기존 단일값 백필: 레거시 ambassador_profile.shopify_price_rule_id → KOREA 스토어
-- (기존 단일 설정이 가리키던 스토어 = ADAM KOREA = mmjnwe-fr.myshopify.com)
INSERT INTO ambassador_store_discount (ambassador_id, shop_domain, shopify_price_rule_id)
SELECT id, 'mmjnwe-fr.myshopify.com', shopify_price_rule_id
FROM ambassador_profile
WHERE shopify_price_rule_id IS NOT NULL
ON CONFLICT (ambassador_id, shop_domain) DO NOTHING;
