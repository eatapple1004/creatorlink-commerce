// repositories/ambassador.repository.js

import { query } from "../config/dbClient.js";
import pool from "../config/db.js";

/**
 * ✅ 이메일로 앰버서더 조회
 */
export const findAmbassadorByEmail = async (email) => {
    const sql = `
        SELECT *
        FROM ambassador_profile
        WHERE email = $1
    `;
    const res = await query(sql, [email]);
    return res.rows[0] || null;
};


/**
 * ✅ 할인코드(추천코드)로 앰버서더 조회
 * Shopify Webhook (orders/create)에서 사용됨
 */
export const findByDiscountCode = async (discountCode) => {
    const sql = `
        SELECT *
        FROM ambassador_profile
        WHERE referral_code = $1
        LIMIT 1
    `;
    const res = await query(sql, [discountCode]);
    return res.rows[0] || null;
};


/**
 * ✅ 새 앰버서더 등록
 * 회원가입 시 사용
 */
export const insertAmbassador = async ({ 
    name, 
    email, 
    password, 
    paypal_email,
    referral_code 
}) => {

    const sql = `
        INSERT INTO ambassador_profile 
        (name, email, password, paypal_email, currency, country_code, status, referral_code, created_at, updated_at)
        VALUES 
        ($1, $2, $3, $4, 'USD', 'US', 'active', $5, NOW(), NOW())
        RETURNING id, name, email, paypal_email, referral_code, created_at;
    `;

    const values = [name, email, password, paypal_email, referral_code];
    const res = await pool.query(sql, values);

    const ambassadorId = res.rows[0].id;

    // 🔹 앰버서더 포인트 초기화 (회원가입 직후)
    await pool.query(
        `
        INSERT INTO ambassador_points 
        (ambassador_id, current_points, total_earned, total_withdrawn, last_updated_at)
        VALUES ($1, 0, 0, 0, NOW())
        `,
        [ambassadorId]
    );

    return res.rows[0];
};


/**
 * ✅ 앰버서더 수익금 증가 (결제완료 Webhook에서 포인트 지급 후)
 */
export const incrementEarnings = async (ambassadorId, amount) => {
  const sql = `
    UPDATE ambassador_points
    SET 
      current_points = current_points + $2,
      total_earned = total_earned + $2,
      last_updated_at = NOW()
    WHERE ambassador_id = $1
    RETURNING *;
  `;

  const res = await pool.query(sql, [ambassadorId, amount]);
  return res.rows[0];
};


/**
 * ✅ PayPal 이메일로 조회 (출금 기능)
 */
export const findByPaypalEmail = async (paypal_email) => {
  const sql = `
    SELECT * 
    FROM ambassador_profile 
    WHERE paypal_email = $1
  `;
  const res = await query(sql, [paypal_email]);
  return res.rows[0] || null;
};
