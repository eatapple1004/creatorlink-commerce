import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { verifyToken } from "../../middlewares/verifyToken.js";
import { getMe, getOrders } from "./ambassadorDashboard.controller.js";

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viewsDir = path.join(__dirname, "views");
const publicDir = path.join(__dirname, "public");

// 정적 파일 (CSS, JS)
router.use("/ambassador-dashboard", express.static(publicDir));

// 대시보드 HTML 페이지
router.get("/dashboard", (req, res) => {
  res.sendFile(path.join(viewsDir, "dashboard.html"));
});

// 로그인한 앰버서더 데이터 API
router.get("/api/me", verifyToken, getMe);

// 앰버서더 구매 내역 API
router.get("/api/orders", verifyToken, getOrders);

export default router;
