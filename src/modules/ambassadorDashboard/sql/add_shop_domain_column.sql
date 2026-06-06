-- order_webhook 멀티 스토어 지원: shop_domain 컬럼 추가
-- Shopify 주문 ID는 스토어 단위로만 유니크하므로, (order_id, shop_domain) 복합키로
-- 스토어 간 ID 충돌(덮어쓰기/포인트 중복 스킵)을 방지한다.
--
-- ⚠️ 실행 전: psql 에서 `\d order_webhook` 로 현재 PK 제약명을 확인할 것.
--    보통 'order_webhook_pkey' 이지만 다를 수 있다.
--    또한 order_webhook 을 참조하는 FK 가 없는지 확인 (현재 코드상 없음).

-- 1) 컬럼 추가
ALTER TABLE order_webhook
  ADD COLUMN IF NOT EXISTS shop_domain TEXT;

-- 2) 기존 행을 기존 운영 스토어(KOREA = mmjnwe-fr.myshopify.com) 도메인으로 백필
--    (기존 단일 설정 SHOPIFY_STORE_DOMAIN 이 가리키던 스토어 = ADAM KOREA)
UPDATE order_webhook
  SET shop_domain = 'mmjnwe-fr.myshopify.com'
  WHERE shop_domain IS NULL;

-- 3) NOT NULL 강제 (복합 PK 의 일부가 되므로 필수)
ALTER TABLE order_webhook
  ALTER COLUMN shop_domain SET NOT NULL;

-- 4) order_id 단독 PK 제거 → (order_id, shop_domain) 복합 PK 로 교체
ALTER TABLE order_webhook DROP CONSTRAINT order_webhook_pkey;
ALTER TABLE order_webhook ADD PRIMARY KEY (order_id, shop_domain);
