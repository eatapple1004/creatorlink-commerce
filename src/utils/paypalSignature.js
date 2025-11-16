import paypal from "@paypal/payouts-sdk";
import { paypalClient } from "../config/paypalClient.js";

/**
 * PayPal Verify Webhook Signature API 호출
 * https://developer.paypal.com/docs/api-basics/notifications/webhooks/verify/
 */
export const verifyPaypalSignature = async (headers, body) => {
    try {
        const req = new paypal.core.PayPalHttpRequest("/v1/notifications/verify-webhook-signature", "POST");
        req.headers["Content-Type"] = "application/json";
        req.requestBody({
            auth_algo: headers.authAlgo,
            cert_url: headers.certUrl,
            transmission_id: headers.transmissionId,
            transmission_sig: headers.transmissionSig,
            transmission_time: headers.transmissionTime,
            webhook_id: headers.webhookId, // .env의 PAYPAL_WEBHOOK_ID
            webhook_event: body,
        });

        const resp = await paypalClient.execute(req);
        // resp.result.verification_status === 'SUCCESS' | 'FAILURE'
        return resp?.result?.verification_status === "SUCCESS";
    } catch (err) {
        console.error("❌ PayPal signature verify failed:", err?.message || err);
        return false;
    }
};
