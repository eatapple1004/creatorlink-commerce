// repositories/orderWebhook.repository.js

import { query } from "../config/dbClient.js";
import pool from "../config/db.js";

/**
 * ✅ 주문 생성/업데이트 (Upsert)
 * Shopify orders/create 또는 orders/paid 어느 쪽이 먼저 와도 정상 처리
 */
export const upsertOrder = async ({ 
  orderId, 
  discountCode = null, 
  ambassadorId = null, 
  paid = false,
  totalPrice = null,
  currency = null 
}) => {
  const sql = `
    INSERT INTO order_webhook (order_id, discount_code, ambassador_id, paid, total_price, currency, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    ON CONFLICT (order_id)
    DO UPDATE SET
      discount_code = COALESCE(EXCLUDED.discount_code, order_webhook.discount_code),
      ambassador_id = EXCLUDED.ambassador_id,
      paid = CASE
        WHEN order_webhook.paid = true THEN true
        ELSE EXCLUDED.paid
      END,
      total_price = EXCLUDED.total_price,
      currency = EXCLUDED.currency,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    orderId, 
    discountCode, 
    ambassadorId, 
    paid, 
    totalPrice, 
    currency
  ];

  const res = await pool.query(sql, values);
  return res.rows[0];
};


/**
 * ✅ order_id 로 주문 기록 조회
 */
export const findOrderById = async (orderId) => {
  const sql = `
    SELECT *
    FROM order_webhook
    WHERE order_id = $1
  `;
  const res = await query(sql, [orderId]);
  return res.rows[0] || null;
};


/**
 * ✅ 결제 완료 상태로 업데이트
 */
export const markPaid = async (orderId, amount, currency) => {
  const sql = `
    UPDATE order_webhook
    SET 
      paid = TRUE,
      total_price = $2,
      currency = $3,
      updated_at = NOW()
    WHERE order_id = $1
    RETURNING *;
  `;

  const res = await pool.query(sql, [orderId, amount, currency]);
  return res.rows[0];
};
