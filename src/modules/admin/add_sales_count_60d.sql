-- 엠버서더 60일 판매 건수 컬럼 추가
ALTER TABLE ambassador_profile
  ADD COLUMN IF NOT EXISTS sales_count_60d INT DEFAULT 0;

-- 등급 테이블에 최소 주문 건수 기준 추가
ALTER TABLE ambassador_grade
  ADD COLUMN IF NOT EXISTS min_orders INT DEFAULT 0;

-- 등급별 기준값 세팅
UPDATE ambassador_grade SET min_orders = 0   WHERE LOWER(code) = 'bronze';
UPDATE ambassador_grade SET min_orders = 20  WHERE LOWER(code) = 'silver';
UPDATE ambassador_grade SET min_orders = 50  WHERE LOWER(code) = 'gold';
UPDATE ambassador_grade SET min_orders = 200 WHERE LOWER(code) = 'platinum';
UPDATE ambassador_grade SET min_orders = 500 WHERE LOWER(code) = 'diamond';

-- 관리자 등급 부여 시 60일 잠금용 컬럼
ALTER TABLE ambassador_profile
  ADD COLUMN IF NOT EXISTS grade_locked_until TIMESTAMP DEFAULT NULL;
