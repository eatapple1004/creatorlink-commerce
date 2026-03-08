import pool from "../../config/db.js";

/**
 * 개별 앰버서더 정산 활성화 여부
 */
export const getAmbassadorSettlementEnabled = async (ambassadorId) => {
  const { rows } = await pool.query(
    "SELECT settlement_enabled FROM ambassador_profile WHERE id = $1",
    [ambassadorId]
  );
  return rows[0]?.settlement_enabled ?? true;
};

/**
 * 포인트 요약 (현재 포인트 + 잠금 포인트)
 */
export const getSettlementSummary = async (ambassadorId) => {
  const { rows } = await pool.query(
    `
    SELECT
      ap.current_points,
      ap.total_earned,
      ap.total_withdrawn,
      COALESCE((
        SELECT SUM(amount)
        FROM transaction_log
        WHERE ambassador_id = $1
          AND type = 'earn'
          AND reference_type NOT IN ('AIRWALLEX_REVERSAL', 'ADMIN_ADJUSTMENT')
          AND created_at >= NOW() - INTERVAL '1 month'
      ), 0) AS locked_points
    FROM ambassador_points ap
    WHERE ap.ambassador_id = $1
    `,
    [ambassadorId]
  );
  return rows[0] || null;
};

/**
 * 활성 정산 계좌 조회 (표시용 - 마스킹된 정보)
 */
export const getActiveBankAccount = async (ambassadorId) => {
  const { rows } = await pool.query(
    `
    SELECT
      account_name,
      account_number_masked,
      routing_type1,
      routing_value1,
      bank_country_code,
      account_currency
    FROM airwallex_beneficiary
    WHERE ambassador_idx = $1 AND is_active = true AND status = 'REGISTERED'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [ambassadorId]
  );
  return rows[0] || null;
};

/**
 * 활성 수취인 전체 정보 조회 (출금용 - airwallex_beneficiary_id 포함)
 */
export const getActiveBeneficiary = async (ambassadorId) => {
  const { rows } = await pool.query(
    `
    SELECT *
    FROM airwallex_beneficiary
    WHERE ambassador_idx = $1 AND is_active = true AND status = 'REGISTERED'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [ambassadorId]
  );
  return rows[0] || null;
};

/**
 * 정산 요청 내역 조회 (airwallex_transfer)
 */
export const getSettlementHistory = async (ambassadorId) => {
  const { rows } = await pool.query(
    `
    SELECT
      idx,
      transfer_amount,
      transfer_currency,
      status,
      created_at
    FROM airwallex_transfer
    WHERE ambassador_idx = $1
    ORDER BY created_at DESC
    LIMIT 50
    `,
    [ambassadorId]
  );
  return rows;
};
