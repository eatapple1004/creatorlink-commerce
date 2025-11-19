import { processPaypalWebhookService } from "../services/paypalWebhook.service.js";

/**
 * PayPal → 우리 서버로 오는 Webhook 수신 컨트롤러
 * - 가능한 빠르게 200 응답 (재전송 방지)
 * - 실제 처리 로직은 서비스로 위임
 */
export const handlePaypalWebhook = async (req, res) => {
    try {
        const headers = {
            transmissionId: req.header("paypal-transmission-id"),
            transmissionTime: req.header("paypal-transmission-time"),
            certUrl: req.header("paypal-cert-url"),
            authAlgo: req.header("paypal-auth-algo"),
            transmissionSig: req.header("paypal-transmission-sig"),
            webhookId: process.env.PAYPAL_WEBHOOK_ID,
        };

        const body = req.body;

        // 즉시 처리 (검증/업데이트 포함)
        await processPaypalWebhookService(headers, body);

        // PayPal에는 200을 반환해야 재시도(중복) 전송을 줄일 수 있음
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error("❌ PayPal Webhook error:", err?.message || err);
        // 검증 실패/비정상 데이터여도 PayPal에 200을 주는 편이 중복폭주를 막음
        res.status(200).json({ ok: true });
    }
};
