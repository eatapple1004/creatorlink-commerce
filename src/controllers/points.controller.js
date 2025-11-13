import {
    addPointsService,
    withdrawPointsService,
} from "../services/points.service.js";
import { getPointsByAmbassador } from "../repositories/points.repository.js";

// 포인트 조회
export const getPoints = async (req, res) => {
    const { ambassadorId } = req.params;
    try {
        const data = await getPointsByAmbassador(ambassadorId);
        if (!data) return res.status(404).json({ message: "Not found" });
        res.status(200).json(data);
    } catch (err) {
        console.error("❌ getPoints error:", err);
        res.status(500).json({ message: "서버 오류" });
    }
};

// 포인트 적립
export const addPoints = async (req, res) => {
    try {
        const { ambassador_id, amount, description } = req.body;
        const data = await addPointsService({ ambassador_id, amount, description });
        res.status(200).json({ message: "포인트 적립 완료", data });
    } catch (err) {
        console.error("❌ addPoints error:", err);
        res.status(400).json({ message: err.message });
    }
};
  
// 포인트 차감
export const withdrawPoints = async (req, res) => {
    try {
        const { ambassador_id, amount, description } = req.body;
        const data = await withdrawPointsService({ ambassador_id, amount, description });
        res.status(200).json({ message: "포인트 차감 완료", data });
    } catch (err) {
        console.error("❌ withdrawPoints error:", err);
        res.status(400).json({ message: err.message });
    }
};
  