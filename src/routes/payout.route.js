import express from "express";
import { payoutToAmbassador } from "../controllers/payout.controller.js";

const router = express.Router();
router.post("/payout", payoutToAmbassador);

export default router;
