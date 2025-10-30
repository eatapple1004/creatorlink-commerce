// src/routes/reward.route.js
import express from "express";
import { addReward, getRewardSummary } from "../controllers/reward.controller.js";

const router = express.Router();

// ❌ verifyToken 제거
router.post("/add", addReward);

router.get("/summary/:creatorId", getRewardSummary);


export default router;
