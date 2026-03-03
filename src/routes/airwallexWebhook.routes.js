import { Router } from "express";
import { handleAirwallexWebhook } from "../controllers/airwallexWebhook.controller.js";

const router = Router();

// Airwallex → POST /api/airwallex/webhook
// express.raw()는 app.js에서 이 경로에 먼저 적용
router.post("/webhook", handleAirwallexWebhook);

export default router;
