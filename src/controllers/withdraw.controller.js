import { requestWithdrawService } from "../services/withdraw.service.js";

export const requestWithdraw = async (req, res) => {
    try {
        const { ambassador_id, amount } = req.body;
        if (!ambassador_id || !amount) {
        return res.status(400).json({ message: "필수 값이 누락되었습니다." });
        }

        const result = await requestWithdrawService({ ambassador_id, amount });
        res.status(200).json({
        message: "✅ 출금 요청 완료",
        result,
        });
    } catch (err) {
        console.error("❌ requestWithdraw error:", err);
        res.status(500).json({ message: err.message || "출금 요청 실패" });
    }
};
