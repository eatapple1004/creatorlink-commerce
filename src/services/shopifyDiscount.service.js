import pool from "../config/db.js";
import logger from "../config/logger.js";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = "2024-01";

async function shopifyAdmin(endpoint, method = "GET", body = null) {
  const url = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}${endpoint}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ACCESS_TOKEN,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(`Shopify API ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

/**
 * 엠버서더 회원가입 시 Shopify 할인 코드 생성
 * 1) Price Rule 생성 (할인율 설정)
 * 2) Discount Code 생성 (referral_code를 코드로)
 * 3) ambassador_profile에 price_rule_id 저장
 */
export const createDiscountCode = async ({ ambassadorId, referralCode, discountRate }) => {
  // 1) Price Rule 생성
  const priceRuleData = await shopifyAdmin("/price_rules.json", "POST", {
    price_rule: {
      title: `Ambassador ${referralCode}`,
      target_type: "line_item",
      target_selection: "all",
      allocation_method: "across",
      value_type: "percentage",
      value: `-${discountRate}`,        // 음수 = 할인
      customer_selection: "all",
      usage_limit: null,                 // 무제한 사용
      starts_at: new Date().toISOString(),
    },
  });

  const priceRuleId = priceRuleData.price_rule.id;

  // 2) Discount Code 생성
  await shopifyAdmin(`/price_rules/${priceRuleId}/discount_codes.json`, "POST", {
    discount_code: {
      code: referralCode,
    },
  });

  // 3) DB에 price_rule_id 저장
  await pool.query(
    "UPDATE ambassador_profile SET shopify_price_rule_id = $1, updated_at = NOW() WHERE id = $2",
    [priceRuleId, ambassadorId]
  );

  logger.info(`🏷️ [Shopify] 할인 코드 생성 완료 → ambassador_id=${ambassadorId}, code=${referralCode}, discount=${discountRate}%, price_rule_id=${priceRuleId}`);

  return { priceRuleId, code: referralCode, discountRate };
};

/**
 * 엠버서더 등급 변경 시 Shopify 할인율 업데이트
 */
export const updateDiscountRate = async ({ ambassadorId, discountRate }) => {
  // 1) DB에서 price_rule_id 조회
  const { rows } = await pool.query(
    "SELECT shopify_price_rule_id FROM ambassador_profile WHERE id = $1",
    [ambassadorId]
  );
  const priceRuleId = rows[0]?.shopify_price_rule_id;

  if (!priceRuleId) {
    logger.warn(`🟨 [Shopify] 할인 코드 없음 → ambassador_id=${ambassadorId}, 업데이트 스킵`);
    return null;
  }

  // 2) Price Rule 할인율 업데이트
  await shopifyAdmin(`/price_rules/${priceRuleId}.json`, "PUT", {
    price_rule: {
      id: priceRuleId,
      value: `-${discountRate}`,
    },
  });

  logger.info(`🏷️ [Shopify] 할인율 업데이트 → ambassador_id=${ambassadorId}, discount=${discountRate}%, price_rule_id=${priceRuleId}`);

  return { priceRuleId, discountRate };
};
