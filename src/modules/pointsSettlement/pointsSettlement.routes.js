import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { getSettlementData } from "./pointsSettlement.controller.js";

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

// 정산 데이터 API
router.get("/api/settlement", verifyToken, getSettlementData);

export default router;
