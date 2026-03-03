import { processAirwallexWebhookService } from "../services/airwallexWebhook.service.js";

/**
 * Airwallex → 우리 서버로 오는 Webhook 수신 컨트롤러
 * - 가능한 빠르게 200 응답 (재전송 방지)
 */
export const handleAirwallexWebhook = async (req, res) => {
    // Airwallex는 200을 받지 못하면 재시도하므로 즉시 응답
    res.status(200).json({ ok: true });

    try {
        const signature = req.header("x-signature");
        const timestamp = req.header("x-timestamp");
        const rawBody   = req.body; // Buffer (express.raw 적용 필요)

        await processAirwallexWebhookService({ signature, timestamp, rawBody });
    } catch (err) {
        console.error("❌ Airwallex Webhook processing error:", err?.message || err);
    }
};
