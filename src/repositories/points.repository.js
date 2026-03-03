import pool from "../config/db.js";
const db = (client) => client ?? pool;

/**
 * 특정 엠버서더 포인트 레코드 조회
 */
export const findPointsByAmbassador = async (ambassadorId) => {
  const result = await pool.query(
    "SELECT * FROM ambassador_points WHERE ambassador_id = $1",
    [ambassadorId]
  );
  return result.rows[0];
};

/**
 * 포인트 레코드 갱신
 */
export const savePoints = async (ambassadorId, updates) => {
  const { current_points, total_earned, total_withdrawn } = updates;
  
  const query = `
    UPDATE ambassador_points
    SET 
      current_points = $1,
      total_earned = $2,
      total_withdrawn = $3,
      last_updated_at = NOW()
    WHERE ambassador_id = $4
    RETURNING *;
  `;
  const values = [current_points, total_earned, total_withdrawn, ambassadorId];
  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * 거래 로그 추가
 */
export const insertTransaction = async ({
  ambassador_id,
  type,
  amount,
  balance_after,
  reference_type = null,
  reference_id = null,
  description = null,
}) => {
  const query = `
    INSERT INTO transaction_log (
      ambassador_id, type, amount, balance_after, reference_type, reference_id, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const result = await pool.query(query, [
    ambassador_id,
    type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    description,
  ]);
  return result.rows[0];
};

/**
 * 추천코드로 앰버서더 조회
 */
 export const findAmbassadorByReferralCode = async (referralCode) => {
    const query = `
        SELECT id AS ambassador_id
        FROM ambassador_profile
        WHERE referral_code = $1
    `;
    const result = await pool.query(query, [referralCode]);
    return result.rows[0];
};


export const existsEarnByShopifyOrder = async (orderId) => {
  const sql = `
    SELECT 1
    FROM transaction_log
    WHERE type = 'earn'
      AND reference_type = 'SHOPIFY_ORDER'
      AND reference_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [orderId]);
  return rows.length > 0;
};

/**
 * 1개월 이내 적립된 포인트 합계 (출금 불가 잠금 포인트)
 */
export const getLockedPoints = async (ambassadorId, client = null) => {
  const sql = `
    SELECT COALESCE(SUM(amount), 0) AS locked_points
    FROM transaction_log
    WHERE ambassador_id = $1
      AND type = 'earn'
      AND created_at >= NOW() - INTERVAL '1 month'
  `;
  const { rows } = await db(client).query(sql, [ambassadorId]);
  return Number(rows[0]?.locked_points ?? 0);
};

/**
 * order_id 기준으로 적립된 포인트 총합 조회
 */
export const getEarnedPointsByOrderId = async (orderId, client = null) => {
  const sql = `
    SELECT COALESCE(SUM(amount), 0) AS total_earned
    FROM transaction_log
    WHERE type = 'earn'
      AND reference_type = 'SHOPIFY_ORDER'
      AND reference_id = $1
  `;
  const { rows } = await db(client).query(sql, [orderId]);
  return Number(rows[0]?.total_earned ?? 0);
};

export const existsRefundByShopifyRefund = async (refundId, client = null) => {
  const sql = `
    SELECT 1
    FROM transaction_log
    WHERE type = 'refund'
      AND reference_type = 'SHOPIFY_REFUND'
      AND reference_id = $1
    LIMIT 1
  `;
  const { rows } = await db(client).query(sql, [refundId]);
  return rows.length > 0;
};


/**
 * ✅ ambassador_id로 commission_rate(%) 조회
 * - commission_rate: numeric(5,2) ex) 5.00
 */
/**
 * ambassador_id로 등급 코드 + 기본 commission_rate 조회
 */
export const getAmbassadorGradeInfo = async (ambassador_id, client = null) => {
  const sql = `
    SELECT g.code AS grade_code, g.commission_rate
    FROM ambassador_profile ap
    JOIN ambassador_grade g ON g.id = ap.grade_id
    WHERE ap.id = $1
    LIMIT 1
  `;
  const { rows } = await db(client).query(sql, [ambassador_id]);
  return rows[0] || { grade_code: "BRONZE", commission_rate: 0 };
};

/**
 * item_code로 아이템별 등급 커미션 조회
 */
export const getItemCommissionByCode = async (itemCode, client = null) => {
  const sql = `SELECT * FROM item_commission WHERE item_code = $1 LIMIT 1`;
  const { rows } = await db(client).query(sql, [itemCode]);
  return rows[0] || null;
};

 export const getCommissionRateByAmbassadorId = async (ambassador_id, client = null) => {
  const sql = `
    SELECT g.commission_rate
    FROM public.ambassador_profile ap
    JOIN public.ambassador_grade g ON g.id = ap.grade_id
    WHERE ap.id = $1
    LIMIT 1
  `;
  const { rows } = await db(client).query(sql, [ambassador_id]);
  // 없으면 기본 0%
  return rows[0]?.commission_rate ?? 0;
};