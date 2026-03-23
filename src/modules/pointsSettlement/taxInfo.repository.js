import pool from "../../config/db.js";

/**
 * 앰버서더 세무정보 조회
 */
export const getTaxInfo = async (ambassadorId) => {
  const { rows } = await pool.query(
    `SELECT ambassador_id, entity_type, name, encrypted_ssn, ssn_iv, ssn_auth_tag,
            business_name, business_number, created_at, updated_at
     FROM ambassador_tax_info
     WHERE ambassador_id = $1`,
    [ambassadorId]
  );
  return rows[0] || null;
};

/**
 * 세무정보 존재 여부만 확인 (민감정보 제외)
 */
export const getTaxInfoSummary = async (ambassadorId) => {
  const { rows } = await pool.query(
    `SELECT ambassador_id, entity_type, name, business_name, business_number, created_at
     FROM ambassador_tax_info
     WHERE ambassador_id = $1`,
    [ambassadorId]
  );
  return rows[0] || null;
};

/**
 * 세무정보 등록 (UPSERT)
 */
export const upsertTaxInfo = async ({
  ambassador_id,
  entity_type,
  name,
  encrypted_ssn,
  ssn_iv,
  ssn_auth_tag,
  business_name,
  business_number,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO ambassador_tax_info
       (ambassador_id, entity_type, name, encrypted_ssn, ssn_iv, ssn_auth_tag,
        business_name, business_number, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
     ON CONFLICT (ambassador_id)
     DO UPDATE SET
       entity_type     = EXCLUDED.entity_type,
       name            = EXCLUDED.name,
       encrypted_ssn   = EXCLUDED.encrypted_ssn,
       ssn_iv          = EXCLUDED.ssn_iv,
       ssn_auth_tag    = EXCLUDED.ssn_auth_tag,
       business_name   = EXCLUDED.business_name,
       business_number = EXCLUDED.business_number,
       updated_at      = NOW()
     RETURNING ambassador_id, entity_type, name, business_name, business_number, created_at, updated_at`,
    [ambassador_id, entity_type, name, encrypted_ssn, ssn_iv, ssn_auth_tag, business_name, business_number]
  );
  return rows[0];
};
