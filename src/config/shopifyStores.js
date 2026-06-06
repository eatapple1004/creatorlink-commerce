// src/config/shopifyStores.js
//
// 멀티 스토어 Shopify 레지스트리
// - 하나의 웹훅 엔드포인트로 여러 스토어를 처리하기 위해
//   x-shopify-shop-domain 헤더 → 스토어 설정을 매핑한다.
// - 각 스토어는 { key, domain, webhookSecret, adminToken } 을 가진다.
//
// 환경변수:
//   SHOPIFY_KOREA_STORE_DOMAIN  / SHOPIFY_KOREA_WEBHOOK_SECRET  / SHOPIFY_KOREA_ADMIN_ACCESS_TOKEN
//   SHOPIFY_GLOBAL_STORE_DOMAIN / SHOPIFY_GLOBAL_WEBHOOK_SECRET / SHOPIFY_GLOBAL_ADMIN_ACCESS_TOKEN
//
// 스토어 매핑 (확인됨):
//   - KOREA  = mmjnwe-fr.myshopify.com (kr.adamtfs.com, KRW) — 기존부터 운영 중인 스토어
//   - GLOBAL = ADAM GLOBAL 스토어 — 새로 추가
//
// 하위호환:
//   KOREA 변수가 비어 있으면 레거시 SHOPIFY_STORE_DOMAIN / SHOPIFY_WEBHOOK_SECRET /
//   SHOPIFY_ADMIN_ACCESS_TOKEN 로 폴백한다. (레거시 단일 설정 = KOREA 스토어)
//
// 주의:
//   domain 값은 Shopify가 웹훅에 실어 보내는 x-shopify-shop-domain 과 정확히
//   일치해야 한다 (항상 *.myshopify.com 형태).

import dotenv from "dotenv";
import logger from "./logger.js";

dotenv.config();

const env = process.env;

/**
 * 스토어 정의 목록
 * - key: 내부 식별자 (포인트 멱등 키 네임스페이스 등에 사용)
 * - isLegacy: true 인 스토어는 멱등 reference_id 를 prefix 없이 bare id 로 사용
 *             (기존 단일 스토어 적립 내역의 멱등성을 보존)
 */
const STORE_DEFINITIONS = [
  {
    // 기존 운영 스토어. 레거시 단일 설정(SHOPIFY_*)이 이 스토어를 가리킨다.
    // isLegacy → 기존 포인트 적립 내역(transaction_log)이 bare order_id 로 저장돼 있어
    //            멱등성 보존을 위해 prefix 없이 사용.
    key: "korea",
    isLegacy: true,
    domain: env.SHOPIFY_KOREA_STORE_DOMAIN || env.SHOPIFY_STORE_DOMAIN,
    webhookSecret: env.SHOPIFY_KOREA_WEBHOOK_SECRET || env.SHOPIFY_WEBHOOK_SECRET,
    adminToken: env.SHOPIFY_KOREA_ADMIN_ACCESS_TOKEN || env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    // OAuth 앱 자격증명 (Admin 토큰 재발급용)
    clientId: env.SHOPIFY_KOREA_CLIENT_ID || env.SHOPIFY_CLIENT_ID,
    clientSecret: env.SHOPIFY_KOREA_CLIENT_SECRET || env.SHOPIFY_CLIENT_SECRET,
  },
  {
    // 새로 추가하는 스토어. 멱등 reference_id 는 `global:<id>` 로 네임스페이스됨.
    key: "global",
    isLegacy: false,
    domain: env.SHOPIFY_GLOBAL_STORE_DOMAIN,
    webhookSecret: env.SHOPIFY_GLOBAL_WEBHOOK_SECRET,
    adminToken: env.SHOPIFY_GLOBAL_ADMIN_ACCESS_TOKEN,
    clientId: env.SHOPIFY_GLOBAL_CLIENT_ID,
    clientSecret: env.SHOPIFY_GLOBAL_CLIENT_SECRET,
  },
];

// OAuth 설치 시 요청할 Admin API 권한 (할인코드 자동 생성/수정 + 주문 조회)
export const OAUTH_SCOPES =
  "read_orders,read_discounts,write_discounts,read_price_rules,write_price_rules";

// OAuth 콜백 redirect_uri 의 베이스 URL (배포 서버)
export const OAUTH_REDIRECT_BASE =
  env.SHOPIFY_OAUTH_REDIRECT_BASE || "https://api.adamthefirstsin.com";

// 도메인이 설정된 스토어만 활성화
const STORES = STORE_DEFINITIONS.filter((s) => {
  if (!s.domain) {
    logger.warn(`🟨 [ShopifyStores] '${s.key}' 스토어 도메인 미설정 → 비활성`);
    return false;
  }
  if (!s.webhookSecret) {
    logger.warn(`🟨 [ShopifyStores] '${s.key}'(${s.domain}) 웹훅 시크릿 미설정`);
  }
  if (!s.adminToken) {
    logger.warn(`🟨 [ShopifyStores] '${s.key}'(${s.domain}) Admin 토큰 미설정`);
  }
  return true;
});

// 도메인(소문자) → 스토어 맵
const STORE_BY_DOMAIN = new Map(STORES.map((s) => [s.domain.toLowerCase(), s]));

logger.info(
  `🏬 [ShopifyStores] 활성 스토어: ${STORES.map((s) => `${s.key}(${s.domain})`).join(", ") || "없음"}`
);

/**
 * x-shopify-shop-domain 헤더 값으로 스토어 조회
 * @param {string} domain
 * @returns {object|null}
 */
export const getStoreByDomain = (domain) => {
  if (!domain) return null;
  return STORE_BY_DOMAIN.get(String(domain).toLowerCase()) || null;
};

/**
 * 키로 스토어 조회
 * @param {string} key
 * @returns {object|null}
 */
export const getStoreByKey = (key) => STORES.find((s) => s.key === key) || null;

/**
 * 활성화된 전체 스토어 목록 (할인코드 생성/업데이트 루프용)
 * @returns {object[]}
 */
export const getAllStores = () => [...STORES];
