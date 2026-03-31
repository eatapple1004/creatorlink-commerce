import pool from "../config/db.js";
import logger from "../config/logger.js";

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = "2024-01";

// REST API 호출
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

// GraphQL API 호출
async function shopifyGraphQL(query, variables = {}) {
  const url = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": ACCESS_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    const err = new Error(`Shopify GraphQL: ${JSON.stringify(data.errors)}`);
    err.detail = data.errors;
    throw err;
  }
  return data.data;
}

/**
 * 엠버서더 회원가입 시 Shopify 할인 코드 생성 (GraphQL - 중복 할인 허용)
 */
export const createDiscountCode = async ({ ambassadorId, referralCode, discountRate }) => {
  const mutation = `
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode {
          id
          codeDiscount {
            ... on DiscountCodeBasic {
              title
              codes(first: 1) {
                nodes { code }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    basicCodeDiscount: {
      title: `Ambassador ${referralCode}`,
      code: referralCode,
      startsAt: new Date().toISOString(),
      customerSelection: { all: true },
      customerGets: {
        value: { percentage: discountRate / 100 },
        items: { all: true },
      },
      combinesWithProductDiscounts: false,
      combinesWithShippingDiscounts: false,
      combinesWithOrderDiscounts: false,
      usageLimit: null,
    },
  };

  const data = await shopifyGraphQL(mutation, variables);
  const result = data.discountCodeBasicCreate;

  if (result.userErrors?.length > 0) {
    const err = new Error(`Shopify Discount 생성 실패: ${JSON.stringify(result.userErrors)}`);
    err.detail = result.userErrors;
    throw err;
  }

  // GraphQL ID에서 숫자 추출 (gid://shopify/DiscountCodeNode/123 → 123)
  const gid = result.codeDiscountNode.id;
  const discountId = gid.split("/").pop();

  // DB에 discount ID 저장
  await pool.query(
    "UPDATE ambassador_profile SET shopify_price_rule_id = $1, updated_at = NOW() WHERE id = $2",
    [discountId, ambassadorId]
  );

  logger.info(`🏷️ [Shopify] 할인 코드 생성 완료 (중복할인 허용) → ambassador_id=${ambassadorId}, code=${referralCode}, discount=${discountRate}%, id=${discountId}`);

  return { discountId, code: referralCode, discountRate };
};

/**
 * 엠버서더 등급 변경 시 Shopify 할인율 업데이트 (GraphQL)
 */
export const updateDiscountRate = async ({ ambassadorId, discountRate }) => {
  const { rows } = await pool.query(
    "SELECT shopify_price_rule_id FROM ambassador_profile WHERE id = $1",
    [ambassadorId]
  );
  const discountId = rows[0]?.shopify_price_rule_id;

  if (!discountId) {
    logger.warn(`🟨 [Shopify] 할인 코드 없음 → ambassador_id=${ambassadorId}, 업데이트 스킵`);
    return null;
  }

  // 먼저 REST API로 시도 (기존 Price Rule 방식)
  try {
    await shopifyAdmin(`/price_rules/${discountId}.json`, "PUT", {
      price_rule: { id: Number(discountId), value: `-${discountRate}` },
    });
    logger.info(`🏷️ [Shopify] 할인율 업데이트 (REST) → ambassador_id=${ambassadorId}, discount=${discountRate}%`);
    return { discountId, discountRate };
  } catch (_) {
    // REST 실패 시 GraphQL로 시도 (새 방식으로 생성된 할인)
  }

  // GraphQL로 업데이트
  const mutation = `
    mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }
  `;

  const data = await shopifyGraphQL(mutation, {
    id: `gid://shopify/DiscountCodeNode/${discountId}`,
    basicCodeDiscount: {
      customerGets: {
        value: { percentage: discountRate / 100 },
        items: { all: true },
      },
    },
  });

  const result = data.discountCodeBasicUpdate;
  if (result.userErrors?.length > 0) {
    const err = new Error(`Shopify 할인율 업데이트 실패: ${JSON.stringify(result.userErrors)}`);
    err.detail = result.userErrors;
    throw err;
  }

  logger.info(`🏷️ [Shopify] 할인율 업데이트 (GraphQL) → ambassador_id=${ambassadorId}, discount=${discountRate}%`);
  return { discountId, discountRate };
};
