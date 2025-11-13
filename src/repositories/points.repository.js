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
