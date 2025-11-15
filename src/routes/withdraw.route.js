import express from "express";
import { requestWithdraw } from "../controllers/withdraw.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

// 출금 요청 (JWT 인증 필요)
router.post("/request", verifyToken, requestWithdraw);

export default router;
