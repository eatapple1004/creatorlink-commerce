// src/services/reward.service.js
import {
    findCreatorByReferralCode,
    insertRewardRecord,
    getTotalPointsByCreator,
  } from "../repositories/reward.repository.js";
  
  export const addRewardService = async (referralCode, amount) => {
    // 1️⃣ 추천 코드 유효성 검사
    const creator = await findCreatorByReferralCode(referralCode);
    if (!creator) throw new Error("INVALID_REFERRAL_CODE");
  
    // 2️⃣ 포인트 계산 (10%)
    const points = amount * 0.1;
  
    // 3️⃣ DB 저장
    await insertRewardRecord(creator.creator_id, referralCode, amount, points);
  
    // 4️⃣ 누적 포인트 합계 조회
    const totalPoints = await getTotalPointsByCreator(creator.creator_id);
  
    return {
      creatorId: creator.creator_id,
      earnedPoints: points,
      totalPoints,
    };
  };
  