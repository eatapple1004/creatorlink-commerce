import pool from "../config/db.js";

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