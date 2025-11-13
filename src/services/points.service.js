import {
    findPointsByAmbassador,
    savePoints,
    insertTransaction,
  } from "../repositories/points.repository.js";
  import { transaction } from "../config/dbClient.js";
  
/**
 * 포인트 적립 서비스
 */
export const addPointsService = async ({ ambassador_id, amount, description }) => {
    return transaction(async (client) => {
        // 1️⃣ 현재 포인트 정보 조회
        const record = await findPointsByAmbassador(ambassador_id);
        if (!record) throw new Error("POINTS_RECORD_NOT_FOUND");
    
        // 2️⃣ 비즈니스 로직: 적립 계산
        const updated = {
            current_points: record.current_points + amount,
            total_earned: record.total_earned + amount,
            total_withdrawn: record.total_withdrawn,
        };
    
        // 3️⃣ 저장
        const newRecord = await savePoints(ambassador_id, updated);
    
        // 4️⃣ 거래 로그 기록
        await insertTransaction({
            ambassador_id,
            type: "earn",
            amount,
            balance_after: newRecord.current_points,
            description,
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
    
        // 2️⃣ 비즈니스 로직: 차감 계산
        const updated = {
            current_points: record.current_points - amount,
            total_earned: record.total_earned,
            total_withdrawn: record.total_withdrawn + amount,
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
  