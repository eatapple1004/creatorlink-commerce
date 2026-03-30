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
        SELECT COUNT(*)
        FROM order_webhook ow
        WHERE ow.ambassador_id = ap.id
          AND ow.paid = true
          AND ow.created_at >= NOW() - INTERVAL '60 days'
      ), 0) AS sales_last_60days
    FROM ambassador_profile ap
    JOIN ambassador_points apt ON apt.ambassador_id = ap.id
    LEFT JOIN ambassador_grade g ON g.id = ap.grade_id
    WHERE ap.id = $1
  `;
  const { rows } = await pool.query(sql, [ambassadorId]);
  return rows[0] || null;
};
