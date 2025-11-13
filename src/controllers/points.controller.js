import {
    withdrawPointsService,
    addPointsByReferralCodeService,
} from "../services/points.service.js";
import { findPointsByAmbassador } from "../repositories/points.repository.js";
  
/**
 * 🎯 포인트 조회
 */
export const getPoints = async (req, res) => {
    const { ambassadorId } = req.params;
  
    try {
        const data = await findPointsByAmbassador(ambassadorId);
        if (!data) {
            return res.status(404).json({
            success: false,
            message: "해당 엠버서더의 포인트 정보를 찾을 수 없습니다.",
            });
        }
    
        res.status(200).json({
            success: true,
            message: "포인트 조회 성공",
            data,
        });
    } catch (err) {
        console.error("❌ [getPoints] error:", err);
        res.status(500).json({
            success: false,
            message: "서버 오류가 발생했습니다.",
        });
    }
};
  
/**
 * 추천코드 기반 포인트 적립
 */
 export const addPointsByReferral = async (req, res) => {
    try {
        const { referral_code, amount, description } = req.body;
    
        if (!referral_code || amount == null) {
            return res.status(400).json({
            success: false,
            message: "referral_code와 amount는 필수입니다.",
            });
        }
    
        const data = await addPointsByReferralCodeService({
            referral_code,
            amount: Number(amount),
            description,
        });
    
        res.status(200).json({
            success: true,
            message: `✅ 추천코드(${referral_code})로 포인트 적립 완료`,
            data,
        });
    } catch (err) {
        console.error("❌ [addPointsByReferral] error:", err.message);
    
        let msg = err.message;
        if (msg === "INVALID_REFERRAL_CODE") msg = "유효하지 않은 추천코드입니다.";
        if (msg === "POINTS_RECORD_NOT_FOUND") msg = "해당 앰버서더의 포인트 계좌가 없습니다.";
    
        res.status(400).json({
            success: false,
            message: msg,
        });
    }
};
  
/**
 * 💸 포인트 차감
 */
export const withdrawPoints = async (req, res) => {
    try {
        const { ambassador_id, amount, description } = req.body;
    
        if (!ambassador_id || amount == null) {
            return res.status(400).json({
            success: false,
            message: "ambassador_id와 amount는 필수입니다.",
            });
        }
    
        const data = await withdrawPointsService({
            ambassador_id,
            amount: Number(amount),
            description: description || "포인트 차감",
        });
    
        res.status(200).json({
            success: true,
            message: "✅ 포인트 차감 완료",
            data,
        });
    } catch (err) {
        console.error("❌ [withdrawPoints] error:", err.message);
    
        let msg = err.message;
        if (msg === "POINTS_RECORD_NOT_FOUND") msg = "포인트 계좌가 존재하지 않습니다.";
        if (msg === "INSUFFICIENT_BALANCE") msg = "잔액이 부족합니다.";
    
        res.status(400).json({
            success: false,
            message: msg,
        });
    }
};
  