import { Router } from "express";
import { renderDashboard } from "./ambassadorDashboard.controller.js";

const router = Router();

// ✅ 최종 URL: /iframe/ambassador/dashboard
router.get("/dashboard", renderDashboard);

export default router;