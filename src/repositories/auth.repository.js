import { query } from "../config/dbClient.js";
import pool from "../config/db.js";

/**
 * ✅ 이메일로 사용자 조회
 * @param {string} email
 * @returns {object|null}
 */
export const findUserByEmail = async (email) => {
  const sql = `
    SELECT *
    FROM ambassador_profile
    WHERE email = $1
  `;
  const res = await query(sql, [email]);
  return res.rows[0] || null;
};


/**
 * ✅ 새 앰버서더 등록
 * @param {object} userData
 * @returns {object} 생성된 사용자 정보
 */
 export const insertUser = async ({ name, email, password, paypal_email, referral_code }) => {
  const query = `
    INSERT INTO ambassador_profile 
      (name, email, password, paypal_email, currency, country_code, status, referral_code, created_at, updated_at)
    VALUES 
      ($1, $2, $3, $4, 'USD', 'US', 'active', $5, NOW(), NOW())
    RETURNING id, name, email, paypal_email, referral_code, created_at;
  `;
  
  const values = [name, email, password, paypal_email, referral_code];
  const result = await pool.query(query, values);

  // ✅ 포인트 테이블 초기화
  const ambassador_id = result.rows[0].id;
  await pool.query(
    `INSERT INTO ambassador_points (ambassador_id, current_points, total_earned, total_withdrawn)
     VALUES ($1, 0, 0, 0)`,
    [ambassador_id]
  );

  return result.rows[0];
};

/**
 * ✅ 포인트 초기화 (회원가입 직후)
 * @param {number} ambassadorId
 */
export const insertInitialPoints = async (ambassadorId) => {
  const sql = `
    INSERT INTO ambassador_points
      (ambassador_id, current_points, total_earned, total_withdrawn, last_updated_at)
    VALUES
      ($1, 0, 0, 0, NOW())
  `;
  await query(sql, [ambassadorId]);
};
