import pool from "../../config/db.js";

// ── Settings ──

export const getSetting = async (key) => {
  const { rows } = await pool.query(
    "SELECT value FROM admin_settings WHERE key = $1",
    [key]
  );
  return rows[0]?.value ?? null;
};

export const setSetting = async (key, value) => {
  const { rowCount } = await pool.query(
    "UPDATE admin_settings SET value = $1, updated_at = NOW() WHERE key = $2",
    [value, key]
  );
  if (rowCount === 0) {
    await pool.query(
      "INSERT INTO admin_settings (key, value) VALUES ($1, $2)",
      [key, value]
    );
  }
};

export const getAllSettings = async () => {
  const { rows } = await pool.query("SELECT key, value FROM admin_settings ORDER BY key");
  return rows;
};

// ── Ambassadors ──

export const searchAmbassadors = async ({ query, limit = 20, offset = 0 }) => {
  const sql = `
    SELECT
      ap.id, ap.name, ap.email, ap.referral_code, ap.status,
      ap.settlement_enabled,
      apt.current_points, apt.total_earned, apt.total_withdrawn,
      UPPER(g.code) AS grade_name
    FROM ambassador_profile ap
    LEFT JOIN ambassador_points apt ON apt.ambassador_id = ap.id
    LEFT JOIN ambassador_grade g ON g.id = ap.grade_id
    WHERE ($1::text IS NULL OR ap.id::text = $1 OR ap.email ILIKE '%' || $1 || '%' OR ap.name ILIKE '%' || $1 || '%')
    ORDER BY ap.id DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await pool.query(sql, [query || null, limit, offset]);
  return rows;
};

export const toggleAmbassadorSettlement = async (id, enabled) => {
  const { rows } = await pool.query(
    "UPDATE ambassador_profile SET settlement_enabled = $1 WHERE id = $2 RETURNING id, settlement_enabled",
    [enabled, id]
  );
  return rows[0] || null;
};

export const getAmbassadorById = async (id) => {
  const sql = `
    SELECT
      ap.id, ap.name, ap.email, ap.paypal_email, ap.referral_code,
      ap.status, ap.country_code, ap.created_at, ap.settlement_enabled,
      apt.current_points, apt.total_earned, apt.total_withdrawn,
      UPPER(g.code) AS grade_name, g.commission_rate
    FROM ambassador_profile ap
    LEFT JOIN ambassador_points apt ON apt.ambassador_id = ap.id
    LEFT JOIN ambassador_grade g ON g.id = ap.grade_id
    WHERE ap.id = $1
  `;
  const { rows } = await pool.query(sql, [id]);
  return rows[0] || null;
};

// ── Grades ──

export const getAllGrades = async () => {
  const { rows } = await pool.query(
    "SELECT id, code, commission_rate, min_orders, discount_rate FROM ambassador_grade ORDER BY min_orders ASC"
  );
  return rows;
};

export const updateAmbassadorGrade = async (ambassadorId, gradeId) => {
  const { rows } = await pool.query(
    `UPDATE ambassador_profile
     SET grade_id = $1,
         grade_locked_until = NOW() + INTERVAL '60 days',
         updated_at = NOW()
     WHERE id = $2
     RETURNING id, grade_id, grade_locked_until`,
    [gradeId, ambassadorId]
  );
  return rows[0] || null;
};

// ── Transfers ──

export const getTransfers = async ({ ambassadorId, limit = 30, offset = 0 }) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (ambassadorId) {
    conditions.push(`t.ambassador_idx = $${idx++}`);
    params.push(ambassadorId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      t.idx, t.ambassador_idx, t.transfer_amount, t.transfer_currency,
      t.status, t.created_at, t.reference, t.airwallex_transfer_id,
      ap.name AS ambassador_name, ap.email AS ambassador_email
    FROM airwallex_transfer t
    LEFT JOIN ambassador_profile ap ON ap.id = t.ambassador_idx
    ${where}
    ORDER BY t.created_at DESC
    LIMIT $${idx++} OFFSET $${idx++}
  `;
  params.push(limit, offset);

  const { rows } = await pool.query(sql, params);
  return rows;
};

