import pool from "../config/db.js";
import logger from "../config/logger.js";
import { getAllStores } from "../config/shopifyStores.js";
import * as storeDiscountRepo from "../repositories/ambassadorStoreDiscount.repository.js";

const API_VERSION = "2024-01";

// REST API 호출 (스토어별 도메인/토큰 사용)
async function shopifyAdmin(store, endpoint, method = "GET", body = null) {
  const url = `https://${store.domain}/admin/api/${API_VERSION}${endpoint}`;
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": store.adminToken,
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

// GraphQL API 호출 (스토어별 도메인/토큰 사용)
async function shopifyGraphQL(store, query, variables = {}) {
  const url = `https://${store.domain}/admin/api/${API_VERSION}/graphql.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": store.adminToken,
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
 * 단일 스토어에 할인 코드 생성 (GraphQL - 중복 할인 허용)
 * @returns {string} discountId (price_rule_id)
 */
async function createDiscountCodeForStore(store, { referralCode, discountRate }) {
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
      // 중첩 객체 구조 (top-level combinesWith* 필드는 DiscountCodeBasicInput 에 없음)
      combinesWith: {
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: false,
      },
      usageLimit: null,
    },
  };

  const data = await shopifyGraphQL(store, mutation, variables);
  const result = data.discountCodeBasicCreate;

  if (result.userErrors?.length > 0) {
    const err = new Error(`Shopify Discount 생성 실패: ${JSON.stringify(result.userErrors)}`);
    err.detail = result.userErrors;
    throw err;
  }

  // GraphQL ID에서 숫자 추출 (gid://shopify/DiscountCodeNode/123 → 123)
  const gid = result.codeDiscountNode.id;
  return gid.split("/").pop();
}

/**
 * 특정 스토어에서 코드 문자열로 기존 할인 노드 ID 조회
 * - 동기화 시 "이미 같은 코드가 존재"하는 경우(중복 생성 방지) 사용
 * @returns {string|null} price_rule_id (없으면 null)
 */
async function findDiscountIdByCode(store, code) {
  // 코드 문자열로 할인 노드를 찾는 전용 쿼리
  const query = `
    query($code: String!) {
      codeDiscountNodeByCode(code: $code) {
        id
      }
    }
  `;
  const data = await shopifyGraphQL(store, query, { code });
  const node = data?.codeDiscountNodeByCode;
  if (!node) return null;
  return node.id.split("/").pop();
}

/**
 * 엠버서더 회원가입 시 Shopify 할인 코드 생성
 *
 * 멀티 스토어:
 * - 활성화된 모든 스토어에 동일 referralCode 로 할인 코드를 생성한다.
 * - 각 스토어의 price_rule_id 는 ambassador_store_discount 에 저장.
 * - 레거시 스토어(GLOBAL)의 값은 하위호환을 위해
 *   ambassador_profile.shopify_price_rule_id 에도 계속 기록한다.
 * - 한 스토어가 실패해도 나머지 스토어는 계속 진행한다.
 */
export const createDiscountCode = async ({ ambassadorId, referralCode, discountRate }) => {
  const stores = getAllStores();
  const results = [];

  for (const store of stores) {
    try {
      const discountId = await createDiscountCodeForStore(store, { referralCode, discountRate });

      await storeDiscountRepo.upsertMapping({
        ambassadorId,
        shopDomain: store.domain,
        priceRuleId: discountId,
      });

      // 레거시 컬럼 하위호환 (GLOBAL 스토어 값 유지)
      if (store.isLegacy) {
        await pool.query(
          "UPDATE ambassador_profile SET shopify_price_rule_id = $1, updated_at = NOW() WHERE id = $2",
          [discountId, ambassadorId]
        );
      }

      logger.info(`🏷️ [Shopify:${store.key}] 할인 코드 생성 완료 → ambassador_id=${ambassadorId}, code=${referralCode}, discount=${discountRate}%, id=${discountId}`);
      results.push({ store: store.key, discountId, code: referralCode, discountRate });
    } catch (err) {
      logger.error(`🟥 [Shopify:${store.key}] 할인 코드 생성 실패 → ambassador_id=${ambassadorId}, code=${referralCode}`, err);
    }
  }

  return results;
};

/**
 * 단일 스토어의 할인율 업데이트 (REST 우선, 실패 시 GraphQL)
 */
async function updateDiscountRateForStore(store, { ambassadorId, discountId, discountRate }) {
  // 먼저 REST API로 시도 (기존 Price Rule 방식)
  try {
    await shopifyAdmin(store, `/price_rules/${discountId}.json`, "PUT", {
      price_rule: { id: Number(discountId), value: `-${discountRate}` },
    });
    logger.info(`🏷️ [Shopify:${store.key}] 할인율 업데이트 (REST) → ambassador_id=${ambassadorId}, discount=${discountRate}%`);
    return;
  } catch (_) {
    // REST 실패 시 GraphQL로 시도 (새 방식으로 생성된 할인)
  }

  const mutation = `
    mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }
  `;

  const data = await shopifyGraphQL(store, mutation, {
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

  logger.info(`🏷️ [Shopify:${store.key}] 할인율 업데이트 (GraphQL) → ambassador_id=${ambassadorId}, discount=${discountRate}%`);
}

/**
 * 엠버서더 등급 변경 시 Shopify 할인율 업데이트
 *
 * 멀티 스토어:
 * - ambassador_store_discount 에 저장된 모든 스토어의 price_rule_id 를 조회해
 *   각 스토어의 할인율을 모두 갱신한다 (포인트/등급 완전 공유와 일치).
 * - 한 스토어 실패가 다른 스토어를 막지 않는다.
 */
export const updateDiscountRate = async ({ ambassadorId, discountRate }) => {
  const mappings = await storeDiscountRepo.findByAmbassador(ambassadorId);

  if (!mappings.length) {
    logger.warn(`🟨 [Shopify] 할인 코드 매핑 없음 → ambassador_id=${ambassadorId}, 업데이트 스킵`);
    return null;
  }

  const stores = getAllStores();
  const updated = [];

  for (const { shop_domain, shopify_price_rule_id } of mappings) {
    const store = stores.find((s) => s.domain === shop_domain);
    if (!store) {
      logger.warn(`🟨 [Shopify] 비활성 스토어 매핑 스킵 → domain=${shop_domain}, ambassador_id=${ambassadorId}`);
      continue;
    }
    try {
      await updateDiscountRateForStore(store, {
        ambassadorId,
        discountId: shopify_price_rule_id,
        discountRate,
      });
      updated.push({ store: store.key, discountId: shopify_price_rule_id });
    } catch (err) {
      logger.error(`🟥 [Shopify:${store.key}] 할인율 업데이트 실패 → ambassador_id=${ambassadorId}`, err);
    }
  }

  return { ambassadorId, discountRate, updated };
};

/**
 * 엠버서더 1명의 할인 코드를 모든 활성 스토어에 동기화
 *
 * 보장:
 * - 모든 스토어에 동일한 referralCode 할인 코드가 존재
 * - 모든 스토어의 할인율이 discountRate 로 일치
 *
 * 멱등 처리(재실행 안전):
 * - DB 매핑 존재 → 할인율만 갱신
 * - 매핑 없지만 Shopify에 같은 코드 존재 → 그 ID 채택 후 갱신 (중복 생성 방지)
 * - 둘 다 없음 → 신규 생성
 * - 스토어 단위로 실패해도 다른 스토어는 계속 진행
 *
 * 용도:
 * - 기존 엠버서더(GLOBAL 추가 전 가입자)의 GLOBAL 코드 일괄 생성
 * - 양쪽 코드/할인율 강제 재동기화
 */
export const syncAmbassadorDiscount = async ({ ambassadorId, referralCode, discountRate }) => {
  const stores = getAllStores();
  const mappings = await storeDiscountRepo.findByAmbassador(ambassadorId);
  const mapByDomain = new Map(mappings.map((m) => [m.shop_domain, m.shopify_price_rule_id]));
  const results = [];

  for (const store of stores) {
    try {
      let discountId = mapByDomain.get(store.domain);
      let action;

      if (discountId) {
        // 이미 매핑 존재 → 할인율만 동기화
        await updateDiscountRateForStore(store, { ambassadorId, discountId, discountRate });
        action = "rate-synced";
      } else {
        // Shopify에 같은 코드가 이미 있는지 확인
        const existingId = await findDiscountIdByCode(store, referralCode);
        if (existingId) {
          discountId = existingId;
          await updateDiscountRateForStore(store, { ambassadorId, discountId, discountRate });
          action = "adopted";
        } else {
          discountId = await createDiscountCodeForStore(store, { referralCode, discountRate });
          action = "created";
        }
        await storeDiscountRepo.upsertMapping({
          ambassadorId,
          shopDomain: store.domain,
          priceRuleId: discountId,
        });
        if (store.isLegacy) {
          await pool.query(
            "UPDATE ambassador_profile SET shopify_price_rule_id = $1, updated_at = NOW() WHERE id = $2",
            [discountId, ambassadorId]
          );
        }
      }

      logger.info(`🔁 [Shopify:${store.key}] 할인 동기화(${action}) → ambassador_id=${ambassadorId}, code=${referralCode}, rate=${discountRate}%, id=${discountId}`);
      results.push({ store: store.key, action, discountId, synced: true });
    } catch (err) {
      logger.error(`🟥 [Shopify:${store.key}] 할인 동기화 실패 → ambassador_id=${ambassadorId}, code=${referralCode}: ${err.message}`);
      results.push({ store: store.key, synced: false, error: err.message });
    }
  }

  return results;
};
