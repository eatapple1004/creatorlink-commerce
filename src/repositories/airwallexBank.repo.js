import { pool } from '../db/pool.js';

export async function findCachedBanks({ countryCode, transferMethod, currency, ttlSeconds }) {
  const sql = `
    SELECT banks_json
    FROM public.airwallex_supported_banks_cache
    WHERE country_code = $1
      AND transfer_method = $2
      AND currency = $3
      AND updated_at >= NOW() - ($4::int * INTERVAL '1 second')
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [countryCode, transferMethod, currency, ttlSeconds]);
  if (!rows[0]) return null;
  return rows[0].banks_json;
}

export async function upsertCachedBanks({ countryCode, transferMethod, currency, banks }) {
  const sql = `
    INSERT INTO public.airwallex_supported_banks_cache
      (country_code, transfer_method, currency, banks_json, updated_at)
    VALUES
      ($1, $2, $3, $4::jsonb, NOW())
    ON CONFLICT (country_code, transfer_method, currency)
    DO UPDATE SET
      banks_json = EXCLUDED.banks_json,
      updated_at = NOW()
  `;
  await pool.query(sql, [countryCode, transferMethod, currency, JSON.stringify(banks)]);
}
