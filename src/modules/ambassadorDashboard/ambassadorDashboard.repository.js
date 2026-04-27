import pool from "../../config/db.js";

export const getAmbassadorDashboardData = async (ambassadorId) => {
  const sql = `
    SELECT
      ap.id,
      ap.name,
      ap.email,
      ap.referral_code,
      apt.current_points,
      apt.total_earned,
      apt.total_withdrawn,
      UPPER(g.code) AS grade_name,
      g.commission_rate,
      COALESCE((
        SELECT COUNT(*)::int
        FROM order_webhook ow
        WHERE ow.ambassador_id = ap.id
          AND ow.paid = TRUE
          AND ow.created_at >= NOW() - INTERVAL '60 days'
      ), 0) AS sales_last_60days,
      ap.grade_locked_until
    FROM ambassador_profile ap
    JOIN ambassador_points apt ON apt.ambassador_id = ap.id
    LEFT JOIN ambassador_grade g ON g.id = ap.grade_id
    WHERE ap.id = $1
  `;
  const { rows } = await pool.query(sql, [ambassadorId]);
  return rows[0] || null;
};

export const getAmbassadorOrders = async (ambassadorId, { page = 1, limit = 20 } = {}) => {
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM order_webhook
    WHERE ambassador_id = $1 AND paid = TRUE
  `;
  const countRes = await pool.query(countSql, [ambassadorId]);
  const total = countRes.rows[0]?.total || 0;

  const sql = `
    SELECT
      ow.order_id,
      ow.line_items,
      ow.created_at,
      COALESCE(tl.earned_points, 0) AS earned_points
    FROM order_webhook ow
    LEFT JOIN (
      SELECT reference_id, SUM(amount) AS earned_points
      FROM transaction_log
      WHERE type = 'earn' AND reference_type = 'SHOPIFY_ORDER'
      GROUP BY reference_id
    ) tl ON tl.reference_id = ow.order_id::text
    WHERE ow.ambassador_id = $1 AND ow.paid = TRUE
    ORDER BY ow.created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await pool.query(sql, [ambassadorId, limit, offset]);

  return {
    orders: rows,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
};
