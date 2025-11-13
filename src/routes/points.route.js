import express from "express";
import {
  getPoints,
  addPointsByReferral,
  withdrawPoints,
} from "../controllers/points.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

router.get("/:ambassadorId", verifyToken, getPoints);
router.post("/add", verifyToken, addPointsByReferral);
router.post("/withdraw", verifyToken, withdrawPoints);

export default router;
