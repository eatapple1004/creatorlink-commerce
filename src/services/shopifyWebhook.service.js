// services/shopifyWebhook.service.js

import * as ambassadorRepo from "../repositories/ambassador.repository.js";
import * as orderWebhookRepo from "../repositories/orderWebhook.repository.js";
import * as pointsService from "./points.service.js";
import logger from "../config/logger.js";

/**
 * 🟦 주문 생성 처리 (orders/create)
 */
export const processOrderCreate = async (order) => {
    const orderId = order.id;
    const discountCode = order.discount_codes?.[0]?.code || null;

    let ambassador = null;

    if (discountCode) {
        ambassador = await ambassadorRepo.findByDiscountCode(discountCode);
    }

    // webhook 저장/upsert
    await orderWebhookRepo.upsertOrder({
        orderId,
        discountCode,
        ambassadorId: ambassador?.id || null,
        paid: false
    });

    logger.info(`🟦 [Shopify] 주문 생성 처리 완료 → order_id=${orderId}`);
};


/**
 * 🟩 결제 완료 처리 (orders/paid)
 */
export const processOrderPaid = async (order) => {
    const orderId = order.id;
    const amount = order.total_price;
    const currency = order.currency || "USD";

    const record = await orderWebhookRepo.findOrderById(orderId);

    // orders/paid 가 먼저 도착한 경우
    if (!record) {
        await orderWebhookRepo.upsertOrder({
        orderId,
        discountCode: null,
        ambassadorId: null,
        paid: true,
        totalPrice: amount,
        currency
        });

        logger.info(`🟩 [Shopify] orders/paid 선도착 처리 완료 → order_id=${orderId}`);
        return;
    }

    // 결제 완료 업데이트
    await orderWebhookRepo.markPaid(orderId, amount, currency);

    // 앰버서더가 있을 경우 포인트 지급
    if (record.ambassador_id) {
        await pointsService.addPoints({
        ambassadorId: record.ambassador_id,
        orderId,
        amount
        });
    }

    logger.info(`🟩 [Shopify] 결제 완료 처리 완료 → order_id=${orderId}`);
};
