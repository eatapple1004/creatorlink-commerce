import {
    findPointsByAmbassador,
    savePoints,
    insertTransaction,
    findAmbassadorByReferralCode,
    existsEarnByShopifyOrder,
    existsRefundByShopifyRefund,
    getCommissionRateByAmbassadorId,
    getAmbassadorGradeInfo,
    getItemCommissionByCode,
    getEarnedPointsByOrderId,
} from "../repositories/points.repository.js";

// 등급 코드 → item_commission 컬럼명 매핑
const GRADE_COMMISSION_COL = {
  BRONZE:   "bronze_commission",
  SILVER:   "silver_commission",
  GOLD:     "gold_commission",
  PLATINUM: "platinum_commission",
  DIAMOND:  "diamond_commission",
};
import { transaction } from "../config/dbClient.js";
  
 /**
 * 추천코드 기반 포인트 적립
 */
export const addPointsByReferralCodeService = async ({ referral_code, amount, description }) => {
    return transaction(async () => {
        // 1️⃣ 추천코드로 앰버서더 찾기
        const ambassador = await findAmbassadorByReferralCode(referral_code);
        if (!ambassador) throw new Error("INVALID_REFERRAL_CODE");
    
        const ambassador_id = ambassador.ambassador_id;
    
        // 2️⃣ 현재 포인트 정보 조회
        const record = await findPointsByAmbassador(ambassador_id);
        if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");
        
        // ✅ 문자열을 숫자로 변환
        const current = parseFloat(record.current_points);
        const earned = parseFloat(record.total_earned);
        const withdrawn = parseFloat(record.total_withdrawn);
        const amt = Number(amount);
        
        // 3️⃣ 비즈니스 로직
        const updated = {
            current_points: current + amt,
            total_earned: earned + amt,
            total_withdrawn: withdrawn,
        };
    
        // 4️⃣ 저장
        const newRecord = await savePoints(ambassador_id, updated);
    
        // 5️⃣ 거래 로그 기록
        await insertTransaction({
            ambassador_id,
            type: "earn",
            amount,
            balance_after: newRecord.current_points,
            description: description || `추천코드(${referral_code}) 적립`,
        });
    
        return newRecord;
    });
};
  
  
/**
 * 포인트 차감 서비스
 */
export const withdrawPointsService = async ({ ambassador_id, amount, description }) => {
    return transaction(async (client) => {
        // 1️⃣ 현재 포인트 정보 조회
        const record = await findPointsByAmbassador(ambassador_id);
        
        if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");
        if (record.current_points < amount) throw new Error("INSUFFICIENT_BALANCE");
            
        // ✅ 문자열을 숫자로 변환
        const current = parseFloat(record.current_points);
        const earned = parseFloat(record.total_earned);
        const withdrawn = parseFloat(record.total_withdrawn);
        const amt = Number(amount);

        // 2️⃣ 비즈니스 로직: 차감 계산
        const updated = {
            current_points: current - amt,
            total_earned: earned,
            total_withdrawn: withdrawn + amount,
        };
    
        // 3️⃣ 저장
        const newRecord = await savePoints(ambassador_id, updated);
    
        // 4️⃣ 거래 로그 기록
        await insertTransaction({
            ambassador_id,
            type: "withdraw",
            amount: -amount,
            balance_after: newRecord.current_points,
            description,
        });
    
        return newRecord;
    });
  };



