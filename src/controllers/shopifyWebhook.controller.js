// controllers/shopifyWebhook.controller.js

import * as shopifyWebhookService from "../services/shopifyWebhook.service.js";
import { getStoreByDomain } from "../config/shopifyStores.js";
import crypto from "crypto";
import logger from "../config/logger.js";

/**
 * 웹훅 요청에서 스토어를 식별한다.
 * - Shopify는 모든 웹훅에 x-shopify-shop-domain 헤더를 실어 보낸다.
 * @returns {object|null} 등록된 스토어 또는 null
 */
const resolveStore = (req) => {
    const shopDomain = req.headers["x-shopify-shop-domain"];
    return getStoreByDomain(shopDomain);
};

/**
 * 🔐 Shopify HMAC Signature 검증 함수 (스토어별 시크릿 사용)
 */
export const verifyHmac = (req, store) => {
    const secret = store?.webhookSecret;
    if (!secret) return false;

    const hmacHeader = req.headers["x-shopify-hmac-sha256"];
    const body = req.body; // RAW BODY

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
        const store = resolveStore(req);
        if (!store) {
            logger.warn(`❌ [Shopify] 미등록 스토어 도메인 → ${req.headers["x-shopify-shop-domain"]}`);
            return res.status(401).send("unknown shop");
        }

        logger.info(`📥 [Shopify:${store.key}] orders/create webhook received.`);

        if (!verifyHmac(req, store)) {
            logger.warn(`❌ [Shopify:${store.key}] HMAC verification failed (orders/create)`);
            return res.status(401).send("invalid hmac");
        }

        const data = JSON.parse(req.body.toString());
        logger.info(`🟦 [${store.key}] OrderCreate → order_id=${data.id}`);

        await shopifyWebhookService.processOrderCreate(data, store);

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
        const store = resolveStore(req);
        if (!store) {
            logger.warn(`❌ [Shopify] 미등록 스토어 도메인 → ${req.headers["x-shopify-shop-domain"]}`);
            return res.status(401).send("unknown shop");
        }

        logger.info(`📥 [Shopify:${store.key}] refunds/create webhook received.`);

        if (!verifyHmac(req, store)) {
            logger.warn(`❌ [Shopify:${store.key}] HMAC verification failed (refunds/create)`);
            return res.status(401).send("invalid hmac");
        }

        const data = JSON.parse(req.body.toString());
        logger.info(`🟥 [${store.key}] Refund → refund_id=${data.id}, order_id=${data.order_id}`);

        await shopifyWebhookService.processRefund(data, store);

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
        const store = resolveStore(req);
        if (!store) {
            logger.warn(`❌ [Shopify] 미등록 스토어 도메인 → ${req.headers["x-shopify-shop-domain"]}`);
            return res.status(401).send("unknown shop");
        }

        logger.info(`📥 [Shopify:${store.key}] orders/paid webhook received.`);

        if (!verifyHmac(req, store)) {
            logger.warn(`❌ [Shopify:${store.key}] HMAC verification failed (orders/paid)`);
            return res.status(401).send("invalid hmac");
        }

        const data = JSON.parse(req.body.toString());
        logger.info(`🟩 [${store.key}] OrderPaid → order_id=${data.id}`);

        await shopifyWebhookService.processOrderPaid(data, store);

        res.status(200).send("ok");
    } catch (err) {
        logger.error("❌ [Shopify] orders/paid error: " + err.stack);
        res.status(500).send("server error");
    }
};
