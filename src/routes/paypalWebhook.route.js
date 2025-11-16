import express from "express";
import { handlePaypalWebhook } from "../controllers/paypalWebhook.controller.js";

const router = express.Router();

// PayPal이 POST로 호출하는 엔드포인트
router.post("/webhook", express.json({ type: "*/*" }), handlePaypalWebhook);

export default router;
