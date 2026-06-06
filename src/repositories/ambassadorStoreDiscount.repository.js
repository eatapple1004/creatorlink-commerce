// repositories/ambassadorStoreDiscount.repository.js
//
// 엠버서더 × 스토어별 Shopify 할인 price_rule_id 매핑
// - 멀티 스토어에서 같은 referral 코드를 각 스토어에 별도로 생성하므로
//   ambassador_id + shop_domain 조합마다 price_rule_id 를 따로 보관한다.

import pool from "../config/db.js";

/**
 * (ambassador_id, shop_domain) 매핑 upsert
 */
export const upsertMapping = async ({ ambassadorId, shopDomain, priceRuleId }) => {
  const sql = `
    INSERT INTO ambassador_store_discount
      (ambassador_id, shop_domain, shopify_price_rule_id, created_at, updated_at)
    VALUES ($1, $2, $3, NOW(), NOW())
    ON CONFLICT (ambassador_id, shop_domain)
    DO UPDATE SET
      shopify_price_rule_id = EXCLUDED.shopify_price_rule_id,
      updated_at = NOW()
    RETURNING *;
  `;
  const res = await pool.query(sql, [ambassadorId, shopDomain, priceRuleId]);
  return res.rows[0];
};

/**
 * 특정 엠버서더의 전체 스토어 매핑 조회
 * @returns {{shop_domain: string, shopify_price_rule_id: string}[]}
 */
export const findByAmbassador = async (ambassadorId) => {
  const sql = `
    SELECT shop_domain, shopify_price_rule_id
    FROM ambassador_store_discount
    WHERE ambassador_id = $1
  `;
  const res = await pool.query(sql, [ambassadorId]);
  return res.rows;
};
