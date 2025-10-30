// src/controllers/reward.controller.js
import { addRewardService, getRewardSummaryService } from "../services/reward.service.js";

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


export const getRewardSummary = async (req, res) => {
    try {
      const creatorId = req.params.creatorId || req.user?.id;
      const summary = await getRewardSummaryService(creatorId);
      res.status(200).json({ message: "요약 조회 성공", summary });
    } catch (err) {
      console.error("❌ getRewardSummary error:", err);
      res.status(500).json({ message: "요약 조회 실패" });
    }
};