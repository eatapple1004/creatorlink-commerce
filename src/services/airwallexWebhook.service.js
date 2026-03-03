import crypto from "crypto";
import { transaction } from "../config/dbClient.js";
import {
    findByAirwallexTransferId,
    updateTransferStatus,
} from "../repositories/airwallexTransfer.repo.js";
import {
    findPointsByAmbassador,
    savePoints,
    insertTransaction,
} from "../repositories/points.repository.js";

/**
 * Airwallex Webhook 서명 검증
 * - HMAC-SHA256(secret, timestamp + "." + rawBody)
 * - x-signature 헤더와 비교
 */
function verifyAirwallexSignature(signature, timestamp, rawBody) {
    const secret = process.env.AIRWALLEX_WEBHOOK_SECRET;
    if (!secret) {
        console.warn("[Airwallex Webhook] AIRWALLEX_WEBHOOK_SECRET not set — skipping signature verification");
        return true;
    }
    if (!signature || !timestamp) {
        console.warn("[Airwallex Webhook] Missing signature or timestamp header");
        return false;
    }

    const bodyStr = rawBody.toString("utf8");

    // Airwallex 서명 방식 1: timestamp + rawBody (구분자 없음)
    const expected1 = crypto.createHmac("sha256", secret).update(`${timestamp}${bodyStr}`).digest("hex");
    // Airwallex 서명 방식 2: timestamp + "." + rawBody
    const expected2 = crypto.createHmac("sha256", secret).update(`${timestamp}.${bodyStr}`).digest("hex");

    console.log("[Airwallex Webhook] received signature :", signature);
    console.log("[Airwallex Webhook] expected (no dot)  :", expected1);
    console.log("[Airwallex Webhook] expected (with dot):", expected2);

    if (signature === expected1 || signature === expected2) return true;

    // base64 인코딩으로도 시도
    const expected1b64 = crypto.createHmac("sha256", secret).update(`${timestamp}${bodyStr}`).digest("base64");
    const expected2b64 = crypto.createHmac("sha256", secret).update(`${timestamp}.${bodyStr}`).digest("base64");
    if (signature === expected1b64 || signature === expected2b64) return true;

    return false;
}

/**
 * Airwallex Webhook 처리 서비스
 * 지원 이벤트:
 *   - payout.transfer.paid       → COMPLETED (상태 확정)
 *   - payout.transfer.failed     → FAILED    (상태 갱신 + 포인트 복원)
 *   - payout.transfer.cancelled  → CANCELLED (상태 갱신 + 포인트 복원)
 *   - payout.transfer.scheduled  → SCHEDULED (상태 업데이트)
 *   - payout.transfer.processing → PROCESSING (상태 업데이트)
 *   - payout.transfer.sent       → SENT (상태 업데이트)
 */
export const processAirwallexWebhookService = async ({ signature, timestamp, rawBody }) => {
    // 1) 서명 검증
    const isValid = verifyAirwallexSignature(signature, timestamp, rawBody);
    if (!isValid) {
        console.warn("[Airwallex Webhook] Invalid signature — rejected");
        return;
    }

    // 2) payload 파싱
    let body;
    try {
        body = JSON.parse(rawBody.toString("utf8"));
    } catch {
        console.error("[Airwallex Webhook] Failed to parse JSON body");
        return;
    }

    const eventName = body?.name;
    const obj       = body?.data?.object ?? {};

    console.log(`[Airwallex Webhook] event: ${eventName}, transfer_id: ${obj.id}`);

    // 이벤트 → 처리할 status 매핑
    const EVENT_STATUS_MAP = {
        "payout.transfer.paid":       "COMPLETED",
        "payout.transfer.failed":     "FAILED",
        "payout.transfer.cancelled":  "CANCELLED",
        "payout.transfer.scheduled":  "SCHEDULED",
        "payout.transfer.processing": "PROCESSING",
        "payout.transfer.sent":       "SENT",
    };

    const newStatus = EVENT_STATUS_MAP[eventName];
    if (!newStatus) {
        // 처리 대상 외 이벤트는 무시
        return;
    }

    const airwallexTransferId = obj.id;

    if (!airwallexTransferId || !newStatus) return;

    await transaction(async (client) => {
        // 3) 우리 DB에서 해당 transfer 찾기
        const transfer = await findByAirwallexTransferId(client, airwallexTransferId);
        if (!transfer) {
            console.warn(`[Airwallex Webhook] transfer not found: ${airwallexTransferId}`);
            return;
        }

        // 이미 COMPLETED / FAILED 등 최종 상태면 중복 처리 방지
        const finalStatuses = new Set(["COMPLETED", "FAILED", "CANCELLED"]);
        if (finalStatuses.has((transfer.status ?? "").toUpperCase())) {
            console.log(`[Airwallex Webhook] Already final status(${transfer.status}), skip`);
            return;
        }

        // 4) 상태 업데이트
        await updateTransferStatus(client, airwallexTransferId, newStatus, obj);

        // 5) FAILED / CANCELLED → 포인트 복원
        if (newStatus === "FAILED" || newStatus === "CANCELLED") {
            const ambassadorId = transfer.ambassador_idx;
            const refundAmt    = parseFloat(transfer.transfer_amount);

            const points = await findPointsByAmbassador(ambassadorId, client);
            if (!points) {
                console.error(`[Airwallex Webhook] ambassador_points not found for: ${ambassadorId}`);
                return;
            }

            const cur      = parseFloat(points.current_points);
            const totEarn  = parseFloat(points.total_earned);
            const totWith  = parseFloat(points.total_withdrawn);

            await savePoints(ambassadorId, {
                current_points:  cur + refundAmt,
                total_earned:    totEarn,
                total_withdrawn: Math.max(0, totWith - refundAmt),
            }, client);

            await insertTransaction({
                ambassador_id:  ambassadorId,
                type:           "earn",
                amount:         refundAmt,
                balance_after:  cur + refundAmt,
                reference_type: "AIRWALLEX_REVERSAL",
                reference_id:   transfer.request_id,
                description:    `Airwallex 정산 ${newStatus} - 포인트 복원`,
            }, client);

            console.log(`[Airwallex Webhook] Points restored: ${refundAmt} for ambassador ${ambassadorId}`);
        }

        if (newStatus === "COMPLETED") {
            console.log(`[Airwallex Webhook] Transfer COMPLETED: ${airwallexTransferId}`);
        }
    });
};
