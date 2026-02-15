// repositories/orderWebhook.repository.js
import { query } from "../config/dbClient.js";
import pool from "../config/db.js";

export const upsertOrder = async ({
  orderId,
  discountCode = null,
  ambassadorId = null,
  paid = false,
  totalPrice = null,
  currency = null,

  // ✅ 추가 저장값
  originalPrice = null,
  discountAmount = null,
  subtotalPrice = null,
  taxAmount = null,
}) => {
  const sql = `
    INSERT INTO order_webhook (
      order_id, discount_code, ambassador_id, paid, currency,
      total_price, original_price, discount_amount, subtotal_price, tax_amount,
      created_at, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10,
      NOW(), NOW()
    )
    ON CONFLICT (order_id)
    DO UPDATE SET
      discount_code = COALESCE(EXCLUDED.discount_code, order_webhook.discount_code),
      ambassador_id = COALESCE(EXCLUDED.ambassador_id, order_webhook.ambassador_id),

      paid = CASE
        WHEN order_webhook.paid = TRUE THEN TRUE
        ELSE EXCLUDED.paid
      END,

      currency = COALESCE(EXCLUDED.currency, order_webhook.currency),

      -- 금액들도 "새 값이 있으면 갱신"
      total_price      = COALESCE(EXCLUDED.total_price, order_webhook.total_price),
      original_price   = COALESCE(EXCLUDED.original_price, order_webhook.original_price),
      discount_amount  = COALESCE(EXCLUDED.discount_amount, order_webhook.discount_amount),
      subtotal_price   = COALESCE(EXCLUDED.subtotal_price, order_webhook.subtotal_price),
      tax_amount       = COALESCE(EXCLUDED.tax_amount, order_webhook.tax_amount),

      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    orderId,
    discountCode,
    ambassadorId,
    paid,
    currency,
    totalPrice,
    originalPrice,
    discountAmount,
    subtotalPrice,
    taxAmount,
  ];

  const res = await pool.query(sql, values);
  return res.rows[0];
};

export const findOrderById = async (orderId) => {
  const sql = `SELECT * FROM order_webhook WHERE order_id = $1`;
  const res = await query(sql, [orderId]);
  return res.rows[0] || null;
};

export const markPaid = async (orderId, amount, currency) => {
  const sql = `
    UPDATE order_webhook
    SET paid = TRUE, total_price = $2, currency = $3, updated_at = NOW()
    WHERE order_id = $1
    RETURNING *;
  `;
  const res = await pool.query(sql, [orderId, amount, currency]);
  return res.rows[0];
};
