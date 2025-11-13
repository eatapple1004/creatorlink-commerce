import pool from "../config/db.js";

// 포인트 조회
export const getPointsByAmbassador = async (ambassadorId) => {
  const query = `
    SELECT * FROM ambassador_points
    WHERE ambassador_id = $1;
  `;
  const result = await pool.query(query, [ambassadorId]);
  return result.rows[0];
};

// 포인트 업데이트
export const updatePoints = async (ambassadorId, current, earned, withdrawn) => {
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
  const result = await pool.query(query, [current, earned, withdrawn, ambassadorId]);
  return result.rows[0];
};

// 거래 로그 기록
export const insertTransactionLog = async ({
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
