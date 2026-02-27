// services/shopifyWebhook.service.js
import * as ambassadorRepo from "../repositories/ambassador.repository.js";
import * as orderWebhookRepo from "../repositories/orderWebhook.repository.js";
import * as pointsService from "./points.service.js";
import logger from "../config/logger.js";

/**
 * 환불 payload에서 총 환불금액 합산
 * - transactions 배열에서 kind='refund'인 항목만 합산
 */
function extractRefundAmount(refund) {
  return (refund.transactions || [])
    .filter((t) => t.kind === "refund")
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

const n = (v) => (v === null || v === undefined ? null : Number(v));

/**
 * Shopify webhook payload가 실제 Order 객체인지 판별
 *
 * 목적:
 * - orders/create / orders/paid webhook에
 *   Checkout, Transaction, 기타 객체가 섞여 들어오는 경우 방어
 *
 * 반환:
 * - true  → 정상 Order payload
 * - false → 처리 대상 아님 (skip)
 */
function isOrderPayload(o) {
  const gid = o?.admin_graphql_api_id || "";
  if (gid.includes("/Order/")) return true;

  if (typeof o?.order_number === "number") return true;
  if (typeof o?.name === "string" && o.name.startsWith("#") && o?.currency) return true;

  return false;
}

/**
 * Order payload에서 discount code 추출
 *
 * 처리 우선순위:
 * 1) discount_codes 배열
 * 2) discount_applications(type=discount_code)
 *
 * 반환:
 * - string (discount code)
 * - null (없을 경우)
 */
function extractDiscountCode(order) {
  return (
    order?.discount_codes?.[0]?.code ||
    order?.discount_applications?.find((x) => x.type === "discount_code")?.code ||
    null
  );
}

/**
 * orders/create webhook 처리
 *
 * 역할:
 * - 주문 생성 시점의 정보 저장
 * - discount_code → ambassador 매핑 시도
 * - paid 여부는 false로 저장
 *
 * 주의:
 * - 금액은 확정값이 아닐 수 있음
 * - 포인트 적립은 하지 않음
 */
export const processOrderCreate = async (order) => {
  if (!isOrderPayload(order)) {
    logger.warn(`🟨 [Shopify] orders/create received but NOT an Order payload → skip (id=${order?.id})`);
    return;
  }

  const orderId = order.id;
  const discountCode = extractDiscountCode(order);

  let ambassador = null;
  if (discountCode) {
    ambassador = await ambassadorRepo.findByDiscountCode(discountCode);
  }

  await orderWebhookRepo.upsertOrder({
    orderId,
    discountCode,
    ambassadorId: ambassador?.id || null,
    paid: false,

    totalPrice: n(order.total_price) ?? null,
    currency: order.currency || null,
    originalPrice: n(order.total_line_items_price) ?? null,
    discountAmount: n(order.total_discounts) ?? null,
    subtotalPrice: n(order.subtotal_price) ?? null,
    taxAmount: n(order.total_tax) ?? null,
  });

  logger.info(`🟦 [Shopify] 주문 생성 처리 완료 → order_id=${orderId}`);
};

/**
 * orders/paid webhook 처리
 *
 * 역할:
 * - 결제 완료 시점의 확정 금액 저장
 * - discount_code → ambassador 재매핑 (선도착 대비)
 * - order_webhook을 paid=true로 확정 업데이트
 * - ambassador 존재 시 포인트 적립 시도
 *
 * 멱등 보장:
 * - 포인트 중복 적립 방지는 pointsService 내부에서
 *   order_id 기준으로 처리해야 함
 *
 * 선도착 대응:
 * - orders/paid가 orders/create보다 먼저 와도 upsert로 정상 처리됨
 *
 * 재전송 대응:
 * - 동일 order_id로 여러 번 호출돼도
 *   포인트는 한 번만 적립되도록 설계해야 함
 */
export const processOrderPaid = async (order) => {
  if (!isOrderPayload(order)) {
    logger.warn(`🟨 [Shopify] orders/paid received but NOT an Order payload → skip (id=${order?.id})`);
    return;
  }

  const orderId = order.id;

  // 결제 확정 금액 추출 (net 기준)
  const currency = order.currency || "USD";
  const totalPrice = n(order.total_price ?? order.current_total_price);
  const originalPrice = n(order.total_line_items_price);
  const discountAmount = n(order.total_discounts ?? order.current_total_discounts);
  const subtotalPrice = n(order.subtotal_price ?? order.current_subtotal_price);
  const taxAmount = n(order.total_tax ?? order.current_total_tax);

  // discount code 재추출 (paid에서도 수행)
  const discountCode = extractDiscountCode(order);

  let ambassador = null;
  if (discountCode) {
    ambassador = await ambassadorRepo.findByDiscountCode(discountCode);
  }

  // 주문 정보 확정 저장 (record 없으면 생성)
  const saved = await orderWebhookRepo.upsertOrder({
    orderId,
    discountCode,
    ambassadorId: ambassador?.id || null,
    paid: true,

    totalPrice,
    currency,
    originalPrice,
    discountAmount,
    subtotalPrice,
    taxAmount,
  });

  // ambassador 존재 시 포인트 적립 시도
  if (saved?.ambassador_id && totalPrice !== null) {
    const result = await pointsService.addPointsByShopifyOrderService({
      ambassador_id: saved.ambassador_id,
      order_id: orderId,
      amount: totalPrice,
      description: `Shopify 주문(${orderId}) 결제 적립`,
    });

    if (result?.skipped) {
      logger.info(`🟨 [Shopify] 포인트 적립 스킵(이미 처리됨) → order_id=${orderId}`);
    } else {
      logger.info(`🟩 [Shopify] 포인트 적립 완료 → order_id=${orderId}`);
    }
  }

  logger.info(`🟩 [Shopify] 결제 완료 처리 완료 → order_id=${orderId}`);
};

/**
 * refunds/create webhook 처리
 *
 * 역할:
 * - 환불 발생 시 해당 주문의 ambassador 포인트 차감
 *
 * 멱등 보장:
 * - refund_id 기준으로 중복 처리 방지 (pointsService 내부)
 *
 * 스킵 조건:
 * - order_webhook에 해당 order_id 없음
 * - ambassador_id 없음
 * - 환불 트랜잭션 금액이 0 이하
 */
export const processRefund = async (refund) => {
  const refundId = refund.id;
  const orderId = refund.order_id;

  if (!orderId) {
    logger.warn(`🟨 [Shopify] refunds/create: order_id 없음 → skip (refund_id=${refundId})`);
    return;
  }

  // 주문 정보 조회 → ambassador_id 확인
  const order = await orderWebhookRepo.findOrderById(orderId);
  if (!order || !order.ambassador_id) {
    logger.info(`🟨 [Shopify] refunds/create: ambassador 없음 → skip (order_id=${orderId})`);
    return;
  }

  // 환불 금액 계산
  const refundAmount = extractRefundAmount(refund);
  if (refundAmount <= 0) {
    logger.warn(`🟨 [Shopify] refunds/create: 환불금액 0 → skip (refund_id=${refundId})`);
    return;
  }

  const result = await pointsService.deductPointsByShopifyRefundService({
    ambassador_id: order.ambassador_id,
    refund_id: refundId,
    order_id: orderId,
    refund_amount: refundAmount,
    description: `Shopify 환불(주문 ${orderId}) 포인트 차감`,
  });

  if (result?.skipped) {
    logger.info(`🟨 [Shopify] 포인트 차감 스킵(이미 처리됨) → refund_id=${refundId}`);
  } else {
    logger.info(`🟥 [Shopify] 포인트 차감 완료 → refund_id=${refundId}, 차감=${result.points}`);
  }

  logger.info(`🟥 [Shopify] 환불 처리 완료 → order_id=${orderId}, refund_id=${refundId}`);
};