export const getTransferCount = async ({ ambassadorId }) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (ambassadorId) {
    conditions.push(`ambassador_idx = $${idx++}`);
    params.push(ambassadorId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT COUNT(*)::int AS count FROM airwallex_transfer ${where}`;
  const { rows } = await pool.query(sql, params);
  return rows[0]?.count ?? 0;
};

// ── Transfers for Excel export (no pagination) ──

export const getTransfersForExport = async ({ ambassadorId, startDate, endDate }) => {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (ambassadorId) {
    conditions.push(`t.ambassador_idx = $${idx++}`);
    params.push(ambassadorId);
  }
  if (startDate) {
    conditions.push(`t.created_at >= $${idx++}`);
    params.push(startDate);
  }
  if (endDate) {
    conditions.push(`t.created_at < $${idx++}::date + INTERVAL '1 day'`);
    params.push(endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const sql = `
    SELECT
      t.idx,
      t.ambassador_idx,
      ap.name AS ambassador_name,
      ap.email AS ambassador_email,
      t.transfer_amount,
      t.transfer_currency,
      t.source_amount,
      t.source_currency,
      t.status,
      t.reference,
      t.airwallex_transfer_id,
      t.airwallex_short_reference_id,
      t.transfer_method,
      t.reason,
      t.created_at,
      t.updated_at
    FROM airwallex_transfer t
    LEFT JOIN ambassador_profile ap ON ap.id = t.ambassador_idx
    ${where}
    ORDER BY t.created_at DESC
  `;

  const { rows } = await pool.query(sql, params);
  return rows;
};

// ── Transactions (per ambassador) ──

export const getTransactions = async ({ ambassadorId, limit = 30, offset = 0 }) => {
  const sql = `
    SELECT id, type, amount, balance_after, reference_type, reference_id, description, created_at
    FROM transaction_log
    WHERE ambassador_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await pool.query(sql, [ambassadorId, limit, offset]);
  return rows;
};

// ── Aggregate Stats ──

export const getAggregateStats = async () => {
  const sql = `
    SELECT
      COUNT(*)::int AS total_ambassadors,
      COALESCE(SUM(current_points), 0) AS total_current_points,
      COALESCE(SUM(total_earned), 0)   AS total_earned,
      COALESCE(SUM(total_withdrawn), 0) AS total_withdrawn
    FROM ambassador_points
  `;
  const { rows } = await pool.query(sql);
  return rows[0];
};

// ── Point Adjustment ──

export const adjustPoints = async (client, { ambassadorId, amount, description }) => {
  // 1) 현재 포인트 조회
  const { rows } = await client.query(
    "SELECT current_points, total_earned, total_withdrawn FROM ambassador_points WHERE ambassador_id = $1 FOR UPDATE",
    [ambassadorId]
  );
  if (rows.length === 0) throw new Error("AMBASSADOR_NOT_FOUND");

  const record = rows[0];
  const current = parseFloat(record.current_points);
  const earned = parseFloat(record.total_earned);
  const withdrawn = parseFloat(record.total_withdrawn);

  const newBalance = current + amount;
  const isAdd = amount > 0;

  // 2) 포인트 업데이트
  await client.query(
    `UPDATE ambassador_points
     SET current_points = $1,
         total_earned = $2,
         total_withdrawn = $3,
         last_updated_at = NOW()
     WHERE ambassador_id = $4`,
    [
      newBalance,
      isAdd ? earned + amount : earned,
      isAdd ? withdrawn : withdrawn + Math.abs(amount),
      ambassadorId,
    ]
  );

  // 3) 트랜잭션 로그
  await client.query(
    `INSERT INTO transaction_log (ambassador_id, type, amount, balance_after, reference_type, reference_id, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      ambassadorId,
      isAdd ? "earn" : "withdraw",
      amount,
      newBalance,
      "ADMIN_ADJUSTMENT",
      `ADMIN-${Date.now()}`,
      description || (isAdd ? "Admin manual add" : "Admin manual deduct"),
    ]
  );

  return { previous: current, adjusted: amount, newBalance };
};
