-- order_webhook 테이블에 line_items JSONB 컬럼 추가
-- 상품명, SKU, 수량, 가격 등 Shopify line_items 정보를 저장
ALTER TABLE order_webhook
ADD COLUMN IF NOT EXISTS line_items JSONB DEFAULT NULL;