export const addPointsByShopifyOrderService = async ({
    ambassador_id,
    order_id,
    lineItems = [],  // [{ sku, price, quantity }]
    amount,          // lineItems 없을 때 fallback용 총 결제금액
    description,
}) => {
    return transaction(async (client) => {
        // 0) 멱등 체크
        const already = await existsEarnByShopifyOrder(order_id, client);
        if (already) {
            const record = await findPointsByAmbassador(ambassador_id, client);
            return { skipped: true, record };
        }

        // 1) 앰버서더 등급 정보 조회 (grade_code + 기본 commission_rate)
        const gradeInfo = await getAmbassadorGradeInfo(ambassador_id, client);
        const gradeCode = String(gradeInfo?.grade_code ?? "BRONZE").toUpperCase();
        const fallbackRate = Number(gradeInfo?.commission_rate ?? 0);
        const gradeCol = GRADE_COMMISSION_COL[gradeCode];

        // 2) 아이템별 포인트 계산
        let points = 0;

        if (lineItems.length > 0) {
            for (const item of lineItems) {
                const sku        = item.sku;
                const paidAmount = Number(item.paidAmount); // 실결제금액 (할인 적용 후)

                if (!sku || !Number.isFinite(paidAmount) || paidAmount <= 0) continue;

                // item_commission 테이블에서 아이템별 등급 커미션 조회
                const itemCommission = await getItemCommissionByCode(sku, client);

                // 아이템 테이블에 등급별 rate만 사용 (없으면 0 = 적립 없음)
                const rate = (itemCommission && gradeCol)
                    ? Number(itemCommission[gradeCol])
                    : 0;

                points += Math.round(paidAmount * (rate / 100) * 100) / 100;
            }
        } else {
            // lineItems 없을 때 기존 방식 (총 결제금액 × 기본 rate)
            const paid = Number(amount);
            if (!Number.isFinite(paid) || paid <= 0) throw new Error("INVALID_AMOUNT");
            points = Math.round(paid * (fallbackRate / 100) * 100) / 100;
        }

        if (points <= 0) throw new Error("INVALID_AMOUNT");

        // 3) 현재 포인트 조회
        const record = await findPointsByAmbassador(ambassador_id, client);
        if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");

        const current   = parseFloat(record.current_points);
        const earned    = parseFloat(record.total_earned);
        const withdrawn = parseFloat(record.total_withdrawn);

        // 4) 업데이트
        const updated = {
            current_points:  current + points,
            total_earned:    earned + points,
            total_withdrawn: withdrawn,
        };

        // 5) 저장
        const newRecord = await savePoints(ambassador_id, updated, client);

        // 6) 거래 로그
        await insertTransaction({
            ambassador_id,
            type: "earn",
            amount: points,
            balance_after: newRecord.current_points,
            reference_type: "SHOPIFY_ORDER",
            reference_id: order_id,
            description: description || `Shopify 주문(${order_id}) 적립 [${gradeCode}]`,
        }, client);

        return {
            skipped: false,
            record: newRecord,
            grade_code: gradeCode,
            points,
        };
    });
};


/**
 * Shopify 환불 시 포인트 차감 서비스
 *
 * - refund_id 기준 멱등 보장
 * - 원래 주문에서 적립된 포인트를 transaction_log에서 조회
 * - 전체 환불 → 적립 포인트 전액 차감
 * - 부분 환불 → 적립 포인트 × (환불금액 / 원래주문금액) 비례 차감
 */
export const deductPointsByShopifyRefundService = async ({
    ambassador_id,
    refund_id,
    order_id,
    refund_amount,
    original_total, // 원래 주문 금액 (비례 계산용)
    description,
}) => {
    return transaction(async (client) => {
        // 0) 멱등 체크
        const already = await existsRefundByShopifyRefund(refund_id, client);
        if (already) {
            const record = await findPointsByAmbassador(ambassador_id, client);
            return { skipped: true, record };
        }

        // 1) 원래 주문에서 적립된 포인트 조회
        const earnedPoints = await getEarnedPointsByOrderId(order_id, client);
        if (earnedPoints <= 0) {
            // 이 주문에 포인트 적립 이력 없음 → 차감 없음
            return { skipped: true, reason: "NO_EARN_FOUND" };
        }

        // 2) 차감 포인트 계산
        const refunded  = Number(refund_amount);
        const origTotal = Number(original_total ?? 0);

        let pointsToDeduct;
        if (origTotal <= 0 || refunded >= origTotal) {
            // 전체 환불 → 적립 포인트 전액 차감
            pointsToDeduct = earnedPoints;
        } else {
            // 부분 환불 → 비례 차감
            const ratio = refunded / origTotal;
            pointsToDeduct = Math.round(earnedPoints * ratio * 100) / 100;
        }

        // 3) 현재 포인트 조회
        const record = await findPointsByAmbassador(ambassador_id, client);
        if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");

        const current   = parseFloat(record.current_points);
        const earned    = parseFloat(record.total_earned);
        const withdrawn = parseFloat(record.total_withdrawn);

        // 4) 차감
        const updated = {
            current_points:  current - pointsToDeduct,
            total_earned:    earned  - pointsToDeduct,
            total_withdrawn: withdrawn,
        };

        // 5) 저장
        const newRecord = await savePoints(ambassador_id, updated, client);

        // 6) 거래 로그
        await insertTransaction({
            ambassador_id,
            type: "refund",
            amount: -pointsToDeduct,
            balance_after: newRecord.current_points,
            reference_type: "SHOPIFY_REFUND",
            reference_id: refund_id,
            description: description || `Shopify 환불(주문 ${order_id}) 포인트 차감`,
        }, client);

        return {
            skipped: false,
            record: newRecord,
            earned_points:   earnedPoints,
            points_deducted: pointsToDeduct,
        };
    });
};