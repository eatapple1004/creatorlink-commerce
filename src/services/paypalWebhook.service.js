import { verifyPaypalSignature } from "../utils/paypalSignature.js";
import { transaction } from "../config/dbClient.js";
import {
    logWebhookEvent,
    findWithdrawByBatchOrItem,
    markWithdrawPaid,
    markWithdrawFailed,
} from "../repositories/paypalWebhook.repository.js";

import {
    findPointsByAmbassador,
    savePoints,
    insertTransaction,
} from "../repositories/points.repository.js";

/**
 * PayPal Webhook 처리 서비스
 * 1) 서명 검증
 * 2) 이벤트 타입 분기
 * 3) withdraw_request 상태 갱신
 * 4) 포인트 회계 반영(실패시 환원), 웹훅 로그 저장
 */
export const processPaypalWebhookService = async (headers, body) => {
    // 1) 서명 검증 (불통과 시 즉시 중단)
    const isValid = await verifyPaypalSignature(headers, body);
    if (!isValid) throw new Error("INVALID_WEBHOOK_SIGNATURE");

    const eventType = body?.event_type;
    const res = body?.resource || {};
    const payoutBatchId = res?.payout_batch_id || res?.batch_header?.payout_batch_id;
    const payoutItemId  = res?.payout_item_id || res?.item_id;
    const receiver      = res?.receiver;
    const amountVal     = parseFloat(res?.amount?.value || "0");
    const failureReason = res?.errors?.name || res?.errors?.message || res?.transaction_status || null;

    // 2) 트랜잭션으로 원자 처리
    await transaction(async (client) => {
        // 2-1) 우선 웹훅 payload 로깅
        await logWebhookEvent(client, {
        event_type: eventType,
        payload: body,
        // 아래는 후속 처리 후 업데이트 가능 (우선 null)
        linked_request_id: null,
        });

        // 2-2) 관련 withdraw_request 찾기 (batch or item 기준)
        const withdraw = await findWithdrawByBatchOrItem(client, { payoutBatchId, payoutItemId });
        if (!withdraw) {
        // 관련 항목이 없더라도 로그만 남기고 종료
        return;
        }

        // 2-3) 이벤트 분기
        if (eventType === "PAYOUTS-ITEM-SUCCEEDED") {
            // 이미 차감된 포인트는 유지, 상태만 확정
            await markWithdrawPaid(client, {
                id: withdraw.id,
                payout_item_id: payoutItemId,
            });
            // 추가 회계 조정 없음 (요청 시점에 차감 완료했기 때문)

        } 
        else if (eventType === "PAYOUTS-ITEM-FAILED") {
            // 실패 처리: 상태 failed + 실패사유 기록
            await markWithdrawFailed(client, {
                id: withdraw.id,
                payout_item_id: payoutItemId,
                failure_reason: failureReason || "PAYOUT_FAILED",
            });

            // 환불 회계 처리: 포인트 복구 + 거래로그(refund)
            const points = await findPointsByAmbassador(withdraw.ambassador_id);
            const cur = parseFloat(points.current_points);
            const totEarn = parseFloat(points.total_earned);
            const totWith = parseFloat(points.total_withdrawn);

            const refundAmt = parseFloat(withdraw.amount); // 원 요청 금액

            await savePoints(withdraw.ambassador_id, {
                current_points: cur + refundAmt,
                total_earned: totEarn,
                total_withdrawn: totWith - refundAmt < 0 ? 0 : totWith - refundAmt,
            });

            await insertTransaction({
                ambassador_id: withdraw.ambassador_id,
                type: "refund",
                amount: refundAmt,
                balance_after: cur + refundAmt,
                description: `PayPal payout failed: refund points (${withdraw.id})`,
            });
        }

        // 2-4) 웹훅 로그에 linked_request_id 업데이트 (선택)
        //  → 간단 구현을 원하시면 repository에 updateLogWithLinkedId 함수를 추가해 여기서 호출
    });
};