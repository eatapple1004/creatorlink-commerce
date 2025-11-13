import express from "express";
import {
  getPoints,
  addPoints,
  withdrawPoints,
} from "../controllers/points.controller.js";
import { verifyToken } from "../middlewares/verifyToken.js";

const router = express.Router();

router.get("/:ambassadorId", verifyToken, getPoints);
router.post("/add", verifyToken, addPoints);
router.post("/withdraw", verifyToken, withdrawPoints);

export default router;
