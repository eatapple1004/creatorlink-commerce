import pool from "../config/db.js";

// ✅ 이메일로 사용자 조회
export const findUserByEmail = async (email) => {
  const query = "SELECT * FROM users WHERE email = $1";
  const result = await pool.query(query, [email]);
  return result.rows[0];
};

// ✅ 새 사용자 등록
export const insertUser = async ({ name, email, password, paypal_id }) => {
  const query = `
    INSERT INTO users (name, email, password, paypal_id, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id, name, email, paypal_id, created_at;
  `;
  const values = [name, email, password, paypal_id];
  const result = await pool.query(query, values);
  return result.rows[0];
};
