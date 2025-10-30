// src/routes/reward.route.js
import express from "express";
import { addReward } from "../controllers/reward.controller.js";

const router = express.Router();

// ❌ verifyToken 제거
router.post("/add", addReward);

export default router;
