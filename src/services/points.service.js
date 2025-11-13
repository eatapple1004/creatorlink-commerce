import {
    findPointsByAmbassador,
    savePoints,
    insertTransaction,
    findAmbassadorByReferralCode,
  } from "../repositories/points.repository.js";
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
            total_withdrawn: withdrawn + amt,
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
  