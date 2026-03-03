import { getSettlementPageDataService } from "./pointsSettlement.service.js";

export async function getSettlementData(req, res) {
  try {
    const data = await getSettlementPageDataService(req.user.id);
    res.json(data);
  } catch (err) {
    if (err.message === "POINTS_RECORD_NOT_FOUND") {
      return res.status(404).json({ message: "포인트 정보를 찾을 수 없습니다." });
    }
    console.error("❌ getSettlementData error:", err.message);
    res.status(500).json({ message: "서버 오류" });
  }
}
