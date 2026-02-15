// services/shopifyWebhook.service.js
import * as ambassadorRepo from "../repositories/ambassador.repository.js";
import * as orderWebhookRepo from "../repositories/orderWebhook.repository.js";
import * as pointsService from "./points.service.js";
import logger from "../config/logger.js";

const n = (v) => (v === null || v === undefined ? null : Number(v));

export const processOrderCreate = async (order) => {
  const orderId = order.id;
  const discountCode = order.discount_codes?.[0]?.code || null;

  let ambassador = null;
  if (discountCode) {
    ambassador = await ambassadorRepo.findByDiscountCode(discountCode);
  }

  await orderWebhookRepo.upsertOrder({
    orderId,
    discountCode,
    ambassadorId: ambassador?.id || null,
    paid: false,
    // create에서는 금액이 안정적이지 않을 수 있어도 들어오면 저장 가능
    totalPrice: n(order.total_price) ?? null,
    currency: order.currency || null,
    originalPrice: n(order.total_line_items_price) ?? null,
    discountAmount: n(order.total_discounts) ?? null,
    subtotalPrice: n(order.subtotal_price) ?? null,
    taxAmount: n(order.total_tax) ?? null,
  });

  logger.info(`🟦 [Shopify] 주문 생성 처리 완료 → order_id=${orderId}`);
};

export const processOrderPaid = async (order) => {
  const orderId = order.id;

  // ✅ paid payload에서 확정값 추출
  const currency = order.currency || "USD";
  const totalPrice = n(order.total_price ?? order.current_total_price);               // net
  const originalPrice = n(order.total_line_items_price);                              // gross
  const discountAmount = n(order.total_discounts ?? order.current_total_discounts);   // discount
  const subtotalPrice = n(order.subtotal_price ?? order.current_subtotal_price);
  const taxAmount = n(order.total_tax ?? order.current_total_tax);

  const discountCode =
    order.discount_codes?.[0]?.code ||
    order.discount_applications?.find(x => x.type === "discount_code")?.code ||
    null;

  // ✅ ambassador 매핑은 paid에서도 수행 (선도착 대비)
  let ambassador = null;
  if (discountCode) {
    ambassador = await ambassadorRepo.findByDiscountCode(discountCode);
  }

  // ✅ record 유무 상관없이 upsert로 확정 저장
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

  // ✅ 포인트 적립: ambassador가 있으면 즉시 시도
  // (중복 방지는 pointsService.addPoints 내부에서 orderId 기준으로 멱등 처리하는 게 안전)
  if (saved.ambassador_id) {
    await pointsService.addPoints({
      ambassadorId: saved.ambassador_id,
      orderId,
      amount: totalPrice,          // 정책상 net 기준
      originalPrice,
      discountAmount,
      currency,
    });
  }

  logger.info(`🟩 [Shopify] 결제 완료 처리 완료 → order_id=${orderId}`);
};
