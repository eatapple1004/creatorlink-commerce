import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { verifyToken } from "../../middlewares/verifyToken.js";
import {
  getSettlementData,
  getBeneficiary,
  registerBeneficiary,
  submitWithdrawal,
  getTaxInfoHandler,
  registerTaxInfo,
} from "./pointsSettlement.controller.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsDir = path.join(__dirname, "views");
const publicDir = path.join(__dirname, "public");

// 정적 파일 (CSS, JS)
router.use("/points-settlement", express.static(publicDir));

// 정산 페이지 HTML
router.get("/settlement", (req, res) => {
  res.sendFile(path.join(viewsDir, "settlement.html"));
});

// ── API (모두 JWT 필요) ──────────────────────────────────────────
// 정산 요약 데이터
router.get("/api/settlement",              verifyToken, getSettlementData);
// 수취인 계좌 확인
router.get("/api/settlement/beneficiary",  verifyToken, getBeneficiary);
// 수취인 계좌 등록
router.post("/api/settlement/beneficiary", verifyToken, registerBeneficiary);
// 출금 요청
router.post("/api/settlement/withdraw",    verifyToken, submitWithdrawal);
// 세무정보 조회
router.get("/api/settlement/tax-info",     verifyToken, getTaxInfoHandler);
// 세무정보 등록
router.post("/api/settlement/tax-info",    verifyToken, registerTaxInfo);

export default router;
