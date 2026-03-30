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

/**
 * 기프트카드 결제 금액 누적 저장
 */
export const addGiftCardAmount = async (orderId, amount) => {
  const sql = `
    UPDATE order_webhook
    SET gift_card_amount = COALESCE(gift_card_amount, 0) + $2, updated_at = NOW()
    WHERE order_id = $1
    RETURNING *;
  `;
  const res = await pool.query(sql, [orderId, amount]);
  // order_webhook 레코드가 없으면 나중에 upsert 시 반영되도록 임시 저장
  if (res.rowCount === 0) {
    await pool.query(
      `INSERT INTO order_webhook (order_id, gift_card_amount, paid, created_at, updated_at)
       VALUES ($1, $2, FALSE, NOW(), NOW())
       ON CONFLICT (order_id) DO UPDATE SET
         gift_card_amount = COALESCE(order_webhook.gift_card_amount, 0) + $2,
         updated_at = NOW()`,
      [orderId, amount]
    );
  }
  return res.rows[0];
};

/**
 * 엠버서더의 최근 60일 판매 건수를 재계산하여 DB에 저장하고 등급도 업데이트
 *
 * ambassador_profile.sales_count_60d  → 건수 저장
 * ambassador_profile.grade_id         → 건수 기준 등급 반영 (ambassador_grade.min_orders 기준)
 */
export const updateGradeByOrderCount = async (ambassadorId) => {
  // 1) 최근 60일 판매 건수 재계산
  const countSql = `
    SELECT COUNT(*)::int AS count
    FROM order_webhook
    WHERE ambassador_id = $1
      AND paid = TRUE
      AND created_at >= NOW() - INTERVAL '60 days'
  `;
  const countRes = await pool.query(countSql, [ambassadorId]);
  const orderCount = countRes.rows[0]?.count ?? 0;

  // 2) DB에서 등급 기준 조회 → 건수에 맞는 최고 등급 결정
  const gradeSql = `
    SELECT id, code, min_orders
    FROM ambassador_grade
    WHERE min_orders <= $1
    ORDER BY min_orders DESC
    LIMIT 1
  `;
  const gradeRes = await pool.query(gradeSql, [orderCount]);
  const targetGrade = gradeRes.rows[0];

  if (!targetGrade) return { ambassadorId, orderCount, newGrade: null, updated: false };

  // 3) 건수 + 등급 한번에 업데이트
  const sql = `
    UPDATE ambassador_profile
    SET sales_count_60d = $2,
        grade_id = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING id, grade_id, sales_count_60d
  `;
  const res = await pool.query(sql, [ambassadorId, orderCount, targetGrade.id]);
  return { ambassadorId, orderCount, newGrade: targetGrade.code, updated: res.rowCount > 0 };
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
