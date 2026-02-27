// controllers/shopifyWebhook.controller.js

import * as shopifyWebhookService from "../services/shopifyWebhook.service.js";
import crypto from "crypto";
import logger from "../config/logger.js";

/**
 * 🔐 Shopify HMAC Signature 검증 함수
 */
export const verifyHmac = (req) => {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const body = req.body; // RAW BODY
    
    logger.info(body);

    const generated = crypto
        .createHmac("sha256", secret)
        .update(body)
        .digest("base64");

    return generated === hmacHeader;
};

/**
 * 🟦 주문 생성 Webhook (orders/create)
 */
export const handleOrderCreate = async (req, res) => {
    try {
        logger.info("📥 [Shopify] orders/create webhook received.");

        if (!verifyHmac(req)) {
            logger.warn("❌ [Shopify] HMAC verification failed (orders/create)");
            return res.status(401).send("invalid hmac");
        }

        const data = JSON.parse(req.body.toString());
        logger.info(data);
        logger.info(`🟦 OrderCreate → order_id=${data.id}`);

        await shopifyWebhookService.processOrderCreate(data);

        res.status(200).send("ok");
    } catch (err) {
        logger.error("❌ [Shopify] orders/create error: " + err.stack);
        res.status(500).send("server error");
    }
};

/**
 * 🟥 환불 Webhook (refunds/create)
 */
export const handleRefund = async (req, res) => {
    try {
        logger.info("📥 [Shopify] refunds/create webhook received.");

        if (!verifyHmac(req)) {
            logger.warn("❌ [Shopify] HMAC verification failed (refunds/create)");
            return res.status(401).send("invalid hmac");
        }

        const data = JSON.parse(req.body.toString());
        logger.info(`🟥 Refund → refund_id=${data.id}, order_id=${data.order_id}`);
        logger.info(data);

        await shopifyWebhookService.processRefund(data);

        res.status(200).send("ok");
    } catch (err) {
        logger.error("❌ [Shopify] refunds/create error: " + err.stack);
        res.status(500).send("server error");
    }
};

/**
 * 🟩 결제 완료 Webhook (orders/paid)
 */
export const handleOrderPaid = async (req, res) => {
    try {
        logger.info("📥 [Shopify] orders/paid webhook received.");

        if (!verifyHmac(req)) {
            logger.warn("❌ [Shopify] HMAC verification failed (orders/paid)");
            return res.status(401).send("invalid hmac");
        }

        const data = JSON.parse(req.body.toString());
        logger.info(`🟩 OrderPaid → order_id=${data.id}`);
        logger.info(data);
        await shopifyWebhookService.processOrderPaid(data);

        res.status(200).send("ok");
    } catch (err) {
        logger.error("❌ [Shopify] orders/paid error: " + err.stack);
        res.status(500).send("server error");
    }
};
