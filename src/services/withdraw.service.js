// src/services/withdraw.service.js
import { paypalClient } from "../config/paypalClient.js";
import { transaction } from "../config/dbClient.js";
import { v4 as uuidv4 } from "uuid";

import {
    getPaypalEmailByAmbassadorId,
    createWithdrawRequest,
} from "../repositories/withdraw.repository.js";

import {
    findPointsByAmbassador,
    savePoints,
    insertTransaction,
} from "../repositories/points.repository.js";

import paypal from "@paypal/payouts-sdk";

/**
 * ✅ 출금 요청 서비스 (PayPal Payout API 연동)
 */
export const requestWithdrawService = async ({ ambassador_id, amount }) => {
    return transaction(async (client) => {
        // 1️⃣ 포인트 확인
        const record = await findPointsByAmbassador(ambassador_id);
        if (!record) throw new Error("포인트 계좌를 찾을 수 없습니다.");
        if (record.current_points < amount) throw new Error("잔액이 부족합니다.");

        // 2️⃣ PayPal 이메일 조회 (쿼리는 Repository에서 처리)
        const ambassador = await getPaypalEmailByAmbassadorId(client, ambassador_id);
        if (!ambassador?.paypal_email) throw new Error("PayPal 계좌 정보가 없습니다.");

        const paypal_email = ambassador.paypal_email;

        // 3️⃣ PayPal 송금 요청 데이터 구성
        const idempotencyKey = uuidv4();
        const payoutRequest = {
        sender_batch_header: {
            sender_batch_id: `batch-${Date.now()}`,
            email_subject: "CreatorLink Ambassador Payout",
        },
        items: [
            {
            recipient_type: "EMAIL",
            amount: { value: amount.toFixed(2), currency: "USD" },
            receiver: paypal_email,
            note: "Ambassador withdrawal",
            },
        ],
        };

        // 4️⃣ PayPal API 호출
        const request = new paypal.payouts.PayoutsPostRequest();
        request.requestBody(payoutRequest);

        const response = await paypalClient.execute(request);
        const batchId = response.result.batch_header.payout_batch_id;

        // 5️⃣ DB에 출금 요청 기록 (Repository)
        const withdraw = await createWithdrawRequest(client, {
        ambassador_id,
        amount,
        paypal_email,
        status: "processing",
        payout_batch_id: batchId,
        idempotency_key: idempotencyKey,
        });

        // 6️⃣ 포인트 차감
        const current = parseFloat(record.current_points);
        const earned = parseFloat(record.total_earned);
        const withdrawn = parseFloat(record.total_withdrawn);
        const amt = Number(amount);

        const newBalance = current - amt;
        await savePoints(ambassador_id, {
        current_points: newBalance,
        total_earned: earned,
        total_withdrawn: withdrawn + amt,
        });

        // 7️⃣ 거래 로그 추가
        await insertTransaction({
        ambassador_id,
        type: "withdraw",
        amount: -amt,
        balance_after: newBalance,
        description: "PayPal 출금 요청",
        });

        return {
        payout_batch_id: batchId,
        amount,
        paypal_email,
        status: withdraw.status,
        };
    });
};
