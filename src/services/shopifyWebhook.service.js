import * as ambassadorRepo from "../repositories/ambassador.repository.js";
import * as orderWebhookRepo from "../repositories/orderWebhook.repository.js";
import * as pointsService from "./points.service.js";


export default {
    processOrderCreate: async (order) => {
        const orderId = order.id;
        const discountCode = order.discount_codes?.[0]?.code || null;

        let ambassador = null;
        if (discountCode) {
            ambassador = await ambassadorRepo.findByDiscountCode(discountCode);
        }

        await orderWebhookRepo.upsert({
            orderId,
            discountCode,
            ambassadorId: ambassador?.id || null,
            paid: false
        });

        console.log(`🟦 Shopify orders/create 완료: order_id=${orderId}`);
    },

    processOrderPaid: async (order) => {
        const orderId = order.id;
        const amount = order.total_price;
        const currency = order.currency || "USD";

        const record = await orderWebhookRepo.findByOrderId(orderId);

        if (!record) {
            await orderWebhookRepo.upsert({
                orderId,
                discountCode: null,
                ambassadorId: null,
                paid: true,
                total_price: amount,
                currency
            });
            console.log(`🟩 Shopify orders/paid 선도착 처리 완료: order_id=${orderId}`);
            return;
        }

        await orderWebhookRepo.markPaid(orderId, amount, currency);

        if (record.ambassador_id) {
            await pointsService.addPoints({
                ambassadorId: record.ambassador_id,
                orderId,
                amount
            });
        }

        console.log(`🟩 Shopify 결제완료 처리 완료: order_id=${orderId}`);
    }
};
