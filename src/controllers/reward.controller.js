// src/controllers/reward.controller.js
import { addRewardService } from "../services/reward.service.js";

export const addReward = async (req, res) => {
  try {
    const { referral_code, amount } = req.body;

    if (!referral_code || !amount)
      return res.status(400).json({ message: "추천 코드와 금액을 모두 입력해야 합니다." });

    const result = await addRewardService(referral_code, amount);

    res.status(201).json({
      message: "포인트 적립 완료",
      referral_code,
      creator_id: result.creatorId,
      earned_points: result.earnedPoints,
      total_points: result.totalPoints,
      is_guest: !req.user, // 로그인 안 한 경우 true
    });
  } catch (err) {
    console.error("❌ addReward error:", err);

    if (err.message === "INVALID_REFERRAL_CODE") {
      return res.status(404).json({ message: "유효하지 않은 추천 코드입니다." });
    }

    res.status(500).json({ message: "서버 오류" });
  }
};
